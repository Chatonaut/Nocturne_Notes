'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {ProjectStore,newProject}=require('../storage');
const {valid}=require('../ipc-contract');
test('search offsets address the original Unicode string',()=>{
 const context={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../search.js'),'utf8'),context);
 const hits=(s,q)=>Array.from(context.window.nocturneSearch.hits(s,q));
 assert.deepEqual(hits('İX','x'),[1]);
 assert.deepEqual(hits('АБ аб','аб'),[0,3]);
 assert.deepEqual(hits('a.b A.B','a.b'),[0,4]);
 assert.deepEqual(hits('😀X','x'),[2]);
 assert.deepEqual(hits('a[a]','[a]'),[1]);
});
test('batch replacement commits every note or rolls all of them back',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-batch-')),file=path.join(dir,'project.ns');
 let store;
 try{
  newProject(file,[{title:'first',html:'<p>A</p>'},{title:'second',html:'<p>B</p>'}]);
  store=new ProjectStore(file);const before=store.snapshot().notes;
  const first={id:before[0].id,title:'changed',html:'<p>new</p>'};
  const second={id:before[1].id,title:'changed too',html:'<p>new</p>'};
  assert.ok(valid('update-notes',[first,second]));
  assert.equal(valid('update-notes',[first,first]),false);
  assert.throws(()=>store.updateNotes([first,{...second,id:'missing'}]));
  assert.deepEqual(store.snapshot().notes,before);
  assert.equal(store.updateNotes([first,second]).length,2);
  assert.deepEqual(store.snapshot().notes.map(n=>n.title),['changed','changed too']);
 }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('copy failure does not replace original or target, and removes partial temp',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-fault-')),source=path.join(dir,'a.ns'),target=path.join(dir,'b.ns');
 let store;try{
  newProject(source);newProject(target);store=new ProjectStore(source);
  const before=fs.readFileSync(target),sourceBefore=fs.readFileSync(source);
  store.makeCopy=tmp=>{fs.writeFileSync(tmp,'partial');const e=Error('simulated disk full');e.code='ENOSPC';throw e;};
  assert.throws(()=>store.copyTo(target,{overwrite:true}),/disk full/);
  assert.deepEqual(fs.readFileSync(target),before);assert.deepEqual(fs.readFileSync(source),sourceBefore);
  assert.equal(fs.readdirSync(dir).some(n=>n.endsWith('.tmp')),false);
 }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('a second process cannot open an exclusively locked project',()=>{
 const {spawnSync}=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-cross-process-')),file=path.join(dir,'a.ns');let store;
 try{
  newProject(file);store=new ProjectStore(file);
  const child=spawnSync(process.execPath,['-e',"const {ProjectStore}=require('./storage');try{const s=new ProjectStore(process.argv[1]);s.close();process.exit(2)}catch(e){process.exit(/locked|busy|заблокирован/i.test(e.message)?0:3)}",file],{cwd:path.join(__dirname,'..'),encoding:'utf8',timeout:15000});
  assert.ifError(child.error);assert.equal(child.status,0,child.stderr);
 }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('recovery survives abrupt process exit without an orderly close',()=>{
 const {spawnSync}=require('node:child_process'),{RecoveryStore}=require('../recovery');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-crash-')),file=path.join(dir,'a.ns'),recoveryDir=path.join(dir,'recovery');let store;
 try{
  newProject(file);
  const child=spawnSync(process.execPath,['-e',"const {ProjectStore}=require('./storage');const {RecoveryStore}=require('./recovery');const s=new ProjectStore(process.argv[1]);const n=s.snapshot().notes[0];new RecoveryStore(process.argv[2]).save(s.path,{id:n.id,title:'recovered',html:'<p>before exit</p>'});process.exit(17);",file,recoveryDir],{cwd:path.join(__dirname,'..'),encoding:'utf8',timeout:15000});
  assert.ifError(child.error);assert.equal(child.status,17,child.stderr);store=new ProjectStore(file);
  assert.equal(new RecoveryStore(recoveryDir).restore(store),1);assert.equal(store.snapshot().notes[0].html,'<p>before exit</p>');
 }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('protection cleanup removes only the current project abandoned recovery temps',()=>{
 const {RecoveryStore}=require('../recovery'),crypto=require('node:crypto');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-cleanup-'));
 try{
  const r=new RecoveryStore(dir),a=path.join(dir,'a.ns'),b=path.join(dir,'b.ns');
  newProject(a);newProject(b);
  const old=r.location(a)+'.'+crypto.randomUUID()+'.tmp',other=r.location(b)+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(old,'plaintext');fs.writeFileSync(other,'different project');r.clearProject(a);
  assert.equal(fs.existsSync(old),false);assert.equal(fs.existsSync(other),true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('deep HTML sanitization and plaintext export avoid recursive stack exhaustion',()=>{
 const {sanitizeHTML,plainText,markdown}=require('../html-content');
 const html='<span>'.repeat(3000)+'content'+'</span>'.repeat(3000);
 assert.equal(plainText(html),'content');assert.ok(sanitizeHTML(html).includes('content'));
 assert.throws(()=>markdown(html),/Заметка слишком большая/);
});
test('deterministic hostile HTML and IPC input smoke fuzzing',()=>{
 const {sanitizeHTML}=require('../html-content');
 let seed=20261125;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const fragments=['<p>','<b>','</p>','<a href="javascript:alert(1)">','<img src=x onerror=alert(1)>','<svg><script>x</script></svg>','&amp;','😀','<span style="color:#abc">','</span>','<iframe>x</iframe>','text'];
 for(let i=0;i<128;i++){
  let input='';for(let j=0;j<32;j++)input+=fragments[next()%fragments.length];
  const out=sanitizeHTML(input);
  assert.doesNotMatch(out,/<(?:script|iframe|svg|img)\b|javascript:|onerror=/i);
  assert.equal(valid('update-note',{id:i,title:'x',html:out}),false);
 }
});

test('verified plain copy rejects source aliases but replaces a distinct target',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-copy-identity-')),source=path.join(dir,'a.ns'),target=path.join(dir,'b.ns'),alias=path.join(dir,'alias.ns');
 let store,check;
 try{
  newProject(source,[{title:'source',html:'<p>source data</p>'}]);
  newProject(target,[{title:'target',html:'<p>target data</p>'}]);
  fs.linkSync(source,alias);store=new ProjectStore(source);
  const expected=store.snapshot().notes,sourceBefore=fs.readFileSync(source),targetBefore=fs.readFileSync(target);
  assert.throws(()=>store.copyTo(source,{overwrite:true}),/Выберите другое имя файла/);
  assert.throws(()=>store.copyTo(alias,{overwrite:true}),/Выберите другое имя файла/);
  assert.deepEqual(fs.readFileSync(source),sourceBefore);
  assert.deepEqual(fs.readFileSync(target),targetBefore);
  store.copyTo(target,{overwrite:true});
  assert.deepEqual(fs.readFileSync(source),sourceBefore);
  check=new ProjectStore(target);assert.deepEqual(check.snapshot().notes,expected);
  assert.equal(fs.readdirSync(dir).some(n=>n.endsWith('.tmp')),false);
 }finally{check?.close();store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
