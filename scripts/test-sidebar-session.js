'use strict';
// Three separate Electron processes share only an isolated, named synthetic project.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){for(let i=0;i<300;i++){if(await fn())return;await delay(30);}throw Error('Timeout: '+label);}
async function child(){
 const {app,BrowserWindow}=require('electron'),profile=process.env.NOCTURNE_SIDEBAR_PROFILE,phase=process.env.NOCTURNE_SIDEBAR_PHASE;
 app.setPath('userData',profile);require('../main');
 await app.whenReady();let win;await wait(()=>{win=BrowserWindow.getAllWindows()[0];return win?.isVisible();},'window');
 const js=s=>win.webContents.executeJavaScript(s),boot=()=>js('window.nocturneNotes.bootstrap()');
 const collapsed=()=>js("document.querySelector('#sidebar').classList.contains('collapsed')");
 const prefsFile=path.join(profile,'preferences.json'),prefs=()=>JSON.parse(fs.readFileSync(prefsFile,'utf8'));
 const ready=()=>js("document.querySelector('#note-title').value==='Sidebar fixture' && !document.querySelector('#note-title').readOnly");
 await wait(ready,'named project loaded');
 const expected=phase==='collapsed';
 async function verify(value){
  await wait(async()=>await collapsed()===value,'visual sidebar state '+value);
  assert.equal((await boot()).sidebarCollapsed,value);assert.equal(prefs().sidebarCollapsed,value);
  assert.equal(await js("document.querySelector('#sidebar-tab').getAttribute('aria-label')===document.querySelector('#sidebar-tab').title"),true);
  assert.equal(await js("document.querySelector('#editor').textContent"),'Sidebar fixture body');
 }
 await verify(expected);
 const burst=n=>js("(()=>{const b=document.querySelector('#sidebar-tab');for(let i=0;i<"+n+";i++)b.click();return document.querySelector('#sidebar').classList.contains('collapsed');})()");
 if(phase==='initial'){
  // All real writes in a burst fail, then the interface must recover without reload.
  const rename=fs.renameSync;let failures=0;
  fs.renameSync=function(from,to){if(to===prefsFile){failures++;throw Error('synthetic sidebar burst write failure');}return rename.call(this,from,to);};
  try{
   assert.equal(await burst(31),true,'immediate optimistic state');
   await boot();await wait(()=>js("!document.querySelector('#toast').hidden && document.querySelector('#toast').textContent==='Could not save settings'"),'localized failure');
   await verify(false);assert.ok(failures>0);
  }finally{fs.renameSync=rename;}
  assert.equal(await burst(31),true);await boot();await verify(true);
  assert.equal(await burst(30),true);await boot();await verify(true);
 }else if(phase==='collapsed'){
  assert.equal(await burst(31),false);await boot();await verify(false);
  // Exercise the existing Ctrl+Backslash binding too.
  await js("document.dispatchEvent(new KeyboardEvent('keydown',{code:'Backslash',key:'\\\\',ctrlKey:true,bubbles:true,cancelable:true}))");
  await boot();await verify(true);
  await js("document.dispatchEvent(new KeyboardEvent('keydown',{code:'Backslash',key:'\\\\',ctrlKey:true,bubbles:true,cancelable:true}))");
  await boot();await verify(false);
 }else assert.equal(phase,'expanded');
 console.log('PASS sidebar session '+phase);
 // A normal close of a named project, not a renderer-only reload.
 await js("document.querySelector('#close-btn').click()");
}
function parent(){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-sidebar-session-')),file=path.join(profile,'sidebar.ns');
 try{
  require('../storage').newProject(file,[{title:'Sidebar fixture',html:'<p>Sidebar fixture body</p>'}]);
  fs.writeFileSync(path.join(profile,'preferences.json'),JSON.stringify({lastProject:file,sidebarCollapsed:false,settings:{restoreLastProject:true,language:'en'}}));
  for(const phase of ['initial','collapsed','expanded']){
   const p=spawnSync(require('electron'),[__filename],{cwd:root,env:{...process.env,NOCTURNE_SIDEBAR_PROFILE:profile,NOCTURNE_SIDEBAR_PHASE:phase},encoding:'utf8',timeout:120000});
   console.log(p.stdout||'');if(p.stderr)console.error(p.stderr);
   assert.ifError(p.error);assert.equal(p.status,0,phase+' failed');assert.ok(p.stdout.includes('PASS sidebar session '+phase),'missing assertion completion marker');
  }
  console.log('PASS sidebar rapid clicks, injected failure, keyboard and persisted collapsed/expanded states across process restarts');
 }finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});}
}
if(process.versions.electron)child().catch(e=>{console.error(e);require('electron').app.exit(1);});else parent();
