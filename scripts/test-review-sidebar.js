'use strict';
// Reproduce the preference failure through the real main/preload bridge.
const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(process.env.NOCTURNE_REVIEW_ROOT||path.join(__dirname,'..'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-sidebar-review-'));app.setPath('userData',profile);require(path.join(root,'main.js'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 await app.whenReady();let win;
 for(let i=0;i<200;i++){win=BrowserWindow.getAllWindows()[0];if(win?.isVisible())break;await delay(100);}
 assert.ok(win?.isVisible(),'window ready');
 const js=s=>win.webContents.executeJavaScript(s),boot=()=>js('window.nocturneNotes.bootstrap()');
 const old=(await boot()).sidebarCollapsed,rename=fs.renameSync;
 fs.renameSync=function(from,to){if(to===path.join(profile,'preferences.json'))throw Error('synthetic preference write failure');return rename.call(this,from,to);};
 try{
  await assert.rejects(js('window.nocturneNotes.setSidebarCollapsed('+!old+')'));
  assert.equal((await boot()).sidebarCollapsed,old,'sidebar preference rollback');
 }finally{fs.renameSync=rename;}
 console.log('PASS sidebar preference rollback');
}
run().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1);});
