'use strict';
const {app,BrowserWindow,session}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-network-'));app.setPath('userData',profile);
const attempts=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(()=>{
 session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{
  attempts.push({url:details.url,resourceType:details.resourceType});callback({cancel:true});
 });
});
require('../main');
async function run(){
 await app.whenReady();let win;
 for(let i=0;i<200;i++){win=BrowserWindow.getAllWindows()[0];if(win?.isVisible())break;await delay(100);}
 assert.ok(win?.isVisible());
 const js=s=>win.webContents.executeJavaScript(s);
 const blocked=await js("fetch('https://example.invalid/nocturne-test').then(()=>false,()=>true)");
 assert.equal(blocked,true);await delay(1000);const defaults=attempts.slice();
 assert.deepEqual(defaults,[],'Default app and CSP must not initiate HTTP/WebSocket requests');
 await js("window.nocturneNotes.updateSettings({spellcheckEnabled:true})");await delay(2000);
 const spelling=attempts.slice(defaults.length);
 await js("window.nocturneNotes.updateSettings({spellcheckEnabled:false})");
 fs.writeFileSync(path.join(__dirname,'../network-evidence.json'),JSON.stringify({defaults,spelling,note:'Requests cancelled by test; optional Chromium dictionary downloads may depend on platform/cache. External links are delegated to the OS.'},null,2));
 console.log('PASS no default HTTP/WebSocket requests; optional spelling attempts:',JSON.stringify(spelling));
}
run().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1);});
