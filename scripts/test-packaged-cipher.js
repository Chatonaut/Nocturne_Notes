'use strict';
// Use the normal hardened packaged main process, not ELECTRON_RUN_AS_NODE.
const {spawnSync}=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs'),{performance}=require('node:perf_hooks');
const targets=['win-unpacked/Nocturne Notes.exe','Nocturne Notes Portable.exe'];
const results=[];
for(const name of targets){
 const exe=path.resolve(__dirname,'../dist',name),start=performance.now();
 const result=spawnSync(exe,['--nocturne-verify-native'],{stdio:'inherit',timeout:180000,windowsHide:true});
 assert.ifError(result.error);assert.equal(result.status,0,'Packaged native diagnostic: '+name);
 results.push({file:name,elapsedMs:Math.round(performance.now()-start),bytes:fs.statSync(exe).size});
}
fs.writeFileSync(path.join(__dirname,'../packaged-native-results.json'),JSON.stringify(results,null,2));
console.log('PASS actual packaged native SQLCipher and portable launcher (synthetic diagnostic, not UI startup)',JSON.stringify(results));
