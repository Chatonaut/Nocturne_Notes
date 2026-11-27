'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {sameFile}=require('../storage');
test('distinct 64-bit file IDs that round to the same Number remain distinct',t=>{
 const a=9007199254740992n,b=a+1n;
 assert.equal(Number(a),Number(b));
 const stat=t.mock.method(fs,'statSync',(file,options)=>({dev:options?.bigint?1n:1,ino:options?.bigint?(file==='a'?a:b):Number(file==='a'?a:b)}));
 assert.equal(sameFile('a','b'),false);assert.equal(sameFile('a','a'),true);
 assert.ok(stat.mock.calls.every(call=>call.arguments[1]?.bigint===true));
});
test('real independent files, hard links, directory aliases and missing paths',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-identity-')),dir=path.join(root,'files'),alias=path.join(root,'alias');
 try{
  fs.mkdirSync(dir);const a=path.join(dir,'a.ns'),b=path.join(dir,'b.ns'),hard=path.join(dir,'hard.ns');
  fs.writeFileSync(a,'same contents');fs.writeFileSync(b,'same contents');
  assert.equal(sameFile(a,b),false);assert.equal(sameFile(a,a),true);
  fs.linkSync(a,hard);assert.equal(sameFile(a,hard),true);
  fs.symlinkSync(dir,alias,process.platform==='win32'?'junction':'dir');
  assert.equal(sameFile(a,path.join(alias,'a.ns')),true);
  assert.equal(sameFile(a,path.join(alias,'b.ns')),false);
  assert.equal(sameFile(a,path.join(dir,'new.ns')),false);
  assert.equal(sameFile(path.join(dir,'new.ns'),path.join(dir,'.','new.ns')),true);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('unavailable file identities fail closed instead of assuming distinct files',t=>{
 t.mock.method(fs,'statSync',()=>({dev:1n,ino:0n}));
 t.mock.method(fs.realpathSync,'native',file=>file);
 assert.equal(sameFile('a','a'),true);
 assert.throws(()=>sameFile('a','b'),/Выберите другое имя файла/);
});
test('unexpected stat errors are propagated rather than ignored',t=>{
 t.mock.method(fs,'statSync',()=>{throw Object.assign(Error('access denied'),{code:'EACCES'});});
 assert.throws(()=>sameFile('a','b'),{code:'EACCES'});
});
