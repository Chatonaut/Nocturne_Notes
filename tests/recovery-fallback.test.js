'use strict';
// Simulate missing file IDs on real, disposable files. This is not a FAT/exFAT hardware test.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {ProjectStore,newProject}=require('../storage'),{RecoveryStore}=require('../recovery');
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-no-id-'));try{return fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}}
test('recovery without file ID uses canonical single-link path, isolates copies and replacements',t=>fixture(dir=>{
 const real=path.join(dir,'files'),alias=path.join(dir,'alias');fs.mkdirSync(real);fs.symlinkSync(real,alias,process.platform==='win32'?'junction':'dir');
 const a=path.join(real,'A.ns'),b=path.join(alias,'A.ns'),copy=path.join(real,'Copy.ns'),r=new RecoveryStore(path.join(dir,'recovery'));
 newProject(a);fs.copyFileSync(a,copy);
 const stat=fs.statSync,paths=new Set([a,b,copy]);let birthOffset=0n;
 t.mock.method(fs,'statSync',function(file,options){
  const st=stat.call(this,file,options);
  if(st&&paths.has(file)&&options?.bigint){st.ino=0n;if(file===a||file===b)st.birthtimeNs+=birthOffset;}
  return st;
 });
 let store;
 try{
  store=new ProjectStore(a);const n=store.snapshot().notes[0];store.close();store=null;
  assert.equal(r.location(a),r.location(b));assert.notEqual(r.location(a),r.location(copy));
  r.save(b,{...n,title:'Fallback edit',html:'<p>Fallback edit</p>'});
  store=new ProjectStore(copy);assert.equal(r.restore(store),0);store.close();store=null;
  store=new ProjectStore(a);assert.equal(r.restore(store),1);assert.equal(store.snapshot().notes[0].title,'Fallback edit');assert.equal(r.restore(store),0);store.close();store=null;
  r.save(a,{...n,html:'<p>Pending before replacement</p>'});const old=r.location(a),data=r.load(a),bytes=fs.readFileSync(old);
  birthOffset=1000000000n; // Same path, simulated different file creation time.
  assert.notEqual(r.location(a),old);assert.equal(Object.keys(r.load(a).notes).length,0);
  assert.throws(()=>r.write(a,data),/Файл проекта изменился/);assert.deepEqual(fs.readFileSync(old),bytes);
  r.clearLocation(old);assert.equal(fs.existsSync(old),false);
 }finally{store?.close();t.mock.restoreAll();}
}));
test('recovery without file ID refuses ambiguous links and failed path resolution without changing files',t=>fixture(dir=>{
 const a=path.join(dir,'A.ns'),hard=path.join(dir,'Hard.ns'),r=new RecoveryStore(path.join(dir,'recovery'));
 newProject(a);let store=new ProjectStore(a),n;
 try{n=store.snapshot().notes[0];}finally{store.close();}
 const stat=fs.statSync,native=fs.realpathSync.native;let unknownLinks=false;
 t.mock.method(fs,'statSync',function(file,options){
  const st=stat.call(this,file,options);
  if(st&&(file===a||file===hard)&&options?.bigint){st.ino=0n;if(unknownLinks)st.nlink=0n;}
  return st;
 });
 try{
  r.save(a,{...n,html:'<p>Pending</p>'});const loc=r.location(a),before=fs.readFileSync(loc),project=fs.readFileSync(a),data=r.load(a);
  fs.linkSync(a,hard);
  for(const file of [a,hard]){
   assert.throws(()=>r.load(file),/идентификатор файла проекта/);
   assert.throws(()=>r.save(file,n),/идентификатор файла проекта/);
   assert.throws(()=>r.clearProject(file),/идентификатор файла проекта/);
  }
  fs.unlinkSync(hard);unknownLinks=true;assert.throws(()=>r.location(a),/идентификатор файла проекта/);unknownLinks=false;
  t.mock.method(fs.realpathSync,'native',function(file,...args){if(file===a)throw Error('synthetic realpath failure');return native.call(this,file,...args);});
  assert.throws(()=>r.load(a),/synthetic realpath failure/);assert.throws(()=>r.write(a,data),/synthetic realpath failure/);assert.throws(()=>r.clearProject(a),/synthetic realpath failure/);
  assert.deepEqual(fs.readFileSync(a),project);assert.deepEqual(fs.readFileSync(loc),before);
  assert.deepEqual(fs.readdirSync(r.directory),[path.basename(loc)]);
 }finally{t.mock.restoreAll();}
}));
test('recovery handles a missing path and rejects a directory without creating a sidecar',()=>fixture(dir=>{
 const r=new RecoveryStore(path.join(dir,'recovery')),missing=path.join(dir,'missing.ns');
 assert.equal(r.location(missing),null);assert.equal(r.load(missing).projectKey,null);assert.equal(Object.keys(r.load(missing).notes).length,0);
 r.clearProject(missing);assert.throws(()=>r.save(missing,{id:'synthetic',title:'Missing',html:'<p>Missing</p>'}),/Файл проекта не найден/);
 assert.throws(()=>r.location(dir),/Файл проекта не найден/);assert.equal(fs.existsSync(r.directory),false);
}));
