'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
const profile=process.env.NOCTURNE_INSTANCE_PROFILE;
app.setPath('userData',profile);
require('../main');
if(process.env.NOCTURNE_INSTANCE_FIRST==='1'){
 app.on('second-instance',()=>fs.writeFileSync(path.join(profile,'received'),'yes'));
 app.whenReady().then(()=>{const timer=setInterval(()=>{const w=BrowserWindow.getAllWindows()[0];if(w?.isVisible()){clearInterval(timer);fs.writeFileSync(path.join(profile,'ready'),'yes');}},50);});
}
