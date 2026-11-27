'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(process.env.NOCTURNE_REVIEW_ROOT||path.join(__dirname,'..'));
const {ProjectStore,newProject,assertReplaceable}=require(path.join(root,'storage'));
const {RecoveryStore}=require(path.join(root,'recovery'));
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-review-'));try{return fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}}
function atomic(dir,password=null){
 const file=path.join(dir,'project.ns');newProject(file,undefined,password);let s=new ProjectStore(file,password);
 try{
  const before=s.snapshot(),setMeta=s.setMeta;
  s.setMeta=()=>{throw Error('synthetic active-note write failure');};
  assert.throws(()=>s.addNote('Not committed'),/synthetic active-note write failure/);
  assert.deepEqual(s.snapshot(),before,'atomic note creation rollback');
  s.close();s=new ProjectStore(file,password);
  assert.deepEqual(s.snapshot(),before,'rollback survives reopen');
  s.setMeta=setMeta;const note=s.addNote('Committed');
  assert.equal(s.snapshot().notes.length,before.notes.length+1);assert.equal(s.snapshot().activeId,note.id);
 }finally{s.close();}
}
test('review: atomic ordinary note creation',()=>fixture(dir=>atomic(dir)));
test('review: atomic protected note creation',()=>fixture(dir=>{const key=Buffer.from('synthetic atomic password');try{atomic(dir,key);}finally{key.fill(0);}}));
test('review: alias crash recovery',()=>fixture(dir=>{
 const files=path.join(dir,'files'),junction=path.join(dir,'junction');fs.mkdirSync(files);
 const original=path.join(files,'Project.ns'),alias=path.join(junction,'Project.ns'),hard=path.join(files,'Hard.ns'),copy=path.join(files,'Copy.ns');
 newProject(original,[{title:'Before',html:'<p>Before</p>'}]);
 fs.symlinkSync(files,junction,process.platform==='win32'?'junction':'dir');fs.linkSync(original,hard);fs.copyFileSync(original,copy);
 const recoveryDir=path.join(dir,'recovery'),r=new RecoveryStore(recoveryDir);
 const child=spawnSync(process.execPath,['-e',"const {ProjectStore}=require('./storage');const {RecoveryStore}=require('./recovery');const s=new ProjectStore(process.argv[1]);const n=s.snapshot().notes[0];new RecoveryStore(process.argv[2]).save(s.path,{id:n.id,title:'Recovered',html:'<p>before crash</p>'});process.exit(17);",original,recoveryDir],{cwd:root,encoding:'utf8',timeout:30000});
 assert.ifError(child.error);assert.equal(child.status,17,child.stderr);
 let s;
 try{
  s=new ProjectStore(copy);assert.equal(r.restore(s),0,'identical byte copy must not inherit recovery');assert.equal(s.snapshot().notes[0].title,'Before');s.close();s=null;
  s=new ProjectStore(alias);assert.equal(r.restore(s),1,'recovery must follow the junction after crash');assert.equal(s.snapshot().notes[0].html,'<p>before crash</p>');assert.equal(r.restore(s),0);
  const note=s.snapshot().notes[0];r.save(alias,{...note,title:'Hard link edit',html:'<p>Hard link edit</p>'});s.close();s=null;
  s=new ProjectStore(hard);assert.equal(r.restore(s),1);assert.equal(s.snapshot().notes[0].title,'Hard link edit');
  r.save(hard,{...note,title:'Renamed edit',html:'<p>Renamed edit</p>'});s.close();s=null;
  const renamed=path.join(files,'Renamed.ns');fs.renameSync(original,renamed);
  const spelling=process.platform==='win32'?path.join(files,'RENAMED.NS'):renamed;
  s=new ProjectStore(spelling);assert.equal(r.restore(s),1);assert.equal(s.snapshot().notes[0].title,'Renamed edit');
  assert.equal(r.location(spelling),r.location(hard));assert.notEqual(r.location(spelling),r.location(copy));
  assert.equal(r.restore(s),0);
 }finally{s?.close();}
}));
test('review: cleanup identity and replacement isolation',()=>fixture(dir=>{
 const a=path.join(dir,'a.ns'),b=path.join(dir,'b.ns'),old=path.join(dir,'old.ns'),r=new RecoveryStore(path.join(dir,'recovery'));
 newProject(a);fs.copyFileSync(a,b);let s=new ProjectStore(a);
 const note=s.snapshot().notes[0];r.save(a,{...note,html:'<p>private pending edit</p>'});s.close();s=null;
 r.save(b,{...note,html:'<p>independent edit</p>'});
 const aRecovery=r.location(a),bRecovery=r.location(b),temp=aRecovery+'.'+crypto.randomUUID()+'.tmp';
 fs.writeFileSync(temp,'private pending edit');
 fs.renameSync(a,old);fs.copyFileSync(b,a);
 assert.notEqual(r.location(a),aRecovery);assert.notEqual(r.location(a),bRecovery);
 try{s=new ProjectStore(a);assert.equal(r.restore(s),0);}finally{s?.close();}
 r.clearLocation(aRecovery);assert.equal(fs.existsSync(aRecovery),false);assert.equal(fs.existsSync(temp),false);assert.equal(fs.existsSync(bRecovery),true);
}));
test('review: hard-linked destination cannot be replaced',()=>fixture(dir=>{
 const a=path.join(dir,'a.ns'),hard=path.join(dir,'hard.ns'),source=path.join(dir,'source.ns');
 newProject(a);newProject(source);fs.linkSync(a,hard);const before=fs.readFileSync(a),s=new ProjectStore(source);
 try{assert.throws(()=>assertReplaceable(a),/жесткими ссылками/);assert.throws(()=>s.copyTo(a,{overwrite:true}),/жесткими ссылками/);assert.deepEqual(fs.readFileSync(a),before);assert.deepEqual(fs.readFileSync(hard),before);}
 finally{s.close();}
}));
