'use strict';
// Browser-only fallback for interactive preview. It intentionally does NOT produce
// .ns files: .ns is the SQLite format handled by the Electron desktop backend.
if (!window.nocturneNotes) {
 const key='nocturnenotes-browser-preview-v1';
 const {DEFAULT_SETTINGS:defaultSettings,safeSettings:normalizeSettings}=window.NocturneSettings;
 const t=key=>window.NocturneI18n.text(settings.language,key);
 const clone=o=>JSON.parse(JSON.stringify(o));
 const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'n'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const seed=()=>{const n={id:uid(),title:'Без названия',html:'<p></p>'};return {projectId:uid(),name:'Без названия',path:null,isDraft:true,notes:[n],activeId:n.id};};
 let project,sidebarCollapsed=false,settings={...defaultSettings},recentSnapshots=[],previewBooted=false;
 try{const s=JSON.parse(localStorage.getItem(key));project=s.project;sidebarCollapsed=!!s.sidebarCollapsed;settings=normalizeSettings(s.settings);
  recentSnapshots=[]; /* Internal preview drafts are not real recent .ns projects. */}catch{}
 if(!project||!Array.isArray(project.notes)){project=seed();}
 if(!project.projectId)project.projectId=uid();
 // Restore the most recent unsaved edit after an unexpected preview shutdown.
 try{const recovery=JSON.parse(localStorage.getItem(key+'-recovery')||'null');
  if(recovery?.projectId===project.projectId){const n=project.notes.find(v=>v.id===recovery.note?.id);if(n){n.title=recovery.note.title;n.html=recovery.note.html;}}
 }catch{}
 const persist=(strict=false)=>{
  try{
   localStorage.setItem(key,JSON.stringify({project,sidebarCollapsed,settings,recentSnapshots}));
  }catch(e){if(strict)throw e;}
 };
 const groupPins=()=>{project.notes=[...project.notes.filter(n=>n.pinned),...project.notes.filter(n=>!n.pinned)];};
 groupPins();
 const result=()=>clone({...project,name:project.isDraft?t("Новый проект"):project.name});
 const download=(fileName,text,mime)=>{
  const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 };
 const fileAsText=()=>new Promise(resolve=>{
  const field=document.querySelector('#browser-import');field.value='';
  field.onchange=async()=>{
   const f=field.files?.[0];if(!f){resolve(null);return;}
   try{const obj=JSON.parse(await f.text());if(!Array.isArray(obj.notes)||!obj.notes.length)throw new Error(t("Неверный формат"));
    const notes=obj.notes.map(n=>({id:uid(),title:String(n.title||t('Заметка')).slice(0,250),html:window.NocturneContent.sanitizeDOM(String(n.html||'<p></p>').slice(0,5_000_000)),pinned:n.pinned===true}));
    project={projectId:uid(),path:null,isDraft:true,name:String(obj.name||f.name).slice(0,250),notes,activeId:notes[0].id};groupPins();persist();resolve(result());
   }catch{resolve(null);alert(t("Не удалось открыть JSON-файл предварительной версии. Файлы .ns открываются в версии для Windows"));}
  };
  field.click();
 });
 window.nocturneNotes={
  isDesktop:false,
  async bootstrap(){
   if(!previewBooted&&!settings.restoreLastProject){const n={id:uid(),title:'Без названия',html:'<p></p>'};project={projectId:uid(),name:'Без названия',path:null,isDraft:true,notes:[n],activeId:n.id};persist()}
   previewBooted=true;
   return {project:result(),sidebarCollapsed,recent:[],settings:{...settings}}
  },
  async updateSettings(s){settings=normalizeSettings({...settings,...s});persist();return {...settings}},
  async saveRecoveryDraft(note){localStorage.setItem(key+'-recovery',JSON.stringify({projectId:project.projectId,note}));return true;},
  async createProject(){project={projectId:uid(),name:'Без названия',path:null,isDraft:true,notes:[{id:uid(),title:'Без названия',html:'<p></p>'}],activeId:null};project.activeId=project.notes[0].id;persist();return result()},
  openProject:fileAsText,async openRecent(id){const recent=recentSnapshots.find(v=>v.id===id);if(!recent)return null;project=clone(recent.project);groupPins();persist();return result()},
  async saveProject(){persist();return {path:null,name:project.name}},
  async saveAsProject(){persist();download(t("Nocturne Notes - проект.json"),JSON.stringify({name:project.name,notes:project.notes},null,2),'application/json');return result()},
  async createNote(){const n={id:uid(),title:t("Новая заметка"),html:'<p></p>',updatedAt:Date.now()};project.notes.push(n);project.activeId=n.id;persist();return clone(n)},
  async updateNote(n){const old=project.notes.find(v=>v.id===n.id);if(!old)throw new Error(t("Заметка не найдена"));old.title=(n.title.trim()||'Без названия').slice(0,250);old.html=window.NocturneContent.sanitizeDOM(n.html);old.updatedAt=Date.now();persist();try{const recovery=JSON.parse(localStorage.getItem(key+'-recovery')||'null');if(recovery?.note?.id===n.id)localStorage.removeItem(key+'-recovery')}catch{}return clone(old)},
  async updateNotes(notes){
   if(!Array.isArray(notes)||!notes.length||new Set(notes.map(n=>n.id)).size!==notes.length||notes.some(n=>!project.notes.some(old=>old.id===n.id)||typeof n.title!=='string'||n.title.length>250||typeof n.html!=='string'||n.html.length>5_000_000))throw new Error(t("Некорректные данные заметки"));
   const saved=notes.map(n=>({...project.notes.find(old=>old.id===n.id),title:n.title.trim()||'Без названия',html:window.NocturneContent.sanitizeDOM(n.html),updatedAt:Date.now()}));
   const byId=new Map(saved.map(n=>[n.id,n]));project.notes=project.notes.map(n=>byId.get(n.id)||n);persist();return clone(saved);
  },
  async selectNote(id){project.activeId=id;persist();return true},
  async setNotePinned(id,pinned){const n=project.notes.find(n=>n.id===id);if(!n)throw new Error(t('Заметка не найдена'));if(typeof pinned!=='boolean')throw new Error(t('Некорректные данные закрепления'));if(!!n.pinned===pinned)return result();project.notes=project.notes.filter(x=>x.id!==id);n.pinned=pinned;project.notes.splice(project.notes.filter(x=>x.pinned).length,0,n);persist();return result();},
  async deleteNote(id){if(project.notes.find(n=>n.id===id)?.pinned)throw new Error(t('Сначала открепите заметку'));if(project.notes.length<2)throw new Error(t("Нельзя удалить последнюю заметку"));const pos=project.notes.findIndex(n=>n.id===id);if(pos<0)throw new Error(t("Заметка не найдена"));(project.trash??=[]).push({...project.notes.splice(pos,1)[0],sortOrder:pos,deletedAt:Date.now()});if(project.activeId===id)project.activeId=project.notes[0].id;persist();return result()},
  async duplicateNote(id){const pos=project.notes.findIndex(n=>n.id===id);if(pos<0)throw new Error(t("Заметка не найдена"));const n=project.notes[pos],suffix=t(" — копия");const copy={...n,id:uid(),pinned:false,title:n.title.slice(0,250-suffix.length)+suffix,updatedAt:Date.now()};project.notes.splice(Math.max(pos+1,project.notes.filter(x=>x.pinned).length),0,copy);project.activeId=copy.id;persist();return result()},
  async listTrash(){return clone((project.trash||[]).map(({id,title,deletedAt})=>({id,title,deletedAt})))},
  async restoreTrash(id){const pos=(project.trash||[]).findIndex(n=>n.id===id);if(pos<0)throw new Error(t("Заметка не найдена"));const n=project.trash.splice(pos,1)[0];n.pinned=false;project.notes.splice(Math.max(project.notes.filter(x=>x.pinned).length,Math.min(n.sortOrder,project.notes.length)),0,n);project.activeId=id;persist();return result()},
  async purgeTrash(id){project.trash=id===null?[]:(project.trash||[]).filter(n=>n.id!==id);persist();return true},
  async alwaysOnTop(){return false},onEditHistory:()=>{},
  async reorderNotes(ids){const before=project.notes.map(n=>n.id),next=ids.map(id=>project.notes.find(n=>n.id===id));if(ids.length!==before.length||new Set(ids).size!==ids.length||next.some(n=>!n))throw new Error(t('Некорректный порядок заметок'));const prefix=project.notes.filter(n=>n.pinned);if(prefix.some((n,i)=>next[i].id!==n.id))throw new Error(t('Сначала открепите заметку'));project.notes=next;persist();return true},
  async setSidebarCollapsed(v){const old=sidebarCollapsed;sidebarCollapsed=!!v;try{persist(true);}catch(e){sidebarCollapsed=old;throw new Error(t('Не удалось сохранить настройки'),{cause:e});}return true},
  async exportNote(id,format){const n=project.notes.find(n=>n.id===id);if(!n)return null;
    const {sanitizeDOM,escapeText}=window.NocturneContent,clean=sanitizeDOM(n.html);
    const element=document.createElement('div');element.innerHTML=clean;
    const text=format==='html'?`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeText(n.title)}</title>${clean}`:element.innerText||element.textContent||'';
    download(n.title+'.'+format,text,format==='html'?'text/html':'text/plain');return n.title+'.'+format;
  },
  async windowAction(a){if(a==='maximize'){document.querySelector('.window')?.classList.toggle('preview-expanded');return true;}return {previewMessage:t("Управление окном доступно в версии для Windows")}},
  recentProjects:async()=>[],isMaximized:async()=>false,
  onBeforeClose:()=>{},closeConfirmed:()=>{},onWindowState:()=>{}
 };
 persist();
}
