'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const {ProjectStore,newProject}=require('../storage'),{RecoveryStore}=require('../recovery');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-encryption-bench-')),key=crypto.randomBytes(32);
const rows=[];let store;
const notes=Array.from({length:120},(_,i)=>({title:'Note '+i,html:i===0?'<p>'+('synthetic text '.repeat(8000))+'</p>':'<p>Text</p>'}));
const measure=(row,name,fn)=>{const t=performance.now(),v=fn();row[name]=Math.round((performance.now()-t)*100)/100;return v;};
try{
 for(let i=0;i<3;i++)for(const encrypted of [false,true]){
  const label=(encrypted?'encrypted':'plain')+'-'+i,file=path.join(dir,label+'.ns'),copy=path.join(dir,label+'-copy.ns'),password=encrypted?key:null;
  const row={encrypted,run:i+1};measure(row,'createMs',()=>newProject(file,notes,password));
  store=measure(row,'openMs',()=>new ProjectStore(file,password));
  const n=store.snapshot().notes[0],changed={id:n.id,title:n.title,html:n.html.replace('</p>',' benchmark edit</p>')};
  measure(row,'saveMs',()=>store.updateNote(changed));
  const rec=new RecoveryStore(path.join(dir,label+'-recovery'));
  const draft={...changed,html:'<p>recovery benchmark</p>'};
  measure(row,'recoveryWriteMs',()=>encrypted?store.saveProtectedRecovery(draft):rec.save(file,draft));
  measure(row,'recoveryRestoreMs',()=>assert.equal(rec.restore(store),1));
  measure(row,'verifiedCopyMs',()=>store.copyTo(copy));
  row.fileBytes=fs.statSync(file).size;store.close();store=null;rows.push(row);
 }
 fs.writeFileSync(path.join(__dirname,'../encryption-performance.json'),JSON.stringify(rows,null,2));console.log('ENCRYPTION BENCHMARK',JSON.stringify(rows));
}finally{store?.close();key.fill(0);fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
