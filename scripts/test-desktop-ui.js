'use strict';
// Actual Electron/Chromium layout with the production main, preload and renderer.
// Use a disposable profile: never open or modify the user's existing notes.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-ui-'));
app.setPath('userData',profile);
// Regression: an explicitly chosen old-default combination must survive boot.
fs.writeFileSync(path.join(profile,'preferences.json'),JSON.stringify({settings:{fontSize:22,titleSize:'standard',lineHeight:1.64,sidebarWidth:240}}));
const main=require('../main.js');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,label)=>{
 for(let i=0;i<100;i++){try{const value=await fn();if(value)return value;}catch{} await delay(100);}
 throw Error('Timeout: '+label);
};
const run=async()=>{
 await app.whenReady();
 const win=await wait(()=>BrowserWindow.getAllWindows()[0],'window');
 const wc=win.webContents;
 const js=code=>wc.executeJavaScript(code);
 await wait(()=>js("!!document.querySelector('.note-row') && document.body.classList.contains('is-electron') && getComputedStyle(document.querySelector('.sidebar-footer > button > svg')).translate !== 'none'"),'renderer and shell CSS');
 const measure=()=>js(`(()=>{
  const get=s=>document.querySelector(s);
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}};
  const font=s=>parseFloat(getComputedStyle(get(s)).fontSize);
  return {width:innerWidth, title:font('.note-title'), text:font('.editor'), list:font('.note-row'), caption:font('.project-caption'),
   titleHeight:rect(get('.note-title')).h,
   sidebar:rect(get('.sidebar')),editor:rect(get('.editor-outer')),
   buttons:[...document.querySelectorAll('.sidebar-footer > button')].map(b=>{
    const svg=b.querySelector('svg');const bb=svg.getBBox(),matrix=svg.getScreenCTM();
    const ink=new DOMPoint(bb.x+bb.width/2,bb.y+bb.height/2).matrixTransform(matrix);
    return {circle:rect(b),svg:rect(svg),ink:{x:ink.x,y:ink.y}};
   })};
 })()`);
 const persisted=await js("window.nocturneNotes.bootstrap()");
 assert.equal(persisted.settings.language,'en');
 assert.equal(await js('document.documentElement.lang'),'en');
 assert.equal(persisted.settings.fontSize,22);
 assert.equal(persisted.settings.titleSize,24);
 assert.equal(persisted.settings.lineHeight,1.6);
 const near=(a,b,tol=1.1)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b} (tolerance ${tol})`);
 const geometry=m=>{
  const [a,b,c]=m.buttons;
  near(b.circle.cx,m.sidebar.cx);
  near((a.circle.cx+c.circle.cx)/2,m.sidebar.cx);
  near(b.circle.cx-a.circle.cx,c.circle.cx-b.circle.cx,.1);
  for(const [i,{circle,svg,ink}] of m.buttons.entries()){
   near(circle.w,36,.1);near(circle.h,36,.1);
   const correction=i===1?-.46:0;
   near(svg.cx-circle.cx,correction,.15);near(svg.cy-circle.cy,correction,.15);
   near(ink.x,circle.cx,.2);near(ink.y,circle.cy,.2);
   near(circle.x,Math.round(circle.x),.05);
   assert.ok(circle.x>=m.sidebar.x-.1 && circle.x+circle.w<=m.sidebar.x+m.sidebar.w+.1,'button inside panel');
  }
  assert.ok(m.editor.w>=439,'editor minimum width');
 };
 // Native geometry is tested FIRST, on a freshly launched visible window,
 // before attaching the debugger or setting any viewport emulation.
 await wait(()=>win.isVisible(),'visible native window');
 // Actual viewport without CDP overrides: ensure right edge and all grips.
 const nativeMeasure=()=>js("(()=>{const r=document.querySelector('#window').getBoundingClientRect();const e=document.querySelector('.editor-surface').getBoundingClientRect();const grips=[...document.querySelectorAll('.nocturne-native-corner-grip')].map(g=>{const b=g.getBoundingClientRect();return {direction:g.dataset.corner,hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===g,x:b.x,y:b.y,right:b.right,bottom:b.bottom}});return {w:innerWidth,h:innerHeight,x:r.x,y:r.y,right:r.right,bottom:r.bottom,editorRight:e.right,grips,mode:document.body.dataset.cornerMode,radius:getComputedStyle(document.querySelector('#window')).borderTopLeftRadius}})()");
 for(const [width,height] of [[900,600],[1064,650],[740,480]]){
  const bounds=win.getBounds();win.setBounds({...bounds,width,height});
  let m;
  try{
   m=await wait(async()=>{
    const v=await nativeMeasure(),b=win.getBounds(),content=win.getContentBounds();
    return Math.abs(v.w-width)<=1&&Math.abs(v.h-height)<=1&&Math.abs(b.width-width)<=1&&Math.abs(b.height-height)<=1&&Math.abs(content.width-v.w)<=1&&Math.abs(content.height-v.h)<=1?v:false;
   },'actual native viewport '+width+'x'+height);
  }catch(error){
   console.error('Native resize diagnostic',JSON.stringify({requested:{width,height},bounds:win.getBounds(),content:win.getContentBounds(),resizable:win.isResizable(),renderer:await nativeMeasure()}));
   throw error;
  }
  assert.equal(m.mode,'alpha');assert.equal(m.radius,'29px');
  near(m.x,0,.1);near(m.y,0,.1);near(m.right,m.w,.1);near(m.bottom,m.h,.1);
  assert.ok(m.editorRight<=m.w&&m.w-m.editorRight>=8,'editor right gutter intact');
  assert.equal(m.grips.length,8);
  for(const g of m.grips){assert.ok(g.hit,'grip '+g.direction+' hit test');assert.ok(g.x>=0&&g.y>=0&&g.right<=m.w&&g.bottom<=m.h);}
  const top=await js(`(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,cy:r.y+r.height/2}};
   const q=s=>document.querySelector(s);
   const controls=[...document.querySelectorAll('.quick-window-actions button,.window-controls button')];
   return {bar:rect(q('.titlebar')),history:rect(q('.edit-history')),system:rect(q('.window-controls')),quick:rect(q('.quick-window-actions')),drag:rect(q('.drag-space')),buttons:controls.map(b=>({id:b.id,...rect(b),hit:document.elementFromPoint(rect(b).x+rect(b).w/2,rect(b).cy)?.closest('button')===b})),arrows:[...document.querySelectorAll('.edit-history button')].map(b=>{const svg=b.querySelector('svg'),bb=svg.getBBox(),p=new DOMPoint(bb.x+bb.width/2,bb.y+bb.height/2).matrixTransform(svg.getScreenCTM());return {button:rect(b),inkY:p.y};})};
  })()`);
  near(top.history.h,34,.1);near(top.history.cy,top.bar.cy,1);near(top.history.cy,top.system.cy,1);near(top.quick.cy,top.system.cy,1);
  near(top.system.x-top.quick.right,16,.1);
  assert.ok(top.drag.w>=24,'drag area must remain accessible');
  assert.deepEqual(top.buttons.map(b=>b.id),['focus-mode','always-top','min-btn','max-btn','close-btn']);
  for(const b of top.buttons){near(b.cy,top.system.cy,1);assert.ok(b.hit&&b.x>=0&&b.right<=width,'top control accessible: '+b.id);}
  for(const a of top.arrows)near(a.inkY,a.button.cy,2.5);
  console.log('PASS titlebar geometry',JSON.stringify(top));
  console.log('PASS native viewport and all eight grips',width,height);
 }
 const beforeMax=win.getBounds();
 await js("window.nocturneNotes.windowAction('maximize')");
 await wait(()=>js("document.querySelector('#window').classList.contains('is-maximized') && [...document.querySelectorAll('.nocturne-native-corner-grip')].every(g=>getComputedStyle(g).display==='none')"),'maximize and hide grips');
 await js("window.nocturneNotes.windowAction('maximize')");
 await wait(()=>js("!document.querySelector('#window').classList.contains('is-maximized')"),'restore');
 assert.deepEqual(win.getBounds(),beforeMax);
 console.log('PASS custom maximize and restore');
 // A long caption must never push the fixed history block, including at 740px.
 const fixedHistory=()=>js(`(()=>{const h=document.querySelector('.edit-history'),p=document.querySelector('#project-caption'),a=document.querySelector('.app-name'),r=e=>e.getBoundingClientRect();return {x:r(h).x,a:r(a).x,p:r(p).x,right:r(p).right,scroll:p.scrollWidth,client:p.clientWidth,overflow:getComputedStyle(p).textOverflow,drag:r(document.querySelector('.drag-space')).width};})()`);
 const caption=await js("document.querySelector('#project-caption').textContent");
 const actualTitle=await js("document.querySelector('#project-caption').title");
 assert.equal(actualTitle,'New Project');
 const hover=await js(`(()=>{const p=document.querySelector('#project-caption'),r=p.getBoundingClientRect();return {region:getComputedStyle(p).getPropertyValue('-webkit-app-region'),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===p,drag:getComputedStyle(document.querySelector('.drag-space')).getPropertyValue('-webkit-app-region')};})()`);
 assert.equal(hover.region,'no-drag');assert.ok(hover.hit,'project caption receives pointer hit');assert.equal(hover.drag,'drag');
 const baseHistory=await fixedHistory();
 for(const value of ['— А','— New Project','— '+('Очень длинное имя проекта '.repeat(15))]){
  await js("document.querySelector('#project-caption').textContent="+JSON.stringify(value));
  const m=await fixedHistory();near(m.x,baseHistory.x,.1);near(m.a,baseHistory.a,.1);near(m.p,baseHistory.p,.1);near(m.right+16,m.x,.1);assert.equal(m.overflow,'clip');assert.ok(m.drag>=24);
  if(value.length>100)assert.ok(m.scroll>m.client);
 }
 await js("document.querySelector('#project-caption').textContent="+JSON.stringify(caption));
 console.log('PASS fixed history, caption native title and non-drag hover region',JSON.stringify({baseHistory,hover}));
 // Test the real pointer path before any viewport emulation. Keep the
 // native window at the already validated 740x480 size after restore.
 const nativeFooter=await measure();
 near(nativeFooter.sidebar.w,240,.1);
 const nativeOffsets=nativeFooter.buttons.map(({circle,svg,ink})=>[svg.cx-circle.cx,svg.cy-circle.cy,ink.x-circle.cx,ink.y-circle.cy]);
 wc.debugger.attach('1.3');
 const grip=await js(`(()=>{const r=document.querySelector('#sidebar-resizer').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),left:document.querySelector('#window').getBoundingClientRect().left};})()`);
 const mouse=async(type,x,buttons)=>wc.debugger.sendCommand('Input.dispatchMouseEvent',{type,x,y:grip.y,button:type==='mouseMoved'?'none':'left',buttons,clickCount:1});
 await mouse('mouseMoved',grip.x,0);await mouse('mousePressed',grip.x,1);
 await wait(()=>js("document.body.classList.contains('sidebar-resizing')"),'native pointer drag started');
 let current=240;
 try{
  for(const width of [239,240,241,242,243,242,241,240]){
   current=width;
   await mouse('mouseMoved',Math.round(grip.left+width),1);
   const m=await wait(async()=>{const v=await measure();return Math.abs(v.sidebar.w-width)<=.1?v:false;},'native pointer width '+width);
   geometry(m);
   m.buttons.forEach(({circle,svg,ink},i)=>{[svg.cx-circle.cx,svg.cy-circle.cy,ink.x-circle.cx,ink.y-circle.cy].forEach((v,j)=>near(v,nativeOffsets[i][j],.1));});
  }
 }catch(error){
  console.error('Native sidebar drag diagnostic',JSON.stringify({target:current,actual:await measure(),dragging:await js("document.body.classList.contains('sidebar-resizing')"),grip}));
  throw error;
 }finally{
  await mouse('mouseReleased',Math.round(grip.left+current),0);
  wc.debugger.detach();
 }
 await wait(()=>js("!document.body.classList.contains('sidebar-resizing')"),'native pointer drag ended');
 await wait(async()=> (await js("window.nocturneNotes.bootstrap()")).settings.sidebarWidth===240,'native pointer width persisted');
 console.log('PASS native sidebar drag and stable footer glyph offsets');
 // Actual window resize plus CDP viewport override for wide/narrow desktop
 // widths even when the Windows CI runner has a small virtual display.
 wc.debugger.attach('1.3');
 for(const [fontSize,titleSize] of [[17,20],[10,24],[35,35],[17,15]]){
  await js(`window.nocturneNotes.updateSettings({fontSize:${fontSize},titleSize:${titleSize},sidebarWidth:240})`);
  const ready=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await ready;
  await wait(()=>js("!!document.querySelector('.note-row') && getComputedStyle(document.querySelector('.sidebar-footer > button > svg')).translate !== 'none' && parseFloat(getComputedStyle(document.querySelector('.editor')).fontSize)==="+fontSize),'settings reload');
  for(const width of [740,900,1064,1440,1800,2400]){
   win.setSize(width,650);
   await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height:650,deviceScaleFactor:1,mobile:false});
   await wait(()=>js('innerWidth === '+width),'viewport width');
   await delay(90);
   const m=await measure();
   near(m.title,titleSize,.01);near(m.text,fontSize,.01);near(m.list,15,.01);near(m.caption,15,.01);near(m.titleHeight,Math.max(30,Math.ceil(titleSize*1.25)),.1);
   geometry(m);
   console.log('PASS font/geometry',fontSize,titleSize,width);
  }
 }
 // Let Chromium settle the viewport and its ResizeObserver before setting
 // sidebar widths through the real application settings/keyboard path.
 win.setSize(1064,650);
 await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width:1064,height:650,deviceScaleFactor:1,mobile:false});
 await wait(()=>js('innerWidth === 1064'),'sidebar test viewport');
 const waitWidth=width=>wait(async()=>{
  const m=await measure();
  return m.width===1064&&Math.abs(m.sidebar.w-width)<=.1?m:false;
 },'rendered sidebar width '+width);
 const reloadWidth=async width=>{
  await js("window.nocturneNotes.updateSettings({sidebarWidth:"+width+"})");
  const loaded=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await loaded;
  await wait(()=>js("!!document.querySelector('.note-row') && getComputedStyle(document.querySelector('.sidebar-footer > button > svg')).translate !== 'none'"),'sidebar renderer boot');
  const m=await waitWidth(width);
  const persisted=await js("window.nocturneNotes.bootstrap()");
  assert.equal(persisted.settings.sidebarWidth,width);
  return m;
 };
 // Do not mutate the CSS variable: production ResizeObserver correctly
 // restores its own state and can overwrite a test-only style assignment.
 // Check the full range via persisted production settings; odd and even
 // widths on both sides of the responsive gap breakpoint are intentional.
 let footerOffsets;
 for(const width of [120,121,122,123,124,130,169,170,171,172,205,239,240,241,242,243,350]){
  const m=await reloadWidth(width);geometry(m);
  const offsets=m.buttons.map(({circle,svg,ink})=>[svg.cx-circle.cx,svg.cy-circle.cy,ink.x-circle.cx,ink.y-circle.cy]);
  if(!footerOffsets)footerOffsets=offsets;
  offsets.forEach((values,i)=>values.forEach((v,j)=>near(v,footerOffsets[i][j],.1)));
  console.log('PASS sidebar geometry',width);
 }
 // Exercise the real accessible resize handle, not a CSS override.
 await reloadWidth(240);
 await js("document.querySelector('#sidebar-resizer').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");
 geometry(await waitWidth(250));
 await wait(async()=> (await js("window.nocturneNotes.bootstrap()")).settings.sidebarWidth===250,'keyboard width persisted');
 await js("document.querySelector('#sidebar-resizer').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");
 geometry(await waitWidth(240));
 await wait(async()=> (await js("window.nocturneNotes.bootstrap()")).settings.sidebarWidth===240,'keyboard width restored');
 // Search expands narrow sidebar temporarily and restores saved width.
 await reloadWidth(120);
 await js("document.querySelector('#search-toggle').click()");
 geometry(await waitWidth(220));
 await js("document.querySelector('#search-close').click()");
 geometry(await waitWidth(120));
 await js("document.querySelector('#sidebar-tab').click()");
 await wait(()=>js("getComputedStyle(document.querySelector('.sidebar-footer')).visibility==='hidden'"),'sidebar collapsed');
 await js("document.querySelector('#sidebar-tab').click()");
 geometry(await waitWidth(120));
 await wc.debugger.sendCommand('Emulation.clearDeviceMetricsOverride');
 wc.debugger.detach();



 // Exercise the actual controls, not just the preload API.
 win.setSize(740,480);
 await wait(()=>js('innerWidth===740 && innerHeight===480'),'minimum settings viewport');
 await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=settings]').click()");
 await wait(()=>js("!!document.querySelector('#setting-line')"),'settings sliders');
 const settingsLayout=await js(`(()=>{const d=document.querySelector('.glass-dialog'),r=d.getBoundingClientRect(),rows=[...document.querySelectorAll('.font-setting')];return {w:r.width,h:r.height,scroll:d.scrollHeight,client:d.clientHeight,rows:rows.map(x=>{const a=x.querySelector('.setting-copy').getBoundingClientRect(),b=x.querySelector('.font-controls').getBoundingClientRect();return {gap:b.left-a.right,aligned:Math.abs(a.y+a.height/2-b.y-b.height/2)<1};})};})()`);
 near(settingsLayout.w,600,.1);
 assert.ok(settingsLayout.h<=456,'settings remains within the minimum window: '+JSON.stringify(settingsLayout));
 assert.ok(settingsLayout.rows.every(r=>Math.abs(r.gap-16)<1&&r.aligned),'horizontal sliders');
 console.log('PASS minimum settings layout (scroll allowed)',JSON.stringify(settingsLayout));
 const fontListLayout=async()=>{
  await js("document.querySelector('[data-select-trigger=setting-editor-font]').click()");
  const m=await js(`(()=>{const list=document.querySelector('[data-select=setting-editor-font] .glass-select-list'),d=document.querySelector('.glass-dialog'),r=list.getBoundingClientRect(),dr=d.getBoundingClientRect();return {height:list.clientHeight,scroll:list.scrollHeight,overflow:getComputedStyle(list).overflowY,count:list.children.length,inside:r.top>=dr.top&&r.bottom<=dr.bottom,visible:[...list.children].every(b=>{const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b;})};})()`);
  assert.equal(m.count,7);assert.ok(m.scroll<=m.height+1&&m.overflow==='visible'&&m.inside&&m.visible,'all seven font choices must fit and be clickable: '+JSON.stringify(m));
  await js("document.querySelector('[data-select-trigger=setting-editor-font]').click()");
 };
 await fontListLayout();
 win.setSize(900,790);
 await wait(()=>js('innerWidth===900 && innerHeight===790'),'normal settings viewport');
 const roomy=await js(`(()=>{const d=document.querySelector('.glass-dialog');return {height:d.clientHeight,scroll:d.scrollHeight,row:document.querySelector('.font-setting').getBoundingClientRect().height,button:document.querySelector('.font-step').getBoundingClientRect().height,padding:parseFloat(getComputedStyle(d).paddingTop)};})()`);
 assert.ok(roomy.scroll<=roomy.height+1&&roomy.row>=45&&roomy.row-roomy.button>=9&&roomy.padding===20,'normal settings have spacing without scroll: '+JSON.stringify(roomy));
 await fontListLayout();
 console.log('PASS relaxed settings and complete font list',JSON.stringify(roomy));
 const controls=await js("[...document.querySelectorAll('.dialog-options input[type=range]')].map(x=>[x.id,x.min,x.max,x.step])");
 assert.deepEqual(controls,[['setting-title-size','15','35','1'],['setting-font','10','35','1'],['setting-line','1','2','0.1']]);
 const fontOptions=await js("[...document.querySelectorAll('[data-select-option=setting-editor-font]')].map(b=>b.textContent)");
 assert.deepEqual(fontOptions,['Segoe UI Variable','Arial','Calibri','Verdana','Tahoma','Georgia','Times New Roman']);
 const originalInterfaceFont=await js("getComputedStyle(document.querySelector('.app-name')).fontFamily");
 await js("document.querySelector('[data-select-trigger=setting-editor-font]').click();document.querySelector('[data-select-option=setting-editor-font][data-value=georgia]').click()");
 assert.equal(await js("document.querySelector('#setting-editor-font').value"),'georgia');
 await js("document.querySelector('#setting-title-size').value=35;document.querySelector('#setting-font').value=17;document.querySelector('#setting-line').value=2;document.querySelector('#dialog-confirm').click()");
 await wait(async()=> (await js("window.nocturneNotes.bootstrap()")).settings.lineHeight===2,'slider persistence');
 await wait(()=>js("parseFloat(getComputedStyle(document.querySelector('#note-title')).fontSize)===35"),'title max applies');
 assert.equal(await js("getComputedStyle(document.querySelector('#note-title')).height"),'44px');
 near(await js("parseFloat(getComputedStyle(document.querySelector('#editor')).lineHeight)"),34,.1);
 const fontState=await js("window.nocturneNotes.bootstrap()");
 assert.equal(fontState.settings.editorFont,'georgia');
 assert.match(await js("getComputedStyle(document.querySelector('#editor')).fontFamily"),/^Georgia/);
 assert.match(await js("getComputedStyle(document.querySelector('#note-title')).fontFamily"),/^Georgia/);
 assert.equal(await js("getComputedStyle(document.querySelector('.app-name')).fontFamily"),originalInterfaceFont);
 const fontReload=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await fontReload;
 await wait(()=>js("!!document.querySelector('.note-row') && getComputedStyle(document.querySelector('#editor')).fontFamily.startsWith('Georgia')"),'font preference survives reload');
 assert.match(await js("getComputedStyle(document.querySelector('#note-title')).fontFamily"),/^Georgia/);
 console.log('PASS seven font choices, independent UI font, persistence, three sliders and migrated settings');
 const input=async(value)=>js("(()=>{const e=document.querySelector('#editor');e.focus();e.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertText'}));e.innerHTML="+JSON.stringify(value)+";e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));})()");
 const body=()=>js("document.querySelector('#editor').textContent");
 await input('<p><strong>First</strong></p>');await delay(700);
 await input('<p><strong>Second</strong></p>');await delay(700);
 await js("document.querySelector('#edit-undo').click()");assert.equal(await body(),'First');
 await js("document.querySelector('#edit-redo').click()");assert.equal(await body(),'Second');
 await js("document.querySelector('#editor').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,ctrlKey:true,code:'KeyZ',key:'z'}))");assert.equal(await body(),'First');
 await input('<p><em>Third</em></p>');await delay(700);
 assert.equal(await js("document.querySelector('#edit-redo').disabled"),true);
 const draftName=async()=>{assert.equal(await js("document.querySelector('#project-caption').textContent"),'— New Project');const p=(await js("window.nocturneNotes.bootstrap()")).project;assert.equal(p.isDraft,true);assert.equal(p.name,'New Project');};
 await draftName();
 const orig=(await js("window.nocturneNotes.bootstrap()")).project.activeId;
 await js("document.querySelector('#add-note').click()");
 await wait(()=>js("document.querySelectorAll('.note-row').length===2"),'new note');
 await draftName();
 await js("document.querySelectorAll('.note-row')[0].click()");
 await wait(()=>js("document.querySelector('.note-row.active').dataset.id==="+JSON.stringify(orig)),'switch back');
 await js("document.querySelector('#edit-undo').click()");assert.equal(await body(),'First');
 await js("document.querySelector('#edit-redo').click()");assert.equal(await body(),'Third');
 console.log('PASS undo/redo branch and independent note history');
 const context=async id=>js("document.querySelector('[data-id="+JSON.stringify(id)+"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:100,clientY:120}))");
 await context(orig);await js("document.querySelector('[data-note-action=duplicate]').click()");
 await wait(()=>js("document.querySelectorAll('.note-row').length===3"),'duplicate');
 await draftName();
 let p=(await js("window.nocturneNotes.bootstrap()")).project;
 const copy=p.activeId;
 assert.notEqual(copy,orig);assert.equal(p.notes.find(n=>n.id===copy).html,'<p><em>Third</em></p>');
 await context(copy);await js("document.querySelector('[data-note-action=delete]').click();document.querySelector('#dialog-confirm').click()");
 await wait(()=>js("document.querySelectorAll('.note-row').length===2"),'move to trash');
 await draftName();
 assert.equal((await js("window.nocturneNotes.listTrash()"))[0].id,copy);
 await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=trash]').click()");
 await wait(()=>js("!!document.querySelector('.trash-row')"),'trash dialog');
 const trashWidth=()=>js("document.querySelector('.glass-dialog').getBoundingClientRect().width");
 near(await trashWidth(),440,.1);
 const trashLayout=await js(`(()=>{const r=document.querySelector('.trash-row'),b=[...r.querySelectorAll('button')];return {fits:b.every(e=>e.getBoundingClientRect().right<=r.getBoundingClientRect().right),title:document.querySelector('.trash-copy').getBoundingClientRect().width};})()`);
 assert.ok(trashLayout.fits&&trashLayout.title>=90,'trash controls remain readable: '+JSON.stringify(trashLayout));
 await js("document.querySelector('.trash-row button').click()");
 await wait(()=>js("document.querySelectorAll('.note-row').length===3"),'restore from trash');
 await draftName();
 await wait(()=>js("!document.querySelector('#dialog-backdrop').hidden && document.querySelector('#dialog-message').textContent==='Trash is empty'"),'empty trash after restore');
 near(await trashWidth(),400,.1);
 await js("document.querySelector('#dialog-confirm').click()");
 assert.deepEqual(await js("[...document.querySelectorAll('[data-note-action=move-up] path,[data-note-action=move-down] path')].map(e=>e.getAttribute('d'))"),['m5 15 7-7 7 7','m5 9 7 7 7-7']);
 console.log('PASS compact trash, vertical menu arrows, duplicate, delete and restore');
 assert.equal(await js("!!document.querySelector('[data-action=view]')"),false);
 await js("document.querySelector('#focus-mode').click()");
 await wait(()=>js("document.querySelector('#window').classList.contains('focus-mode') && getComputedStyle(document.querySelector('#sidebar')).display==='none' && getComputedStyle(document.querySelector('#titlebar')).display==='none'"),'focus mode');
 assert.equal(await js("!!document.querySelector('#focus-exit')"),false);
 await js("document.querySelector('#editor').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Escape'}))");
 assert.equal(await js("document.querySelector('#window').classList.contains('focus-mode')"),false);
 await js("document.querySelector('#editor').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'F11'}))");
 assert.equal(await js("document.querySelector('#window').classList.contains('focus-mode')"),true);
 await js("document.querySelector('#editor').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'F11'}))");
 assert.equal(await js("document.querySelector('#window').classList.contains('focus-mode')"),false);
 const chrome=await js(`(()=>{const q=s=>getComputedStyle(document.querySelector(s));return {wave:q('.glass-wave').display,history:q('.edit-history').boxShadow,background:q('.edit-history').backgroundImage,focus:q('#focus-mode').color,pin:q('#always-top').color,pinPath:document.querySelector('#always-top path').getAttribute('d')};})()`);
 assert.equal(chrome.wave,'none');assert.notEqual(chrome.history,'none');assert.match(chrome.background,/linear-gradient/);assert.equal(chrome.focus,chrome.pin);assert.match(chrome.pinPath,/M16 3 21 8/);
 await js("document.querySelector('#always-top').click()");
 await wait(()=>win.isAlwaysOnTop(),'always on top enabled');
 await wait(()=>js("document.querySelector('#always-top').getAttribute('aria-pressed')==='true'"),'active pin state');
 await js("document.querySelector('#editor').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,ctrlKey:true,shiftKey:true,code:'KeyT',key:'T'}))");
 await wait(()=>!win.isAlwaysOnTop(),'always on top disabled');
 await wait(()=>js("document.querySelector('#always-top').getAttribute('aria-pressed')==='false'"),'inactive pin state');
 console.log('PASS focus mode and always on top');
 const draftReload=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await draftReload;
 await wait(()=>js("document.querySelector('#project-caption').textContent==='— New Project'"),'reopened draft caption');
 await draftName();
 await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=new-project]').click()");
 await wait(()=>js("document.querySelectorAll('.note-row').length===1"),'new draft');
 await draftName();
 console.log('PASS draft display name survives mutations, reload and new project');
 // Language selection is in the final Application section. Both languages must preserve
 // the existing project data, geometry and current editor history.
 const openSettings=async()=>{
  await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=settings]').click()");
  await wait(()=>js("!document.querySelector('#dialog-backdrop').hidden && !!document.querySelector('#setting-language')"),'language settings');
 };
 const ownedLabels=()=>js(`(()=>{const p=s=>document.querySelector(s);return {lang:document.documentElement.lang,caption:p('#project-caption').textContent,menu:p('[data-action=new-project] span').textContent,trash:p('[data-action=trash] span').textContent,undo:p('#edit-undo').title,search:p('#search-toggle').title,placeholder:p('#editor').dataset.placeholder,rename:p('[data-note-action=rename] span').textContent,close:p('#close-btn').title};})()`);
 const enLabels={lang:'en',caption:'— New Project',menu:'New Project',trash:'Trash',undo:'Undo · Ctrl+Z',search:'Find and Replace · Ctrl+F',placeholder:'Start writing...',rename:'Rename',close:'Close'};
 const ruLabels={lang:'ru',caption:'— Новый проект',menu:'Новый проект',trash:'Корзина',undo:'Отменить · Ctrl+Z',search:'Поиск и замена · Ctrl+F',placeholder:'Начни писать...',rename:'Переименовать',close:'Закрыть'};
 assert.deepEqual(await ownedLabels(),enLabels);
 await input('<p>Настройки — user content</p>');await delay(700);
 const beforeLanguage=await js("document.querySelector('#editor').innerHTML");
 const setLanguage=async(value,expectedLabels)=>{
  await openSettings();
  const state=await js(`(()=>{const p=s=>document.querySelector(s);return {sections:[...document.querySelectorAll('.settings-group > .settings-caption')].map(e=>e.textContent),first:p('.settings-group .setting-row strong').textContent,last:p('.settings-group:last-child .setting-row:last-child strong').textContent,languageLabel:p('#setting-language').closest('.setting-row').querySelector('strong').textContent,trayChecked:p('#setting-tray').checked,selected:p('#setting-language').value,options:[...document.querySelectorAll('[data-select-option=setting-language]')].map(e=>e.textContent),width:p('.glass-dialog').getBoundingClientRect().width,sectionGaps:[...document.querySelectorAll('.settings-group + .settings-group')].map(e=>({margin:parseFloat(getComputedStyle(e).marginTop),padding:parseFloat(getComputedStyle(e).paddingTop),border:parseFloat(getComputedStyle(e).borderTopWidth)})),rangeWidths:[...document.querySelectorAll('.font-step')].map(e=>e.getBoundingClientRect().width),footer:p('#dialog-confirm').textContent};})()`);
  const isEn=state.selected==='en';
  assert.deepEqual(state.sections,isEn?['Editor','Saving','Application']:['Редактор','Сохранение','Приложение']);
  assert.equal(state.first,isEn?'Editor font':'Шрифт редактора');
  assert.equal(state.last,isEn?'Minimize to tray on close':'Сворачивать в трей при закрытии');
  assert.equal(state.languageLabel,isEn?'Application language':'Язык приложения');
  assert.equal(state.trayChecked,!isEn);
  assert.equal(state.sectionGaps.length,2);assert.deepEqual(state.sectionGaps[0],state.sectionGaps[1]);assert.ok(state.sectionGaps.every(g=>g.margin>0&&g.padding>0&&g.border===1));
  assert.deepEqual(state.options,isEn?['English','Russian']:['Английский','Русский']);
  near(state.width,600,.1);assert.ok(state.rangeWidths.every(w=>Math.abs(w-35)<.1));
  assert.equal(state.footer,isEn?'Save':'Сохранить');
  await js("document.querySelector('[data-select-trigger=setting-language]').scrollIntoView({block:'nearest'});document.querySelector('[data-select-trigger=setting-language]').click()");
  const optionHits=await js(`[...document.querySelectorAll('[data-select-option=setting-language]')].every(b=>{const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b;})`);
  assert.ok(optionHits,'both language options are visible and clickable');
  await js("document.querySelector('[data-select-option=setting-language][data-value="+value+"]').click();document.querySelector('#setting-tray').checked=true;document.querySelector('#dialog-confirm').click()");
  await wait(()=>js("document.documentElement.lang==="+JSON.stringify(value)),'language applied');
  assert.deepEqual(await ownedLabels(),expectedLabels);
  assert.equal(await js("document.querySelector('#editor').innerHTML"),beforeLanguage);
  assert.equal((await js("window.nocturneNotes.bootstrap()")).settings.language,value);
  assert.ok(main.getTray()&&!main.getTray().isDestroyed());
  assert.deepEqual(main.getTrayMenu().items.filter(i=>i.type!=='separator').map(i=>i.label),value==='en'?['Open Nocturne Notes','Exit']:['Открыть Nocturne Notes','Выход']);
 };
 await setLanguage('ru',ruLabels);
 await js("document.querySelector('#edit-undo').click()");
 assert.notEqual(await body(),'Настройки — user content');
 await js("document.querySelector('#edit-redo').click()");
 assert.equal(await body(),'Настройки — user content');
 await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=trash]').click()");
 await wait(()=>js("document.querySelector('#dialog-message').textContent==='Корзина пуста'"),'Russian trash');
 await js("document.querySelector('#dialog-confirm').click()");
 // A reload proves persistence; unlike a language switch it resets session undo.
 // Flush through the real window-blur handler before reloading only the renderer.
 await js("window.dispatchEvent(new Event('blur'))");
 await wait(async()=>{const p=(await js("window.nocturneNotes.bootstrap()")).project;return p.notes.find(n=>n.id===p.activeId)?.html===beforeLanguage;},'localized user content persisted');
 const languageReload=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await languageReload;
 await wait(()=>js("document.documentElement.lang==='ru' && document.querySelector('#project-caption').textContent==='— Новый проект'"),'Russian persisted');
 assert.deepEqual(await ownedLabels(),ruLabels);
 await setLanguage('en',enLabels);
 await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=trash]').click()");
 await wait(()=>js("document.querySelector('#dialog-message').textContent==='Trash is empty'"),'English trash');
 await js("document.querySelector('#dialog-confirm').click()");
 console.log('PASS English default, Russian and English live switch, saved locale, unchanged notes and session undo');
 // Exercise the actual Tray object and its native menu handlers. Never expose
 // these controls to the renderer or replace the real close/save handshake.
 const tray=main.getTray();assert.ok(tray&&!tray.isDestroyed());
 const trayProject=(await js("window.nocturneNotes.bootstrap()")).project;
 await input('<p>Tray save test</p>');
 await js("document.querySelector('#close-btn').click()");
 await wait(()=>!win.isVisible()&&!win.isDestroyed(),'close hides to tray');
 assert.equal((await js("window.nocturneNotes.bootstrap()")).project.notes.find(n=>n.id===trayProject.activeId).html,'<p>Tray save test</p>');
 tray.emit('click');
 await wait(()=>win.isVisible()&&!win.isMinimized(),'tray click restores window');
 assert.equal(await body(),'Tray save test');
 await js("document.querySelector('#edit-undo').click()");assert.notEqual(await body(),'Tray save test');
 await js("document.querySelector('#edit-redo').click()");assert.equal(await body(),'Tray save test');
 await js("document.querySelector('#min-btn').click()");
 await wait(()=>win.isMinimized(),'normal minimize unchanged');
 main.getTrayMenu().items.find(i=>i.id==='tray-open').click();
 await wait(()=>win.isVisible()&&!win.isMinimized(),'native Open restores minimized window');
 await openSettings();
 await js("document.querySelector('#setting-tray').checked=false;document.querySelector('#dialog-confirm').click()");
 await wait(()=>main.getTray()===null,'disable removes tray icon');
 assert.equal((await js("window.nocturneNotes.bootstrap()")).settings.minimizeToTray,false);
 await openSettings();
 await js("document.querySelector('#setting-tray').checked=true;document.querySelector('#dialog-confirm').click()");
 await wait(()=>main.getTray()&&!main.getTray().isDestroyed(),'enable recreates tray icon');
 await input('<p>Exit save test</p>');
 // Keep the test runner alive long enough to inspect disk after the real
 // native Exit callback closes the window; app.exit below ends the runner.
 app.on('before-quit',e=>e.preventDefault());
 main.getTrayMenu().items.find(i=>i.id==='tray-exit').click();
 await wait(()=>win.isDestroyed()&&main.getTray()===null,'native Exit closes and removes tray');
 const {ProjectStore}=require('../storage');
 const saved=new ProjectStore(trayProject.path);
 try{assert.equal(saved.snapshot().notes.find(n=>n.id===trayProject.activeId).html,'<p>Exit save test</p>');}finally{saved.close();}
 assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'),'utf8')).settings.minimizeToTray,true);
 console.log('PASS native tray, bilingual menu, close saves and hides, restore retains undo, normal minimize, disable and Exit saves');
 console.log('PASS Electron desktop geometry, settings, search and collapse');
};
run().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1)});
