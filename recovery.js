'use strict';
// Private crash-recovery snapshots are keyed by file identity, not path spelling.
// Distinct copies stay isolated even when they contain identical project rows.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {note:validNote}=require('./ipc-contract');
const {sanitizeHTML}=require('./html-content');
class RecoveryStore {
 constructor(directory){this.directory=path.resolve(directory);}
 location(projectPath){
  const st=fs.statSync(projectPath,{bigint:true,throwIfNoEntry:false});
  if(!st)return null;
  if(!st.isFile())throw new Error('Файл проекта не найден');
  // Keep the entire 64-bit ID and the creation time; a new file at the
  // same path must not inherit an interrupted edit from a replaced file.
  let identity;
  if(st.ino!==0n)identity='file:'+st.dev+':'+st.ino+':'+st.birthtimeNs;
  else{
   // Some filesystems provide no stable inode. Only canonical single-link
   // paths are usable there; ambiguous hard links must fail closed.
   if(st.nlink!==1n)throw new Error('Не удалось определить идентификатор файла проекта');
   identity='path:'+fs.realpathSync.native(projectPath)+':'+st.birthtimeNs;
  }
  return path.join(this.directory,crypto.createHash('sha256').update(identity).digest('hex')+'.json');
 }
 clearProject(projectPath){this.clearLocation(this.location(projectPath));}
 clearLocation(file){
  if(file===null)return;
  if(path.dirname(file)!==this.directory||!/^[0-9a-f]{64}\.json$/.test(path.basename(file)))throw new Error('Некорректный восстановительный черновик');
  const remove=p=>{try{fs.unlinkSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}};
  remove(file);
  // A killed process may leave a temporary plaintext snapshot.
  let names;try{names=fs.readdirSync(this.directory);}catch(e){if(e.code==='ENOENT')return;throw e;}
  const prefix=path.basename(file)+'.';
  for(const name of names)if(name.startsWith(prefix)&&/^[0-9a-f-]{36}\.tmp$/i.test(name.slice(prefix.length)))remove(path.join(this.directory,name));
 }
 load(projectPath){
  const file=this.location(projectPath),projectKey=file?path.basename(file):null;
  const empty=()=>({projectKey,notes:Object.create(null)});
  if(!file)return empty();
  try{
   const data=JSON.parse(fs.readFileSync(file,'utf8'));
   return data?.projectKey===projectKey&&data?.notes&&typeof data.notes==='object'&&!Array.isArray(data.notes)
    ?{projectKey,notes:Object.assign(Object.create(null),data.notes)}
    :empty();
  }catch{return empty();}
 }
 write(projectPath,data){
  const file=this.location(projectPath);
  if(!file)throw new Error('Файл проекта не найден');
  if(data.projectKey!==path.basename(file))throw new Error('Файл проекта изменился');
  if(!Object.keys(data.notes).length){try{fs.unlinkSync(file)}catch(e){if(e.code!=='ENOENT')throw e}return;}
  fs.mkdirSync(this.directory,{recursive:true});
  const tmp=file+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(tmp,JSON.stringify(data),{encoding:'utf8',flush:true});fs.renameSync(tmp,file)}
  finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
 }
 save(projectPath,note){
  if(!validNote(note))throw new Error('Некорректный восстановительный черновик');
  const data=this.load(projectPath);
  data.notes[note.id]={title:note.title,html:sanitizeHTML(note.html),updatedAt:Date.now()};
  this.write(projectPath,data);
 }
 remove(projectPath,id){
  const data=this.load(projectPath);if(!Object.hasOwn(data.notes,id))return;
  delete data.notes[id];this.write(projectPath,data);
 }
 restore(store){
  if(store.encrypted)return store.restoreProtectedRecovery();
  const data=this.load(store.path);let count=0;
  const current=store.snapshot().notes;
  for(const n of current){
   const saved=data.notes[n.id];if(!saved)continue;
   if(validNote({id:n.id,...saved})&&Number.isFinite(saved.updatedAt)&&saved.updatedAt>=n.updatedAt&&(saved.title!==n.title||saved.html!==n.html)){
    store.updateNote({id:n.id,title:saved.title,html:saved.html});count++;
   }
   delete data.notes[n.id];
  }
  this.write(store.path,data);
  return count;
 }
}
module.exports={RecoveryStore};
