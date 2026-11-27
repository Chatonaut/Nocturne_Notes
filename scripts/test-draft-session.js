'use strict';
// Use an isolated profile, a separate Electron process per phase, and no real projects.
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const electron=require('electron'),child=path.join(__dirname,'test-draft-session-child.js');
const {newProject}=require('../storage');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-draft-lifecycle-'));
const dir=path.join(profile,'drafts'),old=path.join(dir,'draft-'+crypto.randomUUID()+'.ns');
const prefs=()=>JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'),'utf8'));
const launch=phase=>new Promise((resolve,reject)=>{
 const proc=spawn(electron,[child],{env:{...process.env,NOCTURNE_DRAFT_TEST_PROFILE:profile,NOCTURNE_DRAFT_TEST_PHASE:phase},stdio:'inherit'});
 const timer=setTimeout(()=>{proc.kill();reject(Error('Draft session timeout: '+phase));},120000);
 proc.once('error',e=>{clearTimeout(timer);reject(e);});
 proc.once('exit',code=>{clearTimeout(timer);resolve(code);});
});
(async()=>{
 try{
  newProject(old,[{title:'obsolete',html:'<p>obsolete</p>'}]);
  assert.equal(await launch('interrupt'),17);
  assert.equal(fs.existsSync(old),false,'obsolete generated draft must be cleaned on startup');
  const interrupted=prefs().activeDraft;assert.ok(interrupted&&fs.existsSync(interrupted),'interrupted session remains recoverable');
  assert.equal(await launch('recover'),0);
  assert.equal(fs.existsSync(interrupted),false,'confirmed discarded draft must be removed');
  assert.equal(prefs().activeDraft,null);assert.deepEqual(fs.readdirSync(dir),[]);
  assert.ok(fs.existsSync(path.join(profile,'saved.ns')),'named project survives cleanup');
  assert.equal(await launch('discard'),0);assert.equal(prefs().activeDraft,null);assert.deepEqual(fs.readdirSync(dir),[]);
  assert.ok(fs.existsSync(path.join(profile,'saved.ns')));
  assert.equal(await launch('empty'),0);assert.equal(prefs().activeDraft,null);assert.deepEqual(fs.readdirSync(dir),[]);
  console.log('PASS startup cleanup, interrupted draft recovery, cancel/save/discard, named project preservation, empty close and bookmark UI');
 }finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});}
})().catch(e=>{console.error(e);process.exitCode=1;});
