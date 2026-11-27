'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {roundWindowRegion}=require('../window-shape');
function isInside(regions,x,y){return regions.some(v=>x>=v.x&&x<v.x+v.width&&y>=v.y&&y<v.y+v.height)}
test('real Win32 region rejects corner pixels while keeping entire interior',()=>{
 for(const [w,h] of [[790,520],[900,740],[1440,900]]){
  const r=roundWindowRegion(w,h,29);
  assert.equal(isInside(r,0,0),false);assert.equal(isInside(r,w-1,0),false);
  assert.equal(isInside(r,0,h-1),false);assert.equal(isInside(r,w-1,h-1),false);
  assert.equal(isInside(r,Math.floor(w/2),0),true);
  assert.equal(isInside(r,0,Math.floor(h/2)),true);
  assert.equal(isInside(r,w-1,Math.floor(h/2)),true);
  assert.equal(isInside(r,29,29),true);
  for(const rect of r){
   assert.ok(rect.x>=0&&rect.y>=0&&rect.width>0&&rect.height>0);
   assert.ok(rect.x+rect.width<=w && rect.y+rect.height<=h);
  }
 }
});
test('region has a balanced 29px curve and never uses a black corner mask',()=>{
 const r=roundWindowRegion(790,520,29);
 for(let y=0;y<29;y++){
  const left=r.find(v=>v.y===y);
  const right=r.find(v=>v.y===520-y-1);
  assert.equal(left.x,right.x);
  assert.equal(left.width,right.width);
 }
 assert.equal(r.length,59);
});
test('invalid bounds are rejected and tiny windows remain safe',()=>{
 assert.throws(()=>roundWindowRegion(-2,50),RangeError);
 assert.deepEqual(roundWindowRegion(1,1,0),[{x:0,y:0,width:1,height:1}]);
 assert.ok(roundWindowRegion(20,20,29).length>0);
});
test('visible draft name never exposes UUID and save-as uses friendly default',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../main.js'),'utf8');
 assert.match(source,/name:isDraft\?t\("Новый проект"\):snapshot\.name/);
 assert.match(source,/defaultPath:projectData\(\)\.isDraft\?t\("Новый проект\.ns"\)/);
 const {text}=require('../i18n');
 for(const [lang,name] of [['en','New Project'],['ru','Новый проект']]){
  assert.equal(text(lang,'Новый проект'),name);
  assert.equal(text(lang,'Новый проект.ns'),name+'.ns');
 }
 // The private directory is now a shared lifecycle helper, not an inline path.
 assert.match(source,/const draftDirectory=\(\)=>path\.join\(app\.getPath\('userData'\),'drafts'\);/);
 assert.match(source,/const file=path\.join\(draftDirectory\(\),`draft-\$\{crypto\.randomUUID\(\)\}\.ns`\);/);
 assert.match(source,/function isDraftPath\(filePath\)\{return isManagedDraft\(draftDirectory\(\),filePath\);\}/);
});
test('approved N remains small, centered and unmodified',()=>{
 const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
 const css=fs.readFileSync(path.join(__dirname,'../brand.css'),'utf8');
 assert.match(css,/width:18px/);assert.match(css,/height:18px/);
 assert.match(css,/justify-self:center/);assert.match(css,/align-self:center/);
 const img=fs.readFileSync(path.join(__dirname,'../assets/nocturne-brand-mark.png'));
 const hash=crypto.createHash('sha256').update(img).digest('hex');
 assert.equal(hash,'987a418709736f7c199d24373fd8a3441f171c326323f7aef381280862f0e0dc');
});
test('About dialog shows the same version as Windows installer',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const base=path.join(__dirname,'..');
 const pkg=JSON.parse(fs.readFileSync(path.join(base,'package.json'),'utf8'));
 const renderer=fs.readFileSync(path.join(base,'renderer.js'),'utf8');
 assert.ok(renderer.includes('Версия '+pkg.version));
});
