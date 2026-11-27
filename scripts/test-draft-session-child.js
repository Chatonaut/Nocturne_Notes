'use strict';
const {app,BrowserWindow,dialog}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {checkDialogButtons}=require('./check-dialog-alignment');
const profile=process.env.NOCTURNE_DRAFT_TEST_PROFILE,phase=process.env.NOCTURNE_DRAFT_TEST_PHASE;
if(!profile||!['interrupt','recover','discard','empty'].includes(phase))throw Error('Isolated draft test required');
app.setPath('userData',profile);require('../main');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){for(let i=0;i<250;i++){try{if(await fn())return;}catch{}await delay(80);}throw Error('Timeout '+label);}
async function run(){
 await app.whenReady();let win;await wait(()=>{win=BrowserWindow.getAllWindows()[0];return win?.isVisible();},'visible');
 const js=code=>win.webContents.executeJavaScript(code),boot=()=>js('window.nocturneNotes.bootstrap()');
 const input=html=>js("(()=>{const e=document.querySelector('#editor');e.innerHTML="+JSON.stringify(html)+";e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));window.dispatchEvent(new Event('blur'));})()");
 const ready=()=>js("!document.querySelector('#note-title').readOnly&&document.querySelector('#dialog-backdrop').hidden");
 const newProject=()=>js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=new-project]').click()");
 const close=()=>js("document.querySelector('#close-btn').click()");
 const prompt=async()=>{await wait(()=>js("!!document.querySelector('#dialog-discard')&&!document.querySelector('#dialog-backdrop').hidden"),'draft warning');await checkDialogButtons(js);};
 const click=id=>js("document.querySelector("+JSON.stringify('#'+id)+").click()");
 const initial=(await boot()).project;
 if(phase==='interrupt'){
  assert.equal(initial.isDraft,true);
  await input('<p>INTERRUPTED DRAFT</p>');await wait(async()=> (await boot()).project.notes[0].html==='<p>INTERRUPTED DRAFT</p>','persisted interrupted draft');
  await js("window.nocturneNotes.updateSettings({restoreLastProject:false})");
  // Bypass the close handshake deliberately: process termination, not a clean exit.
  app.exit(17);return;
 }
 // Keep the runner alive until the parent has a deterministic process exit code.
 app.on('before-quit',event=>event.preventDefault());
 if(phase==='empty'){
  assert.equal(initial.isDraft,true);assert.equal(initial.notes[0].html,'<p></p>');
  await close();await wait(()=>win.isDestroyed(),'empty close without warning');assert.equal(fs.existsSync(initial.path),false);return;
 }
 if(phase==='discard'){
  assert.equal(initial.isDraft,true);
  await input('<p>DISCARD THIS</p>');
  await close();await prompt();await click('dialog-discard');
  await wait(()=>win.isDestroyed(),'explicit discard close');assert.equal(fs.existsSync(initial.path),false);return;
 }
 assert.equal(initial.isDraft,true);assert.equal(initial.notes[0].html,'<p>INTERRUPTED DRAFT</p>');
 await close();await prompt();
 const g=await js(`(()=>{const d=document.querySelector('.glass-dialog'),m=document.querySelector('#dialog-message'),b=document.querySelector('.dialog-buttons'),r=e=>e.getBoundingClientRect();return {text:m.textContent,gap:r(b).top-r(m).bottom,width:r(d).width,heights:[...b.querySelectorAll('button:not([hidden])')].map(x=>r(x).height),buttons:[...b.querySelectorAll('button:not([hidden])')].map(x=>x.textContent)};})()`);
 assert.equal(g.text,'The project has not been saved. Unsaved data will be lost when closed');assert.deepEqual(g.buttons,['Cancel',"Don't save",'Save']);
 assert.ok(Math.abs(g.gap-22)<=1&&g.heights.every(h=>Math.abs(h-35)<=0.1)&&g.width<=510,'draft dialog geometry '+JSON.stringify(g));
 await click('dialog-cancel');await wait(ready,'cancel close');assert.equal((await boot()).project.path,initial.path);assert.ok(fs.existsSync(initial.path));
 // Test the approved Russian wording and layout, then return to English.
 const language=async value=>{await js("window.nocturneNotes.updateSettings("+JSON.stringify({language:value})+")");const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;await wait(()=>js("document.documentElement.lang==="+JSON.stringify(value)+" && !!document.querySelector('.note-row.active')"),'locale '+value);};
 await language('ru');await close();await prompt();
 assert.equal(await js("document.querySelector('#dialog-message').textContent"),'Проект не сохранен. При закрытии несохраненные данные будут потеряны');
 assert.deepEqual(await js("[...document.querySelectorAll('.dialog-buttons button:not([hidden])')].map(x=>x.textContent)"),['Отмена','Не сохранять','Сохранить']);
 await click('dialog-cancel');await wait(ready,'Russian cancel');await language('en');
 dialog.showSaveDialog=async()=>({canceled:true});
 await close();await prompt();await click('dialog-confirm');await wait(ready,'cancel Save As');assert.equal((await boot()).project.path,initial.path);assert.ok(fs.existsSync(initial.path));
 // A cancelled open picker must not remove or prompt for the draft.
 dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});
 await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=open-project]').click()");
 await wait(ready,'cancel Open');assert.ok(fs.existsSync(initial.path));
 // Choosing discard does not delete the source until the new target is valid.
 const invalid=path.join(profile,'invalid.ns');fs.writeFileSync(invalid,'not a project');
 dialog.showOpenDialog=async()=>({canceled:false,filePaths:[invalid]});
 await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=open-project]').click()");
 await prompt();await click('dialog-discard');await wait(ready,'invalid open rejected');assert.equal((await boot()).project.path,initial.path);assert.ok(fs.existsSync(initial.path));
 await newProject();await prompt();await click('dialog-discard');
 await wait(async()=> (await boot()).project.path!==initial.path&&await ready(),'new empty project');assert.equal(fs.existsSync(initial.path),false);
 const draft=(await boot()).project.path;
 for(let count=2;count<=3;count++){await click('add-note');await wait(()=>js("document.querySelectorAll('.note-row').length==="+count+"&&!document.querySelector('#note-title').readOnly"),'new note '+count);}
 const ids=(await boot()).project.notes.map(n=>n.id),pin=ids[1];
 await js("document.querySelectorAll('.note-row')[1].click()");await wait(async()=> (await boot()).project.activeId===pin&&await ready(),'select middle note');
 const context=()=>js("document.querySelector('[data-id="+JSON.stringify(pin)+"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:100,clientY:150}))");
 await context();
 assert.equal(await js("document.querySelector('[data-note-action=duplicate]').nextElementSibling.dataset.noteAction"),'pin-note');
 const menuIcon=await js("document.querySelector('[data-note-action=pin-note] path').getAttribute('d')");
 await js("document.querySelector('[data-note-action=pin-note]').click()");
 await wait(()=>js("!!document.querySelector('.note-row.active .note-bookmark')&&!document.querySelector('#note-title').readOnly"),'pin persisted');
 const grouped=[pin,ids[0],ids[2]];
 assert.deepEqual((await boot()).project.notes.map(n=>n.id),grouped);
 const groupLayout=await js(`(()=>{const list=document.querySelector('#note-list'),divider=list.querySelector('.pinned-divider');return {order:[...list.querySelectorAll('.note-row')].map(n=>n.dataset.id),before:divider.previousElementSibling.dataset.id,after:divider.nextElementSibling.dataset.id,height:divider.getBoundingClientRect().height};})()`);
 assert.deepEqual(groupLayout,{order:grouped,before:pin,after:ids[0],height:1});
 const icon=await js(`(()=>{const p=document.querySelector('.note-row.active .note-bookmark'),s=p.querySelector('svg'),r=s.getBoundingClientRect();return {path:s.querySelector('path').getAttribute('d'),w:r.width,h:r.height,next:p.nextElementSibling?.className,color:getComputedStyle(p).color,drag:p.parentElement.draggable};})()`);
 assert.deepEqual(icon,{path:menuIcon,w:14,h:14,next:'note-save-dot',color:'rgb(178, 178, 185)',drag:false});
 await context();assert.equal(await js("document.querySelector('[data-note-action=pin-note] span').textContent"),'Unpin');
 await js("document.querySelector('.note-row.active').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:innerWidth-1,clientY:innerHeight-1}))");
 assert.ok(await js("(()=>{const r=document.querySelector('#note-menu').getBoundingClientRect(),w=document.querySelector('#window').getBoundingClientRect();return r.right<=w.right&&r.bottom<=w.bottom&&r.left>=w.left&&r.top>=w.top;})()"),'context menu fits bottom-right corner');
 assert.equal(await js("document.querySelector('[data-note-action=pin-note] path').getAttribute('d')"),menuIcon);
 assert.ok(await js("['move-up','move-down','delete'].every(a=>document.querySelector('[data-note-action='+a+']').disabled)"));
 await assert.rejects(js("window.nocturneNotes.deleteNote("+JSON.stringify(pin)+")"));
 await assert.rejects(js("window.nocturneNotes.reorderNotes("+JSON.stringify([ids[2],pin,ids[0]])+")"));
 await js("document.querySelector('[data-note-action=pin-note]').click()");
 await wait(()=>js("!document.querySelector('.note-row.active .note-bookmark')&&!document.querySelector('#note-title').readOnly"),'unpin');
 assert.equal(await js("document.querySelectorAll('.pinned-divider').length"),0);
 assert.deepEqual((await boot()).project.notes.map(n=>n.id),grouped);
 await context();await js("document.querySelector('[data-note-action=pin-note]').click()");
 await wait(()=>js("!!document.querySelector('.note-row.active .note-bookmark')&&!document.querySelector('#note-title').readOnly"),'repin');
 // Ordinary notes can swap freely below the pinned prefix via the real menu.
 await js("document.querySelectorAll('.note-row')[2].dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:100,clientY:150}))");
 assert.equal(await js("document.querySelector('[data-note-action=move-up]').disabled"),false);
 await js("document.querySelector('[data-note-action=move-up]').click()");
 const finalOrder=[pin,ids[2],ids[0]];
 await wait(async()=>JSON.stringify((await boot()).project.notes.map(n=>n.id))===JSON.stringify(finalOrder)&&await ready(),'ordinary reorder below pins');
 await language('ru');await context();
 assert.equal(await js("document.querySelector('[data-note-action=pin-note] span').textContent"),'Открепить');
 const russianMenu=await js(`(()=>{const m=document.querySelector('#note-menu'),r=m.getBoundingClientRect();return {width:r.width,labels:[...m.querySelectorAll('.context-label')].every(x=>x.scrollWidth<=x.clientWidth+1),f2:!!m.querySelector('kbd')};})()`);
 assert.ok(russianMenu.width>0&&russianMenu.labels&&!russianMenu.f2,'Russian adaptive menu '+JSON.stringify(russianMenu));
 await language('en');
 const target=path.join(profile,'saved.ns');dialog.showSaveDialog=async()=>({canceled:false,filePath:target});
 await close();await prompt();await click('dialog-confirm');await wait(()=>win.isDestroyed(),'save and close');
 assert.equal(fs.existsSync(draft),false);assert.ok(fs.existsSync(target));
 const {ProjectStore}=require('../storage'),saved=new ProjectStore(target);
 try{assert.equal(saved.snapshot().notes.find(n=>n.id===pin).pinned,true);assert.deepEqual(saved.snapshot().notes.map(n=>n.id),finalOrder);}finally{saved.close();}
}
run().then(()=>{if(phase!=='interrupt')app.exit(0);}).catch(e=>{console.error(e);app.exit(1);});
