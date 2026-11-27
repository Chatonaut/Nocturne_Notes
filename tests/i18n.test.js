'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {EN,text,errorText,locale}=require('../i18n');
test('localization catalog covers native tooltips, static labels, and known storage errors',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const match of html.matchAll(/(?:title|aria-label|placeholder|data-placeholder|alt)="([^"]*[А-Яа-яЁё][^"]*)"/g))assert.ok(Object.hasOwn(EN,match[1]),'Missing static attribute: '+match[1]);
 for(const match of html.matchAll(/>([^<>]*[А-Яа-яЁё][^<>]*)</g)){
  const key=match[1].trim();if(key.startsWith('— '))continue;
  assert.ok(Object.hasOwn(EN,key),'Missing static label: '+key);
 }
 for(const file of ['storage.js','recovery.js','main.js']){
  const js=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  for(const m of js.matchAll(/new Error\('([^']*[А-Яа-яЁё][^']*)'/g))assert.ok(Object.hasOwn(EN,m[1]),'Missing error: '+m[1]);
 }
 assert.equal(text('en','Поиск и замена'),'Find and Replace');
 assert.equal(text('ru','Поиск и замена'),'Поиск и замена');
 assert.equal(errorText('en',"Error invoking remote method 'delete-note': Error: Нельзя удалить последнюю заметку"),'Cannot delete the last note');
 assert.equal(errorText('en',"Error invoking remote method 'delete-note': Error: Cannot delete the last note"),'Cannot delete the last note');
 assert.equal(locale('ru'),'ru-RU');assert.equal(locale('en'),'en-US');
});

test('tray menu and settings are bilingual',()=>{assert.equal(text('en','Приложение'),'Application');assert.equal(text('en','Сворачивать в трей при закрытии'),'Minimize to tray on close');assert.equal(text('en','Открыть Nocturne Notes'),'Open Nocturne Notes');assert.equal(text('en','Выход'),'Exit');assert.equal(text('ru','Выход'),'Выход');});

test('direct application-owned Russian strings are bilingual and use е instead of ё',()=>{
 for(const file of ['renderer.js','main.js','storage.js','drafts.js','html-content.js','recovery.js','preview-api.js']){
  const js=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  for(const m of js.matchAll(/(?:\bt\(|\btoast\(|new Error\(|\btitle:|\bconfirm:)\s*(['"])([^'"\n]*[А-Яа-яЁё][^'"\n]*)\1/g)){
   assert.ok(Object.hasOwn(EN,m[2]),file+' missing translation: '+m[2]);assert.ok(!/[Ёё]/.test(m[2]),file+' inconsistent Russian spelling: '+m[2]);
  }
 }
 for(const key of Object.keys(EN))assert.ok(!/[Ёё]/.test(key),'Inconsistent Russian spelling: '+key);
});
