'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {isManagedDraft,withinDraftDirectory,cleanDrafts}=require('../drafts'),{RecoveryStore}=require('../recovery');
test('cleanup retains interrupted draft and sidecars, removes only managed old files and recovery',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-drafts-')),dir=path.join(root,'drafts');
 try{
  fs.mkdirSync(dir);const fresh=()=>path.join(dir,'draft-'+crypto.randomUUID()+'.ns'),keep=fresh(),old=fresh(),outside=path.join(root,path.basename(old)),custom=path.join(dir,'User project.ns');
  const names=[keep,keep+'-journal',old,old+'-journal',old+'.'+crypto.randomUUID()+'.tmp',outside,custom];
  names.forEach(f=>fs.writeFileSync(f,'synthetic'));
  const recovery=new RecoveryStore(path.join(root,'recovery'));recovery.save(keep,{id:'a',title:'keep',html:'<p>keep</p>'});recovery.save(old,{id:'a',title:'old',html:'<p>old</p>'});
  const oldRecovery=recovery.location(old),keepRecovery=recovery.location(keep);
  assert.equal(isManagedDraft(dir,old),true);assert.equal(isManagedDraft(dir,outside),false);
  assert.equal(withinDraftDirectory(dir,custom),true);assert.equal(withinDraftDirectory(dir,outside),false);
  cleanDrafts(dir,{keep,recovery});assert.ok(fs.existsSync(keep)&&fs.existsSync(keep+'-journal')&&fs.existsSync(outside)&&fs.existsSync(custom));
  assert.ok(names.slice(2,5).every(f=>!fs.existsSync(f)));assert.equal(fs.existsSync(oldRecovery),false);assert.equal(fs.existsSync(keepRecovery),true);
  cleanDrafts(dir,{only:keep,recovery});assert.equal(fs.existsSync(keep),false);assert.equal(fs.existsSync(keep+'-journal'),false);assert.equal(fs.existsSync(keepRecovery),false);
  const alias=path.join(root,'alias');fs.symlinkSync(dir,alias,process.platform==='win32'?'junction':'dir');
  assert.equal(withinDraftDirectory(dir,path.join(alias,'new.ns')),true);assert.throws(()=>cleanDrafts(alias),/очистить/);assert.ok(fs.existsSync(custom));
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
