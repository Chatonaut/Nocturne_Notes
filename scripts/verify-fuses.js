'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {getCurrentFuseWire,FuseV1Options}=require('@electron/fuses');
(async()=>{
 const file=path.join(__dirname,'../dist/win-unpacked/Nocturne Notes.exe');
 const wire=await getCurrentFuseWire(file);
 // Electron fuse state bytes are ASCII '0' (disabled) and '1' (enabled).
 for(const key of ['RunAsNode','EnableNodeOptionsEnvironmentVariable','EnableNodeCliInspectArguments'])assert.equal(wire[FuseV1Options[key]],48,key);
 for(const key of ['EnableEmbeddedAsarIntegrityValidation','OnlyLoadAppFromAsar'])assert.equal(wire[FuseV1Options[key]],49,key);
 console.log('PASS packaged Electron fuses',JSON.stringify(wire));
})().catch(e=>{console.error(e);process.exitCode=1;});
