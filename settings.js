'use strict';
(function(root){
const EDITOR_FONTS=Object.freeze({
 segoe:Object.freeze({label:'Segoe UI Variable',family:'"Segoe UI Variable Text","Segoe UI",Inter,Arial,sans-serif'}),
 arial:Object.freeze({label:'Arial',family:'Arial,"Segoe UI",sans-serif'}),
 calibri:Object.freeze({label:'Calibri',family:'Calibri,"Segoe UI",sans-serif'}),
 verdana:Object.freeze({label:'Verdana',family:'Verdana,"Segoe UI",sans-serif'}),
 tahoma:Object.freeze({label:'Tahoma',family:'Tahoma,"Segoe UI",sans-serif'}),
 georgia:Object.freeze({label:'Georgia',family:'Georgia,"Times New Roman",serif'}),
 times:Object.freeze({label:'Times New Roman',family:'"Times New Roman",Georgia,serif'})
});
const DEFAULT_SETTINGS=Object.freeze({language:'en',minimizeToTray:false,editorFont:'segoe',fontSize:17,titleSize:20,lineHeight:1.1,autosaveMs:60000,restoreLastProject:true,sidebarWidth:240,formatToolbarEnabled:true,saveIndicatorsEnabled:true,spellcheckEnabled:false});
function safeSettings(raw){
 const v=raw&&typeof raw==='object'?raw:{};
 return {
  language:v.language==='ru'?'ru':'en',
  minimizeToTray:v.minimizeToTray===true,
  editorFont:typeof v.editorFont==='string'&&Object.hasOwn(EDITOR_FONTS,v.editorFont)?v.editorFont:DEFAULT_SETTINGS.editorFont,
  fontSize:Number.isInteger(v.fontSize)&&v.fontSize>=10&&v.fontSize<=35?v.fontSize:17,
  titleSize:v.titleSize==='standard'?24:v.titleSize==='small'?20:Number.isInteger(v.titleSize)&&v.titleSize>=15&&v.titleSize<=35?v.titleSize:20,
  lineHeight:Number.isFinite(v.lineHeight)&&v.lineHeight>=1&&v.lineHeight<=2?Math.round(v.lineHeight*10)/10:1.1,
  autosaveMs:[60000,180000,300000].includes(v.autosaveMs)?v.autosaveMs:60000,
  restoreLastProject:typeof v.restoreLastProject==='boolean'?v.restoreLastProject:true,
  sidebarWidth:Number.isFinite(v.sidebarWidth)?Math.max(120,Math.min(10000,Math.round(v.sidebarWidth))):240,
  formatToolbarEnabled:typeof v.formatToolbarEnabled==='boolean'?v.formatToolbarEnabled:true,
  saveIndicatorsEnabled:typeof v.saveIndicatorsEnabled==='boolean'?v.saveIndicatorsEnabled:true,
  spellcheckEnabled:typeof v.spellcheckEnabled==='boolean'?v.spellcheckEnabled:false
 };
}
 const api={DEFAULT_SETTINGS,EDITOR_FONTS,safeSettings};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.NocturneSettings=api;
})(typeof window==='object'?window:globalThis);
