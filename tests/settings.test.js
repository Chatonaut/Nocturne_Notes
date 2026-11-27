'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DEFAULT_SETTINGS,EDITOR_FONTS,safeSettings}=require('../settings');
test('shared defaults and valid numeric preferences',()=>{
 assert.deepEqual(safeSettings(null),DEFAULT_SETTINGS);
 assert.equal(safeSettings({titleSize:24,lineHeight:1.64}).titleSize,24);
 for(const value of ['invalid','24',null,undefined,NaN])assert.equal(safeSettings({titleSize:value}).titleSize,20);
 assert.equal(safeSettings({lineHeight:1.64}).lineHeight,1.6);
});
test('slider limits and invalid settings',()=>{
 for(const n of [15,35])assert.equal(safeSettings({titleSize:n}).titleSize,n);
 for(const n of [1,2,1.3])assert.equal(safeSettings({lineHeight:n}).lineHeight,n);
 assert.deepEqual(safeSettings({fontSize:100,titleSize:14,lineHeight:0,sidebarWidth:10}).sidebarWidth,120);
 assert.equal(safeSettings({titleSize:14}).titleSize,20);
});
test('seven safe system font choices and unknown values',()=>{
 assert.deepEqual(Object.keys(EDITOR_FONTS),['segoe','arial','calibri','verdana','tahoma','georgia','times']);
 for(const editorFont of Object.keys(EDITOR_FONTS))assert.equal(safeSettings({editorFont}).editorFont,editorFont);
 for(const editorFont of ['Consolas','__proto__','constructor','invalid',null])assert.equal(safeSettings({editorFont}).editorFont,'segoe');
});

test('English is default, Russian is persisted, invalid language falls back',()=>{assert.equal(safeSettings({}).language,'en');assert.equal(safeSettings({language:'ru'}).language,'ru');assert.equal(safeSettings({language:'de'}).language,'en');});

test('tray setting is opt-in and accepts only an actual boolean true',()=>{assert.equal(safeSettings({}).minimizeToTray,false);assert.equal(safeSettings({minimizeToTray:true}).minimizeToTray,true);for(const invalid of [false,'true',1,null,{}])assert.equal(safeSettings({minimizeToTray:invalid}).minimizeToTray,false);});

test('autosave accepts and preserves each whole minute from 1 through 20',()=>{
 for(let minute=1;minute<=20;minute++)assert.equal(safeSettings({autosaveMs:minute*60000}).autosaveMs,minute*60000);
 for(const invalid of [0,59999,90000,1200001,1260000,'60000',null,Infinity,NaN])assert.equal(safeSettings({autosaveMs:invalid}).autosaveMs,60000);
 assert.equal(DEFAULT_SETTINGS.autosaveMs,60000);
});
