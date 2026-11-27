'use strict';
(() => {
 const api=window.nocturneNotes;
 const $=s=>document.querySelector(s);
 const refs={win:$('#window'),menuToggle:$('#menu-toggle'),appMenu:$('#app-menu'),submenu:$('#submenu'),list:$('#note-list'),sidebar:$('#sidebar'),resizer:$('#sidebar-resizer'),sidebarTab:$('#sidebar-tab'),addNote:$('#add-note'),saveShortcut:$('#save-shortcut'),searchCounter:$('#search-counter'),searchNavigation:$('#search-navigation'),searchPrevious:$('#search-previous'),searchNext:$('#search-next'),searchToggle:$('#search-toggle'),searchPanel:$('#sidebar-search'),searchQuery:$('#search-query'),searchReplacement:$('#search-replacement'),searchScopeButtons:document.querySelectorAll('[data-search-scope]'),searchReplaceOne:$('#search-replace-one'),searchReplaceAll:$('#search-replace-all'),title:$('#note-title'),editor:$('#editor'),scroll:$('#editor-scroll'),toolbar:$('#floating-toolbar'),headingPopover:$('#heading-popover'),colorPopover:$('#color-popover'),context:$('#note-menu'),dialog:$('#dialog-backdrop'),dialogHeading:$('#dialog-heading'),dialogMessage:$('#dialog-message'),dialogInput:$('#dialog-input'),dialogOptions:$('#dialog-options'),dialogConfirm:$('#dialog-confirm'),dialogCancel:$('#dialog-cancel'),toast:$('#toast')};
 let searchOpen=false,searchScope='note',searchHits={groups:[],length:0},searchCursor=-1;
 let state=null,busy=false,saveTimer=null,savePromise=Promise.resolve(),activeContextId=null,preservedRange=null,dialogResolve=null,toastTimer=null;
  const {DEFAULT_SETTINGS,EDITOR_FONTS}=window.NocturneSettings;
 const {text:translate,errorText,locale}=window.NocturneI18n;
 const t=key=>translate(settings.language,key);
 const bookmarkIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v17l-7-4.5L5 21Z"/></svg>';
 const lockIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M12 14v3"/></svg>';
 let lockPending=false,lockFailed=false,lockedHeading;
 const staticStrings=[];
 let settings={...DEFAULT_SETTINGS};
 const statuses=new Map(),revisions=new Map();
 let cachedPayload=null,formatPopoversReady=false;
 let recoveryTimer=null;
 let projectOperation=false,externalWaiting=false;
 const scrollOffsets=new Map();
 let shellStylesReady = Promise.resolve();
 // Keep the frozen reference unchanged; all new UI is an additive layer.
 const featuresReady=Promise.all([
  new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='undo-buffer.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);}),
  new Promise((resolve,reject)=>{const s=document.createElement('link');s.rel='stylesheet';s.href='features.css';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);})
 ]);
 let history=null,historyTimer=null,historyPending=false,historyRestoring=false,lastEditKey='',lastEditAt=0,focusMode=false,topmost=false;
 let undoButton,redoButton;
 function pathFor(node){const path=[];while(node&&node!==refs.editor){const parent=node.parentNode;if(!parent)return null;path.unshift(Array.prototype.indexOf.call(parent.childNodes,node));node=parent;}return node===refs.editor?path:null;}
 function nodeFor(path){let node=refs.editor;for(const i of path||[]){node=node.childNodes[i];if(!node)return null;}return node;}
 function editSnapshot(){
  const result={title:refs.title.value,html:refs.editor.innerHTML,scroll:refs.scroll.scrollTop};
  if(document.activeElement===refs.title)result.selection={field:'title',start:refs.title.selectionStart,end:refs.title.selectionEnd};
  else {const s=window.getSelection();if(s?.rangeCount&&refs.editor.contains(s.anchorNode)&&refs.editor.contains(s.focusNode))result.selection={field:'body',anchor:pathFor(s.anchorNode),focus:pathFor(s.focusNode),a:s.anchorOffset,f:s.focusOffset};}
  return result;
 }
 function storedSnapshot(n){return {title:n.title==='Без названия'?'':n.title,html:sanitizeHTML(n.html),scroll:scrollOffsets.get(n.id)||0};}
 function updateHistoryButtons(){if(!undoButton)return;undoButton.disabled=!(historyPending||history?.can(state?.activeId,'undo'));redoButton.disabled=historyPending||!history?.can(state?.activeId,'redo');}
 function commitHistory(){clearTimeout(historyTimer);historyTimer=null;if(historyPending&&history&&state?.activeId){historyPending=false;history.record(state.activeId,editSnapshot());}lastEditKey='';updateHistoryButtons();}
 function scheduleHistory(){
  if(!history||historyRestoring||busy||!state?.activeId)return;
  historyPending=true;clearTimeout(historyTimer);historyTimer=setTimeout(commitHistory,600);updateHistoryButtons();
 }
 function beforeEdit(e){
  if(!history||historyRestoring||busy||!state?.activeId)return;
  if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){if(e.cancelable){e.preventDefault();applyHistory(e.inputType==='historyUndo'?'undo':'redo');}return;}
  if(e.isComposing)return;
  const key=e.target.id+':'+e.inputType,continuous=['insertText','deleteContentBackward','deleteContentForward','insertCompositionText'].includes(e.inputType);
  if(historyPending&&(!continuous||lastEditKey!==key||performance.now()-lastEditAt>600))commitHistory();
  if(!historyPending)history.resetCurrent(state.activeId,editSnapshot());
  lastEditKey=key;lastEditAt=performance.now();
 }
 function applyHistory(dir){
  if(!history||!state?.activeId||busy||projectOperation)return;
  commitHistory();const value=history.move(state.activeId,dir);if(!value)return;
  historyRestoring=true;
  try{
   refs.title.value=value.title;refs.editor.innerHTML=value.html;refs.scroll.scrollTop=value.scroll||0;
   preservedRange=null;refs.toolbar.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;
   const s=value.selection;
   if(s?.field==='title'){refs.title.focus({preventScroll:true});refs.title.setSelectionRange(s.start,s.end);}
   else{refs.editor.focus({preventScroll:true});const sel=window.getSelection(),a=s?.anchor&&nodeFor(s.anchor),f=s?.focus&&nodeFor(s.focus);
    if(a&&f){try{sel.setBaseAndExtent(a,s.a,f,s.f);}catch{sel.collapse(refs.editor,0);}}else sel.collapse(refs.editor,0);}
   queueSave();if(searchOpen)refreshSearchMatches();else renderList();
  }finally{historyRestoring=false;updateHistoryButtons();}
 }
 function recordExternal(n,next){if(!history)return;if(!history.notes.has(n.id))history.resetCurrent(n.id,storedSnapshot(n));history.record(n.id,storedSnapshot({...n,...next}));}
 function toggleFocus(force){
  const next=typeof force==='boolean'?force:!focusMode;if(next===focusMode)return;
  if(next&&searchOpen)closeSearch();closeMenus();focusMode=next;refs.win.classList.toggle('focus-mode',focusMode);
  refs.editor.focus({preventScroll:true});
 }
 async function toggleTop(){
  try{
   topmost=await api.alwaysOnTop(!topmost);
   const b=$('#always-top');if(b){b.setAttribute('aria-pressed',String(topmost));b.title=t(topmost?'Отключить поверх всех окон · Ctrl+Shift+T':'Поверх всех окон · Ctrl+Shift+T');b.setAttribute('aria-label',b.title);}
   toast(topmost?'Поверх всех окон':'Обычный режим окна');
  }catch(e){report(e)}
 }
 function installFeatureUI(){
  const icons={undo:'M9 7 4 12l5 5 M4 12h10a5 5 0 0 1 5 5',redo:'m15 7 5 5-5 5 M20 12H10a5 5 0 0 0-5 5',copy:'M9 9h11v11H9z M15 9V4H4v11h5',focus:'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',pin:'M16 3 21 8 18 9 15 13 15 16 13 18 6 11 8 9 11 9 15 6 16 3M9.5 14.5 3 21'};
  function icon(key){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icons[key]+'"/></svg>';}
  const group=document.createElement('div');group.className='edit-history no-drag';group.setAttribute('aria-label','Отмена и повтор');
  for(const [key,label] of [['undo','Отменить · Ctrl+Z'],['redo','Повторить · Ctrl+Y']]){
   const b=document.createElement('button');b.type='button';b.id='edit-'+key;b.title=label;b.setAttribute('aria-label',label);b.innerHTML=icon(key);b.disabled=true;b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',()=>applyHistory(key));group.appendChild(b);
  }
  document.querySelector('.drag-space').before(group);undoButton=$('#edit-undo');redoButton=$('#edit-redo');
  const add=(menu,attr,key,label,markup,before)=>{const b=document.createElement('button');b.type='button';b.setAttribute(attr,key);b.setAttribute('role','menuitem');b.innerHTML=markup+'<span>'+label+'</span>';menu.insertBefore(b,before);return b;};
  add(refs.context,'data-note-action','duplicate','Дублировать',icon('copy'),refs.context.querySelector('[data-note-action="move-up"]'));
  add(refs.context,'data-note-action','pin-note','Закрепить',bookmarkIcon,refs.context.querySelector('[data-note-action="move-up"]'));
  refs.context.querySelector('[data-note-action="rename"] kbd')?.remove(); // F2 itself remains supported.
  refs.context.querySelectorAll('button > span').forEach(label=>label.classList.add('context-label'));
  refs.context.querySelector('[data-note-action="delete"] span').textContent='В корзину';
  // Preserve the menu's original SVG viewport and stroke styling.
  for(const [action,d] of [['move-up','m5 15 7-7 7 7'],['move-down','m5 9 7 7 7-7']]){
   const svg=refs.context.querySelector('[data-note-action="'+action+'"] svg');
   svg.setAttribute('viewBox','0 0 24 24');svg.innerHTML='<path d="'+d+'"/>';
  }
  const settingsRow=refs.appMenu.querySelector('[data-action="settings"]');
  if(api.isDesktop){
   const shield='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5c0 5.1 3.1 8.2 7.5 10 4.4-1.8 7.5-4.9 7.5-10V6L12 3Z"/><path d="m9 12 2 2 4-4"/></svg>';
   const row=add(refs.appMenu,'data-action','protection','Защита проекта',shield,refs.appMenu.querySelector('[data-action="export"]'));
   row.insertAdjacentHTML('beforeend','<svg class="chevron"><use href="#i-chevron-right"/></svg>');
  }
  add(refs.appMenu,'data-action','trash','Корзина','<svg><use href="#i-trash"/></svg>',settingsRow);
  // Only the SVG path changes; keep the approved menu glyph size and styling.
  $('#i-trash path').setAttribute('d','M3 6h18M8 6l1-3h6l1 3M5 6l1 13q0 2 2 2h8q2 0 2-2l1-13M10 10v7M14 10v7');
  lockedHeading=document.createElement('div');lockedHeading.id='locked-project-title';lockedHeading.className='note-title locked-project-title';lockedHeading.setAttribute('role','heading');lockedHeading.setAttribute('aria-level','1');lockedHeading.hidden=true;lockedHeading.innerHTML=lockIcon+'<span></span>';refs.title.after(lockedHeading);
  const quick=document.createElement('div');quick.className='quick-window-actions no-drag';
  for(const [id,key,label,fn] of [['panic-lock','lock','Установить пароль · Ctrl+Shift+L',()=>void toggleProjectLock()],['focus-mode','focus','Режим концентрации · F11',()=>toggleFocus()],['always-top','pin','Поверх всех окон · Ctrl+Shift+T',()=>void toggleTop()]]){
   if((id==='always-top'||id==='panic-lock')&&!api.isDesktop)continue;
   const b=document.createElement('button');b.id=id;b.type='button';b.className='glass-round';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=key==='lock'?lockIcon:icon(key);
   if(id==='panic-lock')b.disabled=true;
   if(id==='always-top')b.setAttribute('aria-pressed','false');
   b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',fn);quick.appendChild(b);
  }
  document.querySelector('.window-controls').before(quick);
  if(api.isDesktop)void api.alwaysOnTop().then(v=>{topmost=v;$('#always-top').setAttribute('aria-pressed',String(v));}).catch(report);
 }
 async function duplicateNote(id){return runProjectTask(()=>duplicateNoteTask(id));}
 async function duplicateNoteTask(id){if(!await flush())return;try{const p=await api.duplicateNote(id);syncProject(p,true);toast('Копия создана');}catch(e){report(e)}}
 async function trashDialog(){return runProjectTask(()=>trashDialogTask());}
 async function trashDialogTask(){
  if(!await flush())return;
  try{
   for(;;){
    const entries=await api.listTrash();let action=null;
    refs.dialog.classList.add('trash-open');
    const promise=dialogBox({title:'Корзина',message:t(entries.length?'Удаленные заметки этого проекта':'Корзина пуста'),hideCancel:true,confirm:'Закрыть',optionsHtml:entries.length?'<div id="trash-list"></div>':''});
    const list=$('#trash-list');
    if(list){
     const addButton=(parent,label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=t(label);b.addEventListener('click',()=>{action=fn;resolveDialog(true);});parent.appendChild(b);};
     for(const item of entries){
      const row=document.createElement('div');row.className='trash-row';const copy=document.createElement('div');copy.className='trash-copy';const title=document.createElement('strong');title.textContent=displayNoteName(item.title);const date=document.createElement('small');date.textContent=new Date(item.deletedAt).toLocaleString(locale(settings.language));copy.append(title,date);row.appendChild(copy);
      addButton(row,'Восстановить',async()=>{syncProject(await api.restoreTrash(item.id),true);toast('Заметка восстановлена');});
      addButton(row,'Удалить',async()=>{if(await dialogBox({title:'Удалить навсегда?',message:item.title,confirm:'Удалить'}))await api.purgeTrash(item.id);});list.appendChild(row);
     }
     addButton(list,'Очистить корзину',async()=>{if(await dialogBox({title:'Очистить корзину?',message:t('Все удаленные заметки будут удалены окончательно'),confirm:'Очистить'}))await api.purgeTrash(null);});
    }
    await promise;refs.dialog.classList.remove('trash-open');if(!action)break;await action();
   }
  }catch(e){report(e)}finally{refs.dialog.classList.remove('trash-open')}
 }

 if(api.isDesktop){
  document.body.classList.add('is-electron');
  // The approved style sheets remain byte-for-byte unchanged; load a Windows-
  // only backing correction before announcing that the first frame is ready.
  shellStylesReady = new Promise(resolve=>{
   const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='windows-shell.css';
   sheet.onload=resolve;sheet.onerror=()=>{console.error('Windows shell stylesheet unavailable');resolve()};
   document.head.appendChild(sheet);
  });
 }
 function applySettings(){
  refs.win.style.setProperty('--editor-font-family',(EDITOR_FONTS[settings.editorFont]||EDITOR_FONTS.segoe).family);
  document.documentElement.style.setProperty('--font-size',settings.fontSize+'px');
  refs.win.classList.remove('small-note-title');
  refs.win.style.setProperty('--note-title-size',settings.titleSize+'px');
  refs.win.style.setProperty('--note-title-line',Math.max(30,Math.ceil(settings.titleSize*1.25))+'px');
  document.documentElement.style.setProperty('--line-height',String(settings.lineHeight));
  document.documentElement.style.setProperty('--paragraph-gap',Math.max(.15,.24+(settings.lineHeight-1.1)*(.48/.54)).toFixed(3)+'em');
  // Keep the final visible line approximately 35px above the bottom edge at
  // every configured font size and line-spacing preset. The line box's
  // descender/leading changes with typography, so equal CSS padding alone
  // cannot produce equal visible spacing.
  document.documentElement.style.setProperty('--editor-bottom-padding', Math.max(16,Math.min(40,Math.round(37-(settings.lineHeight-1)*settings.fontSize/2)))+'px');
  refs.editor.spellcheck=!!settings.spellcheckEnabled;
  if(!settings.formatToolbarEnabled){refs.toolbar.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;}
  syncSidebarWidth();
  renderSaveIndicator();
 }
 // Register only application-owned static strings, before any project data is rendered.
 // Never scan the editor, note list, project names, recovery data or user input.
 function translateLabel(value){
  for(const prefix of ['Уменьшить: ','Увеличить: '])if(value.startsWith(prefix))return t(prefix)+t(value.slice(prefix.length));
  if(/^Цвет \d+$/.test(value))return t('Цвет ')+value.slice(5);
  return t(value);
 }
 function localizeTree(root,remember=false){
  const keys=window.NocturneI18n.EN;
  const isKey=s=>Object.hasOwn(keys,s)||/^(?:Уменьшить: |Увеличить: |Цвет \d+$)/.test(s);
  const apply=(value,set)=>{if(!isKey(value))return;if(remember)staticStrings.push({value,set});set(translateLabel(value));};
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let n=walker.nextNode();n;n=walker.nextNode()){
   if(n.parentElement?.closest('script,style,#editor,#note-list,#project-caption'))continue;
   const node=n,raw=node.nodeValue,key=raw.trim();
   apply(key,value=>{node.nodeValue=raw.replace(key,()=>value);});
  }
  for(const el of root.querySelectorAll('[title],[aria-label],[placeholder],[data-placeholder],[alt]')){
   if(el.closest('#editor,#note-list,#project-caption')&&el.id!=='editor')continue;
   for(const attr of ['title','aria-label','placeholder','data-placeholder','alt'])if(el.hasAttribute(attr))apply(el.getAttribute(attr),value=>el.setAttribute(attr,value));
  }
 }
 function applyLanguage(){
  document.documentElement.lang=settings.language;
  for(const {value,set} of staticStrings)set(translateLabel(value));
  if(refs.sidebar.classList.contains('collapsed'))refs.sidebarTab.title=t('Показать список заметок');else refs.sidebarTab.title=t('Скрыть список заметок');
  refs.sidebarTab.setAttribute('aria-label',refs.sidebarTab.title);
  $('#max-btn').title=t(refs.win.classList.contains('is-maximized')?'Восстановить размер':'Развернуть');
  const pin=$('#always-top');if(pin){pin.title=t(topmost?'Отключить поверх всех окон · Ctrl+Shift+T':'Поверх всех окон · Ctrl+Shift+T');pin.setAttribute('aria-label',pin.title);}
  if(formatPopoversReady)fillFormatPopovers();
  if(state){updateProjectCaption(state);updateProtectionUI();renderList();renderSaveIndicator();}
 }
 function toast(s){refs.toast.textContent=t(s);refs.toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>refs.toast.hidden=true,3000)}
 function report(err){console.error(err);toast(errorText(settings.language,err?.message)||'Не удалось выполнить действие')}
 const readNote=()=>state?.notes.find(n=>n.id===state.activeId);
 function nameOrFallback(text){return String(text||'').trim()||'Без названия'}
 function displayNoteName(value){const title=nameOrFallback(value);return title==='Без названия'?t('Без названия'):title;}
 function sanitizeHTML(html){return window.NocturneContent.sanitizeDOM(html);}
 function notePayload(){
  const n=readNote();if(!n)return null;
  const revision=revisions.get(n.id)||0;
  if(cachedPayload?.id===n.id&&cachedPayload.revision===revision)return cachedPayload.value;
  const value={id:n.id,title:nameOrFallback(refs.title.value),html:sanitizeHTML(refs.editor.innerHTML)};
  cachedPayload={id:n.id,revision,value};return value;
 }
 function updateLocalNote(){const n=readNote();if(!n||busy)return;const value=notePayload();if(value){n.title=value.title;n.html=value.html;}}
 const SAVE_LABELS={saved:'Сохранено',pending:'Есть несохраненные изменения',error:'Ошибка сохранения'};
 function noteStatus(id){return statuses.get(id)||'saved'}
 function renderSaveIndicator(){
  if(!state)return;
  const active=refs.list.querySelector('.note-row.active');if(!active)return;
  let dot=active.querySelector('.note-save-dot');
  if(!settings.saveIndicatorsEnabled){dot?.remove();return;}
  if(!dot){dot=document.createElement('span');dot.className='note-save-dot';dot.setAttribute('aria-hidden','true');active.appendChild(dot);}
  const status=noteStatus(state.activeId);dot.dataset.status=status;dot.title=t(SAVE_LABELS[status]);
 }
 function markStatus(id,status){if(statuses.get(id)===status)return;statuses.set(id,status);if(state?.activeId===id)renderSaveIndicator()}
 function queueRecovery(){
  if(!api.saveRecoveryDraft)return;
  clearTimeout(recoveryTimer);
  recoveryTimer=setTimeout(()=>{
   recoveryTimer=null;const value=notePayload();if(!value)return;
   const project=state,revision=revisions.get(value.id)||0;
   const work=savePromise.then(()=>{
    if(state!==project||(revisions.get(value.id)||0)!==revision||noteStatus(value.id)==='saved')return;
    return api.saveRecoveryDraft(value);
   });
   savePromise=work.catch(error=>{console.error('Recovery backup failed:',error);toast('Не удалось создать восстановительный черновик')});
  },450);
 }
 function queueSave(){
  if(busy||!state?.activeId)return;
  const id=state.activeId;cachedPayload=null;revisions.set(id,(revisions.get(id)||0)+1);
  // Avoid serializing and sanitizing the full document for every keystroke.
  // Search needs current text immediately; recovery/save capture it on demand.
  const n=readNote();if(n)n.title=nameOrFallback(refs.title.value);
   window.nocturneSearch.invalidate(id);
  if(searchOpen)updateLocalNote();
  markStatus(id,'pending');scheduleHistory();
  queueRecovery();clearTimeout(saveTimer);saveTimer=setTimeout(()=>void persistActive(),settings.autosaveMs);
 }
 async function persistActive(){
  clearTimeout(saveTimer);saveTimer=null;
  if(busy||!state)return true;
  // No SQLite or recovery rewrite when the current revision is already saved.
  if(noteStatus(state.activeId)==='saved')return true;
  const value=notePayload();if(!value)return true;
  const n=readNote();if(n){n.title=value.title;n.html=value.html;}
  if(recoveryTimer){clearTimeout(recoveryTimer);recoveryTimer=null;}
  const id=value.id,revision=revisions.get(id)||0;
  // Persist a fast recovery copy before the scheduled .ns write: even a failed
  // manual save must leave the latest edit recoverable.
  const promise=savePromise.then(async()=>{
   if(api.saveRecoveryDraft){try{await api.saveRecoveryDraft(value)}catch(e){console.error('Recovery backup failed:',e)}}
   return api.updateNote(value);
  });
  savePromise=promise.catch(()=>{});
  try{await promise;if((revisions.get(id)||0)===revision)markStatus(id,'saved');return true;}
  catch(e){if((revisions.get(id)||0)===revision)markStatus(id,'error');report(e);return false;}
 }
 async function flush(){
  if(!historyRestoring)commitHistory();
  for(;;){
   const project=state,id=state?.activeId,revision=revisions.get(id)||0;
   const ok=await persistActive();await savePromise;
   if(!ok||state!==project||state?.activeId!==id)return false;
   if((revisions.get(id)||0)===revision)return true;
  }
 }
 function syncProject(project,preserveHistory=false){
  commitHistory();if(!preserveHistory){history?.clear();scrollOffsets.clear();}
  if(searchOpen)closeSearch();
  state={...project,notes:project.notes.map(n=>({...n}))};
  statuses.clear();revisions.clear();window.nocturneSearch.clearCache();cachedPayload=null;clearTimeout(recoveryTimer);recoveryTimer=null;clearTimeout(saveTimer);saveTimer=null;
   savePromise=Promise.resolve();window.getSelection()?.removeAllRanges();
  updateProjectCaption(project);updateProtectionUI();
  renderList();renderNote();closeMenus();
 }
 function updateProjectCaption(project){
  const projectName=project.isDraft?t('Новый проект'):String(project.name||'').trim()||t('Без названия');
  refs.win.dataset.project=projectName;
  const projectCaption=$('#project-caption');
  projectCaption.textContent='— '+projectName;
  projectCaption.title=projectName+(project.locked?' — '+t('Проект заблокирован'):project.encrypted?' — '+t('Проект защищен'):'');
  document.title='Nocturne Notes — '+projectName;
 }
 // Reconcile by note ID: preserve rows, focus and DOM identity across searches.
 // One delegated handler per event, not eight new closures per row per render.
 function renderList(){
  if(!state){refs.list.replaceChildren();return;}
  const query=searchOpen?refs.searchQuery.value.trim():'';
  const matched=query?new Set(searchHits.groups.map(g=>g.noteId)):null;
  const filtered=matched?state.notes.filter(n=>matched.has(n.id)):state.notes;
  const previous=new Map([...refs.list.children].filter(el=>el.classList.contains('note-row')).map(el=>[el.dataset.id,el]));
  const wanted=new Set(filtered.map(n=>n.id));
  for(const [id,row] of previous)if(!wanted.has(id))row.remove();
  let empty=refs.list.querySelector('.search-empty');
  if(query&&!filtered.length){
   if(!empty){empty=document.createElement('div');empty.className='search-empty';refs.list.appendChild(empty);}
   empty.textContent=t('Ничего не найдено');
  }else empty?.remove();
  let separator=refs.list.querySelector('.pinned-divider');
  const needsDivider=filtered.some(n=>n.pinned)&&filtered.some(n=>!n.pinned);
  if(!needsDivider){separator?.remove();separator=null;}
  else if(!separator){separator=document.createElement('div');separator.className='pinned-divider';separator.setAttribute('role','presentation');separator.setAttribute('aria-hidden','true');}
  let position=refs.list.firstElementChild,dividerPlaced=false;
  for(const n of filtered){
   if(separator&&!n.pinned&&!dividerPlaced){
    if(position!==separator)refs.list.insertBefore(separator,position);else position=position.nextElementSibling;
    dividerPlaced=true;
   }
   let row=previous.get(n.id);
   if(!row){
    row=document.createElement('button');row.type='button';row.className='note-row';row.dataset.id=n.id;row.setAttribute('role','option');
    const label=document.createElement('span');label.className='note-row-label';row.appendChild(label);
   }
   const active=n.id===state.activeId,name=displayNoteName(n.title),label=row.firstElementChild;
   if(row.title!==name)row.title=name;
   if(label.textContent!==name)label.textContent=name;
   row.classList.toggle('active',active);row.setAttribute('aria-selected',String(active));row.draggable=!n.pinned;
   let badge=row.querySelector('.note-bookmark');
   if(n.pinned){
    if(!badge){badge=document.createElement('span');badge.className='note-bookmark';badge.innerHTML=bookmarkIcon;label.after(badge);}
    badge.title=t('Закрепленная заметка');badge.setAttribute('aria-label',badge.title);
   }else badge?.remove();
   let dot=row.querySelector('.note-save-dot');
   if(active&&settings.saveIndicatorsEnabled){
    if(!dot){dot=document.createElement('span');dot.className='note-save-dot';dot.setAttribute('aria-hidden','true');row.appendChild(dot);}
    const status=noteStatus(n.id);dot.dataset.status=status;dot.title=t(SAVE_LABELS[status]);
   }else dot?.remove();
   if(position!==row)refs.list.insertBefore(row,position);else position=position.nextElementSibling;
  }
 }
 function bindNoteList(){
  const rowFor=e=>e.target.closest('.note-row');
  let dragged=null;
  const resetDrag=()=>{dragged=null;refs.list.querySelectorAll('.dragging,.drag-target').forEach(el=>el.classList.remove('dragging','drag-target'));};
  refs.list.addEventListener('click',e=>{const row=rowFor(e);if(!row||projectOperation||!refs.dialog.hidden)return;void runProjectTask(async()=>{
   const id=row.dataset.id;await switchNote(id);
   if(searchOpen&&state.activeId===id){refreshSearchMatches({preferNoteId:id});await showCurrentSearchHit(true,true);}
  });});
  refs.list.addEventListener('dblclick',e=>{const row=rowFor(e);if(row)void renameNote(row.dataset.id);});
  refs.list.addEventListener('contextmenu',e=>{const row=rowFor(e);if(!row)return;e.preventDefault();if(!projectOperation&&refs.dialog.hidden)openContext(row.dataset.id,e.clientX,e.clientY);});
  refs.list.addEventListener('dragstart',e=>{const row=rowFor(e);if(!row||!row.draggable||projectOperation||!e.dataTransfer){e.preventDefault();return;}dragged=row.dataset.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragged);row.classList.add('dragging');});
  refs.list.addEventListener('dragend',resetDrag);
  refs.list.addEventListener('dragover',e=>{const row=rowFor(e);if(!row||!dragged||projectOperation||!state)return;
   const a=state.notes.findIndex(n=>n.id===dragged),b=state.notes.findIndex(n=>n.id===row.dataset.id);
   if(canMove(a,b)){e.preventDefault();row.classList.add('drag-target');}
  });
  refs.list.addEventListener('dragleave',e=>{const row=rowFor(e);if(row&&!row.contains(e.relatedTarget))row.classList.remove('drag-target');});
  refs.list.addEventListener('drop',e=>{const row=rowFor(e);if(!row||!dragged)return;e.preventDefault();const id=dragged;resetDrag();void moveNote(id,row.dataset.id);});
 }
 function renderNote(){
  const n=readNote();cachedPayload=null;busy=true;refs.toolbar.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;
  preservedRange=null;
  if(n){refs.title.value=n.title==='Без названия'?'':n.title;refs.editor.innerHTML=sanitizeHTML(n.html);refs.scroll.scrollTop=scrollOffsets.get(n.id)||0;}
  else{refs.title.value='';refs.editor.innerHTML=state?.locked?'':'<p></p>'}
  busy=false;
  if(n&&history)history.resetCurrent(n.id,editSnapshot());updateHistoryButtons();
 }
 async function selectNote(id){return runProjectTask(()=>switchNote(id));}
 async function switchNote(id){
  if(!state||id===state.activeId||!state.notes.some(n=>n.id===id))return;
  const old=state.activeId;scrollOffsets.set(old,refs.scroll.scrollTop);
  if(!await flush())return;
  await api.selectNote(id);state.activeId=id;renderNote();if(searchOpen)refreshSearchMatches();else renderList();
 }
 async function createNote(){return runProjectTask(()=>createNoteTask());}
 async function createNoteTask(){if(state?.locked)return;if(searchOpen)closeSearch();if(!await flush())return;try{const newNote=await api.createNote();state.notes.push(newNote);state.activeId=newNote.id;renderList();renderNote();refs.title.focus();refs.title.select();}catch(e){report(e)}}
 function updateProtectionUI(){
  const locked=!!state?.locked;
  const concealed=locked||lockPending;
  refs.menuToggle.disabled=lockPending;
  refs.title.disabled=locked;refs.title.readOnly=projectOperation;refs.editor.contentEditable=concealed||projectOperation?'false':'true';
  refs.title.hidden=concealed;lockedHeading.hidden=!concealed;
  lockedHeading.querySelector('span').textContent=concealed?t(locked?'Проект заблокирован':lockFailed?'Не удалось заблокировать проект':'Блокировка проекта'):'';
  refs.win.classList.toggle('privacy-pending',lockPending);
  refs.editor.dataset.placeholder=concealed?'':t('Начни писать...');
  const panic=$('#panic-lock');if(panic){
   // A plain project can enter the normal password-setup flow. Only the
   // temporary operation guard disables the action, not the protection state.
   panic.disabled=!state||projectOperation||lockPending;
   panic.title=t(locked?'Разблокировать проект · Ctrl+Shift+L':state?.encrypted?'Заблокировать проект · Ctrl+Shift+L':'Установить пароль · Ctrl+Shift+L');
   panic.setAttribute('aria-label',panic.title);
  }
  refs.addNote.disabled=locked;refs.saveShortcut.disabled=locked;refs.searchToggle.disabled=locked;
  for(const action of ['save','save-as','export','trash']){const row=refs.appMenu.querySelector('[data-action="'+action+'"]');if(row)row.disabled=locked;}
 }
 async function runProjectTask(fn){
  if(projectOperation)return;
  // Capture the edit and selection before temporarily freezing the fields.
  commitHistory();projectOperation=true;updateProtectionUI();
  try{await fn();}catch(e){report(e);}
  finally{projectOperation=false;updateProtectionUI();void drainExternal();}
 }
 async function drainExternal(){
  if(!externalWaiting||projectOperation||!refs.dialog.hidden||!state)return;
  externalWaiting=false;await runProjectTask(async()=>{if(await flush())await completeOpen(await api.openExternal());});
 }
 async function completeOpen(result){
  if(!result)return false;
  if(!result.passwordRequired){syncProject(result);toast('Проект открыт');return true;}
  let error='';
  for(;;){
   const values=await passwordDialog('unlock',result.name,error);
   if(!values){await api.cancelUnlock(result.token);return false;}
   try{
    const p=await api.unlockProject({token:result.token,password:values.current});
    syncProject(p);toast('Проект открыт');return true;
   }catch(e){error=errorText(settings.language,e.message);}
   finally{values.current='';}
  }
 }
 async function newProject(){return runProjectTask(async()=>{if(!await flush())return;const p=await api.createProject();if(p){syncProject(p);toast('Создан новый проект');}});}
 async function openProject(){return runProjectTask(async()=>{if(await flush())await completeOpen(await api.openProject());});}
 async function openRecent(file){return runProjectTask(async()=>{if(await flush())await completeOpen(await api.openRecent(file));});}
 async function saveProject(){if(state?.locked)return;return runProjectTask(async()=>{if(!await flush())return;const info=await api.saveProject();if(info){if(info.notes)syncProject(info,true);toast(api.isDesktop?'Проект сохранен':'Черновик сохранен в браузере');}});}
 async function saveAs(){if(state?.locked)return;return runProjectTask(async()=>{if(!await flush())return;const p=await api.saveAsProject();if(p){if(p.notes)syncProject(p,true);toast(api.isDesktop?'Проект сохранен как .ns':'Скачана JSON-копия предпросмотра');}});}
 async function exportNote(format){if(state?.locked)return;return runProjectTask(async()=>{
  if(!await flush())return;
  if(state.encrypted&&!await dialogBox({title:'Экспорт без шифрования',message:t('Экспортируемый файл не защищен паролем'),confirm:'Экспортировать'}))return;
  const filename=await api.exportNote(state.activeId,format,!!state.encrypted);
  if(filename)toast(t('Экспортировано: ')+format.toUpperCase());
 });}
 const privacyIcons={
  eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff:'<path d="M3 3l18 18M10 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.5M6.3 7.6C3.5 9.6 2 12 2 12s3.5 6 10 6a10 10 0 0 0 4-.8"/>'
 };
 function privacyIcon(kind){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+privacyIcons[kind]+'</svg>';}
 async function passwordDialog(kind,name='',error=''){
  const fields=kind==='unlock'||kind==='remove'?[['current','Пароль']]:kind==='change'?[['current','Текущий пароль'],['password','Новый пароль'],['repeat','Повторите пароль']]:[['password','Пароль'],['repeat','Повторите пароль']];
  const title={unlock:'Защищенный проект',protect:'Защитить проект',change:'Изменить пароль',remove:'Снять защиту'}[kind];
  const message=kind==='unlock'?name:kind==='remove'?t('Проект станет доступен без пароля'):t('Не менее 8 символов. При потере пароля доступ невозможен');
  const confirm={unlock:'Открыть',protect:'Защитить',change:'Сохранить',remove:'Снять защиту'}[kind];
  const markup='<div class="password-fields">'+fields.map(([key,label])=>'<label class="password-label" for="password-'+key+'">'+t(label)+'</label><div class="password-row"><input class="dialog-input" id="password-'+key+'" data-password="'+key+'" type="password" maxlength="1024" autocomplete="off" spellcheck="false" aria-label="'+t(label)+'"><button type="button" class="password-eye" data-password-eye="'+key+'" title="'+t('Показать пароль')+'" aria-label="'+t('Показать пароль')+'">'+privacyIcon('eye')+'</button></div>').join('')+'<div class="password-error" role="alert" hidden></div></div>';
  refs.dialog.classList.add('password-open');refs.dialog.dataset.passwordMode=kind;
  try{
   const result=dialogBox({title,message,confirm,optionsHtml:markup});
   if(error){const e=refs.dialogOptions.querySelector('.password-error');e.textContent=error;e.hidden=false;}
   requestAnimationFrame(()=>refs.dialogOptions.querySelector('[data-password]')?.focus());
   return await result;
  }finally{refs.dialogOptions.querySelectorAll('[data-password]').forEach(x=>x.value='');refs.dialogOptions.textContent='';refs.dialog.classList.remove('password-open');delete refs.dialog.dataset.passwordMode;}
 }
 // The titlebar button and shortcut use the existing three protection actions.
 // Unlock is always the existing password challenge, never a UI-only toggle.
 async function toggleProjectLock(){
  if(!api.isDesktop||!state||projectOperation||lockPending||!refs.dialog.hidden)return;
  closeMenus();
  if(state.locked)return protectionAction('unlock');
  if(!state.encrypted)return protectionAction('protect');
  return lockProjectNow();
 }
 // Conceal synchronously before the first async save. Do not clear the editor
 // until its latest changes are committed and the encrypted store is closed.
 async function lockProjectNow(){
  if(!api.isDesktop||!state?.encrypted||state.locked||projectOperation||!refs.dialog.hidden)return;
  closeMenus();refs.toolbar.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;
  lockPending=true;lockFailed=false;updateProtectionUI();
  await runProjectTask(async()=>{
   try{
    for(;;){
     lockFailed=false;updateProtectionUI();
     try{
      if(await flush()){
       const result=await api.lockProject();
       syncProject(result.project);clearTimeout(toastTimer);refs.toast.hidden=true;refs.toast.textContent='';return;
      }
     }catch(error){console.error('Project lock failed:',error);}
     // A failed write must not discard edits or unexpectedly reveal the note.
     lockFailed=true;updateProtectionUI();
     if(!await dialogBox({title:'Не удалось заблокировать проект',message:t('Повторите блокировку или нажмите «Отмена», чтобы вернуться к проекту'),confirm:'Повторить блокировку'}))return;
    }
   }finally{lockPending=false;lockFailed=false;updateProtectionUI();}
  });
 }
 async function protectionAction(kind){
 if(kind==='lock')return lockProjectNow();
 return runProjectTask(async()=>{
  if(!await flush())return;
  if(kind==='unlock'){const boot=await api.bootstrap();await completeOpen(boot.pendingOpen);return;}
  let error='';
  for(;;){
   const values=await passwordDialog(kind,'',error);
   if(!values)return;
   try{
    const p=kind==='protect'?await api.protectProject(values.password):kind==='change'?await api.changePassword({current:values.current,password:values.password}):await api.removeProtection(values.current);
    syncProject(p);toast(kind==='remove'?'Защита снята':kind==='change'?'Пароль изменен':'Проект защищен');return;
   }catch(e){error=errorText(settings.language,e.message);}
   finally{for(const k of Object.keys(values))values[k]='';}
  }
 });}
 async function deleteNote(id){return runProjectTask(()=>deleteNoteTask(id));}
 async function deleteNoteTask(id){
  if(state.notes.find(n=>n.id===id)?.pinned)return;
  if(state.notes.length<2){toast('В проекте должна остаться хотя бы одна заметка');return;}
  const note=state.notes.find(n=>n.id===id);const ok=await dialogBox({title:'Переместить в корзину?',message:settings.language==='en'?`“${displayNoteName(note.title)}” can be restored`:`«${displayNoteName(note.title)}» можно будет восстановить`,confirm:'В корзину'});
  if(!ok)return;if(!await flush())return;try{const project=await api.deleteNote(id);history?.drop(id);syncProject(project,true)}catch(e){report(e)}
 }
 async function renameNote(id){return runProjectTask(()=>renameNoteTask(id));}
 async function renameNoteTask(id){
  const n=state.notes.find(v=>v.id===id);if(!n)return;
  if(id===state.activeId){refs.title.focus();refs.title.select();return;}
  const title=await dialogBox({title:'Переименовать заметку',input:n.title,confirm:'Сохранить'});
  if(title===null)return;
  try{const updated=await api.updateNote({id,title:nameOrFallback(title),html:n.html});recordExternal(n,updated);n.title=updated.title;if(searchOpen)refreshSearchMatches();else renderList()}catch(e){report(e)}
 }
 async function moveNote(from,target,direction){return runProjectTask(()=>moveNoteTask(from,target,direction));}
 async function setNotePinned(id){
  return runProjectTask(async()=>{
   const n=state?.notes.find(n=>n.id===id);if(!n||!await flush())return;
   const next=await api.setNotePinned(id,!n.pinned);
   const byId=new Map(state.notes.map(n=>[n.id,n]));
   // Preserve editor/undo/scroll state; only the committed order and pin metadata change.
   state.notes=next.notes.map(n=>Object.assign(byId.get(n.id)||{},n,{pinned:!!n.pinned}));
   if(searchOpen)refreshSearchMatches();else renderList();
  });
 }
 function canMove(from,to){return from>=0&&to>=0&&to<state.notes.length&&from!==to&&!state.notes.slice(Math.min(from,to),Math.max(from,to)+1).some(n=>n.pinned);}
 async function moveNoteTask(from,target,direction){
  if(!from)return;const ids=state.notes.map(n=>n.id),i=ids.indexOf(from),j=ids.indexOf(target);
  const to=typeof direction==='number'?i+direction:j;
  if(!canMove(i,to))return;
  ids.splice(i,1);ids.splice(to,0,from);
  // Do not publish uncommitted ordering in the UI.
  await api.reorderNotes(ids);
  const byId=new Map(state.notes.map(n=>[n.id,n]));
  state.notes=ids.map(id=>byId.get(id));if(searchOpen)refreshSearchMatches();else renderList();
 }
 function closeMenus(){refs.appMenu.hidden=true;refs.submenu.hidden=true;refs.context.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;refs.menuToggle.setAttribute('aria-expanded','false')}
 function toggleAppMenu(){if(lockPending)return;const wasOpen=!refs.appMenu.hidden;closeMenus();refs.appMenu.hidden=wasOpen;refs.menuToggle.setAttribute('aria-expanded',String(!wasOpen));}
 async function showSubmenu(type){
  refs.submenu.textContent='';
  const add=(label,click)=>{
   const b=document.createElement('button');
   b.type='button';
   b.title=label;
   const span=document.createElement('span');span.className='submenu-label';span.textContent=label;
   b.appendChild(span);
    b.addEventListener('click',()=>{closeMenus();void click()});
   refs.submenu.appendChild(b);
  };
  if(type==='protection'){
    if(state?.locked)add(t('Разблокировать'),()=>protectionAction('unlock'));
    else if(state?.encrypted){add(t('Заблокировать'),()=>protectionAction('lock'));add(t('Изменить пароль'),()=>protectionAction('change'));add(t('Удалить пароль'),()=>protectionAction('remove'));}
    else add(t('Установить пароль'),()=>protectionAction('protect'));
   }else if(type==='export'){
    add(t('Обычный текст (.txt)'),()=>exportNote('txt'));
   add('HTML (.html)',()=>exportNote('html'));
   add('Markdown (.md)',()=>exportNote('md'));
  }else{
   const files=await api.recentProjects();
   if(!files.length){
    const info=document.createElement('div');info.className='empty-recent';
    info.textContent=t('Нет');refs.submenu.appendChild(info);
   }
   files.forEach(item=>{
    const id=typeof item==='string'?item:item.id;
    const label=typeof item==='string'?item.split(/[\\/]/).pop():item.label;
    add(label,()=>openRecent(id));
   });
  }
  // Anchor beside the actual menu row, not an arbitrary hard-coded vertical offset.
  const anchor=refs.appMenu.querySelector('[data-action="'+type+'"]');
  const root=refs.win.getBoundingClientRect();
  const menu=refs.appMenu.getBoundingClientRect();
  const row=anchor.getBoundingClientRect();
  const left=Math.round(menu.right-root.left+6);
  let top=Math.round(row.top-root.top-4);
  const roomRight=Math.floor(root.right-(root.left+left)-12);
  refs.submenu.style.left=left+'px';
  refs.submenu.style.top=top+'px';
  refs.submenu.style.maxWidth=Math.max(104,Math.min(460,roomRight))+'px';
  refs.submenu.style.maxHeight=Math.max(120,Math.floor(root.bottom-row.top)-16)+'px';
  refs.submenu.hidden=false;
   if(type==='protection'){top=Math.max(6,Math.min(top,root.height-refs.submenu.offsetHeight-8));refs.submenu.style.top=top+'px';}
  }
  async function doAction(action){
   if(lockPending)return;
   if(state?.locked&&['save','save-as','export','trash'].includes(action))return;
   if(action==='recent'||action==='export'||action==='protection'){await showSubmenu(action);return}
  closeMenus();
  if(action==='new-project')await newProject();if(action==='open-project')await openProject();
  if(action==='save')await saveProject();if(action==='save-as')await saveAs();
  if(action==='trash')await trashDialog();if(action==='settings')await settingsDialog();if(action==='about'){
   refs.dialog.classList.add('about-open');
   try{await dialogBox({title:'Nocturne Notes',optionsHtml:'<div class="about-identity"><img class="about-logo" src="assets/nocturne-notes-logo.png" alt="Логотип Nocturne Notes"><div class="about-details"><div class="about-product">Nocturne Notes</div><div class="about-version">Версия 2.5.0</div></div></div>',hideCancel:true,confirm:'Закрыть'});}
   finally{refs.dialog.classList.remove('about-open');}
  }
 }
 function openContext(id,x,y){closeMenus();activeContextId=id;
  const index=state.notes.findIndex(n=>n.id===id),note=state.notes[index];if(!note)return;
  const pin=refs.context.querySelector('[data-note-action="pin-note"]');
  pin.querySelector('span').textContent=t(note.pinned?'Открепить':'Закрепить');
  refs.context.querySelector('[data-note-action="move-up"]').disabled=!!note.pinned||state.notes[index-1]?.pinned===true;
  refs.context.querySelector('[data-note-action="move-down"]').disabled=!!note.pinned||state.notes[index+1]?.pinned===true;
  refs.context.querySelector('[data-note-action="delete"]').disabled=!!note.pinned;
  const bounds=refs.win.getBoundingClientRect();
  refs.context.style.maxWidth=Math.max(0,Math.floor(bounds.width)-12)+'px';
  refs.context.style.maxHeight=Math.max(0,Math.floor(bounds.height)-12)+'px';
  refs.context.hidden=false;
  refs.context.style.left=Math.max(6,Math.min(x-bounds.left,bounds.width-refs.context.offsetWidth-6))+'px';
  refs.context.style.top=Math.max(6,Math.min(y-bounds.top,bounds.height-refs.context.offsetHeight-6))+'px';
 }
 function openSearch(focusReplacement=false){
   if(state?.locked)return;
   if(focusMode)toggleFocus(false);
  if(!searchOpen){
   updateLocalNote();
   searchOpen=true;refs.searchPanel.hidden=false;refs.sidebar.classList.add('searching');
   refs.searchToggle.setAttribute('aria-expanded','true');
   if(refs.sidebar.classList.contains('collapsed'))toggleSidebar(false);
   syncSidebarWidth();
  }
  refreshSearchMatches();
  const field=focusReplacement?refs.searchReplacement:refs.searchQuery;
  field.focus();if(!focusReplacement)field.select();
 }
 function clearSearchHighlights(){
  if(typeof CSS!=='undefined'&&CSS.highlights){CSS.highlights.delete('nocturne-search-all');CSS.highlights.delete('nocturne-search-current');}
  refs.title.classList.remove('search-title-hit');
 }
 function closeSearch(){
  searchOpen=false;refs.searchPanel.hidden=true;refs.sidebar.classList.remove('searching');
  refs.searchToggle.setAttribute('aria-expanded','false');
  refs.searchQuery.value='';refs.searchReplacement.value='';
  searchHits={groups:[],length:0};searchCursor=-1;clearSearchHighlights();
  refs.searchNavigation.hidden=true;
  syncSidebarWidth();renderList();
 }
 function searchResultNodes(){
  const q=refs.searchQuery.value.trim();if(!q||!state)return [];
  const ids=new Set(searchHits.groups.map(g=>g.noteId));
  return state.notes.filter(n=>ids.has(n.id));
 }
 // Store offsets in compact per-note groups rather than one object per match.
 function getSearchHits(){
  const q=refs.searchQuery.value.trim(),groups=[];let length=0;
  if(!searchOpen||!q||!state)return {groups,length};
  const add=(noteId,kind,positions)=>{
   if(!positions.length)return;
   groups.push({noteId,kind,start:length,offsets:Uint32Array.from(positions)});
   length+=positions.length;
  };
  for(const n of state.notes){
   if(searchScope==='note'&&n.id!==state.activeId)continue;
   add(n.id,'title',window.nocturneSearch.hits(n.title||'',q));
   add(n.id,'body',window.nocturneSearch.bodyHits(n,q));
  }
  return {groups,length};
 }
 function searchHitAt(index){
  if(index<0||index>=searchHits.length)return null;
  let lo=0,hi=searchHits.groups.length-1;
  while(lo<=hi){
   const mid=(lo+hi)>>>1,g=searchHits.groups[mid];
   if(index<g.start)hi=mid-1;
   else if(index>=g.start+g.offsets.length)lo=mid+1;
   else return {noteId:g.noteId,kind:g.kind,offset:g.offsets[index-g.start]};
  }
  return null;
 }
 function previousSearchIndex(hit){
  if(!hit)return -1;
  const g=searchHits.groups.find(g=>g.noteId===hit.noteId&&g.kind===hit.kind);
  if(!g)return -1;
  let lo=0,hi=g.offsets.length-1;
  while(lo<=hi){const mid=(lo+hi)>>>1,x=g.offsets[mid];if(x===hit.offset)return g.start+mid;if(x<hit.offset)lo=mid+1;else hi=mid-1;}
  return -1;
 }
 function updateSearchCounter(){
  const hasText=searchOpen&&!!refs.searchQuery.value.trim();
  refs.searchNavigation.hidden=!hasText;
  refs.searchCounter.textContent=`${searchHits.length?searchCursor+1:0} ${settings.language==='en'?'of':'из'} ${searchHits.length}`;
  refs.searchPrevious.disabled=refs.searchNext.disabled=!searchHits.length;
  refs.searchReplaceOne.disabled=refs.searchReplaceAll.disabled=!searchHits.length;
 }
 function refreshSearchMatches({preferNoteId,preferredIndex}={}){
  const old=searchHitAt(searchCursor);
  searchHits=getSearchHits();
  if(!searchHits.length)searchCursor=-1;
  else if(Number.isInteger(preferredIndex))searchCursor=Math.min(Math.max(preferredIndex,0),searchHits.length-1);
  else if(preferNoteId){const group=searchHits.groups.find(g=>g.noteId===preferNoteId);searchCursor=group?.start??0;}
  else{const idx=previousSearchIndex(old);searchCursor=idx>=0?idx:Math.min(Math.max(searchCursor,0),searchHits.length-1);}
  updateSearchCounter();renderList();paintSearchHits(false);
 }
 function paintSearchHits(scroll){
  clearSearchHighlights();
  if(!searchOpen||!refs.searchQuery.value.trim()||!state)return;
  const current=searchHitAt(searchCursor);
  const ranges=window.nocturneSearch.rangesFor(refs.editor,refs.searchQuery.value.trim(),current?.noteId===state.activeId&&current.kind==='body'?current.offset:null);
  if(typeof CSS!=='undefined'&&CSS.highlights&&typeof Highlight!=='undefined'){
   CSS.highlights.set('nocturne-search-all',new Highlight(...ranges.map(hit=>hit.range)));
   const chosen=current?.noteId===state.activeId&&current?.kind==='body'?ranges.find(hit=>hit.offset===current.offset):null;
   if(chosen)CSS.highlights.set('nocturne-search-current',new Highlight(chosen.range));
  }
  if(current?.noteId!==state.activeId)return;
  if(current.kind==='title'){
   refs.title.classList.add('search-title-hit');
   if(scroll){
    refs.title.focus({preventScroll:true});
    refs.title.setSelectionRange(current.offset,current.offset+refs.searchQuery.value.trim().length);
    refs.scroll.scrollTop=0;
   }
   return;
  }
  if(scroll){
   const match=ranges.find(hit=>hit.offset===current.offset);
   if(match){
    const box=match.range.getBoundingClientRect();const viewport=refs.scroll.getBoundingClientRect();
    if(box.top<viewport.top+16)refs.scroll.scrollTop+=box.top-viewport.top-28;
    else if(box.bottom>viewport.bottom-30)refs.scroll.scrollTop+=box.bottom-viewport.bottom+42;
    if(typeof CSS==='undefined'||!CSS.highlights||typeof Highlight==='undefined'){
     const sel=window.getSelection();sel.removeAllRanges();sel.addRange(match.range);
    }
   }
  }
 }
 async function showCurrentSearchHit(scroll=false,withinOperation=false){
  const chosen=searchHitAt(searchCursor);
  if(!chosen){paintSearchHits(false);return;}
  if(chosen.noteId!==state.activeId){await (withinOperation?switchNote(chosen.noteId):selectNote(chosen.noteId));}
  updateSearchCounter();paintSearchHits(scroll);
 }
 async function navigateSearch(direction){return runProjectTask(async()=>{
  refreshSearchMatches();if(!searchHits.length)return;
  searchCursor=(searchCursor+direction+searchHits.length)%searchHits.length;
  await showCurrentSearchHit(true,true);
 });}
 async function replaceSearchMatches(all){return runProjectTask(()=>replaceSearchMatchesTask(all));}
 async function replaceSearchMatchesTask(all){
  const query=refs.searchQuery.value.trim(),value=refs.searchReplacement.value;
  if(!query){refs.searchQuery.focus();return;}
  if(!await flush())return;
  refreshSearchMatches();
  if(!searchHits.length){toast('Совпадений нет');return;}
  const previousIndex=searchCursor;
  const targets=all?searchResultNodes():[state.notes.find(n=>n.id===searchHitAt(searchCursor).noteId)];
  let changed=0;const batch=[];
  for(const n of targets){
   if(!n)continue;
   const chosen=all?null:searchHitAt(searchCursor);
   const updated=all?window.nocturneSearch.replaceInNote(n,query,value,true):window.nocturneSearch.replaceAt(n,query,value,chosen.kind,chosen.offset);
   if(!updated.count)continue;
   const html=sanitizeHTML(updated.html);
   if(updated.title.length>250||html.length>5_000_000){toast('Результат замены слишком длинный');return;}
   batch.push({id:n.id,title:updated.title,html});changed+=updated.count;
   if(!all)break;
  }
  if(batch.length){
   let saved;
   try{saved=await api.updateNotes(batch);}catch(e){report(e);return;}
   for(const row of saved){
    const n=state.notes.find(v=>v.id===row.id);
    recordExternal(n,row);Object.assign(n,row);window.nocturneSearch.invalidate(n.id);markStatus(n.id,'saved');
   }
  }
  renderNote();
  refreshSearchMatches({preferredIndex:all?0:previousIndex});
  if(!all)await showCurrentSearchHit(true,true);
  toast(changed?(t('Заменено: ')+changed):'Совпадений нет');
 }
 let sidebarSaved=false,sidebarRequest=0;
 function applySidebarCollapsed(collapsed){refs.sidebar.classList.toggle('collapsed',collapsed);refs.sidebarTab.title=t(collapsed?'Показать список заметок':'Скрыть список заметок');refs.sidebarTab.setAttribute('aria-label',refs.sidebarTab.title);}
 function toggleSidebar(force){const collapsed=typeof force==='boolean'?force:!refs.sidebar.classList.contains('collapsed'),request=++sidebarRequest;applySidebarCollapsed(collapsed);void api.setSidebarCollapsed(collapsed).then(()=>{sidebarSaved=collapsed;}).catch(e=>{if(request===sidebarRequest)applySidebarCollapsed(sidebarSaved);report(e);});}
 // Keep the active editing line above a real bottom gutter while typing.
 // Browser-native caret auto-scrolling only makes the caret barely visible and
 // does not respect the container's padding-bottom, causing the observed <5px gap.
 let caretInsetFrame=0;
 function caretLineRect(){
  const sel=window.getSelection();
  if(!sel||!sel.isCollapsed||!sel.rangeCount||!refs.editor.contains(sel.focusNode))return null;
  const rng=sel.getRangeAt(0),node=rng.startContainer,offset=rng.startOffset;
  if(node.nodeType===Node.TEXT_NODE&&node.length){
   const r=document.createRange();
   const end=Math.max(1,Math.min(node.length,offset));
   r.setStart(node,end-1);r.setEnd(node,end);
   const box=r.getBoundingClientRect();
   if(box.height>0)return box;
  }
  const element=node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
  const block=element?.closest?.('p,h1,h2,h3,h4,h5,li,blockquote,div');
  return block&&block!==refs.editor?block.getBoundingClientRect():null;
 }
 function keepCaretAboveBottom(){
  caretInsetFrame=0;
  if(document.activeElement!==refs.editor)return;
  const line=caretLineRect();if(!line)return;
  const frame=refs.scroll.getBoundingClientRect();
  const selection=window.getSelection();
  const focus=selection?.focusNode;
  const el=focus?.nodeType===Node.ELEMENT_NODE?focus:focus?.parentElement;
  const last=refs.editor.lastElementChild;
  const isLastBlock=!!last&&(last===el||last.contains(el));
  // If the user is entering the last line, finish the scroll to its actual
  // maximum: otherwise native caret scroll leaves 5-40px of scroll unused.
  if(isLastBlock&&line.bottom>frame.bottom-40){
   refs.scroll.scrollTop=refs.scroll.scrollHeight;
   return;
  }
  const desiredInset=parseFloat(getComputedStyle(refs.scroll).paddingBottom)+8;
  const overflow=line.bottom-(frame.bottom-desiredInset);
  if(overflow>0.5)refs.scroll.scrollTop+=overflow;
 }
 function scheduleCaretBottomInset(){
  if(!caretInsetFrame)caretInsetFrame=requestAnimationFrame(keepCaretAboveBottom);
 }
 function selectionInsideEditor(){const s=window.getSelection();if(!s||s.isCollapsed||s.rangeCount===0)return null;if(!refs.editor.contains(s.anchorNode)||!refs.editor.contains(s.focusNode))return null;return s.getRangeAt(0)}
 function adjustToolbar(){
  if(lockPending||state?.locked){refs.toolbar.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;return;}
  if(!settings.formatToolbarEnabled||searchOpen){refs.toolbar.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;return;}
  const range=selectionInsideEditor();if(!range){refs.toolbar.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;return}
  if(!formatPopoversReady){fillFormatPopovers();formatPopoversReady=true;}
  preservedRange=range.cloneRange();refs.toolbar.hidden=false;
  const selRect=range.getBoundingClientRect(),root=refs.win.getBoundingClientRect();
  const width=refs.toolbar.offsetWidth||630;
  const x=Math.min(Math.max(selRect.left-root.left+27,Math.max(12,refs.sidebar.getBoundingClientRect().right-root.left+17)),root.width-width-12);
  let y=selRect.top-root.top-refs.toolbar.offsetHeight-22;
  const titleRect=refs.title.getBoundingClientRect();
  // Near the beginning of a note, show the floating toolbar below the selection
  // instead of obscuring the note title.
  if(y<60||(root.top+y<titleRect.bottom+6&&root.top+y+refs.toolbar.offsetHeight>titleRect.top-2))y=selRect.bottom-root.top+11;
  refs.toolbar.style.left=Math.round(x)+'px';refs.toolbar.style.top=Math.round(y)+'px';
  const parent=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
  const tag=parent?.closest?.('h1,h2,h3,h4,h5,h6')?.tagName?.toLowerCase()||'p';
  $('#heading-label').textContent=tag==='p'?'Aa':tag.toUpperCase();
  refs.headingPopover.querySelectorAll('[data-heading]').forEach(b=>b.classList.toggle('active',b.dataset.heading===tag));
  for(const b of refs.toolbar.querySelectorAll('[data-format]')){
   const c=b.dataset.format;
   if(['bold','italic','underline','strikeThrough'].includes(c)){
    try{const active=!!document.queryCommandState(c);b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))}catch{b.classList.remove('selected');b.setAttribute('aria-pressed','false')}
   }
  }
 }
 function restoreRange(){if(!preservedRange)return;const sel=window.getSelection();sel.removeAllRanges();sel.addRange(preservedRange);refs.editor.focus({preventScroll:true})}
 function editorCommand(command,value=null){
  if(projectOperation||state?.locked)return false;
  commitHistory();if(state?.activeId)history?.resetCurrent(state.activeId,editSnapshot());
  const result=document.execCommand(command,false,value);
  queueSave();return result;
 }
 async function formatAction(cmd){
  if(cmd==='color'||cmd==='heading'){
   const pop=cmd==='color'?refs.colorPopover:refs.headingPopover;
   const other=cmd==='color'?refs.headingPopover:refs.colorPopover;
   const button=cmd==='color'?$('#color-button'):$('#heading-toggle');
   const wasOpen=!pop.hidden;
   other.hidden=true;
   pop.hidden=wasOpen;
   if(wasOpen)return;
   const appRect=refs.win.getBoundingClientRect(),b=button.getBoundingClientRect();
   const popWidth=pop.offsetWidth||(cmd==='color'?224:210);
   const x=Math.max(12,Math.min(b.left-appRect.left-(cmd==='color'?110:35),appRect.width-popWidth-12));
   let top=b.bottom-appRect.top+10;
   if(top+pop.offsetHeight>appRect.height-12)top=Math.max(56,b.top-appRect.top-pop.offsetHeight-10);
   pop.style.left=Math.round(x)+'px';pop.style.top=Math.round(top)+'px';
   $('#heading-toggle').setAttribute('aria-expanded',String(cmd==='heading'&&!pop.hidden));
   return;
  }
  if(cmd==='link'){
   const s=window.getSelection()?.toString()||'';
   const url=await dialogBox({title:'Добавить ссылку',message:t(s?'Ссылка для выделенного текста:':'Введите адрес ссылки:'),input:'https://',confirm:'Добавить'});
   if(!url)return;
   if(!/^(https?:\/\/|mailto:)/i.test(url)){toast('Нужна ссылка с https://, http:// или mailto:');return}
   restoreRange();editorCommand('createLink',url);setTimeout(adjustToolbar,15);return;
  }
  restoreRange();
  try {
   editorCommand(cmd);requestAnimationFrame(adjustToolbar);
  }catch(e){report(e)}
 }
 async function askDraftDecision({token}){
  const ownsOperation=!projectOperation;
  let choice='cancel';
  if(ownsOperation){commitHistory();projectOperation=true;updateProtectionUI();}
  try{
   if(!refs.dialog.hidden||!await flush())return;
   closeMenus();refs.dialog.classList.add('draft-open');
   let decision;
   try{decision=await dialogBox({title:'Сохранить проект?',message:t('Проект не сохранен. При закрытии несохраненные данные будут потеряны'),confirm:'Сохранить',discard:true});}
   finally{refs.dialog.classList.remove('draft-open');}
   if(decision==='discard'){choice='discard';return;}
   if(!decision)return;
   if(state?.locked){const boot=await api.bootstrap();if(!await completeOpen(boot.pendingOpen))return;}
   const saved=await api.saveAsProject();
   if(saved?.notes&&!saved.isDraft){syncProject(saved,true);choice='save';}
  }catch(e){report(e);}
  finally{
   try{await api.respondDraft({token,choice});}catch(e){report(e);}
   if(ownsOperation){projectOperation=false;updateProtectionUI();void drainExternal();}
  }
 }
 function dialogBox({title,message='',input,confirm='Готово',hideCancel=false,optionsHtml='',discard=false}){
  refs.dialogHeading.textContent=t(title);refs.dialogMessage.textContent=message;
  refs.dialogInput.hidden=input===undefined;refs.dialogInput.value=input??'';
  refs.dialogOptions.hidden=!optionsHtml;refs.dialogOptions.innerHTML=optionsHtml;localizeTree(refs.dialogOptions);
  refs.dialogCancel.hidden=hideCancel;refs.dialogConfirm.textContent=t(confirm);
  $('#dialog-discard')?.remove();
  if(discard){const button=document.createElement('button');button.type='button';button.id='dialog-discard';button.textContent=t('Не сохранять');button.addEventListener('click',()=>resolveDialog('discard'));refs.dialogConfirm.before(button);}
  refs.dialog.hidden=false;
  return new Promise(resolve=>{dialogResolve=resolve;requestAnimationFrame(()=>{(input===undefined?refs.dialogConfirm:refs.dialogInput).focus();if(input!==undefined)refs.dialogInput.select()})});
 }
 function resolveDialog(ok){
  if(refs.dialog.hidden)return;
  let value=ok==='discard'&&refs.dialog.classList.contains('draft-open')?'discard':ok?(refs.dialogInput.hidden?true:refs.dialogInput.value):null;
  if(refs.dialog.dataset.passwordMode){
   const fields=[...refs.dialogOptions.querySelectorAll('[data-password]')];
   if(ok){
    value=Object.fromEntries(fields.map(el=>[el.dataset.password,el.value]));
    let message='';
    if(fields.some(el=>!el.value))message='Введите пароль';
    else if(value.password&&[...value.password].length<8)message='Не менее 8 символов';
    else if(value.password!==undefined&&value.password!==value.repeat)message='Пароли не совпадают';
    if(message){const e=refs.dialogOptions.querySelector('.password-error');e.textContent=t(message);e.hidden=false;return;}
   }
   fields.forEach(el=>{el.value='';el.type='password';});
  }
  const cb=dialogResolve;dialogResolve=null;refs.dialog.hidden=true;$('#dialog-discard')?.remove();if(cb)cb(value);
  queueMicrotask(()=>void drainExternal());
 }
 function customSelect(id,selected,items){
  const current=items.find(([value])=>String(value)===String(selected))||items[0];
  return `<div class="glass-select" data-select="${id}">
   <button type="button" class="glass-select-trigger" data-select-trigger="${id}" aria-haspopup="listbox" aria-expanded="false"><span class="selected-label">${current[1]}</span><svg><use href="#i-chevron-down"/></svg></button>
   <div class="glass-select-list" role="listbox" hidden>${items.map(([value,label])=>`<button type="button" role="option" data-select-option="${id}" data-value="${value}" aria-selected="${String(value)===String(selected)}">${label}</button>`).join('')}</div>
   <input type="hidden" id="${id}" value="${selected}">
  </div>`;
 }
 function settingsControlEvents(){
  refs.dialogOptions.addEventListener('click',e=>{
   const trigger=e.target.closest('[data-select-trigger]');
   if(trigger){
    const root=trigger.closest('.glass-select'),list=root.querySelector('.glass-select-list'),wasOpen=!list.hidden;
    refs.dialogOptions.querySelectorAll('.glass-select-list').forEach(el=>el.hidden=true);
    refs.dialogOptions.querySelectorAll('.glass-select-trigger').forEach(el=>el.setAttribute('aria-expanded','false'));
    list.hidden=wasOpen;trigger.setAttribute('aria-expanded',String(!wasOpen));
    if(!wasOpen){
     // Keep all options visible inside the existing scrolling settings dialog.
     // No menu dimensions or button sizes change.
     const dialog=trigger.closest('.glass-dialog'),r=list.getBoundingClientRect(),d=dialog.getBoundingClientRect();
     const bottom=d.top+dialog.clientTop+dialog.clientHeight;
     if(r.bottom>bottom)dialog.scrollTop+=Math.ceil(r.bottom-bottom+2);
     else if(r.top<d.top+dialog.clientTop)dialog.scrollTop-=Math.ceil(d.top+dialog.clientTop-r.top+2);
    }
    return;
   }
   const option=e.target.closest('[data-select-option]');
   if(option){
    const root=option.closest('.glass-select');root.querySelector('input').value=option.dataset.value;
    root.querySelector('.selected-label').textContent=option.textContent;
    root.querySelectorAll('[data-select-option]').forEach(el=>el.setAttribute('aria-selected',String(el===option)));
    root.querySelector('.glass-select-list').hidden=true;
    root.querySelector('.glass-select-trigger').setAttribute('aria-expanded','false');return;
   }
   const step=e.target.closest('[data-font-step]');
   if(step){const input=$('#'+step.dataset.target);input.value=Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value)+Number(step.dataset.fontStep)*Number(input.step)));input.dispatchEvent(new Event('input',{bubbles:true}));return;}
  });
  refs.dialogOptions.addEventListener('input',e=>{if(e.target.matches('input[type=range]')){const readout=$('#'+e.target.id+'-value');if(readout)readout.textContent=rangeReadout(e.target.id,e.target.value);if(e.target.id==='setting-autosave')e.target.setAttribute('aria-valuetext',rangeReadout(e.target.id,e.target.value));}});
 }
 function rangeReadout(id,value){
  if(id==='setting-line')return Number(value).toFixed(2);
  if(id==='setting-autosave')return value+' '+t('мин');
  return value+' px';
 }
 async function settingsDialog(){
  const range=(id,label,desc,min,max,step,value)=>`<div class="setting-row font-setting"><span class="setting-copy"><strong>${label}</strong><small>${desc}</small></span><div class="font-controls"><button type="button" class="font-step" data-target="${id}" data-font-step="-1" aria-label="Уменьшить: ${label}"><svg><use href="#i-minus"/></svg></button><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"><button type="button" class="font-step" data-target="${id}" data-font-step="1" aria-label="Увеличить: ${label}"><svg><use href="#i-plus"/></svg></button><span class="font-readout" id="${id}-value">${rangeReadout(id,value)}</span></div></div>`;
  const language=customSelect('setting-language',settings.language,[['en','Английский'],['ru','Русский']]);
  const font=customSelect('setting-editor-font',settings.editorFont,Object.entries(EDITOR_FONTS).map(([key,value])=>[key,value.label]));
  const delay=range('setting-autosave','Автосохранение','Пауза после последнего ввода',1,20,1,settings.autosaveMs/60000);
  const html=`
   <section class="settings-group"><div class="settings-caption">Редактор</div>
    <div class="setting-row editor-font-setting"><span class="setting-copy"><strong>Шрифт редактора</strong><small>Заголовок и текст заметки</small></span>${font}</div>
    ${range('setting-title-size','Размер заголовка','От 15 до 35 пикселей',15,35,1,settings.titleSize)}
    ${range('setting-font','Размер текста','От 10 до 35 пикселей',10,35,1,settings.fontSize)}
    ${range('setting-line','Межстрочный интервал','От 1.00 до 2.00',1,2,.1,settings.lineHeight)}
    <div class="setting-row"><span class="setting-copy"><strong>Панель форматирования</strong><small>Показывать при выделении текста</small></span><input id="setting-toolbar" type="checkbox" aria-label="Панель форматирования" ${settings.formatToolbarEnabled?'checked':''}></div>
    <div class="setting-row"><span class="setting-copy"><strong>Индикаторы сохранения</strong><small>Показывать статус активной заметки</small></span><input id="setting-indicators" type="checkbox" aria-label="Индикаторы сохранения" ${settings.saveIndicatorsEnabled?'checked':''}></div>
    <div class="setting-row"><span class="setting-copy"><strong>Проверка орфографии</strong><small>Русский и английский языки</small></span><input id="setting-spellcheck" type="checkbox" aria-label="Проверка орфографии" ${settings.spellcheckEnabled?'checked':''}></div>
   </section>
   <section class="settings-group"><div class="settings-caption">Сохранение</div>
    ${delay}
    <div class="setting-row"><span class="setting-copy"><strong>Восстанавливать последний проект</strong><small>Открывать прошлую сессию при запуске</small></span><input id="setting-restore" type="checkbox" aria-label="Восстанавливать последний проект" ${settings.restoreLastProject?'checked':''}></div>
   </section>
   <section class="settings-group"><div class="settings-caption">Приложение</div>
    <div class="setting-row"><span class="setting-copy"><strong>Язык приложения</strong><small>Язык интерфейса</small></span>${language}</div>
    <div class="setting-row"><span class="setting-copy"><strong>Сворачивать в трей при закрытии</strong><small>Оставлять приложение запущенным в фоне</small></span><input id="setting-tray" type="checkbox" aria-label="Сворачивать в трей при закрытии" ${settings.minimizeToTray?'checked':''} ${api.isDesktop?'':'disabled'}></div>
   </section>`;
  refs.dialog.classList.add('settings-open');
  try{
   const dialog=dialogBox({title:'Настройки',confirm:'Сохранить',optionsHtml:html});
   $('#setting-autosave').setAttribute('aria-valuetext',rangeReadout('setting-autosave',$('#setting-autosave').value));
   const accepted=await dialog;
   if(!accepted)return;
   const next={language:$('#setting-language').value,minimizeToTray:$('#setting-tray').checked,editorFont:$('#setting-editor-font').value,fontSize:Number($('#setting-font').value),titleSize:Number($('#setting-title-size').value),lineHeight:Number($('#setting-line').value),autosaveMs:Number($('#setting-autosave').value)*60000,restoreLastProject:$('#setting-restore').checked,sidebarWidth:settings.sidebarWidth,formatToolbarEnabled:$('#setting-toolbar').checked,saveIndicatorsEnabled:$('#setting-indicators').checked,spellcheckEnabled:$('#setting-spellcheck').checked};
   const previousLanguage=settings.language;
   settings={...DEFAULT_SETTINGS,...await api.updateSettings(next)};
   applySettings();
   if(previousLanguage!==settings.language)applyLanguage();
   if(saveTimer){clearTimeout(saveTimer);saveTimer=setTimeout(()=>void persistActive(),settings.autosaveMs)}
   toast('Настройки сохранены');
  }catch(e){report(e)}finally{refs.dialog.classList.remove('settings-open')}
 }
 function fillFormatPopovers(){
  const titles=[['p','Обычный текст','Aa'],['h1','Заголовок 1','H1'],['h2','Заголовок 2','H2'],['h3','Заголовок 3','H3'],['h4','Заголовок 4','H4'],['h5','Заголовок 5','H5']];
  refs.headingPopover.innerHTML='<div class="popover-caption">Стиль текста</div>'+titles.map(([tag,label,icon])=>`<button class="heading-option" type="button" data-heading="${tag}" role="option"><span class="heading-sample heading-${tag}">${icon}</span><span>${label}</span></button>`).join('');
  const palette=['#efefef','#c5c5c9','#9d9da5','#66666e','#343439','#f4d9dd','#eaa4b1','#da798c','#c45169','#893447','#f7dfcc','#edb794','#dc976b','#b87750','#76513c','#f8efc3','#e9d887','#c6bb69','#948b4b','#67633c','#d4e9d6','#a6d0b2','#7db993','#548968','#365b49','#d4e6f4','#a9cde9','#83a9d9','#597bb0','#394d78','#e0d6f4','#c2abeb','#aa8bd6','#8563b4','#5b437a'];
  const grid=$('#color-grid');grid.innerHTML=palette.map((c,i)=>`<button type="button" class="palette-swatch" data-color="${c}" style="--swatch:${c}" aria-label="Цвет ${i+1}" title="${c}"></button>`).join('');
  localizeTree(refs.headingPopover);localizeTree(grid);
 }
 const SIDEBAR_MIN=120,EDITOR_MIN=440;
 function sidebarMaximum(){return Math.max(SIDEBAR_MIN,Math.floor(refs.win.querySelector('.workarea').clientWidth-EDITOR_MIN));}
 function syncSidebarWidth(){refs.win.style.setProperty('--sidebar-w',Math.min(sidebarMaximum(),Math.max(searchOpen?220:SIDEBAR_MIN,Math.round(settings.sidebarWidth||240)))+'px');}
 function resizeSidebar(){
  const handle=refs.resizer;
  const setWidth=(value,persist=false)=>{
   settings.sidebarWidth=Math.min(sidebarMaximum(),Math.max(SIDEBAR_MIN,Math.round(value)));
   syncSidebarWidth();
   if(persist)void api.updateSettings({sidebarWidth:settings.sidebarWidth}).then(data=>{settings={...settings,...data}}).catch(report);
  };
  let activePointer=null, resizeLeft=0, pendingWidth=null, resizeFrame=0;
  const flushResize=()=>{
   resizeFrame=0;
   if(pendingWidth===null)return;
   setWidth(pendingWidth);
   pendingWidth=null;
  };
  handle.addEventListener('pointerdown',e=>{
   if(refs.sidebar.classList.contains('collapsed'))return;
   e.preventDefault();activePointer=e.pointerId;resizeLeft=refs.win.getBoundingClientRect().left;
   handle.setPointerCapture(e.pointerId);
   document.body.classList.add('sidebar-resizing');
  });
  handle.addEventListener('pointermove',e=>{
   if(activePointer!==e.pointerId)return;
   pendingWidth=e.clientX-resizeLeft;
   if(!resizeFrame)resizeFrame=requestAnimationFrame(flushResize);
  });
  const stop=e=>{
   if(activePointer!==e.pointerId)return;
   if(resizeFrame){cancelAnimationFrame(resizeFrame);resizeFrame=0;}
   if(pendingWidth!==null){setWidth(pendingWidth);pendingWidth=null;}
   activePointer=null;document.body.classList.remove('sidebar-resizing');setWidth(settings.sidebarWidth,true);
  };
  handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);
  handle.addEventListener('keydown',e=>{
   if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
   e.preventDefault();setWidth(settings.sidebarWidth+(e.key==='ArrowRight'?10:-10),true);
  });
 }
 function onKey(e){
  const ctrl=e.ctrlKey||e.metaKey, shift=e.shiftKey;
  if(e.key==='Escape'){if(!refs.dialog.hidden){resolveDialog(false);e.preventDefault();return}if(searchOpen){e.preventDefault();closeSearch();return;}if(focusMode){e.preventDefault();toggleFocus(false);return;}closeMenus();return;}
  if(!refs.dialog.hidden||e.isComposing)return;
  if(api.isDesktop&&ctrl&&shift&&e.code==='KeyL'){e.preventDefault();if(!e.repeat)void toggleProjectLock();return;}
  if(projectOperation){if(e.ctrlKey||e.metaKey||e.key==='F2')e.preventDefault();return;}
  if(e.key==='F11'){e.preventDefault();toggleFocus();return;}
  if(api.isDesktop&&ctrl&&shift&&e.code==='KeyT'){e.preventDefault();void toggleTop();return;}
  if(ctrl&&(e.code==='KeyZ'||e.code==='KeyY')&&(e.target===refs.title||refs.editor.contains(e.target)||e.target===document.body)){e.preventDefault();applyHistory(e.code==='KeyY'||shift?'redo':'undo');return;}
  if(ctrl&&(e.code==='KeyF'||e.code==='KeyH')){e.preventDefault();openSearch(e.code==='KeyH');return;}
  if(ctrl&&e.code==='KeyN'){e.preventDefault();void(shift?newProject():createNote());return}
  if(ctrl&&e.code==='KeyO'){e.preventDefault();void openProject();return}
  if(ctrl&&e.code==='KeyS'){e.preventDefault();void(shift?saveAs():saveProject());return}
  if(ctrl&&e.code==='Backslash'){e.preventDefault();toggleSidebar();return}
  if(e.key==='F2'){e.preventDefault();if(state)void renameNote(state.activeId);return}
  if(e.key==='Alt'&&!ctrl&&!shift){e.preventDefault();toggleAppMenu()}
 }
 function bind(){
  bindNoteList();
  refs.menuToggle.addEventListener('click',e=>{e.stopPropagation();toggleAppMenu()});
  refs.appMenu.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)void doAction(b.dataset.action)});
  refs.context.addEventListener('click',e=>{
   const b=e.target.closest('[data-note-action]');if(!b||b.disabled)return;const action=b.dataset.noteAction,id=activeContextId;closeMenus();
   if(action==='pin-note')void setNotePinned(id);
   if(action==='duplicate')void duplicateNote(id);if(action==='rename')void renameNote(id);if(action==='delete')void deleteNote(id);
   if(action==='move-up')void moveNote(id,id,-1);if(action==='move-down')void moveNote(id,id,1);
  });
  document.addEventListener('pointerdown',e=>{
   if(!e.target.closest('.glass-menu,#menu-toggle,#color-popover,#color-button,#heading-popover,#heading-toggle'))closeMenus();
   if(!e.target.closest('#floating-toolbar,#editor,#color-popover')&&!e.target.closest('#dialog-backdrop')){refs.toolbar.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;}
  });
  refs.addNote.addEventListener('click',()=>void createNote());
  refs.saveShortcut.addEventListener('click',()=>void saveProject());
  refs.searchToggle.addEventListener('click',()=>searchOpen?closeSearch():openSearch());
  refs.searchPanel.querySelectorAll('[data-search-scope]').forEach(button=>button.addEventListener('click',()=>{
   searchScope=button.dataset.searchScope;
   refs.searchPanel.querySelectorAll('[data-search-scope]').forEach(b=>{
    const selected=b.dataset.searchScope===searchScope;
    b.classList.toggle('selected',selected);
    b.setAttribute('aria-pressed',String(selected));
   });
   refreshSearchMatches({preferredIndex:0});
  }));
  $('#search-close').addEventListener('click',closeSearch);
  refs.searchQuery.addEventListener('input',()=>{refreshSearchMatches({preferredIndex:0});});
  refs.searchQuery.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void navigateSearch(e.shiftKey?-1:1)}});
  refs.searchPrevious.addEventListener('click',()=>void navigateSearch(-1));
  refs.searchNext.addEventListener('click',()=>void navigateSearch(1));
  refs.searchReplacement.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void replaceSearchMatches(false)}});
  refs.searchReplaceOne.addEventListener('click',()=>void replaceSearchMatches(false));
  refs.searchReplaceAll.addEventListener('click',()=>void replaceSearchMatches(true));
  refs.sidebarTab.addEventListener('click',()=>toggleSidebar());
  for(const field of [refs.title,refs.editor])field.addEventListener('beforeinput',e=>{if(projectOperation||state?.locked){if(e.cancelable)e.preventDefault();return;}beforeEdit(e);});
  api.onEditHistory?.(dir=>{if(document.activeElement===refs.title||refs.editor.contains(document.activeElement))applyHistory(dir);else document.execCommand(dir);});
  refs.title.addEventListener('input',()=>{
   queueSave();
   if(searchOpen){refreshSearchMatches();return;}
   const row=refs.list.querySelector('.note-row.active'),n=readNote();
   if(row&&n){row.title=displayNoteName(n.title);row.querySelector('.note-row-label').textContent=displayNoteName(n.title);}
  });
  // Enter in the note title moves into the note body, without adding a line
  // break to the title or changing the document contents.
  refs.title.addEventListener('keydown',e=>{
   if(e.key!=='Enter'||e.isComposing)return;
   if(searchOpen&&refs.searchQuery.value.trim()){e.preventDefault();void navigateSearch(e.shiftKey?-1:1);return;}
   e.preventDefault();
   refs.editor.focus();
   const selection=window.getSelection();
   if(!selection)return;
   const range=document.createRange();
   range.selectNodeContents(refs.editor.firstElementChild||refs.editor);
   range.collapse(true);
   selection.removeAllRanges();selection.addRange(range);
  });
  // A native input may scroll to the end when the entire title is selected.
  // Keep its visual start fixed without disrupting partial selections or typing.
  refs.title.addEventListener('select',()=>{
   if(refs.title.selectionStart!==0||refs.title.selectionEnd!==refs.title.value.length)return;
   requestAnimationFrame(()=>{
    if(refs.title.selectionStart===0&&refs.title.selectionEnd===refs.title.value.length)
     refs.title.scrollLeft=0;
   });
  });
  refs.editor.addEventListener('input',()=>{queueSave();if(searchOpen)refreshSearchMatches();scheduleCaretBottomInset();});
  refs.editor.addEventListener('paste',e=>{e.preventDefault();if(projectOperation||state?.locked)return;commitHistory();if(state?.activeId)history?.resetCurrent(state.activeId,editSnapshot());const plain=e.clipboardData?.getData('text/plain')||'';document.execCommand('insertText',false,plain)});
  refs.editor.addEventListener('click',e=>{
   const a=e.target.closest('a[href]');if(a && (e.ctrlKey||e.metaKey)){e.preventDefault();window.open(a.href,'_blank','noopener,noreferrer')}
  });
  document.addEventListener('selectionchange',()=>{if(!refs.dialog.hidden)return;requestAnimationFrame(adjustToolbar)});
  refs.editor.addEventListener('keyup',()=>{adjustToolbar();scheduleCaretBottomInset();});refs.editor.addEventListener('mouseup',adjustToolbar);
  refs.scroll.addEventListener('scroll',()=>{if(!refs.toolbar.hidden)requestAnimationFrame(adjustToolbar)});
  refs.toolbar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault()});
  refs.toolbar.addEventListener('click',e=>{const b=e.target.closest('[data-format]');if(b)void formatAction(b.dataset.format)});
  refs.colorPopover.addEventListener('pointerdown',e=>e.preventDefault());
  const chooseHeading=b=>{restoreRange();editorCommand('formatBlock','<'+b.dataset.heading+'>');refs.headingPopover.hidden=true;$('#heading-toggle').setAttribute('aria-expanded','false');queueSave();requestAnimationFrame(adjustToolbar)};
  refs.headingPopover.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-heading]');e.preventDefault();if(b)chooseHeading(b)});
  refs.headingPopover.addEventListener('click',e=>{const b=e.target.closest('[data-heading]');if(b&&e.detail===0)chooseHeading(b)});
  refs.colorPopover.addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(!b)return;restoreRange();editorCommand('foreColor',b.dataset.color);refs.colorPopover.hidden=true;queueSave();adjustToolbar()});
  refs.dialogCancel.addEventListener('click',()=>resolveDialog(false));refs.dialogConfirm.addEventListener('click',()=>resolveDialog(true));
  refs.dialogInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();resolveDialog(true)}});
  refs.dialogOptions.addEventListener('keydown',e=>{if(e.target.matches('[data-password]')&&e.key==='Enter'){e.preventDefault();resolveDialog(true);}});
  refs.dialogOptions.addEventListener('click',e=>{
   const b=e.target.closest('[data-password-eye]');if(!b)return;
   const field=refs.dialogOptions.querySelector('#password-'+b.dataset.passwordEye);if(!field)return;
   const show=field.type==='password';field.type=show?'text':'password';b.innerHTML=privacyIcon(show?'eyeOff':'eye');b.title=t(show?'Скрыть пароль':'Показать пароль');b.setAttribute('aria-label',b.title);field.focus();
  });
  refs.dialog.addEventListener('pointerdown',e=>{if(e.target===refs.dialog)resolveDialog(false)});
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.glass-select'))refs.dialogOptions.querySelectorAll('.glass-select-list').forEach(el=>el.hidden=true)});
  settingsControlEvents();resizeSidebar();
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>syncSidebarWidth()).observe(refs.win.querySelector('.workarea'));
  else window.addEventListener('resize',syncSidebarWidth);
  document.addEventListener('keydown',onKey);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush()});
  window.addEventListener('blur',()=>{if(state)void flush()});
  $('#min-btn').addEventListener('click',async()=>{const x=await api.windowAction('minimize');if(x?.previewMessage)toast(x.previewMessage)});
  $('#max-btn').addEventListener('click',async()=>{const x=await api.windowAction('maximize');if(x?.previewMessage)toast(x.previewMessage)});
  $('#close-btn').addEventListener('click',async()=>{if(projectOperation||!await flush())return;const x=await api.windowAction('close');if(x?.previewMessage)toast(x.previewMessage)});
  api.onDraftDecision?.(request=>void askDraftDecision(request));
  api.onBeforeClose(async()=>{if(projectOperation||!refs.dialog.hidden){api.closeConfirmed(false);return;}let ok=false;try{ok=await flush();}catch(error){report(error);}finally{api.closeConfirmed(ok);}});
  api.onExternalOpen?.(()=>{externalWaiting=true;void drainExternal();});
  api.onWindowState(v=>{refs.win.classList.toggle('is-maximized',v);$('#max-btn').title=t(v?'Восстановить размер':'Развернуть');});
 }
 async function start(){
  let pendingOpen=null;
  await featuresReady;history=new window.NocturneUndoBuffer();installFeatureUI();localizeTree(document.body,true);bind();
  try{const boot=await api.bootstrap();settings={...DEFAULT_SETTINGS,...boot.settings};applyLanguage();applySettings();syncProject(boot.project);sidebarSaved=!!boot.sidebarCollapsed;applySidebarCollapsed(sidebarSaved);pendingOpen=boot.pendingOpen||null;}
  catch(e){report(e);refs.title.value=t('Ошибка загрузки');refs.editor.textContent=errorText(settings.language,e.message)}
  if(!api.isDesktop){toast('Интерактивная версия в браузере · проекты .ns — в Windows-приложении')}
  if(api.isDesktop&&typeof api.notifyUIReady==='function'){
   // Electron must never display a raw transparent window or empty first frame.
   await shellStylesReady;
   await document.fonts.ready;
   let announced=false;
   const announce=()=>{if(announced)return;announced=true;api.notifyUIReady()};
   requestAnimationFrame(()=>requestAnimationFrame(announce));
   // Hidden renderers may throttle animation frames; ensure no invisible window.
   setTimeout(announce,200);
  }
  if(pendingOpen)void runProjectTask(()=>completeOpen(pendingOpen));
 }
 void start();
})();
