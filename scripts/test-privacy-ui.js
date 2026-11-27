'use strict';
const {app,BrowserWindow,dialog}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-privacy-ui-'));app.setPath('userData',profile);
// Seed an explicitly saved project, because discarded internal drafts now disappear.
// Enable tray in this isolated test only; the application default stays false.
const {ProjectStore,newProject,encryptedFile}=require('../storage'),{RecoveryStore}=require('../recovery'),crypto=require('node:crypto');
const projects=path.join(profile,'projects'),alias=path.join(profile,'alias');fs.mkdirSync(projects);fs.symlinkSync(projects,alias,process.platform==='win32'?'junction':'dir');
const savedSource=path.join(projects,'privacy-source.ns'),aliasSource=path.join(alias,'privacy-source.ns');
newProject(savedSource);const seed=new ProjectStore(savedSource),initialNote=seed.snapshot().notes[0];seed.close();
const recovery=new RecoveryStore(path.join(profile,'recovery'));recovery.save(savedSource,{...initialNote,html:'<p>INITIAL ALIAS RECOVERY</p>'});
fs.writeFileSync(path.join(profile,'preferences.json'),JSON.stringify({lastProject:aliasSource,settings:{minimizeToTray:true}}));
const main=require('../main');
const {checkDialogButtons}=require('./check-dialog-alignment');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){for(let i=0;i<200;i++){try{if(await fn())return;}catch{}await sleep(100);}throw Error('Timeout '+label);}
async function run(){
 await app.whenReady();let win;await wait(()=>{win=BrowserWindow.getAllWindows()[0];return win?.isVisible();},'visible');
 const js=s=>win.webContents.executeJavaScript(s),boot=()=>js('window.nocturneNotes.bootstrap()');
 const initial=(await boot()).project,source=initial.path;
 assert.equal(source,aliasSource);assert.equal(initial.notes[0].html,'<p>INITIAL ALIAS RECOVERY</p>');assert.equal(recovery.location(savedSource),recovery.location(source));
 const openMenu=async(type='protection')=>{
  await wait(()=>js("!document.querySelector('#note-title').readOnly && document.querySelector('#dialog-backdrop').hidden"),'previous operation finished');
  await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action="+type+"]').click()");
  await wait(()=>js("!document.querySelector('#submenu').hidden"),type+' submenu');
 };
 const choose=async label=>{
  await openMenu();
  await js("(()=>{const b=[...document.querySelectorAll('#submenu button')].find(x=>x.textContent.trim()==="+JSON.stringify(label)+");if(!b)throw Error('Missing menu action '+ "+JSON.stringify(label)+");b.click();})()");
 };
 const inspectMenu=async(labels,type='protection')=>{
  await openMenu(type);
  const result=await js(`(()=>{const m=document.querySelector('#submenu'),r=m.getBoundingClientRect(),root=document.querySelector('#window').getBoundingClientRect();return {labels:[...m.querySelectorAll('button')].map(x=>x.textContent.trim()),icons:m.querySelectorAll('svg,img').length,width:r.width,fits:r.right<=root.right&&[...m.querySelectorAll('.submenu-label')].every(x=>{const range=document.createRange();range.selectNodeContents(x);const r=x.getBoundingClientRect(),text=range.getBoundingClientRect(),style=getComputedStyle(x),button=getComputedStyle(x.parentElement);return x.scrollWidth<=x.clientWidth+1&&text.left-r.left>=0.75&&r.right-text.right>=0.75&&style.paddingLeft==='1px'&&style.paddingRight==='1px'&&button.paddingLeft==='11px'&&button.paddingRight==='11px';})};})()`);
  if(labels)assert.deepEqual(result.labels,labels);else assert.ok(result.labels.includes('plain-reopen.ns'),'synthetic recent project missing');
  assert.equal(result.icons,0);assert.ok(result.fits,'submenu clips text: '+JSON.stringify(result));
  await js("document.querySelector('#menu-toggle').click()");
  return result.width;
 };
 const setLanguage=async language=>{
  await js("window.nocturneNotes.updateSettings("+JSON.stringify({language})+")");
  const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;
  await wait(()=>js("document.documentElement.lang==="+JSON.stringify(language)+" && !!document.querySelector('.note-row.active') && !!document.querySelector('#edit-undo')"),'language '+language);
 };
 const fields=async values=>{for(const [id,value] of Object.entries(values))await js("document.querySelector('#password-"+id+"').value="+JSON.stringify(value));};
 const confirm=()=>js("document.querySelector('#dialog-confirm').click()");
 const checkPasswordLayout=async()=>{
  await checkDialogButtons(js);
  const g=await js(`(()=>{const d=document.querySelector('.glass-dialog'),fields=document.querySelector('.password-fields'),footer=document.querySelector('.dialog-buttons'),msg=document.querySelector('#dialog-message'),rect=e=>e.getBoundingClientRect();const words=msg.textContent.match(/\\S+/g)||[],lines=new Map(),node=msg.firstChild;if(node&&node.nodeType===3){for(const m of msg.textContent.matchAll(/\\S+/g)){const r=document.createRange();r.setStart(node,m.index);r.setEnd(node,m.index+m[0].length);const rr=r.getClientRects();if(rr.length!==1)return {brokenWord:true};const y=rr[0].top;lines.set(y,(lines.get(y)||0)+1);}}return {width:rect(d).width,gap:rect(footer).top-rect(fields).bottom,heights:[...footer.querySelectorAll('button:not([hidden])')].map(b=>rect(b).height),wordCount:words.length,lastLine:[...lines.values()].at(-1),bottom:rect(footer).bottom,dialogBottom:rect(d).bottom};})()`);
  assert.equal(g.brokenWord,undefined);assert.ok(g.width>=450&&g.width<=455,'password dialog width '+JSON.stringify(g));
  assert.ok(Math.abs(g.gap-22)<=1,'password footer gap '+JSON.stringify(g));
  assert.ok(g.heights.every(h=>Math.abs(h-35)<=0.1),'password button heights '+JSON.stringify(g));
  if(g.wordCount>1)assert.ok(g.lastLine>=2,'single orphan word '+JSON.stringify(g));
  assert.ok(g.bottom<=g.dialogBottom+1,'footer does not fit');
 };
 const pass='A1bcdef8',next='B2ghijk8';
 const lockedLayout=async language=>{
  const layout=await js(`(()=>{const p=document.querySelector('#panic-lock'),h=document.querySelector('#locked-project-title'),i=document.querySelector('#note-title'),e=document.querySelector('#editor');return {text:h.textContent,headingVisible:!h.hidden,iconMatches:h.querySelector('svg').innerHTML===p.querySelector('svg').innerHTML,inputHidden:i.hidden,inputValue:i.value,body:e.innerHTML,placeholder:e.dataset.placeholder,disabled:p.disabled,tooltip:p.title,aria:p.getAttribute('aria-label'),offset:new DOMMatrixReadOnly(getComputedStyle(h.querySelector('svg')).transform).m42,list:document.querySelectorAll('.note-row').length,undo:document.querySelector('#edit-undo').disabled};})()`);
  assert.deepEqual(layout,{text:language==='ru'?'Проект заблокирован':'Project locked',headingVisible:true,iconMatches:true,inputHidden:true,inputValue:'',body:'',placeholder:'',disabled:false,tooltip:language==='ru'?'Разблокировать проект · Ctrl+Shift+L':'Unlock project · Ctrl+Shift+L',aria:language==='ru'?'Разблокировать проект · Ctrl+Shift+L':'Unlock project · Ctrl+Shift+L',offset:1,list:0,undo:true});
 };
 const plainPanic=async language=>{
  const appearance=await js(`(()=>{const p=document.querySelector('#panic-lock'),f=document.querySelector('#focus-mode'),s=getComputedStyle(p);return {disabled:p.disabled,title:p.title,aria:p.getAttribute('aria-label'),color:s.color,peerColor:getComputedStyle(f).color,opacity:s.opacity};})()`);
  const title=language==='ru'?'Установить пароль · Ctrl+Shift+L':'Set password · Ctrl+Shift+L';
  assert.deepEqual(appearance,{disabled:false,title,aria:title,color:appearance.peerColor,peerColor:appearance.peerColor,opacity:'1'});
 };
 await plainPanic('en');
 await setLanguage('ru');
 await plainPanic('ru');
 await inspectMenu(['Установить пароль']);
 await inspectMenu(['Обычный текст (.txt)','HTML (.html)','Markdown (.md)'],'export');
 await js("document.querySelector('#panic-lock').click()");await wait(()=>js("!!document.querySelector('#password-password')"),'Russian panic password setup');
 assert.equal(await js("document.querySelector('#dialog-message').textContent"),'Не менее 8 символов. При потере пароля доступ невозможен');
 await checkPasswordLayout();
 await js("document.querySelector('#dialog-cancel').click()");
 await wait(()=>js("document.querySelector('#dialog-backdrop').hidden && !document.querySelector('#note-title').readOnly"),'cancel Russian password dialog');
 assert.ok(!(await boot()).project.encrypted);await plainPanic('ru');
 await setLanguage('en');
 await plainPanic('en');
 const unprotectedWidth=await inspectMenu(['Set password']);
 await inspectMenu(['Plain Text (.txt)','HTML (.html)','Markdown (.md)'],'export');
 assert.equal(await js("document.querySelector('[data-action=save-as]').nextElementSibling.dataset.action"),'protection');
 await js("(()=>{const e=document.querySelector('#editor');e.innerHTML='<p>PRIVATE UI MARKER</p>';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));})()");
 await js("document.querySelector('#panic-lock').click()");await wait(()=>js("!!document.querySelector('#password-password')"),'create password with panic button');
 const priorRecovery=recovery.location(savedSource),abandoned=priorRecovery+'.'+crypto.randomUUID()+'.tmp';
 fs.mkdirSync(path.dirname(abandoned),{recursive:true});fs.writeFileSync(abandoned,'PRIVATE UI MARKER');
 assert.equal(await js("document.querySelector('#dialog-message').textContent"),'At least 8 characters. A lost password cannot be recovered');
 assert.equal(await js("getComputedStyle(document.querySelector('#dialog-message')).whiteSpace"),'normal');
 await checkPasswordLayout();
 await fields({password:'1234567',repeat:'1234567'});await confirm();
 assert.equal(await js("document.querySelector('.password-error').textContent"),'At least 8 characters');
 await assert.rejects(js("window.nocturneNotes.protectProject('1234567')"));
 await fields({password:pass,repeat:'Different passphrase'});await confirm();
 assert.equal(await js("document.querySelector('.password-error').textContent"),'Passwords do not match');
 await js("document.querySelector('[data-password-eye=password]').click()");assert.equal(await js("document.querySelector('#password-password').type"),'text');
 await js("document.querySelector('[data-password-eye=password]').click()");
 await fields({password:pass,repeat:pass});await confirm();
 await wait(async()=> (await boot()).project.encrypted,'protected');
 assert.equal(encryptedFile(source),true);assert.equal(fs.readFileSync(source).includes(Buffer.from('PRIVATE UI MARKER')),false);
 assert.equal(fs.existsSync(abandoned),false);assert.equal(fs.existsSync(priorRecovery),false);assert.equal(fs.existsSync(recovery.location(source)),false);assert.equal(encryptedFile(savedSource),true);
 for(const name of fs.readdirSync(path.join(profile,'recovery')))assert.equal(fs.readFileSync(path.join(profile,'recovery',name)).includes(Buffer.from('PRIVATE UI MARKER')),false);
 for(const name of fs.readdirSync(path.dirname(source)).filter(n=>n.startsWith(path.basename(source)))){
  assert.equal(fs.readFileSync(path.join(path.dirname(source),name)).includes(Buffer.from('PRIVATE UI MARKER')),false,'plaintext remains in project/sidecar '+name);
 }
 assert.equal(fs.readdirSync(path.dirname(source)).some(n=>n.startsWith(path.basename(source)+'.')&&n.endsWith('.tmp')),false,'temporary protection copy remains');
 await wait(()=>js("document.querySelector('#editor').textContent==='PRIVATE UI MARKER'&&!document.querySelector('#panic-lock').disabled"),'protected UI');
 assert.ok(!(await boot()).project.locked,'password setup leaves the project open');
 assert.equal(await js("document.querySelector('#panic-lock').title"),'Lock project · Ctrl+Shift+L');
 const encryptedWidth=await inspectMenu(['Lock','Change password','Remove password']);
 assert.ok(encryptedWidth>unprotectedWidth,'protection submenu should grow with longer labels');
 await setLanguage('ru');await inspectMenu(['Заблокировать','Изменить пароль','Удалить пароль']);
 await choose('Изменить пароль');await wait(()=>js("!!document.querySelector('#password-repeat')"),'Russian change');await checkPasswordLayout();
 await js("document.querySelector('#dialog-cancel').click()");await wait(()=>js("!document.querySelector('#note-title').readOnly"),'cancel Russian change');
 await choose('Удалить пароль');await wait(()=>js("!!document.querySelector('#password-current')"),'Russian removal');await checkPasswordLayout();
 await js("document.querySelector('#dialog-cancel').click()");await wait(()=>js("!document.querySelector('#note-title').readOnly"),'cancel Russian removal');
 await choose('Заблокировать');await wait(async()=> (await boot()).project.locked&&await js("document.querySelector('#editor').textContent===''"),'Russian locked');
 await lockedLayout('ru');
 await js("document.querySelector('#panic-lock').click()");await wait(()=>js("!!document.querySelector('#password-current')"),'Russian panic unlock');await checkPasswordLayout();
 await js("document.querySelector('#dialog-cancel').click()");await wait(()=>js("!document.querySelector('#panic-lock').disabled&&document.querySelector('#dialog-backdrop').hidden"),'cancel unlock');
 await lockedLayout('ru');
 // Reload invalidates the cancelled/previous renderer's password challenge.
 const cancelled=(await boot()).pendingOpen.token;
 const reloadLocked=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await reloadLocked;
 await wait(()=>js("!!document.querySelector('#password-current')&&!document.querySelector('#dialog-backdrop').hidden"),'locked reload challenge');
 const fresh=(await boot()).pendingOpen.token;assert.notEqual(fresh,cancelled);
 await assert.rejects(js("window.nocturneNotes.unlockProject("+JSON.stringify({token:cancelled,password:pass})+")"));
 await js("document.querySelector('#dialog-cancel').click()");await wait(()=>js("!document.querySelector('#panic-lock').disabled&&document.querySelector('#dialog-backdrop').hidden"),'cancel reloaded challenge');
 await lockedLayout('ru');
 await choose('Разблокировать');await wait(()=>js("!!document.querySelector('#password-current')"),'Russian unlock menu');await checkPasswordLayout();
 await fields({current:pass});await confirm();await wait(()=>js("document.querySelector('#editor').textContent==='PRIVATE UI MARKER'&&!document.querySelector('#note-title').readOnly"),'Russian unlocked');
 await setLanguage('en');
 const assertUnlocked=async()=>{
  const b=await boot();assert.equal(b.project.encrypted,true);assert.ok(!b.project.locked);assert.equal(b.pendingOpen,null);
  assert.equal(await js("document.querySelector('#dialog-backdrop').hidden && document.querySelector('#editor').textContent==='PRIVATE UI MARKER'"),true);
 };
 await assertUnlocked();
 await openMenu('export');
 await js("document.querySelector('#submenu button').click()");
 await wait(()=>js("!document.querySelector('#dialog-backdrop').hidden"),'protected plaintext export warning');
 await checkDialogButtons(js);
 await js("document.querySelector('#dialog-cancel').click()");
 await wait(()=>js("!document.querySelector('#note-title').readOnly&&document.querySelector('#dialog-backdrop').hidden"),'cancel export');
 await assertUnlocked();
 // Reopening the already-open file is not a new session and must not ask again.
 dialog.showOpenDialog=async()=>({canceled:false,filePaths:[source]});
 await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=open-project]').click()");
 await wait(()=>js("!document.querySelector('#note-title').readOnly"),'same-file open finished');
 await assertUnlocked();
 const tray=main.getTray();assert.ok(tray&&!tray.isDestroyed());
 await js("document.querySelector('#close-btn').click()");
 await wait(()=>!win.isVisible()&&!win.isDestroyed(),'protected close to tray');
 await assertUnlocked();tray.emit('click');
 await wait(()=>win.isVisible()&&!win.isMinimized(),'protected tray restore');
 await assertUnlocked();
 win.minimize();await wait(()=>win.isMinimized(),'protected minimize');
 main.getTrayMenu().items.find(i=>i.id==='tray-open').click();
 await wait(()=>win.isVisible()&&!win.isMinimized(),'protected restore from minimize');await assertUnlocked();
 // A genuinely different project closes the current DB; reopening the protected
 // file via the actual open dialog must request a password once again.
 const other=path.join(profile,'plain-reopen.ns');newProject(other);
 const openFile=async file=>{
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});
  await js("document.querySelector('#menu-toggle').click();document.querySelector('[data-action=open-project]').click()");
 };
 await openFile(other);await wait(async()=> (await boot()).project.path===other&&await js("!document.querySelector('#note-title').readOnly"),'different project');
 await inspectMenu(null,'recent');
 await openFile(source);await wait(()=>js("!!document.querySelector('#password-current')"),'password on reopen');
 await fields({current:pass});await confirm();
 await wait(()=>js("document.querySelector('#editor').textContent==='PRIVATE UI MARKER' && document.querySelector('#dialog-backdrop').hidden && !document.querySelector('#note-title').readOnly"),'reopened protected project');
 await assertUnlocked();
 // Panic button must immediately conceal still-dirty content, even before IPC returns.
 const immediate=await js(`(()=>{const e=document.querySelector('#editor'),title=document.querySelector('#note-title');e.innerHTML='<p>PRIVATE UI MARKER</p><p>PANIC NEW EDIT</p>';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));document.querySelector('#search-toggle').click();document.querySelector('#search-query').value='PANIC';document.querySelector('#panic-lock').click();return {masked:document.querySelector('#window').classList.contains('privacy-pending'),editor:getComputedStyle(e).visibility,titleHidden:title.hidden,list:getComputedStyle(document.querySelector('#note-list')).visibility,search:getComputedStyle(document.querySelector('#sidebar-search')).visibility};})()`);
 assert.deepEqual(immediate,{masked:true,editor:'hidden',titleHidden:true,list:'hidden',search:'hidden'});
 await wait(async()=> (await boot()).project.locked && await js("document.querySelector('#editor').textContent===''"),'panic locked');
 await lockedLayout('en');
 assert.equal(fs.readFileSync(source).includes(Buffer.from('PANIC NEW EDIT')),false);
 assert.equal(await js("document.querySelector('#editor').textContent"),'');
 assert.equal(await js("document.querySelectorAll('.note-row').length"),0);
 assert.equal(await js("document.querySelector('#edit-undo').disabled"),true);
 await js("document.querySelector('#panic-lock').click()");await wait(()=>js("!!document.querySelector('#password-current')"),'panic unlock password');
 await checkPasswordLayout();
 assert.equal(await js("document.querySelector('#panic-lock').disabled"),true,'challenge in progress');
 assert.equal(await js("getComputedStyle(document.querySelector('#panic-lock')).opacity"),'1','temporary operation guard does not dim panic icon');
 const challenge=(await boot()).pendingOpen;
 assert.ok(challenge?.token);assert.equal((await boot()).pendingOpen.token,challenge.token,'bootstrap must not invalidate a live password challenge');
 await fields({current:'wrong password'});await confirm();
 await wait(()=>js("!!document.querySelector('.password-error:not([hidden])')"),'wrong password');
 assert.equal((await boot()).project.locked,true);
 assert.equal(await js("document.querySelector('#editor').innerHTML"),'');
 assert.equal((await boot()).pendingOpen.token,challenge.token);
 await fields({current:pass});await confirm();
 await wait(()=>js("document.querySelector('#editor').innerHTML==='<p>PRIVATE UI MARKER</p><p>PANIC NEW EDIT</p>'&&!document.querySelector('#note-title').readOnly"),'panic edit preserved on unlock');
 assert.equal(await js("document.querySelector('#panic-lock').title"),'Lock project · Ctrl+Shift+L');
 await assert.rejects(js("window.nocturneNotes.unlockProject("+JSON.stringify({token:"stale-token",password:"synthetic wrong"})+")"));
 // A failed encrypted write must keep the document concealed and recoverable.
 const update=ProjectStore.prototype.updateNotes;
 ProjectStore.prototype.updateNotes=function(notes){if(notes.some(n=>n.html.includes('PANIC FAILURE EDIT')))throw Error('synthetic disk failure');return update.call(this,notes);};
 try{
  const failed=await js(`(()=>{const e=document.querySelector('#editor');e.innerHTML='<p>PANIC FAILURE EDIT</p>';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));document.querySelector('#panic-lock').click();return getComputedStyle(e).visibility;})()`);
  assert.equal(failed,'hidden');
  await wait(()=>js("!document.querySelector('#dialog-backdrop').hidden&&document.querySelector('#dialog-heading').textContent==='Could not lock project'"),'panic save error');
  await checkDialogButtons(js);
  assert.equal((await boot()).project.locked,undefined);assert.equal(await js("getComputedStyle(document.querySelector('#editor')).visibility"),'hidden');
  assert.equal(await js("document.querySelector('#editor').textContent"),'PANIC FAILURE EDIT');
 }finally{ProjectStore.prototype.updateNotes=update;}
 await confirm();await wait(async()=> (await boot()).project.locked&&await js("document.querySelector('#editor').innerHTML===''"),'retry lock after write recovery');
 await lockedLayout('en');
 await choose('Unlock');await wait(()=>js("!!document.querySelector('#password-current')"),'unlock after retry');
 await fields({current:pass});await confirm();await wait(()=>js("document.querySelector('#editor').textContent==='PANIC FAILURE EDIT'&&!document.querySelector('#note-title').readOnly"),'failed edit preserved after retry');
 // Keyboard shortcut also works when the titlebar is hidden in focus mode.
 await js("(()=>{const e=document.querySelector('#editor');e.innerHTML='<p>PRIVATE UI MARKER</p>';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));document.querySelector('#focus-mode').click();e.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,ctrlKey:true,shiftKey:true,code:'KeyL',key:'L'}));})()");
 await wait(async()=> (await boot()).project.locked&&await js("document.querySelector('#editor').innerHTML===''"),'focus shortcut locked');
 await lockedLayout('en');
 await js("document.querySelector('#editor').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,ctrlKey:true,shiftKey:true,code:'KeyL',key:'L'}))");
 await wait(()=>js("!!document.querySelector('#password-current')"),'unlock by focus shortcut');
 await fields({current:pass});await confirm();await wait(()=>js("document.querySelector('#editor').textContent==='PRIVATE UI MARKER'&&!document.querySelector('#note-title').readOnly"),'shortcut preserved final edit');
 assert.equal(await js("document.querySelector('#window').classList.contains('focus-mode')"),true);
 await js("document.querySelector('#editor').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Escape'}))");
 await choose('Change password');await wait(()=>js("!!document.querySelector('#password-repeat')"),'change password');
 assert.equal(await js("document.querySelector('#dialog-message').textContent"),'At least 8 characters. A lost password cannot be recovered');
 assert.equal(await js("getComputedStyle(document.querySelector('#dialog-message')).whiteSpace"),'normal');
 await checkPasswordLayout();
 await fields({current:pass,password:'1234567',repeat:'1234567'});await confirm();
 assert.equal(await js("document.querySelector('.password-error').textContent"),'At least 8 characters');
 await assert.rejects(js("window.nocturneNotes.changePassword({current:'"+pass+"',password:'1234567'})"));
 await fields({current:pass,password:next,repeat:next});await confirm();
 await wait(()=>js("document.querySelector('#dialog-backdrop').hidden && !document.querySelector('#dialog-backdrop').classList.contains('password-open')"),'change dialog closed');
 await wait(()=>js("!document.querySelector('#note-title').readOnly"),'password change committed');
 await choose('Lock');await wait(async()=> (await boot()).project.locked && await js("document.querySelector('#editor').textContent===''"),'locked after change');
 await choose('Unlock');await wait(()=>js("!!document.querySelector('#password-current')"),'changed password dialog');
 await fields({current:pass});await confirm();await wait(()=>js("!!document.querySelector('.password-error:not([hidden])')"),'old password rejected');
 await fields({current:next});await confirm();await wait(()=>js("document.querySelector('#editor').textContent==='PRIVATE UI MARKER'"),'new password works');
 const target=path.join(profile,'overwrite.ns');newProject(target,[{title:'old',html:'<p>OLD</p>'}]);
 const opened=new ProjectStore(target),targetNote=opened.snapshot().notes[0];
 const previousTargetRecovery=recovery.location(target);recovery.save(target,{...targetNote,html:'<p>OVERWRITTEN RECOVERY MARKER</p>'});
 dialog.showSaveDialog=async()=>({canceled:false,filePath:target});
 try{await assert.rejects(js('window.nocturneNotes.saveAsProject()'));assert.equal(opened.snapshot().notes[0].title,'old');assert.equal(fs.existsSync(previousTargetRecovery),true);}finally{opened.close();}
 const copied=await js('window.nocturneNotes.saveAsProject()');assert.equal(copied.encrypted,true);assert.equal(copied.path,target);assert.equal(encryptedFile(target),true);assert.equal(fs.existsSync(previousTargetRecovery),false);
 const reloaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await reloaded;
 await wait(()=>js("document.querySelector('#editor').textContent==='PRIVATE UI MARKER'"),'copied UI');
 await choose('Remove password');await wait(()=>js("!!document.querySelector('#password-current')"),'remove password');
 assert.equal(await js("document.querySelector('#dialog-message').textContent"),'The project will be accessible without a password');
 await checkPasswordLayout();
 await fields({current:next});await confirm();await wait(async()=>!(await boot()).project.encrypted,'removed');
 await wait(()=>js("!document.querySelector('#panic-lock').disabled&&!document.querySelector('#note-title').hidden"),'panic active after removal');
 await plainPanic('en');
 // The keyboard shortcut has the identical setup flow when no password exists.
 await js("document.querySelector('#editor').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,ctrlKey:true,shiftKey:true,code:'KeyL',key:'L'}))");
 await wait(()=>js("!!document.querySelector('#password-password')"),'shortcut opens password setup');
 await checkPasswordLayout();
 await js("document.querySelector('#dialog-cancel').click()");
 await wait(()=>js("!document.querySelector('#panic-lock').disabled&&document.querySelector('#dialog-backdrop').hidden"),'cancel shortcut setup');
 assert.ok(!(await boot()).project.encrypted);await plainPanic('en');
 assert.equal(encryptedFile(target),false);assert.equal(encryptedFile(source),true);
 // Replacing a multiply-linked file cannot guarantee that plaintext disappears.
 const hard=path.join(profile,'hard-link.ns');fs.linkSync(other,hard);
 await openFile(other);await wait(async()=> (await boot()).project.path===other&&await js("!document.querySelector('#note-title').readOnly"),'hard-linked project');
 const hardNote=(await boot()).project.notes[0],beforeHard=fs.readFileSync(other),hardRecovery=recovery.location(other);
 recovery.save(hard,{...hardNote,html:'<p>HARD LINK RECOVERY</p>'});
 await assert.rejects(js("window.nocturneNotes.protectProject('A1bcdef8')"),/жесткими ссылками|multiple hard links/);
 assert.equal((await boot()).project.encrypted,false);assert.deepEqual(fs.readFileSync(other),beforeHard);assert.deepEqual(fs.readFileSync(hard),beforeHard);assert.equal(fs.existsSync(hardRecovery),true);
 const icon=main.trayImage();assert.ok(!icon.isEmpty());assert.ok(icon.getScaleFactors().includes(1));assert.ok(icon.getScaleFactors().includes(2));const size=icon.getSize(1);assert.equal(size.width,16);assert.equal(size.height,16);
 const pixels=icon.toBitmap({scaleFactor:1});let x0=16,y0=16,x1=-1,y1=-1;for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(pixels[(y*16+x)*4+3]>8){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}assert.ok(Math.max(x1-x0+1,y1-y0+1)>=15,'tray fill');
 console.log('PASS eight-character passwords, hints, text-only adaptive bilingual submenu, unlock session across tray/minimize, password on reopen, lock, change, encrypted overwrite, protected source, removal and tray scale');
}
run().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1)});
