'use strict';
(() => {
 const api=window.nocturneNotes;
 const $=s=>document.querySelector(s);
 const refs={win:$('#window'),menuToggle:$('#menu-toggle'),appMenu:$('#app-menu'),submenu:$('#submenu'),list:$('#note-list'),sidebar:$('#sidebar'),resizer:$('#sidebar-resizer'),sidebarTab:$('#sidebar-tab'),addNote:$('#add-note'),saveShortcut:$('#save-shortcut'),searchCounter:$('#search-counter'),searchNavigation:$('#search-navigation'),searchPrevious:$('#search-previous'),searchNext:$('#search-next'),searchToggle:$('#search-toggle'),searchPanel:$('#sidebar-search'),searchQuery:$('#search-query'),searchReplacement:$('#search-replacement'),searchScopeButtons:document.querySelectorAll('[data-search-scope]'),searchReplaceOne:$('#search-replace-one'),searchReplaceAll:$('#search-replace-all'),title:$('#note-title'),editor:$('#editor'),scroll:$('#editor-scroll'),toolbar:$('#floating-toolbar'),headingPopover:$('#heading-popover'),colorPopover:$('#color-popover'),context:$('#note-menu'),dialog:$('#dialog-backdrop'),dialogHeading:$('#dialog-heading'),dialogMessage:$('#dialog-message'),dialogInput:$('#dialog-input'),dialogOptions:$('#dialog-options'),dialogConfirm:$('#dialog-confirm'),dialogCancel:$('#dialog-cancel'),toast:$('#toast')};
 let searchOpen=false,searchScope='note',searchHits=[],searchCursor=-1;
 let state=null,busy=false,saveTimer=null,savePromise=Promise.resolve(),activeContextId=null,preservedRange=null,dialogResolve=null,toastTimer=null;
  const {DEFAULT_SETTINGS,EDITOR_FONTS}=window.NocturneSettings;
 const {text:translate,errorText,locale}=window.NocturneI18n;
 const t=key=>translate(settings.language,key);
 const staticStrings=[];
 let settings={...DEFAULT_SETTINGS};
 const statuses=new Map(),revisions=new Map();
 let cachedPayload=null,formatPopoversReady=false;
 let recoveryTimer=null;
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
 function storedSnapshot(n){return {title:n.title==='Без названия'?'':n.title,html:n.html,scroll:scrollOffsets.get(n.id)||0};}
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
  if(!history||!state?.activeId||busy)return;
  commitHistory();const value=history.move(state.activeId,dir);if(!value)return;
  historyRestoring=true;
  try{
   refs.title.value=value.title;refs.editor.innerHTML=value.html;refs.scroll.scrollTop=value.scroll||0;
   preservedRange=null;refs.toolbar.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;
   const s=value.selection;
   if(s?.field==='title'){refs.title.focus({preventScroll:true});refs.title.setSelectionRange(s.start,s.end);}
   else{refs.editor.focus({preventScroll:true});const sel=window.getSelection(),a=s?.anchor&&nodeFor(s.anchor),f=s?.focus&&nodeFor(s.focus);
    if(a&&f){try{sel.setBaseAndExtent(a,s.a,f,s.f);}catch{sel.collapse(refs.editor,0);}}else sel.collapse(refs.editor,0);}
   queueSave();renderList();if(searchOpen)refreshSearchMatches();
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
  refs.context.querySelector('[data-note-action="delete"] span').textContent='В корзину';
  // Preserve the menu's original SVG viewport and stroke styling.
  for(const [action,d] of [['move-up','m5 15 7-7 7 7'],['move-down','m5 9 7 7 7-7']]){
   const svg=refs.context.querySelector('[data-note-action="'+action+'"] svg');
   svg.setAttribute('viewBox','0 0 24 24');svg.innerHTML='<path d="'+d+'"/>';
  }
  const settingsRow=refs.appMenu.querySelector('[data-action="settings"]');
  add(refs.appMenu,'data-action','trash','Корзина','<svg><use href="#i-trash"/></svg>',settingsRow);
  // Only the SVG path changes; keep the approved menu glyph size and styling.
  $('#i-trash path').setAttribute('d','M3 6h18M8 6l1-3h6l1 3M5 6l1 13q0 2 2 2h8q2 0 2-2l1-13M10 10v7M14 10v7');
  const quick=document.createElement('div');quick.className='quick-window-actions no-drag';
  for(const [id,key,label,fn] of [['focus-mode','focus','Режим концентрации · F11',()=>toggleFocus()],['always-top','pin','Поверх всех окон · Ctrl+Shift+T',()=>void toggleTop()]]){
   if(id==='always-top'&&!api.isDesktop)continue;
   const b=document.createElement('button');b.id=id;b.type='button';b.className='glass-round';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=icon(key);
   if(id==='always-top')b.setAttribute('aria-pressed','false');
   b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',fn);quick.appendChild(b);
  }
  document.querySelector('.window-controls').before(quick);
  if(api.isDesktop)void api.alwaysOnTop().then(v=>{topmost=v;$('#always-top').setAttribute('aria-pressed',String(v));}).catch(report);
 }
 async function duplicateNote(id){if(!await flush())return;try{const p=await api.duplicateNote(id);syncProject(p,true);toast('Копия создана');}catch(e){report(e)}}
 async function trashDialog(){
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
     addButton(list,'Очистить корзину',async()=>{if(await dialogBox({title:'Очистить корзину?',message:t('Все удаленные заметки будут удалены окончательно.'),confirm:'Очистить'}))await api.purgeTrash(null);});
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
  if(state){updateProjectCaption(state);renderList();renderSaveIndicator();}
 }
 function toast(s){refs.toast.textContent=t(s);refs.toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>refs.toast.hidden=true,3000)}
 function report(err){console.error(err);toast(errorText(settings.language,err?.message)||'Не удалось выполнить действие')}
 const readNote=()=>state?.notes.find(n=>n.id===state.activeId);
 function nameOrFallback(text){return String(text||'').trim()||'Без названия'}
 function displayNoteName(value){const title=nameOrFallback(value);return title==='Без названия'?t('Без названия'):title;}
 function sanitizeHTML(html){
  const parsed=new DOMParser().parseFromString(`<body>${String(html||'')}</body>`,'text/html');
  const allowed=new Set(['p','div','br','strong','b','em','i','u','s','strike','del','h1','h2','h3','h4','h5','h6','ul','ol','li','a','span','font','blockquote']);
  const forbidden=new Set(['script','style','svg','iframe','object','embed','img','link','meta','form','input','button','video','audio','math','textarea']);
  const safeColor=c=>/^#[0-9a-f]{3,8}$/i.test(c||'')||/^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/i.test(c||'');
  function clean(node){
   if(node.nodeType===3)return document.createTextNode(node.textContent);
   if(node.nodeType!==1)return document.createDocumentFragment();
   const tag=node.tagName.toLowerCase();
   if(forbidden.has(tag))return document.createDocumentFragment();
   const dest=document.createElement(allowed.has(tag)?({div:'p',b:'strong',i:'em',strike:'s',del:'s',font:'span'}[tag]||tag):'span');
   if(tag==='a'){
    const href=node.getAttribute('href')||'';
    if(/^(https?:\/\/|mailto:)/i.test(href)){dest.setAttribute('href',href);dest.setAttribute('target','_blank');dest.setAttribute('rel','noopener noreferrer')}
   }
   if(tag==='span'||tag==='font'){
    let color=tag==='font'?(node.getAttribute('color')||''):node.style?.color||'';
    if(safeColor(color))dest.style.color=color;
   }
   for(const child of [...node.childNodes])dest.appendChild(clean(child));
   return dest;
  }
  const wrapper=document.createElement('div');
  for(const el of [...parsed.body.childNodes])wrapper.appendChild(clean(el));
  return wrapper.innerHTML||'<p></p>';
 }
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
   recoveryTimer=null;const value=notePayload();if(value)void api.saveRecoveryDraft(value).catch(error=>{console.error('Recovery backup failed:',error);toast('Не удалось создать восстановительный черновик')});
  },450);
 }
 function queueSave(){
  if(busy||!state?.activeId)return;
  const id=state.activeId;cachedPayload=null;revisions.set(id,(revisions.get(id)||0)+1);
  // Avoid serializing and sanitizing the full document for every keystroke.
  // Search needs current text immediately; recovery/save capture it on demand.
  const n=readNote();if(n)n.title=nameOrFallback(refs.title.value);
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
 async function flush(){if(!historyRestoring)commitHistory();const ok=await persistActive();await savePromise;return ok}
 function syncProject(project,preserveHistory=false){
  commitHistory();if(!preserveHistory){history?.clear();scrollOffsets.clear();}
  if(searchOpen)closeSearch();
  state={...project,notes:project.notes.map(n=>({...n}))};
  statuses.clear();revisions.clear();cachedPayload=null;clearTimeout(recoveryTimer);recoveryTimer=null;
  updateProjectCaption(project);
  renderList();renderNote();closeMenus();
 }
 function updateProjectCaption(project){
  const projectName=project.isDraft?t('Новый проект'):String(project.name||'').trim()||t('Без названия');
  refs.win.dataset.project=projectName;
  const projectCaption=$('#project-caption');
  projectCaption.textContent='— '+projectName;
  projectCaption.title=projectName;
  document.title='Nocturne Notes — '+projectName;
 }
 function renderList(){
  refs.list.textContent='';
  if(!state)return;
  const query=searchOpen?refs.searchQuery.value.trim():'';
  const filtered=state.notes.filter(n=>!query||((searchScope==='project'||n.id===state.activeId)&&window.nocturneSearch.countMatches(n,query)>0));
  if(searchOpen)updateSearchCounter();
  if(query&&!filtered.length){const empty=document.createElement('div');empty.className='search-empty';empty.textContent=t('Ничего не найдено');refs.list.appendChild(empty);}
  filtered.forEach(n=>{
   const row=document.createElement('button');row.type='button';row.className='note-row'+(n.id===state.activeId?' active':'');row.title=displayNoteName(n.title);const label=document.createElement('span');label.className='note-row-label';label.textContent=displayNoteName(n.title);row.appendChild(label);
   if(n.id===state.activeId&&settings.saveIndicatorsEnabled){const dot=document.createElement('span');dot.className='note-save-dot';dot.dataset.status=noteStatus(n.id);dot.title=t(SAVE_LABELS[noteStatus(n.id)]);dot.setAttribute('aria-hidden','true');row.appendChild(dot)}
   row.dataset.id=n.id;row.setAttribute('role','option');row.setAttribute('aria-selected',String(n.id===state.activeId));row.draggable=true;
   row.addEventListener('click',async()=>{await selectNote(n.id);if(searchOpen){refreshSearchMatches({preferNoteId:n.id});showCurrentSearchHit(true);}});
   row.addEventListener('dblclick',()=>void renameNote(n.id));
   row.addEventListener('contextmenu',e=>{e.preventDefault();openContext(n.id,e.clientX,e.clientY)});
   row.addEventListener('dragstart',e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',n.id);row.classList.add('dragging')});
   row.addEventListener('dragend',()=>{row.classList.remove('dragging');refs.list.querySelectorAll('.drag-target').forEach(el=>el.classList.remove('drag-target'))});
   row.addEventListener('dragover',e=>{e.preventDefault();row.classList.add('drag-target')});
   row.addEventListener('dragleave',()=>row.classList.remove('drag-target'));
   row.addEventListener('drop',e=>{e.preventDefault();row.classList.remove('drag-target');const dragging=e.dataTransfer.getData('text/plain');void moveNote(dragging,n.id)});
   refs.list.appendChild(row);
  });
 }
 function renderNote(){
  const n=readNote();cachedPayload=null;busy=true;refs.toolbar.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;
  preservedRange=null;
  if(n){refs.title.value=n.title==='Без названия'?'':n.title;refs.editor.innerHTML=sanitizeHTML(n.html);refs.scroll.scrollTop=scrollOffsets.get(n.id)||0;}
  else{refs.title.value='';refs.editor.innerHTML='<p></p>'}
  busy=false;
  if(n&&history)history.resetCurrent(n.id,editSnapshot());updateHistoryButtons();
 }
 async function selectNote(id){if(!state||id===state.activeId)return;const old=state.activeId;scrollOffsets.set(old,refs.scroll.scrollTop);if(!await flush())return;state.activeId=id;try{await api.selectNote(id);}catch(e){state.activeId=old;report(e);return;}renderList();renderNote();}
 async function createNote(){if(searchOpen)closeSearch();if(!await flush())return;try{const newNote=await api.createNote();state.notes.push(newNote);state.activeId=newNote.id;renderList();renderNote();refs.title.focus();refs.title.select();}catch(e){report(e)}}
 async function newProject(){if(!await flush())return;try{const p=await api.createProject();syncProject(p);toast('Создан новый проект')}catch(e){report(e)}}
 async function openProject(){if(!await flush())return;try{const p=await api.openProject();if(p){syncProject(p);toast('Проект открыт')}}catch(e){report(e)}}
 async function openRecent(file){if(!await flush())return;try{const p=await api.openRecent(file);if(p){syncProject(p);toast('Проект открыт')}}catch(e){report(e)}}
 async function saveProject(){if(!await flush())return;try{const info=await api.saveProject();if(info){if(info.notes)syncProject(info,true);toast(api.isDesktop?'Проект сохранен':'Черновик сохранен в браузере')}}catch(e){report(e)}}
 async function saveAs(){if(!await flush())return;try{const p=await api.saveAsProject();if(p){if(p.notes)syncProject(p,true);toast(api.isDesktop?'Проект сохранен как .ns':'Скачана JSON-копия предпросмотра')}}catch(e){report(e)}}
 async function exportNote(format){if(!await flush())return;try{const filename=await api.exportNote(state.activeId,format);if(filename)toast(t('Экспортировано: ')+format.toUpperCase())}catch(e){report(e)}}
 async function deleteNote(id){
  if(state.notes.length<2){toast('В проекте должна остаться хотя бы одна заметка');return;}
  const note=state.notes.find(n=>n.id===id);const ok=await dialogBox({title:'Переместить в корзину?',message:settings.language==='en'?`“${displayNoteName(note.title)}” can be restored.`:`«${displayNoteName(note.title)}» можно будет восстановить.`,confirm:'В корзину'});
  if(!ok)return;if(!await flush())return;try{const project=await api.deleteNote(id);history?.drop(id);syncProject(project,true)}catch(e){report(e)}
 }
 async function renameNote(id){
  const n=state.notes.find(v=>v.id===id);if(!n)return;
  if(id===state.activeId){refs.title.focus();refs.title.select();return;}
  const title=await dialogBox({title:'Переименовать заметку',input:n.title,confirm:'Сохранить'});
  if(title===null)return;
  try{const updated=await api.updateNote({id,title:nameOrFallback(title),html:n.html});recordExternal(n,updated);n.title=updated.title;renderList()}catch(e){report(e)}
 }
 async function moveNote(from,target,direction){
  if(!from)return;const ids=state.notes.map(n=>n.id),i=ids.indexOf(from),j=ids.indexOf(target);
  const to=typeof direction==='number'?i+direction:j;
  if(i===-1||to<0||to>=ids.length||i===to)return;
  ids.splice(i,1);ids.splice(to,0,from);
  state.notes.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));renderList();
  try{await api.reorderNotes(ids)}catch(e){report(e)}
 }
 function closeMenus(){refs.appMenu.hidden=true;refs.submenu.hidden=true;refs.context.hidden=true;refs.headingPopover.hidden=true;refs.colorPopover.hidden=true;refs.menuToggle.setAttribute('aria-expanded','false')}
 function toggleAppMenu(){const wasOpen=!refs.appMenu.hidden;closeMenus();refs.appMenu.hidden=wasOpen;refs.menuToggle.setAttribute('aria-expanded',String(!wasOpen));}
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
  if(type==='export'){
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
  const top=Math.round(row.top-root.top-4);
  const roomRight=Math.floor(root.right-(root.left+left)-12);
  refs.submenu.style.left=left+'px';
  refs.submenu.style.top=top+'px';
  refs.submenu.style.maxWidth=Math.max(104,Math.min(460,roomRight))+'px';
  refs.submenu.style.maxHeight=Math.max(120,Math.floor(root.bottom-row.top)-16)+'px';
  refs.submenu.hidden=false;
 }
 async function doAction(action){
  if(action==='recent'||action==='export'){await showSubmenu(action);return}
  closeMenus();
  if(action==='new-project')await newProject();if(action==='open-project')await openProject();
  if(action==='save')await saveProject();if(action==='save-as')await saveAs();
  if(action==='trash')await trashDialog();if(action==='settings')await settingsDialog();if(action==='about'){
   refs.dialog.classList.add('about-open');
   try{await dialogBox({title:'Nocturne Notes',optionsHtml:'<div class="about-identity"><img class="about-logo" src="assets/nocturne-notes-logo.png" alt="Логотип Nocturne Notes"><div class="about-details"><div class="about-product">Nocturne Notes</div><div class="about-version">Версия 2.0.0</div></div></div>',hideCancel:true,confirm:'Закрыть'});}
   finally{refs.dialog.classList.remove('about-open');}
  }
 }
 function openContext(id,x,y){closeMenus();activeContextId=id;const bounds=refs.win.getBoundingClientRect();refs.context.hidden=false;refs.context.style.left=Math.max(6,Math.min(x-bounds.left,bounds.width-refs.context.offsetWidth-6))+'px';refs.context.style.top=Math.max(6,Math.min(y-bounds.top,bounds.height-refs.context.offsetHeight-6))+'px';}
 function openSearch(focusReplacement=false){
  if(focusMode)toggleFocus(false);
  if(!searchOpen){
   updateLocalNote();
   searchOpen=true;refs.searchPanel.hidden=false;refs.sidebar.classList.add('searching');
   refs.searchToggle.setAttribute('aria-expanded','true');
   if(refs.sidebar.classList.contains('collapsed'))toggleSidebar(false);
   syncSidebarWidth();renderList();
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
  searchHits=[];searchCursor=-1;clearSearchHighlights();
  refs.searchNavigation.hidden=true;
  syncSidebarWidth();renderList();
 }
 function searchResultNodes(){
  const q=refs.searchQuery.value.trim();if(!q||!state)return [];
  return state.notes.filter(n=>(searchScope==='project'||n.id===state.activeId)&&window.nocturneSearch.countMatches(n,q)>0);
 }
 const searchHitKey=hit=>hit?`${hit.noteId}|${hit.kind}|${hit.offset}`:'';
 function getSearchHits(){
  const q=refs.searchQuery.value.trim();if(!searchOpen||!q||!state)return [];
  const found=[];
  for(const n of state.notes){
   if(searchScope==='note'&&n.id!==state.activeId)continue;
   for(const position of window.nocturneSearch.hits(n.title||'',q))found.push({noteId:n.id,kind:'title',offset:position});
   const root=document.createElement('div');root.innerHTML=n.html||'';
   const body=window.nocturneSearch.findInElement(root,q);
   for(const position of body.positions)found.push({noteId:n.id,kind:'body',offset:position});
  }
  return found;
 }
 function updateSearchCounter(){
  const hasText=searchOpen&&!!refs.searchQuery.value.trim();
  refs.searchNavigation.hidden=!hasText;
  refs.searchCounter.textContent=`${searchHits.length?searchCursor+1:0} ${settings.language==='en'?'of':'из'} ${searchHits.length}`;
  refs.searchPrevious.disabled=refs.searchNext.disabled=!searchHits.length;
  refs.searchReplaceOne.disabled=refs.searchReplaceAll.disabled=!searchHits.length;
 }
 function refreshSearchMatches({preferNoteId,preferredIndex}={}){
  const old=searchHitKey(searchHits[searchCursor]);
  searchHits=getSearchHits();
  if(!searchHits.length)searchCursor=-1;
  else if(Number.isInteger(preferredIndex))searchCursor=Math.min(Math.max(preferredIndex,0),searchHits.length-1);
  else if(preferNoteId){const idx=searchHits.findIndex(hit=>hit.noteId===preferNoteId);searchCursor=idx>=0?idx:0;}
  else{const idx=searchHits.findIndex(hit=>searchHitKey(hit)===old);searchCursor=idx>=0?idx:Math.min(Math.max(searchCursor,0),searchHits.length-1);}
  updateSearchCounter();paintSearchHits(false);
 }
 function paintSearchHits(scroll){
  clearSearchHighlights();
  if(!searchOpen||!refs.searchQuery.value.trim()||!state)return;
  const current=searchHits[searchCursor];
  const ranges=window.nocturneSearch.rangesFor(refs.editor,refs.searchQuery.value.trim());
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
 async function showCurrentSearchHit(scroll=false){
  const chosen=searchHits[searchCursor];
  if(!chosen){paintSearchHits(false);return;}
  if(chosen.noteId!==state.activeId){await selectNote(chosen.noteId);}
  updateSearchCounter();paintSearchHits(scroll);
 }
 async function navigateSearch(direction){
  refreshSearchMatches();if(!searchHits.length)return;
  searchCursor=(searchCursor+direction+searchHits.length)%searchHits.length;
  await showCurrentSearchHit(true);
 }
 async function replaceSearchMatches(all){
  const query=refs.searchQuery.value.trim(),value=refs.searchReplacement.value;
  if(!query){refs.searchQuery.focus();return;}
  if(!await flush())return;
  refreshSearchMatches();
  if(!searchHits.length){toast('Совпадений нет');return;}
  const previousIndex=searchCursor;
  const targets=all?searchResultNodes():[state.notes.find(n=>n.id===searchHits[searchCursor].noteId)];
  let changed=0;
  for(const n of targets){
   if(!n)continue;
   const chosen=all?null:searchHits[searchCursor];
   const updated=all?window.nocturneSearch.replaceInNote(n,query,value,true):window.nocturneSearch.replaceAt(n,query,value,chosen.kind,chosen.offset);
   if(!updated.count)continue;
   if(updated.title.length>250||updated.html.length>5_000_000){toast('Результат замены слишком длинный');return;}
   try{
    const saved=await api.updateNote({id:n.id,title:updated.title,html:sanitizeHTML(updated.html)});
    recordExternal(n,saved);Object.assign(n,saved);changed+=updated.count;markStatus(n.id,'saved');
   }catch(error){markStatus(n.id,'error');report(error);return;}
   if(!all)break;
  }
  renderNote();renderList();
  refreshSearchMatches({preferredIndex:all?0:previousIndex});
  if(!all)await showCurrentSearchHit(true);
  toast(changed?(t('Заменено: ')+changed):'Совпадений нет');
 }
 function toggleSidebar(force){const collapsed=typeof force==='boolean'?force:!refs.sidebar.classList.contains('collapsed');refs.sidebar.classList.toggle('collapsed',collapsed);refs.sidebarTab.title=t(collapsed?'Показать список заметок':'Скрыть список заметок');refs.sidebarTab.setAttribute('aria-label',refs.sidebarTab.title);void api.setSidebarCollapsed(collapsed);}
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
   restoreRange();commitHistory();if(state?.activeId)history?.resetCurrent(state.activeId,editSnapshot());document.execCommand('createLink',false,url);queueSave();setTimeout(adjustToolbar,15);return;
  }
  restoreRange();commitHistory();if(state?.activeId)history?.resetCurrent(state.activeId,editSnapshot());
  try {
   document.execCommand(cmd,false,null);
   queueSave();requestAnimationFrame(adjustToolbar);
  }catch(e){report(e)}
 }
 function dialogBox({title,message='',input,confirm='Готово',hideCancel=false,optionsHtml=''}){
  refs.dialogHeading.textContent=t(title);refs.dialogMessage.textContent=message;
  refs.dialogInput.hidden=input===undefined;refs.dialogInput.value=input??'';
  refs.dialogOptions.hidden=!optionsHtml;refs.dialogOptions.innerHTML=optionsHtml;localizeTree(refs.dialogOptions);
  refs.dialogCancel.hidden=hideCancel;refs.dialogConfirm.textContent=t(confirm);refs.dialog.hidden=false;
  return new Promise(resolve=>{dialogResolve=resolve;requestAnimationFrame(()=>{(input===undefined?refs.dialogConfirm:refs.dialogInput).focus();if(input!==undefined)refs.dialogInput.select()})});
 }
 function resolveDialog(ok){
  if(refs.dialog.hidden)return;
  const cb=dialogResolve;dialogResolve=null;
  const value=ok?(refs.dialogInput.hidden?true:refs.dialogInput.value):null;
  refs.dialog.hidden=true;if(cb)cb(value);
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
  refs.dialogOptions.addEventListener('input',e=>{if(e.target.matches('input[type=range]')){const readout=$('#'+e.target.id+'-value');if(readout)readout.textContent=e.target.id==='setting-line'?Number(e.target.value).toFixed(2):e.target.value+' px';}});
 }
 async function settingsDialog(){
  const range=(id,label,desc,min,max,step,value)=>`<div class="setting-row font-setting"><span class="setting-copy"><strong>${label}</strong><small>${desc}</small></span><div class="font-controls"><button type="button" class="font-step" data-target="${id}" data-font-step="-1" aria-label="Уменьшить: ${label}"><svg><use href="#i-minus"/></svg></button><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"><button type="button" class="font-step" data-target="${id}" data-font-step="1" aria-label="Увеличить: ${label}"><svg><use href="#i-plus"/></svg></button><span class="font-readout" id="${id}-value">${id==='setting-line'?Number(value).toFixed(2):value+' px'}</span></div></div>`;
  const language=customSelect('setting-language',settings.language,[['en','Английский'],['ru','Русский']]);
  const font=customSelect('setting-editor-font',settings.editorFont,Object.entries(EDITOR_FONTS).map(([key,value])=>[key,value.label]));
  const delay=customSelect('setting-autosave',settings.autosaveMs,[[60000,'1 минута'],[180000,'3 минуты'],[300000,'5 минут']]);
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
    <div class="setting-row"><span class="setting-copy"><strong>Автосохранение</strong><small>Пауза после последнего ввода</small></span>${delay}</div>
    <div class="setting-row"><span class="setting-copy"><strong>Восстанавливать последний проект</strong><small>Открывать прошлую сессию при запуске</small></span><input id="setting-restore" type="checkbox" aria-label="Восстанавливать последний проект" ${settings.restoreLastProject?'checked':''}></div>
   </section>
   <section class="settings-group"><div class="settings-caption">Приложение</div>
    <div class="setting-row"><span class="setting-copy"><strong>Язык приложения</strong><small>Язык интерфейса</small></span>${language}</div>
    <div class="setting-row"><span class="setting-copy"><strong>Сворачивать в трей при закрытии</strong><small>Оставлять приложение запущенным в фоне</small></span><input id="setting-tray" type="checkbox" aria-label="Сворачивать в трей при закрытии" ${settings.minimizeToTray?'checked':''} ${api.isDesktop?'':'disabled'}></div>
   </section>`;
  refs.dialog.classList.add('settings-open');
  try{
   const accepted=await dialogBox({title:'Настройки',confirm:'Сохранить',optionsHtml:html});
   if(!accepted)return;
   const next={language:$('#setting-language').value,minimizeToTray:$('#setting-tray').checked,editorFont:$('#setting-editor-font').value,fontSize:Number($('#setting-font').value),titleSize:Number($('#setting-title-size').value),lineHeight:Number($('#setting-line').value),autosaveMs:Number($('#setting-autosave').value),restoreLastProject:$('#setting-restore').checked,sidebarWidth:settings.sidebarWidth,formatToolbarEnabled:$('#setting-toolbar').checked,saveIndicatorsEnabled:$('#setting-indicators').checked,spellcheckEnabled:$('#setting-spellcheck').checked};
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
  refs.menuToggle.addEventListener('click',e=>{e.stopPropagation();toggleAppMenu()});
  refs.appMenu.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)void doAction(b.dataset.action)});
  refs.context.addEventListener('click',e=>{
   const b=e.target.closest('[data-note-action]');if(!b)return;const action=b.dataset.noteAction,id=activeContextId;closeMenus();
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
   refreshSearchMatches({preferredIndex:0});renderList();
  }));
  $('#search-close').addEventListener('click',closeSearch);
  refs.searchQuery.addEventListener('input',()=>{refreshSearchMatches({preferredIndex:0});renderList();});
  refs.searchQuery.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void navigateSearch(e.shiftKey?-1:1)}});
  refs.searchPrevious.addEventListener('click',()=>void navigateSearch(-1));
  refs.searchNext.addEventListener('click',()=>void navigateSearch(1));
  refs.searchReplacement.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void replaceSearchMatches(false)}});
  refs.searchReplaceOne.addEventListener('click',()=>void replaceSearchMatches(false));
  refs.searchReplaceAll.addEventListener('click',()=>void replaceSearchMatches(true));
  refs.sidebarTab.addEventListener('click',()=>toggleSidebar());
  for(const field of [refs.title,refs.editor])field.addEventListener('beforeinput',beforeEdit);
  api.onEditHistory?.(dir=>{if(document.activeElement===refs.title||refs.editor.contains(document.activeElement))applyHistory(dir);else document.execCommand(dir);});
  refs.title.addEventListener('input',()=>{
   queueSave();
   if(searchOpen){refreshSearchMatches();renderList();return;}
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
  refs.editor.addEventListener('paste',e=>{e.preventDefault();commitHistory();if(state?.activeId)history?.resetCurrent(state.activeId,editSnapshot());const plain=e.clipboardData?.getData('text/plain')||'';document.execCommand('insertText',false,plain)});
  refs.editor.addEventListener('click',e=>{
   const a=e.target.closest('a[href]');if(a && (e.ctrlKey||e.metaKey)){e.preventDefault();window.open(a.href,'_blank','noopener,noreferrer')}
  });
  document.addEventListener('selectionchange',()=>{if(!refs.dialog.hidden)return;requestAnimationFrame(adjustToolbar)});
  refs.editor.addEventListener('keyup',()=>{adjustToolbar();scheduleCaretBottomInset();});refs.editor.addEventListener('mouseup',adjustToolbar);
  refs.scroll.addEventListener('scroll',()=>{if(!refs.toolbar.hidden)requestAnimationFrame(adjustToolbar)});
  refs.toolbar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault()});
  refs.toolbar.addEventListener('click',e=>{const b=e.target.closest('[data-format]');if(b)void formatAction(b.dataset.format)});
  refs.colorPopover.addEventListener('pointerdown',e=>e.preventDefault());
  const chooseHeading=b=>{restoreRange();commitHistory();if(state?.activeId)history?.resetCurrent(state.activeId,editSnapshot());document.execCommand('formatBlock',false,'<'+b.dataset.heading+'>');refs.headingPopover.hidden=true;$('#heading-toggle').setAttribute('aria-expanded','false');queueSave();requestAnimationFrame(adjustToolbar)};
  refs.headingPopover.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-heading]');e.preventDefault();if(b)chooseHeading(b)});
  refs.headingPopover.addEventListener('click',e=>{const b=e.target.closest('[data-heading]');if(b&&e.detail===0)chooseHeading(b)});
  refs.colorPopover.addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(!b)return;restoreRange();commitHistory();if(state?.activeId)history?.resetCurrent(state.activeId,editSnapshot());document.execCommand('foreColor',false,b.dataset.color);refs.colorPopover.hidden=true;queueSave();adjustToolbar()});
  refs.dialogCancel.addEventListener('click',()=>resolveDialog(false));refs.dialogConfirm.addEventListener('click',()=>resolveDialog(true));
  refs.dialogInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();resolveDialog(true)}});
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
  $('#close-btn').addEventListener('click',async()=>{if(!await flush())return;const x=await api.windowAction('close');if(x?.previewMessage)toast(x.previewMessage)});
  api.onBeforeClose(async()=>{let ok=false;try{ok=await flush();}catch(error){report(error);}finally{api.closeConfirmed(ok);}});
  api.onWindowState(v=>{refs.win.classList.toggle('is-maximized',v);$('#max-btn').title=t(v?'Восстановить размер':'Развернуть');});
 }
 async function start(){
  await featuresReady;history=new window.NocturneUndoBuffer();installFeatureUI();localizeTree(document.body,true);bind();
  try{const boot=await api.bootstrap();settings={...DEFAULT_SETTINGS,...boot.settings};applyLanguage();applySettings();syncProject(boot.project);if(boot.sidebarCollapsed)toggleSidebar(true)}
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
 }
 void start();
})();
