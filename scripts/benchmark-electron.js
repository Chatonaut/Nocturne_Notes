'use strict';
// Shared workload: launch the accepted baseline or the candidate with its own Electron binary
// and an isolated profile. Never read or modify the owner's data.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.NOCTURNE_BENCH_ROOT);
const profile=path.resolve(process.env.NOCTURNE_BENCH_PROFILE);
app.setPath('userData',profile);
const {newProject,ProjectStore}=require(path.join(root,'storage.js'));
const {RecoveryStore}=require(path.join(root,'recovery.js'));
const file=path.join(profile,'benchmark.ns');
const body=Array.from({length:800},(_,i)=>'<p>Строка '+i+' <strong>Тест форматирования</strong> — обычный текст.</p>').join('');
newProject(file,Array.from({length:120},(_,i)=>({title:'Заметка '+i,html:i===0?body:'<p>Текст '+i+'</p>'})));
fs.writeFileSync(path.join(profile,'preferences.json'),JSON.stringify({lastProject:file,settings:{restoreLastProject:true,fontSize:17}}));
require(path.join(root,'main.js'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){for(let i=0;i<150;i++){try{const x=await fn();if(x)return x}catch{}await delay(100);}throw Error('Timeout: '+label);}
const run=async()=>{
 await app.whenReady();
 const win=await wait(()=>BrowserWindow.getAllWindows()[0],'window');
 const js=code=>win.webContents.executeJavaScript(code);
 await wait(()=>win.isVisible(),'visible');
 const timing=await wait(()=>JSON.parse(fs.readFileSync(path.join(profile,'startup-timing.json'),'utf8')),'startup timing');
 await wait(()=>js("document.querySelectorAll('.note-row').length===120"),'notes');
 const workingSetMiB=app.getAppMetrics().reduce((sum,x)=>sum+(x.memory?.workingSetSize||0),0)/1024;
 const measurements=await js(`(()=>{
  const title=document.querySelector('#note-title'),editor=document.querySelector('#editor');
  const last=editor.lastElementChild.firstChild;
  const start=performance.now();
  for(let i=0;i<40;i++){last.appendData('a');editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'a'}));}
  const bodyMs=performance.now()-start;
  const t=performance.now();
  for(let i=0;i<40;i++){title.value='Заметка '+i;title.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'a'}));}
  const titleMs=performance.now()-t;
  last.appendData(' NocturnePerfMarker');editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:' NocturnePerfMarker'}));
  return {bodyMs,titleMs};
 })()`);
 // Recovery remains independent of the primary .ns autosave.
 await wait(()=>{const dir=path.join(profile,'recovery');return fs.readdirSync(dir).some(f=>f.endsWith('.json')&&fs.readFileSync(path.join(dir,f),'utf8').includes('NocturnePerfMarker'));},'recovery draft');
 const searchMs=await js(`(()=>{document.querySelector('#search-toggle').click();const q=document.querySelector('#search-query');const start=performance.now();for(let i=0;i<40;i++){q.value=i%2?'NocturnePerfMarker':'Тест';q.dispatchEvent(new Event('input',{bubbles:true}));}return performance.now()-start;})()`);
 const counter=await js("document.querySelector('#search-counter').textContent");
 assert.match(counter,/1 (?:of|из) 1/);
 // Identical workloads on both versions, including large project-wide results.
 const projectSearch=await js(`(()=>{
  document.querySelector('[data-search-scope=project]').click();
  const q=document.querySelector('#search-query');q.value='Заметка';q.dispatchEvent(new Event('input',{bubbles:true}));
  const before=[...document.querySelectorAll('.note-row')],start=performance.now();
  for(let i=0;i<40;i++){q.value=i%2?'Заметка':'заметка';q.dispatchEvent(new Event('input',{bubbles:true}));}
  const projectSearchMs=performance.now()-start,after=[...document.querySelectorAll('.note-row')];
  return {projectSearchMs,retainedRows:after.filter(x=>before.includes(x)).length,rows:after.length};
 })()`);
 assert.equal(projectSearch.rows,120);
 if(process.env.NOCTURNE_BENCH_REQUIRE_REUSE==='1')assert.equal(projectSearch.retainedRows,120);
 await js("document.querySelector('#search-close').click();document.querySelectorAll('.note-row')[1].click()");
 await wait(()=>js("document.querySelector('#note-title').value==='Заметка 1'"),'note switch');
 const saved=await js("window.nocturneNotes.bootstrap()");
 assert.equal(saved.project.notes[0].title,'Заметка 39');
 assert.match(saved.project.notes[0].html,/NocturnePerfMarker/);
 assert.match(saved.project.notes[0].html,/<strong>/);
 const before=saved.project.notes[1].updatedAt;
 await delay(40);
 await js("window.dispatchEvent(new Event('blur'))");
 await delay(300);
 const after=await js("window.nocturneNotes.bootstrap()");
 const unchangedWrite=after.project.notes[1].updatedAt!==before;
 if(process.env.NOCTURNE_BENCH_CANDIDATE==='1')assert.equal(unchangedWrite,false,'clean note was unnecessarily written');
 // Measure the exact storage and recovery operations changed by the review,
 // after capturing UI/startup/memory measurements so they cannot affect them.
 const backend={};
 for(const encrypted of [false,true]){
  const label=encrypted?'protected':'plain',file=path.join(profile,label+'-bench.ns'),key=encrypted?Buffer.from('synthetic benchmark only'):null;
  const rec=new RecoveryStore(path.join(profile,label+'-recovery'));let db;
  try{
   newProject(file,undefined,key);db=new ProjectStore(file,key);
   const n=db.snapshot().notes[0];let start=performance.now();
   for(let i=0;i<20;i++)db.addNote('Synthetic '+i);
   backend[label+'Create20Ms']=performance.now()-start;
   start=performance.now();
   for(let i=0;i<20;i++){const draft={...n,html:'<p>Recovery '+i+'</p>'};if(encrypted)db.saveProtectedRecovery(draft);else rec.save(file,draft);}
   backend[label+'RecoveryWrite20Ms']=performance.now()-start;
   start=performance.now();assert.equal(rec.restore(db),1);backend[label+'RecoveryRestoreMs']=performance.now()-start;
   assert.equal(db.snapshot().notes.find(x=>x.id===n.id).html,'<p>Recovery 19</p>');
  }finally{db?.close();key?.fill(0);}
 }
 console.log('NOCTURNE_BENCH '+JSON.stringify({...timing,electronVersion:process.versions.electron,workingSetMiB,...measurements,searchMs,...projectSearch,unchangedWrite,...backend}));
};
run().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1)});
