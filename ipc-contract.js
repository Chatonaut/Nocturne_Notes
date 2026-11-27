'use strict';
// @ts-check
/** @typedef {import('./types/contracts').NotePayload} NotePayload */
/** @typedef {import('./types/contracts').SettingsPatch} SettingsPatch */
const MAX_HTML=5_000_000,MAX_TITLE=250;
/** @param {unknown} v @returns {v is Record<string,unknown>} */
function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
/** @param {unknown} v @returns {v is string} */
function id(v){return typeof v==='string'&&v.length>0&&v.length<=250&&!/[\u0000-\u001f]/.test(v);}
/** @param {unknown} v @returns {v is NotePayload} */
function note(v){return object(v)&&id(v.id)&&typeof v.title==='string'&&v.title.length<=MAX_TITLE&&typeof v.html==='string'&&v.html.length<=MAX_HTML;}
/** @param {unknown} v @returns {v is SettingsPatch} */
function settings(v){
 if(!object(v))return false;
 for(const [k,x] of Object.entries(v)){
  if(['minimizeToTray','restoreLastProject','formatToolbarEnabled','saveIndicatorsEnabled','spellcheckEnabled'].includes(k)){if(typeof x!=='boolean')return false;}
  else if(['fontSize','titleSize','lineHeight','autosaveMs','sidebarWidth'].includes(k)){if(typeof x!=='number'||!Number.isFinite(x))return false;}
  else if(k==='language'){if(x!=='en'&&x!=='ru')return false;}
  else if(k==='editorFont'){if(typeof x!=='string'||!['segoe','arial','calibri','verdana','tahoma','georgia','times'].includes(x))return false;}
  else return false;
 }
 return true;
}
/** @param {unknown} v @returns {v is string} */
function password(v){return typeof v==='string'&&v.length>0&&Buffer.byteLength(v,'utf8')<=4096;}
/** @param {unknown} v @returns {v is string} */
function newPassword(v){return password(v)&&[...v].length>=8;}
/** @param {string} channel @param {unknown} value */
function valid(channel,value){
 switch(channel){
  case 'update-note':case 'save-recovery-draft':return note(value);
  case 'set-note-pinned':return object(value)&&id(value.id)&&typeof value.pinned==='boolean';
  case 'draft-decision':return object(value)&&id(value.token)&&['save','discard','cancel'].some(x=>x===value.choice);
  case 'update-notes':return Array.isArray(value)&&value.length>0&&value.every(note)&&new Set(value.map(n=>n.id)).size===value.length;
  case 'update-settings':return settings(value);
  case 'select-note':case 'delete-note':case 'duplicate-note':case 'restore-trash':return id(value);
  case 'purge-trash':return value===null||id(value);
  case 'reorder-notes':return Array.isArray(value)&&value.every(id)&&new Set(value).size===value.length;
  case 'open-recent':return typeof value==='string'&&value.length>0&&value.length<=32767&&!value.includes('\0');
  case 'always-on-top':return value===undefined||typeof value==='boolean';
  case 'set-sidebar':return typeof value==='boolean';
  case 'window-action':return value==='minimize'||value==='maximize'||value==='close';
  case 'export-note':return object(value)&&id(value.id)&&['txt','html','md'].some(x=>x===value.format)&&(value.confirmPlaintext===undefined||typeof value.confirmPlaintext==='boolean');
  case 'protect-project':return newPassword(value);
  case 'remove-protection':return password(value);
  case 'change-password':return object(value)&&password(value.current)&&newPassword(value.password);
  case 'unlock-project':return object(value)&&id(value.token)&&password(value.password);
  case 'cancel-unlock':return id(value);
  case 'lock-project':case 'open-external':return value===undefined;
  case 'bootstrap':case 'create-project':case 'open-project':case 'save-project':case 'save-project-as':case 'create-note':case 'list-trash':case 'get-window-state':case 'get-recent':return value===undefined;
  default:return false;
 }
}
/** Compare only equivalent URL spellings, never filesystem aliases or other origins.
 * @param {unknown} actual @param {unknown} expected */
function sameLocalFileURL(actual,expected){
 if(typeof actual!=='string'||typeof expected!=='string'||!actual.startsWith('file://')||!expected.startsWith('file://'))return false;
 if(/[?#]/.test(actual)||/[?#]/.test(expected))return false;
 /** @param {string} url */
 const normalize=url=>url.replace(/%([0-9a-f]{2})/gi,(_escape,hex)=>{
  const char=String.fromCharCode(parseInt(hex,16));
  return /^[A-Za-z0-9._~-]$/.test(char)?char:'%'+hex.toUpperCase();
 });
 return normalize(actual)===normalize(expected);
}
module.exports={valid,note,id,settings,MAX_TITLE,MAX_HTML,sameLocalFileURL};
