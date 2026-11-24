'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ProjectStore,newProject}=require('../storage');
const {RecoveryStore}=require('../recovery');
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-recovery-'));try{return fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
test('an unsaved draft is restored into the same .ns project',()=>fixture(dir=>{
 const file=path.join(dir,'project.ns');newProject(file);
 const store=new ProjectStore(file),note=store.snapshot().notes[0],recovery=new RecoveryStore(path.join(dir,'recovery'));
 recovery.save(file,{id:note.id,title:'Восстановлено',html:'<p>До сбоя</p>'});
 assert.equal(recovery.restore(store),1);
 assert.equal(store.snapshot().notes[0].title,'Восстановлено');
 assert.equal(store.snapshot().notes[0].html,'<p>До сбоя</p>');
 assert.equal(recovery.restore(store),0);
 store.close();
}));
test('successfully saved note removes pending recovery; projects are isolated',()=>fixture(dir=>{
 const a=path.join(dir,'a.ns'),b=path.join(dir,'b.ns');newProject(a);newProject(b);
 const recovery=new RecoveryStore(path.join(dir,'recovery'));const sa=new ProjectStore(a),sb=new ProjectStore(b);
 const note=sa.snapshot().notes[0];recovery.save(a,{id:note.id,title:'В работе',html:'<p>Черновик</p>'});
 assert.equal(recovery.restore(sb),0);
 sa.updateNote({id:note.id,title:'Завершено',html:'<p>Готово</p>'});recovery.remove(a,note.id);
 assert.equal(recovery.restore(sa),0);
 assert.equal(sa.snapshot().notes[0].title,'Завершено');sa.close();sb.close();
}));
