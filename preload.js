'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const cornerMode=(process.argv.find(x=>x.startsWith('--nocturne-corner-mode='))||'--nocturne-corner-mode=native').split('=')[1];
if(process.platform==='win32'){
 window.addEventListener('DOMContentLoaded',()=>{
  document.body.dataset.cornerMode=cornerMode;
  if(cornerMode==='native')return;
  const directions=cornerMode==='alpha'?['nw','ne','sw','se','n','s','w','e']:['nw','ne','sw','se'];
  for(const corner of directions){
   const grip=document.createElement('div');
   grip.className='nocturne-native-corner-grip corner-'+corner;
   grip.setAttribute('aria-hidden','true');
   grip.dataset.corner=corner;
   let pointer=null;
   const finish=()=>{
    if(pointer===null)return;
    pointer=null;
    ipcRenderer.send('app:corner-resize',{phase:'end'});
   };
   grip.addEventListener('pointerdown',event=>{
    if(event.button!==0||pointer!==null)return;
    event.preventDefault();
    event.stopPropagation();
    pointer=event.pointerId;
    grip.setPointerCapture(pointer);
    ipcRenderer.send('app:corner-resize',{phase:'start',corner});
   });
   grip.addEventListener('pointermove',event=>{
    if(event.pointerId===pointer)ipcRenderer.send('app:corner-resize',{phase:'move'});
   });
   grip.addEventListener('pointerup',event=>{if(event.pointerId===pointer)ipcRenderer.send('app:corner-resize',{phase:'move'});finish();});
   grip.addEventListener('pointercancel',finish);
   grip.addEventListener('lostpointercapture',finish);
   window.addEventListener('blur',finish);
   document.body.appendChild(grip);
  }
 },{once:true});
}
contextBridge.exposeInMainWorld('nocturneNotes',Object.freeze({
 isDesktop:true,
 notifyUIReady:()=>ipcRenderer.send('app:renderer-ready'),
 bootstrap:()=>ipcRenderer.invoke('bootstrap'),
 updateSettings:s=>ipcRenderer.invoke('update-settings',s),
 saveRecoveryDraft:n=>ipcRenderer.invoke('save-recovery-draft',n),
 createProject:()=>ipcRenderer.invoke('create-project'),
 onDraftDecision:fn=>ipcRenderer.on('app:confirm-draft',(_event,request)=>fn(request)),
 respondDraft:request=>ipcRenderer.invoke('draft-decision',request),
 openProject:()=>ipcRenderer.invoke('open-project'),
 openRecent:(p)=>ipcRenderer.invoke('open-recent',p),
 openExternal:()=>ipcRenderer.invoke('open-external'),
 onExternalOpen:fn=>ipcRenderer.on('app:external-open',()=>fn()),
 unlockProject:request=>ipcRenderer.invoke('unlock-project',request),
 cancelUnlock:token=>ipcRenderer.invoke('cancel-unlock',token),
 protectProject:password=>ipcRenderer.invoke('protect-project',password),
 changePassword:request=>ipcRenderer.invoke('change-password',request),
 removeProtection:password=>ipcRenderer.invoke('remove-protection',password),
 lockProject:()=>ipcRenderer.invoke('lock-project'),
 saveProject:()=>ipcRenderer.invoke('save-project'),
 saveAsProject:()=>ipcRenderer.invoke('save-project-as'),
 createNote:()=>ipcRenderer.invoke('create-note'),
 updateNote:n=>ipcRenderer.invoke('update-note',n),
 updateNotes:notes=>ipcRenderer.invoke('update-notes',notes),
 selectNote:id=>ipcRenderer.invoke('select-note',id),
 deleteNote:id=>ipcRenderer.invoke('delete-note',id),
 duplicateNote:id=>ipcRenderer.invoke('duplicate-note',id),
 setNotePinned:(id,pinned)=>ipcRenderer.invoke('set-note-pinned',{id,pinned}),
 listTrash:()=>ipcRenderer.invoke('list-trash'),
 restoreTrash:id=>ipcRenderer.invoke('restore-trash',id),
 purgeTrash:id=>ipcRenderer.invoke('purge-trash',id),
 alwaysOnTop:value=>ipcRenderer.invoke('always-on-top',value),
 onEditHistory:fn=>ipcRenderer.on('app:edit-history',(_event,action)=>fn(action)),
 reorderNotes:ids=>ipcRenderer.invoke('reorder-notes',ids),
 setSidebarCollapsed:v=>ipcRenderer.invoke('set-sidebar',v),
 exportNote:(id,format,confirmPlaintext=false)=>ipcRenderer.invoke('export-note',{id,format,confirmPlaintext}),
 windowAction:a=>ipcRenderer.invoke('window-action',a),
 recentProjects:()=>ipcRenderer.invoke('get-recent'),
 isMaximized:()=>ipcRenderer.invoke('get-window-state'),
 onBeforeClose:fn=>ipcRenderer.on('app:before-close',()=>fn()),
 closeConfirmed:ok=>ipcRenderer.send('app:ready-to-close',ok),
 onWindowState:fn=>ipcRenderer.on('app:window-state',(_e,x)=>fn(x))
}));
