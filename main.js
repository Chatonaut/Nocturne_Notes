'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,Menu,Tray,nativeImage,nativeTheme,screen} = require('electron');
// Packaged diagnostic is intentionally isolated from normal profile initialization.
// It cannot execute external JS or access a user-selected project.
if(app.isPackaged&&process.argv.includes('--nocturne-verify-native')){
 try{require('./cipher-db').verifyNativeRuntime();app.exit(0);}
 catch(e){console.error('Packaged native verification failed:',e.message);app.exit(1);}
}else{
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const processStartedAt=performance.now();
let backendReadyAt=0;
let firstWindowCreatedAt=0;
const {ProjectStore,newProject,exists,encryptedFile,sameFile,assertReplaceable,publishCopy}=require('./storage');
const {markdown:htmlToMarkdown,plainText:noteToText,exportHTML}=require('./html-content');
const {valid:validIPC,sameLocalFileURL}=require('./ipc-contract');
const {safeLink}=require('./content-policy');
const {pathToFileURL}=require('node:url');
const {RecoveryStore}=require('./recovery');
const {isManagedDraft,withinDraftDirectory,cleanDrafts,safeDirectory}=require('./drafts');
const {roundWindowRegion}=require('./window-shape');
const {cornerResizeBounds}=require('./corner-resize');
let win=null, store=null, prefs={}, prefsPath='', closeApproved=false, recovery=null;
let tray=null,trayMenu=null,quitRequested=false,closePending=false,rendererReady=false;
let lockedPath=null,pendingUnlock=null,pendingExternal=null,pendingDraftDecision=null,transitionBusy=false;
const isWin=process.platform==='win32';
// Installed releases retain Electron's existing userData path for upgrades.
 // The Portable uses a separate profile from the installed edition.
 // Never move profiles. Managed temporary drafts have an explicit lifecycle.
 const isPortable=app.isPackaged&&!!process.env.PORTABLE_EXECUTABLE_FILE;
 if(isPortable){
  const profile=path.join(app.getPath('appData'),'Nocturne Notes Portable');
  fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
 }
// CI-only startup trace. Fixed file in the existing profile, no command,
// caller-selected destination, note contents or passwords. Normal startup
// neither creates this file nor changes its behavior.
const traceStartup=process.env.GITHUB_ACTIONS==='true'&&process.env.NOCTURNE_CI_STARTUP_TRACE==='1';
function startupTrace(stage,detail={}){
 if(!traceStartup)return;
 try{
  const dir=app.getPath('userData');
  fs.mkdirSync(dir,{recursive:true});
  fs.appendFileSync(path.join(dir,'startup-diagnostics.jsonl'),JSON.stringify({stage,elapsedMs:Math.round(performance.now()-processStartedAt),...detail})+'\n');
 }catch(e){console.error('CI startup trace:',e.message);}
}
startupTrace('main-loaded',{packaged:app.isPackaged,portable:isPortable,profile:app.getPath('userData'),appData:app.getPath('appData')});
// Enforce a single instance per edition/profile, including tray-hidden windows.
const ownsInstance=app.requestSingleInstanceLock();
startupTrace('instance-lock',{owned:ownsInstance});
if(!ownsInstance)app.exit(0);
// Native menus follow the dark Nocturne window even when Windows uses a light theme.
nativeTheme.themeSource='dark';
let cornerDrag=null, cornerMoveTimer=null;
const CORNER_FRAME_MS=16;
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
 // Respect valid saved preferences. Defaults apply only to missing or invalid values.
 prefs.settings=safeSettings(prefs.settings||{});
}
function writePrefs(){
 const dir=path.dirname(prefsPath);fs.mkdirSync(dir,{recursive:true});
 const tmp=prefsPath+'.tmp';fs.writeFileSync(tmp,JSON.stringify(prefs,null,2),{encoding:'utf8',flush:true});fs.renameSync(tmp,prefsPath);
}
function safeFileName(s){return s.replace(/[\\/:*?"<>|]/g,'_').slice(0,65)||t("Проект");}
function ensureProject(){if(!store)throw new Error('Нет открытого проекта');}
function projectData(){
 if(lockedPath&&!store)return {path:lockedPath,name:isDraftPath(lockedPath)?t('Новый проект'):path.basename(lockedPath,'.ns'),notes:[],activeId:null,encrypted:true,locked:true,isDraft:isDraftPath(lockedPath)};
 ensureProject();
 const snapshot=store.snapshot();
 const isDraft=isDraftPath(store.path);
 // The internal UUID remains on disk for crash-safe recovery but is never UI text.
 return {...snapshot,name:isDraft?t("Новый проект"):snapshot.name,isDraft};
}
const draftDirectory=()=>path.join(app.getPath('userData'),'drafts');
function isDraftPath(filePath){return isManagedDraft(draftDirectory(),filePath);}
function cleanupDrafts(options={}){
 try{cleanDrafts(draftDirectory(),{...options,recovery});}
 catch(error){console.warn('Draft cleanup failed:',error.message);return false;}
 return true;
}
function currentPath(){return store?.path||lockedPath;}
function draftHasData(){
 const file=currentPath();if(!isDraftPath(file))return false;
 if(!store||store.encrypted)return true;
 const notes=store.snapshot().notes;
 const defaultTitles=['Новая заметка','Без названия','New note','New Note','Untitled',t('Новая заметка'),t('Без названия')];
 return notes.length!==1||notes.some(n=>n.pinned||!defaultTitles.includes(n.title)||n.html!=='<p></p>')||store.listTrash().length>0;
}
function finishDraftDecision(choice){
 const pending=pendingDraftDecision;if(!pending)return;
 pendingDraftDecision=null;pending.resolve(choice);
}
async function confirmDraftLeave(){
 if(!draftHasData())return true;
 if(pendingDraftDecision||!win||win.isDestroyed()||!rendererReady)return false;
 const file=currentPath(),token=crypto.randomUUID();
 showWindow();
 const choice=await new Promise(resolve=>{
  pendingDraftDecision={token,resolve};
  try{win.webContents.send('app:confirm-draft',{token});}catch{finishDraftDecision('cancel');}
 });
 if(choice==='save')return !!store&&!isDraftPath(store.path);
 return choice==='discard'&&currentPath()===file;
}
async function transition(fn){
 if(transitionBusy||closePending)return null;
 transitionBusy=true;try{return await fn();}finally{transitionBusy=false;}
}
async function openWithDraft(file){
 if(currentPath()&&sameFile(currentPath(),file))return requestOpen(file);
 if(withinDraftDirectory(draftDirectory(),file))throw new Error('Выберите другое расположение проекта');
 if(!await confirmDraftLeave())return null;
 return requestOpen(file);
}
function finishDraftExit(){
 const file=currentPath();
 if(store){store.close();store=null;}lockedPath=null;pendingUnlock=null;
 if(cleanupDrafts()){
  if(isDraftPath(file))prefs.lastProject=null;
  prefs.activeDraft=null;
 }else{
  if(isDraftPath(file))prefs.activeDraft=file;
  dialog.showErrorBox('Nocturne Notes',t('Не удалось очистить черновики'));
 }
 // The close event persists this state together with window bounds.
}
function remember(filePath){
 prefs.lastProject=filePath;
 prefs.activeDraft=isDraftPath(filePath)?filePath:null;
 // Recover drafts on launch but never list internal drafts as user projects.
 prefs.recent=prefs.recent.filter(p=>!isDraftPath(p)&&p!==filePath&&exists(p));
 if(!isDraftPath(filePath))prefs.recent.unshift(filePath);
 prefs.recent=prefs.recent.slice(0,8);
 writePrefs();
}
function changeProject(filePath,password=null){
 if(store&&sameFile(store.path,filePath))return projectData();
 const next=new ProjectStore(filePath,password),old=store,oldPath=currentPath();
 const previous={lastProject:prefs.lastProject,activeDraft:prefs.activeDraft,recent:prefs.recent};
 try{
  if(recovery)recovery.restore(next);
  next.snapshot(); // validate all metadata before replacing or deleting the current draft
  remember(filePath);
  try{old?.close();}catch(error){Object.assign(prefs,previous);writePrefs();throw error;}
 }catch(error){Object.assign(prefs,previous);next.close();throw error;}
 store=next;lockedPath=null;pendingUnlock=null;
 if(isDraftPath(oldPath)&&!sameFile(oldPath,filePath))cleanupDrafts({only:oldPath});
 return projectData();
}
function requestOpen(file){
 if(store&&sameFile(store.path,file))return projectData();
 if(encryptedFile(file)){
  const token=crypto.randomUUID();pendingUnlock={token,file};
  return unlockRequest(pendingUnlock);
 }
 return changeProject(file);
}
function unlockRequest({token,file}){return {passwordRequired:true,token,name:isDraftPath(file)?t('Новый проект'):path.basename(file)};}
function lockedRequest(){
 if(!lockedPath)return null;
 // Repeated bootstrap reads must not invalidate an in-progress challenge.
 // A different pending target belongs to an explicit Open, not this bootstrap.
 if(pendingUnlock)return pendingUnlock.file===lockedPath?unlockRequest(pendingUnlock):null;
 return requestOpen(lockedPath);
}
function clearPending(token){if(pendingUnlock?.token===token)pendingUnlock=null;}
function keyBytes(value){return Buffer.from(value,'utf8');}
function cleanupDeletedRecovery(id){
 // The trash transaction has already committed. A sidecar cleanup failure
 // must not make the renderer believe that deletion failed.
 if(!store.encrypted){try{recovery.remove(store.path,id);}catch(e){console.warn('Recovery cleanup failed:',e.message);}}
}
function changeProtection(password){
 ensureProject();
 const old=store,source=old.path,tmp=source+'.'+crypto.randomUUID()+'.tmp';
 // Replacing a hard-linked file leaves the original bytes at its other names.
 assertReplaceable(source,false); // the open database may still own its journal
 let prior=old.password?Buffer.from(old.password):null;
 try{
  // Any pending recovery must be included in the verified destination.
  recovery.restore(old);
  old.makeCopy(tmp,password);
  recovery.clearProject(source); // never keep an old plaintext recovery sidecar
  old.close();store=null;
  try{publishCopy(tmp,source,true);}
  catch(e){store=new ProjectStore(source,prior);throw e;}
  try{store=new ProjectStore(source,password);}
  catch(e){
   // The complete destination was reopened and verified before replacement.
   // Preserve it; do not guess or roll back by recreating plaintext.
   lockedPath=password?source:null;throw e;
  }
  lockedPath=null;pendingUnlock=null;remember(source);return projectData();
 }finally{prior?.fill(0);if(exists(tmp))fs.unlinkSync(tmp);}
}
function launchFile(argv,cwd=process.cwd()){
 for(const arg of argv){if(typeof arg!=='string'||!arg.toLowerCase().endsWith('.ns'))continue;
  try{const file=path.resolve(cwd,arg);if(fs.statSync(file).isFile())return file;}catch{}
 }return null;
}
function createDraft(){
 const file=path.join(draftDirectory(),`draft-${crypto.randomUUID()}.ns`);
 safeDirectory(draftDirectory());
 newProject(file,[{title:t("Новая заметка"),html:'<p></p>'}]);
 return changeProject(file);
}
function initProject(){
 const cli=launchFile(process.argv);
 // A draft marker survives only an uncompleted session. Restore it even if
 // restore-last-project is disabled; a CLI open is deferred until recovery.
 safeDirectory(draftDirectory());
 const crashed=isDraftPath(prefs.activeDraft)&&exists(prefs.activeDraft)?prefs.activeDraft:null;
 if(!cleanupDrafts({keep:crashed}))throw new Error('Не удалось очистить черновики');
 if(crashed){
  const st=fs.lstatSync(crashed);
  if(!st.isFile()||st.isSymbolicLink())throw new Error('Не удалось очистить черновики');
  if(cli&&!sameFile(cli,crashed))pendingExternal=cli;
  if(encryptedFile(crashed)){lockedPath=crashed;return projectData();}
  return changeProject(crashed);
 }
 const candidates=[cli,...(prefs.settings.restoreLastProject?[prefs.lastProject]:[])].filter(p=>p&&!isDraftPath(p));
 for(const p of candidates){try{if(exists(p)){if(encryptedFile(p)){lockedPath=p;return projectData();}return changeProject(p);}}catch(err){console.error('Could not open project',err.message)}}
 return createDraft();
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
  // Keep the native region synchronized with the compositor while dragging.
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
 if(elapsed>=CORNER_FRAME_MS){applyCornerMove();return;}
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
function trayImage(){
 const source=nativeImage.createFromPath(path.join(__dirname,'assets','nocturne-notes-logo.png'));
 if(source.isEmpty())throw new Error('Tray icon is empty');
 const {width,height}=source.getSize(),bitmap=source.toBitmap();
 let x0=width,y0=height,x1=0,y1=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(bitmap[(y*width+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 if(x1<=x0||y1<=y0)throw new Error('Tray icon has no visible pixels');
 const side=Math.min(Math.max(x1-x0+1,y1-y0+1)+2,width,height);
 const x=Math.max(0,Math.min(width-side,Math.round((x0+x1+1-side)/2))),y=Math.max(0,Math.min(height-side,Math.round((y0+y1+1-side)/2)));
 const crop=source.crop({x,y,width:side,height:side}),result=nativeImage.createEmpty();
 for(const scale of [1,1.25,1.5,1.75,2,2.5,3,4]){const size=Math.round(16*scale);result.addRepresentation({scaleFactor:scale,buffer:crop.resize({width:size,height:size,quality:'best'}).toPNG()});}
 return result;
}
function syncTray(){
 if(!prefs.settings.minimizeToTray){destroyTray();return true;}
 try{
  if(!tray||tray.isDestroyed()){
   const logo=trayImage();
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
if(!app.isPackaged)module.exports={getTray:()=>tray,getTrayMenu:()=>trayMenu,trayImage};
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
  webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,additionalArguments:['--nocturne-corner-mode='+cornerMode]}
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
 win.webContents.setWindowOpenHandler(({url})=>{if(safeLink(url))void shell.openExternal(url).catch(()=>{});return {action:'deny'};});
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.on('will-frame-navigate',event=>event.preventDefault());
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  win.webContents.session.setPermissionCheckHandler(()=>false);
 if(traceStartup){
  win.webContents.on('preload-error',(_event,_preloadPath,error)=>startupTrace('preload-error',{message:String(error?.message||error).slice(0,500)}));
  win.webContents.on('render-process-gone',(_event,details)=>startupTrace('render-process-gone',{reason:details.reason,exitCode:details.exitCode}));
  win.webContents.on('did-finish-load',()=>startupTrace('did-finish-load'));
  win.webContents.on('console-message',(_event,details)=>{
   if(details&&typeof details==='object'&&['error','warning'].includes(details.level))
    startupTrace('renderer-console',{level:details.level,message:String(details.message).slice(0,500)});
  });
 }
 startupTrace('window-created');
 win.webContents.on('did-fail-load',(_event,code,description,url,isMainFrame)=>{
  if(isMainFrame && code!==-3){
   startupTrace('did-fail-load',{code,description});
   dialog.showErrorBox('Nocturne Notes',t('Не удалось загрузить интерфейс: ')+description);
   closeApproved=true;win.destroy();
  }
 });
 // Rendering is intentionally hidden until the project, styles and two frames
 // have been prepared in the renderer. ready-to-show alone can paint a blank
 // acrylic rectangle before the application interface exists.
 win.loadFile(path.join(__dirname,'index.html')).catch(error=>{
  startupTrace('load-file-error',{message:String(error.message).slice(0,500)});
  dialog.showErrorBox('Nocturne Notes',t('Ошибка загрузки приложения: ')+errorText(prefs.settings.language,error.message));
 });
 const firstFrameDeadline=setTimeout(()=>{
  if(win&&!win.isDestroyed()&&!rendererReady){
   startupTrace('first-frame-timeout');
   dialog.showErrorBox('Nocturne Notes', t("Интерфейс не смог запуститься. Попробуйте открыть приложение снова"));
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
  prefs.maximized=isWindowMaximized();
  try{writePrefs();}catch(error){
   // The user already confirmed exit and the DB is closed. Never leave an
   // unusable window with no open store because only preferences failed.
   console.error('Could not save window preferences:',error.message);
   dialog.showErrorBox('Nocturne Notes',t('Не удалось сохранить настройки'));
  }
 });
 win.webContents.on('render-process-gone',()=>{finishDraftDecision('cancel');pendingUnlock=null;});
 win.webContents.on('did-start-navigation',(_event,_url,sameDocument,isMainFrame)=>{if(isMainFrame&&!sameDocument){finishDraftDecision('cancel');pendingUnlock=null;}});
 win.on('closed',()=>{finishDraftDecision('cancel');stopCornerDrag();destroyTray();win=null;rendererReady=false;closePending=false;});
}
function trustedSender(event){try{return !!win&&!win.isDestroyed()&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&sameLocalFileURL(event.senderFrame.url,pathToFileURL(path.join(__dirname,'index.html')).href);}catch{return false;}}
function handler(name,fn){ipcMain.handle(name,async(event,arg)=>{try{
 if(!trustedSender(event)||!validIPC(name,arg)){
  if(name==='bootstrap')startupTrace('bootstrap-rejected',{senderURL:event.senderFrame?.url,expectedURL:pathToFileURL(path.join(__dirname,'index.html')).href});
  throw new Error('Недопустимый запрос');
 }
 const result=await fn(arg);
 if(name==='bootstrap')startupTrace('bootstrap-ok');
 return result;
 }catch(error){if(name==='bootstrap')startupTrace('bootstrap-error',{message:String(error?.message||error).slice(0,500)});const message=errorText(prefs.settings.language,error?.message);if(message!==error?.message)throw new Error(message);throw error;}});}
function installHandlers(){
 // Win32 shaped corners are not clickable outside their real silhouette.
 // Invisible inner-corner handles initiate a mouse-captured resize without
 // adding pixels outside the rounded window.
 ipcMain.on('app:corner-resize',(event,request)=>{
  if(!isWin||!trustedSender(event))return;
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
  if(!trustedSender(event)||rendererReady){
   if(!rendererReady)startupTrace('renderer-ready-rejected',{senderURL:event.senderFrame?.url,expectedURL:pathToFileURL(path.join(__dirname,'index.html')).href});
   return;
  }
  rendererReady=true;
  if(prefs.maximized&&!isWindowMaximized())toggleMaximize();
  updateWindowRegion();
  win.show();
  startupTrace('window-shown',{visible:win.isVisible(),minimized:win.isMinimized()});
  if(pendingExternal)win.webContents.send('app:external-open');
  const shownAt=performance.now();
  const metrics={electronVersion:process.versions.electron,resizeMode:'coalesced',electronProcessToShownMs:Math.round(shownAt-processStartedAt),
   backendReadyMs:Math.round(backendReadyAt-processStartedAt),
   windowCreatedToShownMs:Math.round(shownAt-firstWindowCreatedAt),cornerMode};
  // The Portable launcher unpacks BEFORE main.js runs. These diagnostics let
  // us separate its cost from Electron/renderer startup in the next test.
  fs.writeFile(path.join(app.getPath('userData'),'startup-timing.json'),JSON.stringify(metrics,null,2),()=>{});
 });
 handler('bootstrap',()=>({project:projectData(),pendingOpen:lockedRequest(),sidebarCollapsed:!!prefs.sidebarCollapsed,recent:prefs.recent.filter(exists),settings:{...prefs.settings}}));
 handler('update-settings',updates=>{
  const old=prefs.settings,next=safeSettings({...old,...updates});
  if(JSON.stringify(old)!==JSON.stringify(next)){
   prefs.settings=next;
   if((old.minimizeToTray!==next.minimizeToTray||old.language!==next.language)&&!syncTray()){
    prefs.settings=old;syncTray();throw new Error('Не удалось создать значок в трее');
   }
   try{writePrefs();}
   catch(error){
    prefs.settings=old;
    if(old.minimizeToTray!==next.minimizeToTray||old.language!==next.language)syncTray();
    throw error;
   }
   if(old.spellcheckEnabled!==next.spellcheckEnabled)configureSpellchecker();
  }
  return {...prefs.settings};
 });
 handler('save-recovery-draft',note=>{ensureProject();if(!store.hasNote(note.id))throw new Error('Заметка не найдена');if(store.encrypted)store.saveProtectedRecovery(note);else recovery.save(store.path,note);return true;});
 handler('draft-decision',({token,choice})=>{
  if(!pendingDraftDecision||pendingDraftDecision.token!==token)throw new Error('Недопустимый запрос');
  finishDraftDecision(choice);return true;
 });
 handler('create-project',()=>transition(async()=>await confirmDraftLeave()?createDraft():null));
 handler('open-project',()=>transition(async()=>{
  const answer=await dialog.showOpenDialog(win,{title:t("Открыть проект Nocturne Notes"),properties:['openFile'],filters:[{name:'Nocturne Notes',extensions:['ns']}]});
  return answer.canceled?null:openWithDraft(answer.filePaths[0]);
 }));
 handler('open-recent',p=>transition(async()=>{
  if(typeof p!=='string'||!prefs.recent.includes(p)||!exists(p))throw new Error('Файл проекта не найден');
  return openWithDraft(p);
 }));
 handler('open-external',()=>transition(async()=>{const file=pendingExternal;pendingExternal=null;return file?openWithDraft(file):null;}));
 handler('save-project',async()=>{
  ensureProject();
  if(projectData().isDraft)return saveAs();
  return {path:store.path,name:projectData().name};
 });
 handler('save-project-as',saveAs);
 handler('unlock-project',({token,password})=>{
  if(!pendingUnlock||pendingUnlock.token!==token)throw new Error('Недопустимый запрос');
  const key=keyBytes(password);try{return changeProject(pendingUnlock.file,key);}finally{key.fill(0);}
 });
 handler('cancel-unlock',token=>{clearPending(token);return true;});
 handler('protect-project',password=>{
  ensureProject();if(store.encrypted)throw new Error('Недопустимый запрос');
  const key=keyBytes(password);try{return changeProtection(key);}finally{key.fill(0);}
 });
 handler('change-password',({current,password})=>{
  ensureProject();const old=keyBytes(current),key=keyBytes(password);
  try{if(!store.verifyPassword(old))throw new Error('Неверный пароль');return changeProtection(key);}
  finally{old.fill(0);key.fill(0);}
 });
 handler('remove-protection',password=>{
  ensureProject();const old=keyBytes(password);
  try{if(!store.verifyPassword(old))throw new Error('Неверный пароль');return changeProtection(null);}
  finally{old.fill(0);}
 });
 handler('lock-project',()=>{
  ensureProject();if(!store.encrypted)throw new Error('Недопустимый запрос');
  const file=store.path;store.close();store=null;lockedPath=file;pendingUnlock=null;
  return {project:projectData(),request:lockedRequest()};
 });
 handler('create-note',()=>{ensureProject();const n=store.addNote(t('Новая заметка'));return n;});
 handler('update-note',n=>{
  ensureProject();const [saved]=store.updateNotes([n]);
  if(!store.encrypted){try{recovery.remove(store.path,n.id);}catch(e){console.warn('Recovery cleanup failed:',e.message);}}
  return saved;
 });
 handler('update-notes',notes=>{
  ensureProject();const saved=store.updateNotes(notes);
  if(!store.encrypted)for(const n of saved){try{recovery.remove(store.path,n.id);}catch(e){console.warn('Recovery cleanup failed:',e.message);}}
  return saved;
 });
 handler('select-note',id=>{ensureProject();store.selectNote(id);return true;});
 handler('delete-note',id=>{ensureProject();store.trashNote(id);cleanupDeletedRecovery(id);return projectData();});
 handler('duplicate-note',id=>{ensureProject();store.duplicateNote(id,t(' — копия'));return projectData();});
 handler('set-note-pinned',({id,pinned})=>{ensureProject();store.setPinned(id,pinned);return projectData();});
 handler('list-trash',()=>{ensureProject();return store.listTrash();});
 handler('restore-trash',id=>{
  ensureProject();
  // Clear a stale plaintext recovery before restoring the live row, so a
  // failed cleanup cannot let it overwrite the restored note on next open.
  if(!store.encrypted&&store.listTrash().some(n=>n.id===id))recovery.remove(store.path,id);
  store.restoreTrash(id);return projectData();
 });
 handler('purge-trash',id=>{ensureProject();store.purgeTrash(id);return true;});
 handler('always-on-top',value=>{if(typeof value==='boolean')win.setAlwaysOnTop(value);return win.isAlwaysOnTop();});
 handler('reorder-notes',ids=>{ensureProject();store.reorder(ids);return true;});
 handler('set-sidebar',v=>{const old=prefs.sidebarCollapsed;const next=!!v;if(old===next)return true;prefs.sidebarCollapsed=next;try{writePrefs();}catch(e){prefs.sidebarCollapsed=old;throw new Error('Не удалось сохранить настройки',{cause:e});}return true;});
 handler('export-note',async({id,format,confirmPlaintext})=>{
  ensureProject();if(store.encrypted&&confirmPlaintext!==true)throw new Error('Требуется подтверждение экспорта');const note=store.snapshot().notes.find(n=>n.id===id);
  if(!note)throw new Error('Заметка не найдена');
  if(!['txt','html','md'].includes(format))throw new Error('Недопустимый формат');
  const result=await dialog.showSaveDialog(win,{title:t("Экспорт заметки"),defaultPath:`${safeFileName(note.title)}.${format}`,filters:[{name:format.toUpperCase(),extensions:[format]}]});
  if(result.canceled)return null;
  const body=format==='html'?exportHTML(note.title,note.html):(format==='md'?htmlToMarkdown(note.html):noteToText(note.html));
  if(sameFile(result.filePath,store.path)||path.extname(result.filePath).toLowerCase()==='.ns')throw new Error('Выберите другое имя файла');
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
 ipcMain.on('app:ready-to-close',async(event,ok)=>{
  if(!trustedSender(event)||!closePending||typeof ok!=='boolean'||pendingDraftDecision)return;
  try{
   if(ok!==true||transitionBusy){quitRequested=false;showWindow();return;}
   if(!quitRequested&&prefs.settings.minimizeToTray&&tray&&!tray.isDestroyed()){
    stopCornerDrag();win.hide();return;
   }
   if(!await confirmDraftLeave()){quitRequested=false;showWindow();return;}
   finishDraftExit();closeApproved=true;win.close();
  }catch(error){quitRequested=false;if(win&&!win.isDestroyed())showWindow();dialog.showErrorBox('Nocturne Notes',errorText(prefs.settings.language,error.message));}
  finally{closePending=false;if(pendingExternal&&win&&!win.isDestroyed()&&!closeApproved)win.webContents.send('app:external-open');}
 });
}
async function saveAs(){
 ensureProject();
 const old=store.path;
 const result=await dialog.showSaveDialog(win,{title:t("Сохранить проект Nocturne Notes"),defaultPath:projectData().isDraft?t("Новый проект.ns"):path.basename(old),filters:[{name:t("Проект Nocturne Notes"),extensions:['ns']}]});
 if(result.canceled)return null;
 let target=result.filePath;
 if(path.extname(target).toLowerCase()!=='.ns')target+='.ns';
 if(withinDraftDirectory(draftDirectory(),target))throw new Error('Выберите другое расположение проекта');
 if(sameFile(target,old))return {path:old,name:projectData().name};
 const overwrite=exists(target);
 // The native Windows Save dialog already confirms the exact selected path.
 // If adding .ns changes the destination, confirm that actual path separately.
 if(overwrite&&target!==result.filePath){
  const answer=await dialog.showMessageBox(win,{type:'warning',title:t('Заменить файл?'),message:path.basename(target),buttons:[t('Отмена'),t('Заменить')],defaultId:0,cancelId:0});
  if(answer.response!==1)return null;
 }
 // Capture the previous file's recovery identity before replacement.
 const replacedRecovery=overwrite?recovery.location(target):null;
 try{store.copyTo(target,{overwrite});}
 catch(e){if(['EBUSY','EPERM','EACCES'].includes(e.code))throw new Error('Проект уже открыт или заблокирован');throw e;}
 recovery.clearLocation(replacedRecovery);
 return changeProject(target,store.password);
}
if(ownsInstance){
app.on('second-instance',(_event,argv,cwd)=>{const file=launchFile(argv,cwd);if(file)pendingExternal=file;showWindow();if(pendingExternal&&rendererReady&&win&&!win.isDestroyed())win.webContents.send('app:external-open');});
app.whenReady().then(()=>{
 backendReadyAt=performance.now();
 startupTrace('app-ready');
 if(isWin)app.setAppUserModelId(isPortable?'com.nocturnenotes.desktop.portable':'com.nocturnenotes.desktop');
 recovery=new RecoveryStore(path.join(app.getPath('userData'),'recovery'));readPrefs();initProject();
 startupTrace('project-initialized',{hasProject:!!store||!!lockedPath,launchArgument:!!launchFile(process.argv),draft:!!store&&isDraftPath(store.path)});
 installHandlers();
 if(!syncTray()){prefs.settings.minimizeToTray=false;writePrefs();}
 makeWindow();
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0){closeApproved=false;makeWindow();syncTray();}else showWindow();});
}).catch(error=>{startupTrace('startup-error',{message:String(error?.message||error).slice(0,500)});dialog.showErrorBox('Nocturne Notes',String(error));app.quit();});
app.on('before-quit',event=>{
 if(win&&!win.isDestroyed()&&!closeApproved){event.preventDefault();requestQuit();}
});
app.on('window-all-closed',()=>{if(store){store.close();store=null;}if(process.platform!=='darwin')app.quit();});

}

}
