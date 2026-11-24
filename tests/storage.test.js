'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ProjectStore,newProject}=require('../storage');
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-notes-test-'));const file=path.join(dir,'project.ns');try{return fn(file)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
test('create, save, reopen and restore active note',()=>fixture(file=>{
 newProject(file,[{title:'Начало',html:'<p>Hello</p>'}]);
 let db=new ProjectStore(file);assert.equal(db.snapshot().notes.length,1);
 const newNote=db.addNote();db.updateNote({id:newNote.id,title:'Список',html:'<p><strong>Important</strong></p>'});db.selectNote(newNote.id);
 db.close();db=new ProjectStore(file);
 assert.equal(db.snapshot().notes[1].title,'Список');
 assert.equal(db.snapshot().notes[1].html,'<p><strong>Important</strong></p>');
 assert.equal(db.snapshot().activeId,newNote.id);db.close();
}));
test('reorder and prevent deleting last note',()=>fixture(file=>{
 newProject(file,[{title:'A',html:'<p></p>'},{title:'B',html:'<p></p>'}]);
 const db=new ProjectStore(file);const ids=db.snapshot().notes.map(n=>n.id);
 db.reorder(ids.slice().reverse());assert.deepEqual(db.snapshot().notes.map(n=>n.id),ids.slice().reverse());
 db.trashNote(ids[0]);assert.throws(()=>db.trashNote(ids[1]),/последнюю/);db.close();
}));
test('reject other sqlite databases and JSON files',()=>fixture(file=>{
 fs.writeFileSync(file,'{"notes":[]}');assert.throws(()=>new ProjectStore(file),/Неподдерживаемый/);
}));

test('new project starts with one empty unnamed note',()=>fixture(file=>{
 newProject(file);
 const db=new ProjectStore(file);const {notes,activeId}=db.snapshot();
 assert.equal(notes.length,1);assert.equal(notes[0].title,'Без названия');
 assert.equal(notes[0].html,'<p></p>');assert.equal(activeId,notes[0].id);
 db.close();
}));

test('foreign SQLite and incomplete project are rejected without leaving a file lock',()=>fixture(file=>{
 const {DatabaseSync}=require('node:sqlite');
 let db=new DatabaseSync(file);db.exec('CREATE TABLE unrelated (value TEXT)');db.close();
 const before=fs.readFileSync(file);
 assert.throws(()=>new ProjectStore(file),/не проект Nocturne Notes/);
 assert.deepEqual(fs.readFileSync(file),before);
 const moved=file+'.moved';fs.renameSync(file,moved);fs.unlinkSync(moved);
 db=new DatabaseSync(file);
 db.exec("CREATE TABLE project_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL); INSERT INTO project_meta VALUES ('format','nocturne-notes-v1')");
 db.close();
 assert.throws(()=>new ProjectStore(file),/файл поврежден/);
 fs.unlinkSync(file);
}));
