'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {CipherDB}=require('../cipher-db');
const {DatabaseSync}=require('node:sqlite');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-cipher-native-')),file=path.join(dir,'native.ns');
const key=Buffer.from('private test passphrase');
let db;
try{
 db=new CipherDB(file,key,true);
 const version=db.prepare('PRAGMA cipher_version').get();assert.match(version.cipher_version,/^4\.20\.0/);
 const provider=String(Object.values(db.prepare('PRAGMA cipher_provider').get())[0]);
 const providerVersion=String(Object.values(db.prepare('PRAGMA cipher_provider_version').get())[0]);
 const memorySecurity=String(Object.values(db.prepare('PRAGMA cipher_memory_security').get())[0]);
 assert.match(provider,/openssl/i);assert.match(providerVersion,/3\.6\.5/);assert.match(memorySecurity,/^(1|on)$/i);
 const sqlite=db.prepare('SELECT sqlite_version() AS version').get().version;
 fs.writeFileSync(path.join(__dirname,'../native-runtime.json'),JSON.stringify({cipher:version.cipher_version,provider,providerVersion,memorySecurity,sqlite,electron:process.versions.electron,node:process.versions.node},null,2));
 db.exec('CREATE TABLE test(value TEXT)');db.prepare('INSERT INTO test VALUES(?)').run('SENSITIVE-TEXT-9633');
 db.close();db=null;
 const raw=fs.readFileSync(file);assert.notEqual(raw.subarray(0,16).toString(),'SQLite format 3\0');assert.equal(raw.includes(Buffer.from('SENSITIVE-TEXT-9633')),false);
 const ordinary=new DatabaseSync(file,{readOnly:true});try{assert.throws(()=>ordinary.prepare('SELECT * FROM test').all());}finally{ordinary.close();}
 assert.throws(()=>new CipherDB(file,Buffer.from('wrong'),false));
 db=new CipherDB(file,key);assert.equal(db.prepare('SELECT value FROM test').get().value,'SENSITIVE-TEXT-9633');
 assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 console.log('PASS genuine SQLCipher 4.20.0, encrypted pages, wrong key and ordinary SQLite rejection');
}finally{db?.close();key.fill(0);fs.rmSync(dir,{recursive:true,force:true});}
