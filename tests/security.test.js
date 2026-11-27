'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {sanitizeHTML,markdown,plainText,exportHTML}=require('../html-content');
const {valid}=require('../ipc-contract');
const {ProjectStore,newProject}=require('../storage');
const {RecoveryStore}=require('../recovery');
test('HTML parser strips executable content, attributes and unsafe links',()=>{
 const raw='<svg><script>alert(1)</script></svg><img src=x onerror=alert(1)><p onclick=x><b>Good</b><a href="jav&#x61;script:alert(1)">bad</a><span style="color:#123; background:url(x)">color</span></p>';
 const clean=sanitizeHTML(raw);
 assert.equal(clean,'<p><strong>Good</strong><a>bad</a><span style="color: rgb(17, 34, 51);">color</span></p>');
 assert.equal(sanitizeHTML(clean),clean);
 assert.doesNotMatch(exportHTML('</title><script>x</script>',raw),/<script|onerror|javascript:/i);
 assert.match(exportHTML('x',raw),/Content-Security-Policy/);
});
test('Markdown ordered/nested lists, formatting and entity decoding',()=>{
 const md=markdown('<h2>Heading</h2><ol><li>First &amp; second</li><li><strong>Bold</strong><ul><li>Nested</li></ul></li></ol><p>Literal *star*</p>');
 assert.match(md,/## Heading/);assert.match(md,/1\. First & second/);assert.match(md,/2\. \*\*Bold\*\*/);assert.match(md,/    - Nested/);assert.match(md,/\\\*star\\\*/);
 assert.equal(plainText('<p>A &copy; &#x1F600;</p><p>B</p>'),'A © 😀\nB');
});
test('IPC schemas reject malformed inputs',()=>{
 assert.ok(valid('update-note',{id:'a',title:'T',html:'<p>x</p>'}));
 for(const x of [null,{}, {id:1,title:'x',html:'x'},{id:'a',title:'x'.repeat(251),html:''}])assert.equal(valid('update-note',x),false);
 assert.equal(valid('update-settings',{unknown:true}),false);assert.equal(valid('update-settings',{minimizeToTray:'yes'}),false);
 assert.equal(valid('reorder-notes',['a','a']),false);assert.equal(valid('export-note',{id:'a',format:'exe'}),false);assert.equal(valid('arbitrary',null),false);
});
test('exclusive database lock, consistent copy, stale recovery protection',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-security-')),f=path.join(dir,'a.ns'),copy=path.join(dir,'b.ns');
 let store,other;try{
  newProject(f);store=new ProjectStore(f);const n=store.snapshot().notes[0];
  assert.throws(()=>new ProjectStore(f),/заблокирован|locked|busy|поврежден/i);
  const rec=new RecoveryStore(path.join(dir,'recovery'));rec.save(f,{id:n.id,title:'old',html:'<p>old</p>'});
  const draft=rec.load(f);draft.notes[n.id].updatedAt=1;rec.write(f,draft);
  store.updateNote({id:n.id,title:'new',html:'<p>new</p><script>bad</script>'});
  assert.equal(rec.restore(store),0);assert.equal(store.snapshot().notes[0].html,'<p>new</p>');
  store.copyTo(copy);other=new ProjectStore(copy);assert.equal(other.snapshot().notes[0].title,'new');assert.throws(()=>store.copyTo(copy),/существует/);
  other.close();other=null;store.close();store=null;other=new ProjectStore(f);assert.equal(other.snapshot().notes[0].title,'new');
 }finally{other?.close();store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
