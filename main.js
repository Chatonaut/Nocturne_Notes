'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,Menu,Tray,nativeImage,nativeTheme,screen} = require('electron');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const processStartedAt=performance.now();
let backendReadyAt=0;
let firstWindowCreatedAt=0;
const {ProjectStore,newProject,exists}=require('./storage');
const {RecoveryStore}=require('./recovery');
const {roundWindowRegion}=require('./window-shape');
const {cornerResizeBounds}=require('./corner-resize');
let win=null, store=null, prefs={}, prefsPath='', closeApproved=false, recovery=null;
let tray=null,trayMenu=null,quitRequested=false,closePending=false,rendererReady=false;
const isWin=process.platform==='win32';
// Installed releases retain Electron's existing userData path for upgrades.
 // Portable releases share a stable, version-independent profile, separate from
 // the installed edition. Never move or delete experimental profiles or drafts.
 const isPortable=app.isPackaged&&!!process.env.PORTABLE_EXECUTABLE_FILE;
 if(isPortable){
  const profile=path.join(app.getPath('appData'),'Nocturne Notes Portable');
  fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
 }
// Native menus follow the dark Nocturne window even when Windows uses a light theme.
nativeTheme.themeSource='dark';
let cornerDrag=null, cornerMoveTimer=null;
const CORNER_FRAME_MS=16;
const legacyResize=process.argv.includes('--corner-resize=legacy');
// Diagnostic fallback: add --corner-mode=native to test Windows DWM corners.
// Alpha mode removes the separate opaque backing; shape remains a diagnostic.
const cornerMode=!isWin?'native':process.argv.includes('--corner-mode=shape')?'shape':process.argv.includes('--corner-mode=native')?'native':'alpha';
const alphaMode=isWin&&cornerMode==='alpha';
let manualMaximized=false,restoreBounds=null;
const resizeDirections=['nw','ne','sw','se','n','s','w','e'];
function isWindowMaximized(){return !!win&&(manualMaximized||win.isMaximized());}
function resizeBounds(bounds,direction,dx,dy){
 if(direction==='n'||direction==='s')return cornerResizeBounds(bounds,direction+'e',0,dy,740,480);
 if(direction==='w'||direction==='e')return cornerResizeBounds(bounds,'s'+direction,dx,0,740,480);
 return cornerResizeBounds(bounds,direction,dx,dy,740,480);
}
function toggleMaximize(){
 if(!win||win.isDestroyed())return;
 stopCornerDrag();
 if(!alphaMode){win.isMaximized()?win.unmaximize():win.maximize();return;}
 if(manualMaximized){
  manualMaximized=false;
  if(restoreBounds)win.setBounds(restoreBounds);
  restoreBounds=null;
 }else{
  restoreBounds=win.getBounds();manualMaximized=true;
  win.setBounds(screen.getDisplayMatching(restoreBounds).workArea);
 }
 win.webContents.send('app:window-state',manualMaximized);
}
const {safeSettings}=require('./settings');
const {text:translate,errorText}=require('./i18n');
const t=key=>translate(prefs?.settings?.language||'en',key);
function readPrefs(){
 prefsPath=path.join(app.getPath('userData'),'preferences.json');
 try{prefs=JSON.parse(fs.readFileSync(prefsPath,'utf8'));}catch{prefs={};}
 if(!prefs||typeof prefs!=='object'||Array.isArray(prefs))prefs={};
 if(!Array.isArray(prefs.recent))prefs.recent=[];
 // Respect all valid saved preferences, including the old default combination
 // when deliberately selected by a user. Defaults apply only to missing values.
 prefs.settings=safeSettings(prefs.settings||{});
}
function writePrefs(){
 const dir=path.dirname(prefsPath);fs.mkdirSync(dir,{recursive:true});
 const tmp=prefsPath+'.tmp';fs.writeFileSync(tmp,JSON.stringify(prefs,null,2),'utf8');fs.renameSync(tmp,prefsPath);
}
function safeFileName(s){return s.replace(/[\\/:*?"<>|]/g,'_').slice(0,65)||t("Проект");}
function noteToText(html){return html.replace(/<\/?(?:p|div|h[1-6]|li|ul|ol|blockquote|br)[^>]*>/gi,'\n').replace(/<[^>]+>/g,'').replaceAll('&nbsp;',' ').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&').replace(/^\n+|\n+$/g,'');}
function htmlToMarkdown(html){
 let out=String(html||'');
 out=out.replace(/<a\s+[^>]*href=["'](https?:\/\/[^"']+|mailto:[^"']+)["'][^>]*>(.*?)<\/a>/gis,(_all,href,label)=>`[${label.replace(/<[^>]*>/g,'')}](${href})`);
 out=out.replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gis,(_,level,v)=>`\n${'#'.repeat(Number(level))} ${v}\n\n`);
 out=out.replace(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/gis,'**$1**').replace(/<(?:em|i)[^>]*>(.*?)<\/(?:em|i)>/gis,'*$1*').replace(/<(?:del|s|strike)[^>]*>(.*?)<\/(?:del|s|strike)>/gis,'~~$1~~');
 out=out.replace(/<li[^>]*>(.*?)<\/li>/gis,'- $1\n').replace(/<br\s*\/?>/gi,'\n').replace(/<\/?(?:p|div|ul|ol|blockquote)[^>]*>/gi,'\n');
 return out.replace(/<[^>]*>/g,'').replaceAll('&nbsp;',' ').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&').replace(/\n{3,}/g,'\n\n').trim();
}
function ensureProject(){if(!store)throw new Error('Нет открытого проекта');}
function projectData(){
 ensureProject();
 const snapshot=store.snapshot();
 const isDraft=isDraftPath(store.path);
 // The internal UUID remains on disk for crash-safe recovery but is never UI text.
 return {...snapshot,name:isDraft?t("Новый проект"):snapshot.name,isDraft};
}
function isDraftPath(filePath){return typeof filePath==='string'&&path.resolve(filePath).startsWith(path.resolve(path.join(app.getPath('userData'),'drafts'))+path.sep);}
function remember(filePath){
 prefs.lastProject=filePath;
 // Recover drafts on launch but never list internal drafts as user projects.
 prefs.recent=prefs.recent.filter(p=>!isDraftPath(p)&&p!==filePath&&exists(p));
 if(!isDraftPath(filePath))prefs.recent.unshift(filePath);
 prefs.recent=prefs.recent.slice(0,8);
 writePrefs();
}
function changeProject(filePath){
 const next=new ProjectStore(filePath);
 if(recovery){try{recovery.restore(next)}catch(e){console.error('Recovery restore failed',e)}}
 const old=store;store=next; if(old)old.close();
 remember(filePath);
 return projectData();
}
function createDraft(useExamples=false){
 const file=path.join(app.getPath('userData'),'drafts',`draft-${crypto.randomUUID()}.ns`);
 newProject(file, useExamples?undefined:[{title:t("Новая заметка"),html:'<p></p>'}]);
 return changeProject(file);
}
function initProject(){
 const cli=process.argv.find(v=>typeof v==='string'&&v.toLowerCase().endsWith('.ns')&&exists(v));
 const candidates=[cli,...(prefs.settings.restoreLastProject?[prefs.lastProject]:[])].filter(Boolean);
 for(const p of candidates){try{if(exists(p))return changeProject(p);}catch(err){console.error('Could not open',p,err)}}
 return createDraft(false);
}
function configureSpellchecker(){
 if(!win||win.isDestroyed())return;
 const session=win.webContents.session;
 try{
  session.setSpellCheckerEnabled(!!prefs.settings.spellcheckEnabled);
  if(prefs.settings.spellcheckEnabled){
   const available=session.availableSpellCheckerLanguages||[];
   const languages=['ru','en-US'].filter(v=>available.includes(v));
   if(languages.length)session.setSpellCheckerLanguages(languages);
  }
 }catch(e){console.warn('Spellchecker not available:',e.message)}
}
function installTextContextMenu(){
 win.webContents.on('context-menu',(_event,params)=>{
  if(!params.isEditable)return;
  const items=[];
  if(prefs.settings.spellcheckEnabled&&params.misspelledWord){
   for(const word of (params.dictionarySuggestions||[]).slice(0,6))items.push({label:word,click:()=>win.webContents.replaceMisspelling(word)});
   if(!params.dictionarySuggestions?.length)items.push({label:t("Нет предложений"),enabled:false});
   items.push({type:'separator'});
  }
  const flags=params.editFlags||{};
  items.push({label:t("Отменить"),click:()=>win.webContents.send('app:edit-history','undo')},
   {label:t("Повторить"),click:()=>win.webContents.send('app:edit-history','redo')},
   {type:'separator'},
   {label:t("Вырезать"),role:'cut',enabled:!!flags.canCut},
   {label:t("Копировать"),role:'copy',enabled:!!flags.canCopy},
   {label:t("Вставить"),role:'paste',enabled:!!flags.canPaste},
   {type:'separator'},{label:t("Выделить все"),role:'selectAll'});
  Menu.buildFromTemplate(items).popup({window:win});
 });
}
// Win32's shaped window region controls both visible pixels and mouse hit testing.
// That is fundamentally different from CSS border-radius, which clips only HTML.
let appliedRegionKey='';
function updateWindowRegion(){
 if(!isWin||cornerMode!=='shape'||!win||win.isDestroyed())return;
 try{
  const maximized=win.isMaximized()||win.isFullScreen();
  const [width,height]=win.getSize();
  const key=maximized?'maximized':`${width}x${height}`;
  if(key===appliedRegionKey)return; // Never rebuild an identical region.
  // This call is synchronous: do not schedule it with setTimeout or rAF.
  // The old timer left the rectangular compositor frame visible while dragging.
  win.setShape(maximized?[]:roundWindowRegion(width,height,29));
  appliedRegionKey=key;
 }catch(e){
  console.warn('Rounded Win32 region unavailable; using system window corners:',e.message);
 }
}
function stopCornerDrag(){
 if(cornerMoveTimer!==null){clearTimeout(cornerMoveTimer);cornerMoveTimer=null;}
 cornerDrag=null;
}
function applyCornerMove(){
 if(cornerMoveTimer!==null){clearTimeout(cornerMoveTimer);cornerMoveTimer=null;}
 const drag=cornerDrag;
 if(!drag||!drag.point||!win||win.isDestroyed()||isWindowMaximized()||win.isFullScreen())return;
 const point=drag.point;drag.point=null;drag.appliedAt=performance.now();
 const next=resizeBounds(drag.bounds,drag.corner,point.x-drag.start.x,point.y-drag.start.y);
 if(next){
  const current=win.getBounds();
  if(current.x===next.x&&current.y===next.y&&current.width===next.width&&current.height===next.height)return;
  // Bounds are coalesced, but the native region is always updated synchronously.
  win.setBounds(next);updateWindowRegion();
 }
}
function queueCornerMove(point){
 if(!cornerDrag)return;
 cornerDrag.point=point;
 const elapsed=performance.now()-cornerDrag.appliedAt;
 if(legacyResize||elapsed>=CORNER_FRAME_MS){applyCornerMove();return;}
 if(cornerMoveTimer===null)cornerMoveTimer=setTimeout(applyCornerMove,CORNER_FRAME_MS-elapsed);
}
function destroyTray(){
 if(tray&&!tray.isDestroyed())tray.destroy();
 tray=null;trayMenu=null;
}
function showWindow(){
 if(!win||win.isDestroyed()||!rendererReady)return;
 if(win.isMinimized())win.restore();
 win.show();win.focus();
}
function requestQuit(){
 quitRequested=true;
 if(!win||win.isDestroyed()){app.quit();return;}
 if(!rendererReady)closeApproved=true;
 win.close();
}
function syncTray(){
 if(!prefs.settings.minimizeToTray){destroyTray();return true;}
 try{
  if(!tray||tray.isDestroyed()){
   const logo=nativeImage.createFromPath(path.join(__dirname,'assets','nocturne-notes-logo.png'));
   if(logo.isEmpty())throw new Error('Tray icon is empty');
   tray=new Tray(logo);
   tray.setToolTip('Nocturne Notes');
   tray.on('click',showWindow);
  }
  trayMenu=Menu.buildFromTemplate([
   {id:'tray-open',label:t('Открыть Nocturne Notes'),click:showWindow},
   {type:'separator'},
   {id:'tray-exit',label:t('Выход'),click:requestQuit}
  ]);
  tray.setContextMenu(trayMenu);
  return true;
 }catch(error){
  console.error('Could not create the notification area icon:',error);
  destroyTray();return false;
 }
}
// Test access stays in the Electron main process, never in the renderer bridge.
if(!app.isPackaged)module.exports={getTray:()=>tray,getTrayMenu:()=>trayMenu};
function makeWindow(){
 rendererReady=false;closePending=false;quitRequested=false;
 appliedRegionKey='';manualMaximized=false;restoreBounds=null;
 const bounds=prefs.bounds || {};
 firstWindowCreatedAt=performance.now();
 win=new BrowserWindow({
  width:Math.max(740,bounds.width||1350),height:Math.max(480,bounds.height||790),
  x:Number.isFinite(bounds.x)?bounds.x:undefined,y:Number.isFinite(bounds.y)?bounds.y:undefined,
  minWidth:740,minHeight:480,show:false,frame:false,
  transparent:!isWin||alphaMode,
  backgroundColor:isWin&&!alphaMode?'#050505':'#00000000',backgroundMaterial:'none',
  roundedCorners:cornerMode==='native',thickFrame:isWin&&!alphaMode,hasShadow:true,
  // Keep size constraints dynamic; thickFrame remains disabled in alpha mode.
  resizable:true,
  title:'Nocturne Notes',icon:path.join(__dirname,'assets','nocturne-notes-logo.png'),autoHideMenuBar:true,
  webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:false,webSecurity:true,additionalArguments:['--nocturne-corner-mode='+cornerMode]}
 });
 // The acrylic DWM backing fills the rectangular window behind the rounded
 // HTML app, so keep the OS backing fully transparent instead.
 if(isWin&&!alphaMode && typeof win.setBackgroundMaterial==='function'){
   try{win.setBackgroundMaterial('none');}catch{ /* transparent window fallback */ }
 }
 // Clip the real Win32 drawing/input region BEFORE showing the first frame.
 updateWindowRegion();
 // Update the Win32 clipping region inside the native resize event, not on
 // the next event-loop turn. A final sync also covers maximize/restore.
 win.on('resize',updateWindowRegion);
 win.on('resized',updateWindowRegion);
 win.on('restore',updateWindowRegion);
 win.on('maximize',updateWindowRegion);
 win.on('unmaximize',updateWindowRegion);
 configureSpellchecker();installTextContextMenu();
 win.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//i.test(url))void shell.openExternal(url);return {action:'deny'};});
 win.webContents.on('did-fail-load',(_event,code,description,url,isMainFrame)=>{
  if(isMainFrame && code!==-3){
   dialog.showErrorBox('Nocturne Notes',t('Не удалось загрузить интерфейс: ')+description);
   closeApproved=true;win.destroy();
  }
 });
 // Rendering is intentionally hidden until the project, styles and two frames
 // have been prepared in the renderer. ready-to-show alone can paint a blank
 // acrylic rectangle before the application interface exists.
 win.loadFile(path.join(__dirname,'index.html')).catch(error=>{
  dialog.showErrorBox('Nocturne Notes',t('Ошибка загрузки приложения: ')+errorText(prefs.settings.language,error.message));
 });
 const firstFrameDeadline=setTimeout(()=>{
  if(win&&!win.isDestroyed()&&!rendererReady){
   dialog.showErrorBox('Nocturne Notes', t("Интерфейс не смог запуститься. Попробуйте открыть приложение снова."));
   closeApproved=true;win.destroy();
  }
 },20000);
 win.on('closed',()=>clearTimeout(firstFrameDeadline));
 win.on('maximize',()=>win.webContents.send('app:window-state',true));
 win.on('unmaximize',()=>win.webContents.send('app:window-state',false));
 win.on('close',event=>{
  if(!closeApproved && !win.webContents.isDestroyed()){
   event.preventDefault();
   if(closePending)return;
   closePending=true;win.webContents.send('app:before-close');return;
  }
  if(!isWindowMaximized())prefs.bounds=win.getBounds();
  else if(alphaMode&&restoreBounds)prefs.bounds=restoreBounds;
  prefs.maximized=isWindowMaximized();writePrefs();
 });
 win.on('closed',()=>{stopCornerDrag();destroyTray();win=null;rendererReady=false;closePending=false;});
}
function handler(name,fn){ipcMain.handle(name,async(_event,arg)=>{try{return await fn(arg);}catch(error){const message=errorText(prefs.settings.language,error?.message);if(message!==error?.message)throw new Error(message);throw error;}});}
function installHandlers(){
 // Win32 shaped corners are not clickable outside their real silhouette.
 // Invisible inner-corner handles initiate a mouse-captured resize without
 // adding back any pixels of the old rectangular backing.
 ipcMain.on('app:corner-resize',(event,request)=>{
  if(!isWin||!win||win.isDestroyed()||event.sender!==win.webContents)return;
  if(!request||typeof request!=='object')return;
  if(request.phase==='end'){applyCornerMove();stopCornerDrag();return;}
  if(isWindowMaximized()||win.isFullScreen()||cornerMode==='native')return;
  if(request.phase==='start'){
   if(!resizeDirections.includes(request.corner))return;
   if(cornerMode==='shape'&&request.corner.length!==2)return;
   const bounds=win.getBounds(),point=screen.getCursorScreenPoint();
   const d=request.corner;
   const targetX=d.includes('e')?bounds.x+bounds.width:bounds.x;
   const targetY=d.includes('s')?bounds.y+bounds.height:bounds.y;
   if((d.includes('e')||d.includes('w'))&&Math.abs(point.x-targetX)>36)return;
   if((d.includes('s')||d.includes('n'))&&Math.abs(point.y-targetY)>36)return;
   if(point.x<bounds.x-36||point.x>bounds.x+bounds.width+36||point.y<bounds.y-36||point.y>bounds.y+bounds.height+36)return;
   stopCornerDrag();cornerDrag={corner:request.corner,start:point,bounds,appliedAt:-Infinity,point:null};
   return;
  }
  if(request.phase==='move'&&cornerDrag){
   queueCornerMove(screen.getCursorScreenPoint());
  }
 });
 ipcMain.on('app:renderer-ready',event=>{
  if(!win || win.isDestroyed() || win.webContents!==event.sender || rendererReady)return;
  rendererReady=true;
  if(prefs.maximized&&!isWindowMaximized())toggleMaximize();
  updateWindowRegion();
  win.show();
  const shownAt=performance.now();
  const metrics={electronVersion:process.versions.electron,resizeMode:legacyResize?'legacy':'coalesced',electronProcessToShownMs:Math.round(shownAt-processStartedAt),
   backendReadyMs:Math.round(backendReadyAt-processStartedAt),
   windowCreatedToShownMs:Math.round(shownAt-firstWindowCreatedAt),cornerMode};
  // The Portable launcher unpacks BEFORE main.js runs. These diagnostics let
  // us separate its cost from Electron/renderer startup in the next test.
  fs.writeFile(path.join(app.getPath('userData'),'startup-timing.json'),JSON.stringify(metrics,null,2),()=>{});
 });
 handler('bootstrap',()=>({project:projectData(),sidebarCollapsed:!!prefs.sidebarCollapsed,recent:prefs.recent.filter(exists),settings:{...prefs.settings}}));
 handler('update-settings',updates=>{
  const old=prefs.settings,next=safeSettings({...old,...updates});
  if(JSON.stringify(old)!==JSON.stringify(next)){
   prefs.settings=next;
   if((old.minimizeToTray!==next.minimizeToTray||old.language!==next.language)&&!syncTray()){
    prefs.settings=old;syncTray();throw new Error('Не удалось создать значок в трее');
   }
   writePrefs();
   if(old.spellcheckEnabled!==next.spellcheckEnabled)configureSpellchecker();
  }
  return {...prefs.settings};
 });
 handler('save-recovery-draft',note=>{ensureProject();recovery.save(store.path,note);return true;});
 handler('create-project',()=>createDraft(false));
 handler('open-project',async()=>{
  const answer=await dialog.showOpenDialog(win,{title:t("Открыть проект Nocturne Notes"),properties:['openFile'],filters:[{name:'Nocturne Notes',extensions:['ns']}]});
  return answer.canceled?null:changeProject(answer.filePaths[0]);
 });
 handler('open-recent',p=>{
  if(typeof p!=='string'||!prefs.recent.includes(p)||!exists(p))throw new Error('Файл проекта не найден');
  return changeProject(p);
 });
 handler('save-project',async()=>{
  ensureProject();
  if(projectData().isDraft)return saveAs();
  return {path:store.path,name:projectData().name};
 });
 handler('save-project-as',saveAs);
 handler('create-note',()=>{ensureProject();const n=store.addNote(t('Новая заметка'));return n;});
 handler('update-note',n=>{ensureProject();const saved=store.updateNote(n);recovery.remove(store.path,n.id);return saved;});
 handler('select-note',id=>{ensureProject();store.selectNote(id);return true;});
 handler('delete-note',id=>{ensureProject();store.trashNote(id);recovery.remove(store.path,id);return projectData();});
 handler('duplicate-note',id=>{ensureProject();store.duplicateNote(id,t(' — копия'));return projectData();});
 handler('list-trash',()=>{ensureProject();return store.listTrash();});
 handler('restore-trash',id=>{ensureProject();store.restoreTrash(id);recovery.remove(store.path,id);return projectData();});
 handler('purge-trash',id=>{ensureProject();store.purgeTrash(id);return true;});
 handler('always-on-top',value=>{if(typeof value==='boolean')win.setAlwaysOnTop(value);return win.isAlwaysOnTop();});
 handler('reorder-notes',ids=>{ensureProject();store.reorder(ids);return true;});
 handler('set-sidebar',v=>{prefs.sidebarCollapsed=!!v;writePrefs();return true;});
 handler('export-note',async({id,format})=>{
  ensureProject();const note=store.snapshot().notes.find(n=>n.id===id);
  if(!note)throw new Error('Заметка не найдена');
  if(!['txt','html','md'].includes(format))throw new Error('Недопустимый формат');
  const result=await dialog.showSaveDialog(win,{title:t("Экспорт заметки"),defaultPath:`${safeFileName(note.title)}.${format}`,filters:[{name:format.toUpperCase(),extensions:[format]}]});
  if(result.canceled)return null;
  const body=format==='html'?`<!doctype html><meta charset="utf-8"><title>${note.title.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</title>${note.html}`:(format==='md'?htmlToMarkdown(note.html):noteToText(note.html));
  fs.writeFileSync(result.filePath,body,'utf8');return result.filePath;
 });
 handler('window-action',action=>{
  if(action==='minimize')win.minimize();
  if(action==='maximize')toggleMaximize();
  if(action==='close')win.close();
  return true;
 });
 handler('get-window-state',()=>isWindowMaximized());
 handler('get-recent',()=>prefs.recent.filter(exists));
 ipcMain.on('app:ready-to-close',(event,ok)=>{
  if(!win||win.isDestroyed()||win.webContents!==event.sender||!closePending)return;
  closePending=false;
  if(ok!==true){quitRequested=false;showWindow();return;}
  if(!quitRequested&&prefs.settings.minimizeToTray&&tray&&!tray.isDestroyed()){
   stopCornerDrag();win.hide();return;
  }
  closeApproved=true;win.close();
 });
}
async function saveAs(){
 ensureProject();
 const old=store.path;
 const result=await dialog.showSaveDialog(win,{title:t("Сохранить проект Nocturne Notes"),defaultPath:projectData().isDraft?t("Новый проект.ns"):path.basename(old),filters:[{name:t("Проект Nocturne Notes"),extensions:['ns']}]});
 if(result.canceled)return null;
 let target=result.filePath;
 if(path.extname(target).toLowerCase()!=='.ns')target+='.ns';
 if(path.resolve(target)===path.resolve(old))return {path:old,name:projectData().name};
 // SQLite DELETE journal mode keeps the whole project within one portable file.
 store.close();store=null;
 try{fs.copyFileSync(old,target);return changeProject(target);}
 catch(e){store=new ProjectStore(old);throw e;}
}
app.whenReady().then(()=>{
 backendReadyAt=performance.now();
 if(isWin)app.setAppUserModelId(isPortable?'com.nocturnenotes.desktop.portable':'com.nocturnenotes.desktop');
 recovery=new RecoveryStore(path.join(app.getPath('userData'),'recovery'));readPrefs();initProject();installHandlers();
 if(!syncTray()){prefs.settings.minimizeToTray=false;writePrefs();}
 makeWindow();
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0){closeApproved=false;makeWindow();syncTray();}else showWindow();});
}).catch(error=>{dialog.showErrorBox('Nocturne Notes',String(error));app.quit();});
app.on('before-quit',event=>{
 if(win&&!win.isDestroyed()&&!closeApproved){event.preventDefault();requestQuit();}
});
app.on('window-all-closed',()=>{if(store){store.close();store=null;}if(process.platform!=='darwin')app.quit();});
