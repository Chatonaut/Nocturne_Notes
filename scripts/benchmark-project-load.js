'use strict';
// Real Electron editor, isolated generated project. Timings include test IPC and
// two animation-frame callbacks; they are not physical keyboard-to-pixel measurements.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(process.env.NOCTURNE_LOAD_ROOT),profile=path.resolve(process.env.NOCTURNE_LOAD_PROFILE);
const size=Number(process.env.NOCTURNE_LOAD_SIZE),protectedProject=process.env.NOCTURNE_LOAD_PROTECTED==='1';
assert.ok([100,500,1000].includes(size));
const password='synthetic load password only',file=path.join(profile,'load.ns'),{newProject}=require(path.join(root,'storage'));
const token=i=>'UniqueToken'+String(i).padStart(4,'0')+'End';
const initial=Array.from({length:size},(_,i)=>({title:'Bench note '+i,html:'<p>CommonNeedle '+token(i)+' '+('word '.repeat(i===0?10000:400))+'tail</p>'}));
app.setPath('userData',profile);
const key=protectedProject?Buffer.from(password):null;
try{newProject(file,initial,key);}finally{key?.fill(0);}
fs.writeFileSync(path.join(profile,'preferences.json'),JSON.stringify({lastProject:file,sidebarCollapsed:false,settings:{restoreLastProject:true,language:'en',autosaveMs:60000,saveIndicatorsEnabled:true}}));
require(path.join(root,'main.js'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){for(let i=0;i<3000;i++){if(await fn())return;await delay(15);}throw Error('Timeout: '+label);}
const percentile=(v,p)=>v.slice().sort((a,b)=>a-b)[Math.max(0,Math.ceil(v.length*p)-1)];
const hash=notes=>crypto.createHash('sha256').update(JSON.stringify(notes.map(({id,title,html})=>({id,title,html})))).digest('hex');
async function run(){
 await app.whenReady();let win;await wait(()=>{win=BrowserWindow.getAllWindows()[0];return win?.isVisible();},'visible window');
 const js=s=>win.webContents.executeJavaScript(s),boot=()=>js('window.nocturneNotes.bootstrap()');
 const frames=()=>js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
 const ready=()=>js("!document.querySelector('#note-title').readOnly && !document.querySelector('#note-title').disabled && document.querySelector('#dialog-backdrop').hidden");
 let unlockMs=0;
 if(protectedProject){
  await wait(()=>js("!!document.querySelector('#password-current') && !document.querySelector('#dialog-backdrop').hidden"),'password dialog');
  const start=performance.now();
  await js("document.querySelector('#password-current').value="+JSON.stringify(password)+";document.querySelector('#dialog-confirm').click()");
  await wait(ready,'unlock');unlockMs=performance.now()-start;
 }
 await wait(async()=>await ready()&&await js("document.querySelectorAll('.note-row').length==="+size),'all notes loaded');
 const first=(await boot()).project;assert.equal(first.encrypted,protectedProject);assert.equal(first.notes.length,size);
 assert.deepEqual(first.notes.map(({title,html})=>({title,html})),initial);
 const expected=first.notes.map(n=>({...n}));
 const input=[],search=[],switching=[],memory=[];
 const sample=()=>{const workingSetMiB=app.getAppMetrics().reduce((s,p)=>s+(p.memory?.workingSetSize||0),0)/1024;assert.ok(workingSetMiB>0);memory.push({elapsedMs:performance.now()-started,workingSetMiB});};
 const started=performance.now(),rounds=size===1000?12:3,events=size===1000?24:12;
 win.focus();await frames();sample();
 for(let round=0;round<rounds;round++){
  const index=(round*137)%size,n=expected[index],start=performance.now();
  await js("document.querySelectorAll('.note-row')["+index+"].click()");
  await wait(async()=>await ready()&&await js("document.querySelector('.note-row.active')?.dataset.id==="+JSON.stringify(n.id)),'switch '+index);
  await frames();if(round>0)switching.push(performance.now()-start);
  assert.equal(await js("document.querySelector('#note-title').value"),n.title);
  await js("(()=>{const e=document.querySelector('#editor');e.focus();const range=document.createRange();range.selectNodeContents(e.lastElementChild);range.collapse(false);const s=window.getSelection();s.removeAllRanges();s.addRange(range);})()");
  // Actual Chromium text insertion through Electron, not manually dispatched input handlers.
  for(let i=0;i<events;i++){
   const t=performance.now();await win.webContents.insertText('x');await frames();input.push(performance.now()-t);
   await delay(size===1000?75:20);
  }
  const suffix='x'.repeat(events);assert.ok((await js("document.querySelector('#editor').textContent")).endsWith('tail'+suffix),'all inserted characters present');
  n.html=n.html.slice(0,-4)+suffix+'</p>';
  assert.equal(await js("document.querySelector('.note-row.active .note-save-dot')?.dataset.status"),'pending');
  await delay(600); // Allow the ordinary recovery timer to fire between edit bursts.
  await js("document.querySelector('#search-toggle').click();document.querySelector('[data-search-scope=project]').click()");
  for(const [query,count] of [['CommonNeedle',size],[token(index),1],['NoSuchSyntheticNeedle',0],['commonneedle',size]]){
   const t=performance.now();
   await js("(()=>{const q=document.querySelector('#search-query');q.value="+JSON.stringify(query)+";q.dispatchEvent(new Event('input',{bubbles:true}));})()");
   await frames();search.push(performance.now()-t);
   const result=await js("({counter:document.querySelector('#search-counter').textContent,rows:document.querySelectorAll('.note-row').length})");
   assert.equal(result.rows,count,'project search row count for '+query);assert.ok(result.counter.endsWith(' of '+count),'search match count '+result.counter);
  }
  await js("document.querySelector('#search-close').click()");
  assert.equal(await js("document.querySelectorAll('.note-row').length"),size);
  sample();
 }
 await js("window.dispatchEvent(new Event('blur'))");
 await wait(()=>js("document.querySelector('.note-row.active .note-save-dot')?.dataset.status==='saved'"),'last edit committed');
 const final=(await boot()).project,expectedHash=hash(expected);
 assert.equal(hash(final.notes),expectedHash,'all edited and untouched notes match expected content');
 assert.equal(final.activeId,expected[(rounds-1)*137%size].id);
 const report={size,protectedProject,electronVersion:process.versions.electron,rounds,events,elapsedMs:performance.now()-started,unlockMs,input,search,switching,memory,expectedHash,activeId:final.activeId,
  metrics:{inputP50Ms:percentile(input,0.5),inputP95Ms:percentile(input,0.95),searchP50Ms:percentile(search,0.5),searchP95Ms:percentile(search,0.95),switchP50Ms:percentile(switching,0.5),switchP95Ms:percentile(switching,0.95),memoryStartMiB:memory[0].workingSetMiB,memoryEndMiB:memory.at(-1).workingSetMiB,memoryPeakMiB:Math.max(...memory.map(x=>x.workingSetMiB))}};
 console.log('NOCTURNE_PROJECT_LOAD '+JSON.stringify(report));
}
run().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1);});
