'use strict';
// Crash-recovery drafts are private per-project snapshots, written separately
// from the user's .ns file so the selected autosave interval stays meaningful.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
class RecoveryStore {
 constructor(directory){this.directory=directory;}
 location(projectPath){
  const key=crypto.createHash('sha256').update(path.resolve(projectPath)).digest('hex');
  return path.join(this.directory,key+'.json');
 }
 load(projectPath){
  try{
   const data=JSON.parse(fs.readFileSync(this.location(projectPath),'utf8'));
   return data?.projectPath===path.resolve(projectPath)&&data?.notes&&typeof data.notes==='object'?data:{projectPath:path.resolve(projectPath),notes:{}};
  }catch{return {projectPath:path.resolve(projectPath),notes:{}};}
 }
 write(projectPath,data){
  fs.mkdirSync(this.directory,{recursive:true});
  const file=this.location(projectPath);
  if(!Object.keys(data.notes).length){try{fs.unlinkSync(file)}catch(e){if(e.code!=='ENOENT')throw e}return;}
  const tmp=file+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(tmp,JSON.stringify(data),'utf8');fs.renameSync(tmp,file)}
  finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
 }
 save(projectPath,note){
  if(!note||typeof note.id!=='string'||typeof note.title!=='string'||typeof note.html!=='string'||note.title.length>250||note.html.length>5_000_000)throw new Error('Некорректный восстановительный черновик');
  const data=this.load(projectPath);
  data.notes[note.id]={title:note.title,html:note.html,updatedAt:Date.now()};
  this.write(projectPath,data);
 }
 remove(projectPath,id){
  const data=this.load(projectPath);if(!Object.hasOwn(data.notes,id))return;
  delete data.notes[id];this.write(projectPath,data);
 }
 restore(store){
  const data=this.load(store.path);let count=0;
  const current=store.snapshot().notes;
  for(const n of current){
   const saved=data.notes[n.id];if(!saved)continue;
   if(typeof saved.html==='string'&&typeof saved.title==='string'&&(saved.title!==n.title||saved.html!==n.html)){
    store.updateNote({id:n.id,title:saved.title,html:saved.html});count++;
   }
   delete data.notes[n.id];
  }
  this.write(store.path,data);
  return count;
 }
}
module.exports={RecoveryStore};
