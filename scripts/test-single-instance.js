'use strict';
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-instance-')),electron=require('electron'),child=path.join(__dirname,'test-single-instance-child.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function wait(f){for(let i=0;i<200;i++){if(f())return;await sleep(100);}throw Error('Instance timeout');}
const launch=first=>spawn(electron,[child],{env:{...process.env,NOCTURNE_INSTANCE_PROFILE:dir,NOCTURNE_INSTANCE_FIRST:first?'1':'0'},stdio:'ignore'});
(async()=>{const a=launch(true);let b;try{await wait(()=>fs.existsSync(path.join(dir,'ready')));b=launch(false);await wait(()=>b.exitCode!==null&&fs.existsSync(path.join(dir,'received')));assert.equal(b.exitCode,0);assert.equal(a.exitCode,null);console.log('PASS second launch exits and existing instance receives activation');}finally{b?.kill();a.kill();await sleep(400);fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}})().catch(e=>{console.error(e);process.exitCode=1;});
