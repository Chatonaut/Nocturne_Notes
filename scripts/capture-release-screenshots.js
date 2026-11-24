'use strict';
// Real renderer screenshots from the accepted Electron app, with synthetic notes.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-release-shot-'));
app.setPath('userData',profile);
const {newProject}=require('../storage');
const project=path.join(profile,'Writing Desk.ns');
newProject(project,[
 {title:'A quiet space',html:'<h1>Make room for ideas.</h1><p>Nocturne Notes is a quiet place for writing, thinking and organizing the things that matter.</p><p>Keep your thoughts together in a local project. Write freely, revisit ideas and refine them at your own pace.</p><h3>Today</h3><ul><li>Capture a new idea</li><li>Review the reading list</li><li>Make time for focused writing</li></ul><p><em>Less noise. More clarity.</em></p>'},
 {title:'Ideas',html:'<p>Collect thoughts here.</p>'},
 {title:'Reading list',html:'<p>Books and articles to revisit.</p>'},
 {title:'Projects',html:'<p>Plan the next step.</p>'}
]);
fs.writeFileSync(path.join(profile,'preferences.json'),JSON.stringify({lastProject:project,settings:{language:'en',restoreLastProject:true,sidebarWidth:240}}));
require('../main');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){for(let i=0;i<150;i++){try{const r=await fn();if(r)return r;}catch{}await delay(100);}throw Error('Timeout: '+label);}
async function run(){
 await app.whenReady();
 const win=await wait(()=>BrowserWindow.getAllWindows()[0],'window');
 const js=s=>win.webContents.executeJavaScript(s);
 await wait(()=>win.isVisible(),'first frame');
 win.setSize(1100,790);
 await wait(()=>js("document.querySelectorAll('.note-row').length===4 && document.querySelector('#editor').textContent.includes('Make room for ideas')"),'sample notes');
 await js('document.fonts.ready.then(()=>true)');await delay(300);
 const output=path.resolve(__dirname,'../dist');fs.mkdirSync(output,{recursive:true});
 async function capture(name){const image=await win.webContents.capturePage();if(image.isEmpty())throw Error('Empty screenshot: '+name);fs.writeFileSync(path.join(output,name),image.toPNG());console.log('Captured '+name+' '+JSON.stringify(image.getSize()));}
 await capture('Nocturne-Notes-Editor.png');
 await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=settings]').click()");
 await wait(()=>js("!document.querySelector('#dialog-backdrop').hidden && !!document.querySelector('#setting-tray')"),'settings dialog');
 await delay(300);await capture('Nocturne-Notes-Settings.png');
}
run().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1);});
