'use strict';
// The official Electron npm CLI waits for its child process's close event and
// propagates its real exit status. Test this before expensive native compilation.
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const cli=process.env.NOCTURNE_ELECTRON_CLI||require.resolve('electron/cli.js');
for(const expected of [0,17]){
 const code='setTimeout(()=>{console.log("NOCTURNE_LAUNCH_EXIT_"+'+expected+');process.exit('+expected+');},750)';
 const result=spawnSync(process.execPath,[cli,'-e',code],{
  env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},encoding:'utf8',timeout:30000,windowsHide:true
 });
 assert.ifError(result.error);
 assert.equal(result.signal,null);
 assert.equal(result.status,expected,'Electron CLI exit status; stderr: '+result.stderr);
 assert.ok(result.stdout.includes('NOCTURNE_LAUNCH_EXIT_'+expected),'Missing delayed completion marker: '+result.stdout);
 console.log('PASS Electron CLI waited for delayed completion and returned '+expected);
}
