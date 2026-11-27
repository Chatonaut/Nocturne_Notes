'use strict';
// Only direct application-generated UUID drafts and matching sidecars.
const fs=require('node:fs'),path=require('node:path');
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const draftName=new RegExp('^draft-'+uuid+'\\.ns$','i');
const managed=new RegExp('^(draft-'+uuid+'\\.ns)(?:-journal|-wal|-shm|\\.'+uuid+'\\.tmp(?:-journal|-wal|-shm)?)?$','i');
const compare=p=>process.platform==='win32'?path.resolve(p).toLowerCase():path.resolve(p);
function isManagedDraft(directory,file){return typeof file==='string'&&compare(path.dirname(file))===compare(directory)&&draftName.test(path.basename(file));}
function safeDirectory(directory){
 const st=fs.lstatSync(directory,{throwIfNoEntry:false});
 if(!st)return false;
 if(!st.isDirectory()||st.isSymbolicLink())throw new Error('Не удалось очистить черновики');
 return true;
}
function withinDraftDirectory(directory,file){
 const parent=path.dirname(path.resolve(file)),root=compare(directory);
 if(compare(file)===root||compare(file).startsWith(root+path.sep))return true;
 let ancestor=parent;
 while(!fs.existsSync(ancestor)){const next=path.dirname(ancestor);if(next===ancestor)break;ancestor=next;}
 if(fs.existsSync(ancestor)&&fs.existsSync(directory)){
  const real=compare(fs.realpathSync.native(ancestor)),actual=compare(fs.realpathSync.native(directory));
  if(real===actual||real.startsWith(actual+path.sep))return true;
 }
 return false;
}
function cleanDrafts(directory,{keep=null,only=null,recovery}={}){
 if(!safeDirectory(directory))return;
 for(const name of fs.readdirSync(directory)){
  const match=name.match(managed);if(!match)continue;
  const file=path.join(directory,name),base=path.join(directory,match[1]);
  if((keep&&compare(base)===compare(keep))||(only&&compare(base)!==compare(only)))continue;
  const st=fs.lstatSync(file,{throwIfNoEntry:false});
  if(!st||!st.isFile()||st.isSymbolicLink())continue;
  if(recovery)recovery.clearProject(base);
  fs.unlinkSync(file);
 }
}
module.exports={isManagedDraft,withinDraftDirectory,cleanDrafts,safeDirectory};
