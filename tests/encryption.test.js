'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {ProjectStore,newProject,encryptedFile}=require('../storage');
test('whole project encryption, trash, recovery, copies and password change',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-encryption-')),plain=path.join(dir,'plain.ns'),secret=path.join(dir,'secret.ns'),changed=path.join(dir,'changed.ns'),copy=path.join(dir,'copy.ns'),removed=path.join(dir,'removed.ns');
 const key=Buffer.from('long test passphrase 1'),newKey=Buffer.from('long test passphrase 2');
 let a,b,c;try{
  newProject(plain,[{title:'PRIVATE-TITLE-9007',html:'<p>PRIVATE-BODY-9007</p>'},{title:'PRIVATE-TRASH-9007',html:'<p>Deleted</p>'}]);
  a=new ProjectStore(plain);const ids=a.snapshot().notes.map(n=>n.id);a.trashNote(ids[1]);a.setPinned(ids[0],true);a.copyTo(secret,{password:key});a.close();a=null;
  assert.equal(encryptedFile(secret),true);assert.throws(()=>new ProjectStore(secret));assert.throws(()=>new ProjectStore(secret,newKey));
  const raw=fs.readFileSync(secret);for(const marker of ['PRIVATE-TITLE-9007','PRIVATE-BODY-9007','PRIVATE-TRASH-9007'])assert.equal(raw.includes(Buffer.from(marker)),false);
  b=new ProjectStore(secret,key);assert.equal(b.snapshot().notes[0].id,ids[0]);assert.equal(b.snapshot().notes[0].pinned,true);assert.throws(()=>b.trashNote(ids[0]),/открепите/);assert.equal(b.listTrash()[0].id,ids[1]);assert.ok(b.verifyPassword(key));assert.equal(b.verifyPassword(newKey),false);
  b.saveProtectedRecovery({id:ids[0],title:'RECOVERY-PRIVATE-9007',html:'<p>Recovery secret</p>'});b.close();b=new ProjectStore(secret,key);
  assert.equal(b.restoreProtectedRecovery(),1);assert.equal(b.snapshot().notes[0].title,'RECOVERY-PRIVATE-9007');
  assert.equal(fs.readFileSync(secret).includes(Buffer.from('RECOVERY-PRIVATE-9007')),false);
  b.copyTo(copy);assert.equal(encryptedFile(copy),true);c=new ProjectStore(copy,key);assert.equal(c.snapshot().notes[0].title,'RECOVERY-PRIVATE-9007');assert.equal(c.snapshot().notes[0].pinned,true);c.close();c=null;
  b.copyTo(changed,{password:newKey});assert.throws(()=>new ProjectStore(changed,key));c=new ProjectStore(changed,newKey);assert.equal(c.snapshot().notes[0].pinned,true);c.close();c=null;
  b.copyTo(removed,{password:null});assert.equal(encryptedFile(removed),false);c=new ProjectStore(removed);assert.equal(c.listTrash()[0].title,'PRIVATE-TRASH-9007');assert.equal(c.snapshot().notes[0].pinned,true);c.close();c=null;
  const target=fs.readFileSync(removed);assert.throws(()=>b.copyTo(removed));assert.deepEqual(fs.readFileSync(removed),target);
  b.copyTo(removed,{overwrite:true,password:null});c=new ProjectStore(removed);assert.equal(c.snapshot().notes[0].id,ids[0]);
 }finally{a?.close();b?.close();c?.close();key.fill(0);newKey.fill(0);fs.rmSync(dir,{recursive:true,force:true});}
});

test('encrypted recovery survives abrupt exit and failed protected copy preserves source',()=>{
 const {spawnSync}=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-protected-crash-')),file=path.join(dir,'secret.ns'),target=path.join(dir,'target.ns'),key=Buffer.from('synthetic crash passphrase');
 let store;
 try{
  newProject(file,[{title:'original',html:'<p>original</p>'}],key);
  const child=spawnSync(process.execPath,['-e',"const {ProjectStore}=require('./storage');const s=new ProjectStore(process.argv[1],Buffer.from('synthetic crash passphrase'));const n=s.snapshot().notes[0];s.saveProtectedRecovery({id:n.id,title:'RECOVERED-PROTECTED',html:'<p>RECOVERED-PROTECTED</p>'});process.exit(17);",file],{cwd:path.join(__dirname,'..'),encoding:'utf8',timeout:30000});
  assert.ifError(child.error);assert.equal(child.status,17,child.stderr);
  assert.equal(fs.readFileSync(file).includes(Buffer.from('RECOVERED-PROTECTED')),false);
  store=new ProjectStore(file,key);assert.equal(store.restoreProtectedRecovery(),1);assert.equal(store.snapshot().notes[0].title,'RECOVERED-PROTECTED');
  newProject(target);const before=fs.readFileSync(target);
  store.makeCopy=tmp=>{fs.writeFileSync(tmp,'partial synthetic failure');throw Object.assign(Error('simulated disk full'),{code:'ENOSPC'});};
  assert.throws(()=>store.copyTo(target,{overwrite:true}),/disk full/);
  assert.deepEqual(fs.readFileSync(target),before);assert.equal(store.snapshot().notes[0].title,'RECOVERED-PROTECTED');
  assert.equal(fs.readdirSync(dir).some(n=>n.endsWith('.tmp')),false);
 }finally{store?.close();key.fill(0);fs.rmSync(dir,{recursive:true,force:true});}
});

test('SQLCipher rollback journal contains no note plaintext and an interrupted transaction rolls back',()=>{
 const {spawnSync}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-journal-')),file=path.join(dir,'secret.ns'),journal=file+'-journal',key=Buffer.from('A1bcdef8');
 const marker='PRIVATE-JOURNAL-BEFORE-7F31',after='PRIVATE-JOURNAL-AFTER-3C91',trash='PRIVATE-JOURNAL-TRASH-5AA1',recovery='PRIVATE-JOURNAL-RECOVERY-61C9';
 let store;
 const noPlaintext=raw=>{for(const token of [marker,after,trash,recovery])for(const encoding of ['utf8','utf16le','utf16be']){const bytes=encoding==='utf16be'?Buffer.from(token,'utf16le').swap16():Buffer.from(token,encoding);assert.equal(raw.includes(bytes),false,'Plaintext marker in encrypted file or journal');}};
 try{
  const notes=Array.from({length:12},(_,i)=>({title:marker+i,html:'<p>'+marker.repeat(650)+'</p>'}));
  notes.push({title:trash,html:'<p>'+trash+'</p>'});
  newProject(file,notes,key);store=new ProjectStore(file,key);const n=store.snapshot().notes;
  store.trashNote(n.at(-1).id);store.saveProtectedRecovery({id:n[0].id,title:recovery,html:'<p>'+recovery+'</p>'});
  const saved=store.snapshot().notes;
  noPlaintext(fs.readFileSync(file));
  if(fs.existsSync(journal))noPlaintext(fs.readFileSync(journal));
  store.close();store=null;assert.equal(fs.existsSync(journal),false,'journal removed after orderly close');
  const child=spawnSync(process.execPath,['-e',`
   const fs=require('node:fs'),assert=require('node:assert/strict'),{ProjectStore}=require('./storage');
   const file=process.argv[1],s=new ProjectStore(file,Buffer.from('A1bcdef8'));
   s.db.exec('PRAGMA cache_size=8; PRAGMA cache_spill=ON; BEGIN IMMEDIATE;');
   for(const n of s.snapshot().notes)s.updateNote({id:n.id,title:'PRIVATE-JOURNAL-AFTER-3C91',html:'<p>'+'PRIVATE-JOURNAL-AFTER-3C91'.repeat(650)+'</p>'});
   const j=fs.readFileSync(file+'-journal');assert.ok(j.length>4096,'journal must contain rollback pages');
   assert.equal(j.subarray(0,8).toString('hex'),'d9d505f920a163d7','cache spill must create a hot journal');
   process.exit(17);
  `,file],{cwd:path.join(__dirname,'..'),encoding:'utf8',timeout:60000});
  assert.ifError(child.error);assert.equal(child.status,17,child.stderr);
  assert.ok(fs.existsSync(journal),'hot journal must survive abrupt exit');
  const raw=fs.readFileSync(journal);assert.ok(raw.length>4096);noPlaintext(raw);noPlaintext(fs.readFileSync(file));
  store=new ProjectStore(file,key);assert.deepEqual(store.snapshot().notes,saved);
  assert.equal(store.listTrash()[0].title,trash);
  assert.equal(store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.equal(store.restoreProtectedRecovery(),1);assert.equal(store.snapshot().notes[0].title,recovery);
  store.close();store=null;assert.equal(fs.existsSync(journal),false);
  noPlaintext(fs.readFileSync(file));
  assert.throws(()=>{const db=new DatabaseSync(file,{readOnly:true});try{db.prepare('SELECT * FROM notes').all();}finally{db.close();}});
  assert.throws(()=>new ProjectStore(file,Buffer.from('wrongkey')));
 }finally{store?.close();key.fill(0);fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('inconsistent encrypted pin order is normalized and copies preserve pinned group order',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-encrypted-pins-')),file=path.join(dir,'pins.ns'),copy=path.join(dir,'copy.ns'),key=Buffer.from('synthetic pin ordering password');let db,other;
 try{
  newProject(file,['A','B','C','D'].map(title=>({title,html:'<p>PIN-PRIVATE-'+title+'</p>'})),key);
  db=new ProjectStore(file,key);const original=db.snapshot(),[a,b,c,d]=original.notes.map(n=>n.id);
  db.setMeta('pinned_notes',JSON.stringify([d,b]));db.close();db=new ProjectStore(file,key);
  assert.deepEqual(db.snapshot().notes.map(n=>n.id),[b,d,a,c]);assert.equal(db.snapshot().activeId,a);
  assert.throws(()=>db.reorder([d,b,a,c]),/открепите/);db.reorder([b,d,c,a]);db.copyTo(copy);
  other=new ProjectStore(copy,key);assert.deepEqual(other.snapshot().notes,db.snapshot().notes);other.close();other=null;
  assert.throws(()=>new ProjectStore(copy));assert.equal(fs.readFileSync(copy).includes(Buffer.from('PIN-PRIVATE-')),false);
 }finally{other?.close();db?.close();key.fill(0);fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});

test('encrypted trash and recovery deletion commit or roll back together',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-trash-recovery-')),file=path.join(dir,'private.ns'),key=Buffer.from('synthetic trash recovery password');let store;
 try{
  newProject(file,[{title:'A',html:'<p>A</p>'},{title:'B',html:'<p>B</p>'}],key);
  store=new ProjectStore(file,key);const n=store.snapshot().notes[0];
  store.saveProtectedRecovery({...n,html:'<p>RECOVERY PRIVATE</p>'});
  const remove=store.removeProtectedRecovery;store.removeProtectedRecovery=()=>{throw Error('synthetic cleanup failure');};
  assert.throws(()=>store.trashNote(n.id),/synthetic cleanup failure/);
  assert.ok(store.hasNote(n.id));assert.equal(store.listTrash().length,0);
  store.removeProtectedRecovery=remove;store.trashNote(n.id);
  assert.ok(!store.hasNote(n.id));assert.equal(store.listTrash().length,1);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM protected_recovery WHERE id=?').get(n.id).n,0);
  store.removeProtectedRecovery=()=>{throw Error('synthetic cleanup failure');};
  assert.throws(()=>store.restoreTrash(n.id),/synthetic cleanup failure/);
  assert.ok(!store.hasNote(n.id));assert.equal(store.listTrash().length,1);
  store.removeProtectedRecovery=remove;store.restoreTrash(n.id);
  assert.equal(store.snapshot().notes.find(x=>x.id===n.id).html,'<p>A</p>');
 }finally{store?.close();key.fill(0);fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
