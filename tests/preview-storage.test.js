'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../preview-api.js'),'utf8');
const {DEFAULT_SETTINGS,safeSettings}=require('../settings'),{text}=require('../i18n');
const {sanitizeHTML}=require('../html-content');
const key='nocturnenotes-browser-preview-v1';
function boot(entries={}){
 const data=new Map(Object.entries(entries)),reads=[];
 const window={NocturneSettings:{DEFAULT_SETTINGS,safeSettings},NocturneI18n:{text},NocturneContent:{sanitizeDOM:sanitizeHTML}};
 const localStorage={getItem:k=>{reads.push(k);return data.get(k)??null;},setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 vm.runInNewContext(source,{window,localStorage});
 return {api:window.nocturneNotes,data,reads,localStorage};
}
test('browser preview starts with one empty note, current settings and current storage keys',async()=>{
 const {api,reads}=boot(),initial=await api.bootstrap();
 assert.equal(initial.project.notes.length,1);
 assert.equal(initial.project.notes[0].html,'<p></p>');
 assert.equal(initial.settings.language,'en');
 assert.equal(initial.settings.titleSize,20);
 assert.deepEqual(reads,[key,key+'-recovery']);
});
test('browser preview restores matching recovery and keeps valid current preferences',async()=>{
 const project={projectId:'p',name:'Synthetic',path:null,isDraft:true,notes:[{id:'a',title:'Current note',html:'<p>Saved</p>'}],activeId:'a'};
 const {api,data,reads}=boot({[key]:JSON.stringify({project,settings:{titleSize:24,language:'ru'}}),[key+'-recovery']:JSON.stringify({projectId:'p',note:{id:'a',title:'Recovered',html:'<p>Recovered text</p>'}})});
 const state=await api.bootstrap();
 assert.equal(state.settings.titleSize,24);
 assert.equal(state.settings.language,'ru');
 assert.equal(state.project.notes[0].html,'<p>Recovered text</p>');
 await api.updateNote({id:'a',title:'Saved again',html:'<p>Saved again</p>'});
 assert.equal(data.has(key+'-recovery'),false);
 assert.ok(reads.every(k=>k===key||k===key+'-recovery'));
});

test('browser preview sidebar preferences roll back on a storage failure',async()=>{
 const {api,data,localStorage}=boot();const initial=await api.bootstrap(),before=data.get(key),write=localStorage.setItem;
 localStorage.setItem=()=>{throw Error('synthetic quota failure');};
 await assert.rejects(api.setSidebarCollapsed(!initial.sidebarCollapsed),/Could not save settings/);
 assert.equal((await api.bootstrap()).sidebarCollapsed,initial.sidebarCollapsed);assert.equal(data.get(key),before);
 localStorage.setItem=write;await api.setSidebarCollapsed(!initial.sidebarCollapsed);assert.equal((await api.bootstrap()).sidebarCollapsed,!initial.sidebarCollapsed);
});
