'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const asar=require('@electron/asar');
const pkg=require('../package.json');
const archive=path.join(__dirname,'../dist/win-unpacked/resources/app.asar');
const entries=asar.listPackage(archive).map(s=>s.split(String.fromCharCode(92)).join('/').replace(/^\/+/, ''));
const approved=pkg.build.files;
for(const file of approved)assert.ok(entries.includes(file),'Missing packaged file: '+file);
// ASAR lists directories too; only allow explicit files and their parent dirs.
const directories=new Set(approved.flatMap(file=>{
 const parts=file.split('/');parts.pop();
 return parts.map((_,i)=>parts.slice(0,i+1).join('/'));
}));
const extra=entries.filter(file=>file && !approved.includes(file) && !directories.has(file));
assert.deepEqual(extra,[],'Unexpected files packaged in application');
console.log('PASS: packaged ASAR contains only explicit runtime files');
console.log(entries.join('\n'));
