'use strict';
const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-load-'));app.setPath('userData',profile);
require('../main');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 await app.whenReady();let win;
 for(let i=0;i<200;i++){win=BrowserWindow.getAllWindows()[0];if(win?.isVisible())break;await delay(100);}
 assert.ok(win?.isVisible(),'ready');
 const results=[];
 for(const length of [10000,100000,500000,1000000]){
  const row=await win.webContents.executeJavaScript('('+function(n){
   const html='<p>'+('abc def ghi '.repeat(Math.ceil(n/12))).slice(0,n)+' marker</p>';
   const note={id:'load-'+n,title:'Benchmark',html};
   const t=performance.now();const clean=window.NocturneContent.sanitizeDOM(html);const sanitizeMs=performance.now()-t;
   const s=performance.now();const cold=window.nocturneSearch.bodyHits(note,'marker');const coldSearchMs=performance.now()-s;
   const w=performance.now();for(let i=0;i<10;i++)window.nocturneSearch.bodyHits(note,'marker');const warmSearchMs=(performance.now()-w)/10;
   const editor=document.querySelector('#editor');const old=editor.innerHTML;const d=performance.now();editor.innerHTML=clean;const domMs=performance.now()-d;const ok=editor.textContent.endsWith(' marker')&&cold.length===1;editor.innerHTML=old;window.nocturneSearch.clearCache();
   return {length:n,sanitizeMs,coldSearchMs,warmSearchMs,domMs,ok};
  }.toString()+')('+length+')');
  assert.ok(row.ok);results.push(row);console.log('LOAD '+JSON.stringify(row));
 }
 const dense=await win.webContents.executeJavaScript('('+function(){
  const root=document.createElement('div');root.textContent='a'.repeat(1_000_000);
  const api=window.nocturneSearch,t=performance.now(),positions=api.hits(root.textContent,'a'),searchMs=performance.now()-t;
  const h=performance.now(),ranges=api.rangesFor(root,'a',999999),highlightMs=performance.now()-h;
  const r=performance.now(),replaced=api.replaceInNote({id:'dense',title:'dense',html:'<p>'+('a'.repeat(100000))+'</p>'},'a','b',true),replaceMs=performance.now()-r;
  return {matches:positions.length,highlights:ranges.length,last:ranges.some(x=>x.offset===999999),replacementCount:replaced.count,replacementCorrect:replaced.html==='<p>'+('b'.repeat(100000))+'</p>',searchMs,highlightMs,replaceMs};
 }.toString()+')()');
 assert.equal(dense.matches,1000000);assert.equal(dense.highlights,2001);assert.equal(dense.last,true);assert.equal(dense.replacementCount,100000);assert.equal(dense.replacementCorrect,true);
 results.push({dense});console.log('DENSE '+JSON.stringify(dense));
 // Count actual retained DOM nodes during project-wide searches on many notes.
 // Do not replace the user's profile: this test uses an isolated generated project.
 const js=code=>win.webContents.executeJavaScript(code);
 for(let i=0;i<20;i++){
  await js("document.querySelector('#add-note').click()");
  for(let attempts=0;attempts<150;attempts++){if(await js("!document.querySelector('#note-title').readOnly&&document.querySelectorAll('.note-row').length==="+(i+2)))break;await delay(30);}
 }
 const reused=await js(`(()=>{document.querySelector('#search-toggle').click();document.querySelector('[data-search-scope=project]').click();const q=document.querySelector('#search-query'),before=[...document.querySelectorAll('.note-row')];q.value='New';q.dispatchEvent(new Event('input',{bubbles:true}));const after=[...document.querySelectorAll('.note-row')];return {rows:before.length,filtered:after.length,retained:after.filter(x=>before.includes(x)).length};})()`);
 assert.equal(reused.rows,21);assert.equal(reused.filtered,21);assert.equal(reused.retained,21);results.push({reused});console.log('PASS DOM row identity across search',JSON.stringify(reused));
 fs.writeFileSync(path.join(__dirname,'../load-results.json'),JSON.stringify(results,null,2));
}
run().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1)});
