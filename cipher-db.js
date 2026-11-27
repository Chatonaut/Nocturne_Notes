'use strict';
const path=require('node:path');
const fs=require('node:fs');
let native;
function binding(){
 if(!native){
  const file=process.resourcesPath&&fs.existsSync(path.join(process.resourcesPath,'nocturne_cipher.node'))?path.join(process.resourcesPath,'nocturne_cipher.node'):path.join(__dirname,'native','build','Release','nocturne_cipher.node');
  native=require(file);
 }
 return native;
}
class CipherDB{
 constructor(file,password,create=false){
  this.native=binding();
  this.handle=this.native.open(file,password,create);
  try{const v=this.prepare('PRAGMA cipher_version').get();if(!v||!String(v.cipher_version).startsWith('4.20.0'))throw new Error('SQLCipher 4.20.0 required');}
  catch(e){this.close();throw e;}
 }
 exec(sql){return this.native.exec(this.handle,sql);}
 prepare(sql){const run=(mode,args)=>this.native.query(this.handle,sql,args,mode);return {all:(...args)=>run('all',args),get:(...args)=>run('get',args),run:(...args)=>run('run',args)};}
 close(){if(this.handle){this.native.close(this.handle);this.handle=null;}}
}
// A packaged diagnostic exercises only synthetic data in an OS temp directory.
// No caller-controlled path, SQL, password or code can be supplied.
function verifyNativeRuntime(){
 const assert=require('node:assert/strict'),os=require('node:os'),crypto=require('node:crypto');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-native-check-')),file=path.join(dir,'synthetic.ns');
 const key=crypto.randomBytes(32),wrong=crypto.randomBytes(32);let db;
 try{
  db=new CipherDB(file,key,true);
  db.exec('CREATE TABLE test(value TEXT)');
  db.prepare('INSERT INTO test VALUES(?)').run('NOCTURNE-SYNTHETIC-SELFTEST');
  db.close();db=null;
  const raw=fs.readFileSync(file);
  assert.equal(raw.includes(Buffer.from('NOCTURNE-SYNTHETIC-SELFTEST')),false);
  assert.notEqual(raw.subarray(0,16).toString(),'SQLite format 3\0');
  assert.throws(()=>new CipherDB(file,wrong));
  db=new CipherDB(file,key);
  assert.equal(db.prepare('SELECT value FROM test').get().value,'NOCTURNE-SYNTHETIC-SELFTEST');
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{try{db?.close();}finally{key.fill(0);wrong.fill(0);fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}}
}
module.exports={CipherDB,verifyNativeRuntime};
