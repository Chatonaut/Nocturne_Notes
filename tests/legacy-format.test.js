'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {ProjectStore,newProject,FORMAT}=require('../storage');
test('old .ns format marker remains readable and new projects use current marker',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-legacy-'));
 try{
  const file=path.join(dir,'old.ns');newProject(file);
  let db=new DatabaseSync(file);db.prepare("UPDATE project_meta SET value=? WHERE key='format'").run('glass-notes-v1');db.close();
  const project=new ProjectStore(file);assert.equal(project.snapshot().notes.length,1);project.close();
  const newFile=path.join(dir,'new.ns');newProject(newFile);db=new DatabaseSync(newFile);
  const marker=db.prepare("SELECT value FROM project_meta WHERE key='format'").get().value;db.close();assert.equal(marker,FORMAT);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
