'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ProjectStore,newProject}=require('../storage'),{valid}=require('../ipc-contract');
test('pin metadata survives reopening and copy, prevents deleting and all cross-pin reorders',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-pins-')),file=path.join(dir,'a.ns'),copy=path.join(dir,'b.ns');let db,other;
 try{
  newProject(file,['A','B','P','C','D'].map(title=>({title,html:'<p>'+title+'</p>'})));db=new ProjectStore(file);
  const ids=db.snapshot().notes.map(n=>n.id),[a,b,p,c,d]=ids;
  db.setPinned(p,true);const before=db.snapshot();
  assert.equal(before.notes[0].pinned,true);assert.deepEqual(before.notes.map(n=>n.id),[p,a,b,c,d]);
  db.setPinned(c,true);const two=db.snapshot();assert.deepEqual(two.notes.map(n=>n.id),[p,c,a,b,d]);
  for(const order of [[a,p,c,b,d],[c,p,a,b,d],[p,a,c,b,d]])assert.throws(()=>db.reorder(order),/открепите/);
  assert.throws(()=>db.trashNote(p),/открепите/);assert.deepEqual(db.snapshot(),two);
  db.reorder([p,c,d,b,a]);db.updateNote({id:p,title:'Edited pinned',html:'<p>Updated</p>'});
  const dup=db.duplicateNote(p);assert.equal(dup.notes.find(n=>n.id===p).pinned,true);assert.ok(!dup.notes.find(n=>n.id===dup.activeId).pinned);assert.equal(dup.notes[2].id,dup.activeId);
  db.setPinned(c,false);assert.deepEqual(db.snapshot().notes.slice(0,2).map(n=>n.id),[p,c]);
  db.copyTo(copy);other=new ProjectStore(copy);assert.deepEqual(other.snapshot().notes,db.snapshot().notes);other.close();other=null;
  db.close();db=new ProjectStore(file);assert.equal(db.snapshot().notes.find(n=>n.id===p).pinned,true);
  db.setPinned(p,false);assert.equal(db.snapshot().notes[0].id,p);db.trashNote(p);assert.ok(db.listTrash().some(n=>n.id===p));db.restoreTrash(p);assert.ok(!db.snapshot().notes.find(n=>n.id===p).pinned);
  db.reorder(db.snapshot().notes.map(n=>n.id).reverse());
 }finally{other?.close();db?.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
test('pin and draft decision IPC schemas reject malformed or arbitrary requests',()=>{
 assert.equal(valid('set-note-pinned',{id:'x',pinned:true}),true);
 for(const x of [null,{}, {id:'x',pinned:'yes'},{id:'',pinned:true}])assert.equal(valid('set-note-pinned',x),false);
 for(const choice of ['save','discard','cancel'])assert.equal(valid('draft-decision',{token:'one-use',choice}),true);
 for(const choice of [true,'delete','/tmp/a',null])assert.equal(valid('draft-decision',{token:'one-use',choice}),false);
});

test('inconsistent pin order is normalized on reopen; restore cannot enter pinned group',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-pin-migrate-')),file=path.join(dir,'old.ns');let db;
 try{
  newProject(file,['A','B','C','D','E'].map(title=>({title,html:'<p>'+title+'</p>'})));db=new ProjectStore(file);
  const original=db.snapshot(),[a,b,c,d,e]=original.notes.map(n=>n.id);
  db.setMeta('pinned_notes',JSON.stringify([d,b]));db.close();db=new ProjectStore(file);
  assert.deepEqual(db.snapshot().notes.map(n=>n.id),[b,d,a,c,e]);
  assert.equal(db.snapshot().activeId,original.activeId);
  assert.deepEqual(db.snapshot().notes.map(({id,title,html,updatedAt})=>({id,title,html,updatedAt})).sort((x,y)=>x.id.localeCompare(y.id)),original.notes.map(({id,title,html,updatedAt})=>({id,title,html,updatedAt})).sort((x,y)=>x.id.localeCompare(y.id)));
  db.trashNote(a);db.setPinned(c,true);db.restoreTrash(a);
  assert.deepEqual(db.snapshot().notes.slice(0,4).map(n=>n.id),[b,d,c,a]);
  db.setPinned(d,false);assert.deepEqual(db.snapshot().notes.slice(0,3).map(n=>n.id),[b,c,d]);
 }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
