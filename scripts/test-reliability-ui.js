'use strict';
const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-reliability-ui-'));app.setPath('userData',profile);require('../main');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){for(let i=0;i<250;i++){if(await fn())return;await delay(80);}throw Error('Timeout '+label);}
async function run(){
 await app.whenReady();let win;await wait(()=>{win=BrowserWindow.getAllWindows()[0];return win?.isVisible();},'visible');
 const js=code=>win.webContents.executeJavaScript(code),boot=()=>js('window.nocturneNotes.bootstrap()');
 const first=(await boot()).project.activeId;
 await js("document.querySelector('#add-note').click()");
 await wait(()=>js("document.querySelectorAll('.note-row').length===2 && !document.querySelector('#note-title').readOnly"),'new note');
 const second=(await boot()).project.activeId;
 assert.notEqual(first,second);
 assert.equal((await boot()).project.notes.find(n=>n.id===second).html,'<p></p>');
 assert.equal(await js("document.querySelector('.note-row.active .note-save-dot')?.dataset.status"),'saved','new empty note is committed');
 assert.equal(await js("document.querySelector('.note-row.active .note-save-dot')?.title"),'Saved');
 const transition=await js("(()=>{const e=document.querySelector('#editor');e.innerHTML='<p>SWITCH MARKER</p>';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));document.querySelectorAll('.note-row')[0].click();const allowed=e.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertText',data:'x'}));return {frozen:e.contentEditable==='false',allowed};})()");
 assert.deepEqual(transition,{frozen:true,allowed:false});
 await wait(()=>js("document.querySelector('.note-row.active').dataset.id==="+JSON.stringify(first)+" && !document.querySelector('#note-title').readOnly"),'first note ready');
 assert.equal((await boot()).project.notes.find(n=>n.id===second).html,'<p>SWITCH MARKER</p>');
 await js("(()=>{const e=document.querySelector('#editor');e.innerHTML='<p>TARGET FIRST</p>';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));document.querySelectorAll('.note-row')[1].click();})()");
 await wait(()=>js("document.querySelector('.note-row.active').dataset.id==="+JSON.stringify(second)+" && !document.querySelector('#note-title').readOnly"),'second note ready');
 assert.equal((await boot()).project.notes.find(n=>n.id===first).html,'<p>TARGET FIRST</p>');
 await js("(()=>{const e=document.querySelector('#editor');e.innerHTML='<p>TARGET SECOND</p>';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));document.querySelector('#search-toggle').click();document.querySelector('[data-search-scope=project]').click();const q=document.querySelector('#search-query');q.value='TARGET';q.dispatchEvent(new Event('input',{bubbles:true}));const r=document.querySelector('#search-replacement');r.value='REPLACED';document.querySelector('#search-replace-all').click();})()");
 await wait(async()=>{const p=(await boot()).project;return p.notes.every(n=>n.html.includes('REPLACED'))&&await js("!document.querySelector('#note-title').readOnly");},'atomic UI replacement');
 await js("document.querySelector('#search-close').click();document.querySelector('#edit-undo').click()");
 await wait(()=>js("document.querySelector('#editor').textContent==='TARGET SECOND'"),'undo replacement');
 await js("window.dispatchEvent(new Event('blur'))");
 await wait(async()=> (await boot()).project.notes.find(n=>n.id===second).html==='<p>TARGET SECOND</p>','undo persisted');
 await js("(()=>{const e=document.querySelector('#editor');e.innerHTML='<p>INDICATOR MARKER</p>';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));})()");
 assert.equal(await js("document.querySelector('.note-row.active .note-save-dot')?.dataset.status"),'pending');
 await js("window.dispatchEvent(new Event('blur'))");
 await wait(()=>js("document.querySelector('.note-row.active .note-save-dot')?.dataset.status==='saved'"),'save indicator returns to saved');
 assert.equal((await boot()).project.notes.find(n=>n.id===second).html,'<p>INDICATOR MARKER</p>');
 // A committed trash operation must not report failure due to sidecar cleanup.
 const {RecoveryStore}=require('../recovery'),recovery=new RecoveryStore(path.join(profile,'recovery'));
 const originalRemove=RecoveryStore.prototype.remove;
 const beforeTrash=(await boot()).project;
 recovery.save(beforeTrash.path,{id:first,title:'STALE RECOVERY',html:'<p>STALE RECOVERY</p>'});
 await assert.rejects(js("window.nocturneNotes.restoreTrash("+JSON.stringify(first)+")"));
 assert.equal(recovery.load(beforeTrash.path).notes[first].html,'<p>STALE RECOVERY</p>','invalid restore cannot erase a live note recovery');
 RecoveryStore.prototype.remove=function(file,id){if(id===first)throw Error('synthetic recovery cleanup failure');return originalRemove.call(this,file,id);};
 try{
  const deleted=await js("window.nocturneNotes.deleteNote("+JSON.stringify(first)+")");
  assert.ok(!deleted.notes.some(n=>n.id===first));assert.ok((await js("window.nocturneNotes.listTrash()")).some(n=>n.id===first));
  await assert.rejects(js("window.nocturneNotes.restoreTrash("+JSON.stringify(first)+")"));
  assert.ok(!(await boot()).project.notes.some(n=>n.id===first));
 }finally{RecoveryStore.prototype.remove=originalRemove;}
 const restored=await js("window.nocturneNotes.restoreTrash("+JSON.stringify(first)+")");
 assert.equal(restored.notes.find(n=>n.id===first).html,'<p>REPLACED FIRST</p>');
 assert.equal(Object.hasOwn(recovery.load(restored.path).notes,first),false);
 await js("window.nocturneNotes.selectNote("+JSON.stringify(second)+")");
 const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;
 await wait(()=>js("document.querySelector('#editor').textContent==='INDICATOR MARKER'"),'renderer restored after recovery cleanup checks');
 // A failed preference write must leave live and persisted settings unchanged.
 const oldSettings=(await boot()).settings,rename=fs.renameSync;
 fs.renameSync=function(from,to){if(to===path.join(profile,'preferences.json'))throw Error('synthetic preference write failure');return rename.call(this,from,to);};
 try{
  await assert.rejects(js("window.nocturneNotes.updateSettings({autosaveMs:1200000})"));
  assert.deepEqual((await boot()).settings,oldSettings);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'),'utf8')).settings,oldSettings);
  const before=await boot();
  await assert.rejects(js('window.nocturneNotes.setSidebarCollapsed('+!before.sidebarCollapsed+')'));
  assert.equal((await boot()).sidebarCollapsed,before.sidebarCollapsed,'sidebar preference rollback');
  await js("document.querySelector('#sidebar-tab').click()");
  await wait(()=>js("!document.querySelector('#toast').hidden && document.querySelector('#toast').textContent==='Could not save settings'"),'sidebar failure toast');
  assert.equal(await js("document.querySelector('#sidebar').classList.contains('collapsed')"),before.sidebarCollapsed,'sidebar visual rollback');
 }finally{fs.renameSync=rename;}
 const sidebarBefore=(await boot()).sidebarCollapsed;
 await js("document.querySelector('#sidebar-tab').click()");
 await wait(async()=> (await boot()).sidebarCollapsed!==sidebarBefore,'sidebar saves after failure');
 assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'),'utf8')).sidebarCollapsed,!sidebarBefore);
 await js("document.querySelector('#sidebar-tab').click()");
 await wait(async()=> (await boot()).sidebarCollapsed===sidebarBefore,'sidebar restored after test');
 const {ipcMain}=require('electron');
 // Test-only failure injection after exercising the real handler; no production changes.
 ipcMain.removeHandler('update-note');ipcMain.handle('update-note',()=>{throw Error('simulated disk full');});
 await js("(()=>{const e=document.querySelector('#editor');e.innerHTML='<p>RECOVERABLE INDICATOR FAILURE</p>';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));window.dispatchEvent(new Event('blur'));})()");
 await wait(()=>js("document.querySelector('.note-row.active .note-save-dot')?.dataset.status==='error'"),'failed save indicator');
 const snapshot=(await boot()).project;
 assert.equal(snapshot.notes.find(n=>n.id===second).html,'<p>INDICATOR MARKER</p>');
 assert.equal(recovery.load(snapshot.path).notes[second].html,'<p>RECOVERABLE INDICATOR FAILURE</p>');
 console.log('PASS rapid edit/switch, guarded transition, batch replacement, undo and persistence; empty/pending/saved/error indicators and recovery');
}
run().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1);});
