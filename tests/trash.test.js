'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ProjectStore,newProject}=require('../storage');
test('duplicate, trash, reopen, restore and purge preserve HTML and IDs',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-trash-')),file=path.join(dir,'x.ns');
 let db;
 try{
  newProject(file,[{title:'A',html:'<p><strong>A</strong></p>'},{title:'B',html:'<p>B</p>'}]);
  db=new ProjectStore(file);assert.equal(db.hasTrash(),false);
  const a=db.snapshot().notes[0];let p=db.duplicateNote(a.id);const copy=p.notes[1];assert.notEqual(copy.id,a.id);assert.equal(copy.html,a.html);assert.equal(copy.title,'A — копия');
  p=db.trashNote(a.id);assert.equal(p.notes.length,2);assert.equal(db.listTrash()[0].id,a.id);
  db.close();db=new ProjectStore(file);assert.equal(db.listTrash()[0].id,a.id);
  p=db.restoreTrash(a.id);assert.equal(p.notes[0].id,a.id);assert.equal(p.notes[0].html,a.html);assert.equal(db.listTrash().length,0);
  db.trashNote(copy.id);db.purgeTrash(copy.id);assert.equal(db.listTrash().length,0);
  db.trashNote(a.id);db.purgeTrash(null);assert.equal(db.listTrash().length,0);
  assert.throws(()=>db.trashNote(db.snapshot().activeId),/последнюю/);
 }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
