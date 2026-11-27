'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {ProjectStore,newProject,FORMAT}=require('../storage');
test('current project marker and schema round-trip preserve notes, order, active note and trash',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-format-')),file=path.join(dir,'project.ns'),copy=path.join(dir,'copy.ns');let store,other,raw;
 try{
  newProject(file,['One','Two','Three'].map(title=>({title,html:'<p><strong>'+title+'</strong></p>'})));
  raw=new DatabaseSync(file);
  assert.equal(FORMAT,'nocturne-notes-v1');
  assert.equal(raw.prepare("SELECT value FROM project_meta WHERE key='format'").get().value,FORMAT);
  assert.equal(raw.prepare('PRAGMA user_version').get().user_version,1);
  raw.close();raw=null;
  store=new ProjectStore(file);const [one,two,three]=store.snapshot().notes.map(n=>n.id);
  store.trashNote(three);store.setPinned(two,true);store.selectNote(one);
  const expected=store.snapshot(),trash=store.listTrash();
  store.copyTo(copy);store.close();store=null;
  for(const name of [file,copy]){
   other=new ProjectStore(name);
   assert.deepEqual(other.snapshot().notes,expected.notes);
   assert.equal(other.snapshot().activeId,expected.activeId);
   assert.deepEqual(other.listTrash(),trash);
   assert.equal(other.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
   assert.equal(other.meta('format'),FORMAT);
   other.close();other=null;
  }
 }finally{raw?.close();store?.close();other?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('unrecognized format marker is rejected without modifying the project or leaving a lock',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-format-reject-')),file=path.join(dir,'foreign.ns');let db;
 try{
  newProject(file);
  db=new DatabaseSync(file);db.prepare("UPDATE project_meta SET value=? WHERE key='format'").run('unrecognized-format');db.close();db=null;
  const before=fs.readFileSync(file);
  assert.throws(()=>new ProjectStore(file),/не проект Nocturne Notes/);
  assert.deepEqual(fs.readFileSync(file),before);
  fs.renameSync(file,file+'.moved');
 }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
