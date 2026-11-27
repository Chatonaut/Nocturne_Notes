'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),asar=require('@electron/asar');
const pkg=require('../package.json');
const entries=asar.listPackage(path.join(__dirname,'../dist/win-unpacked/resources/app.asar')).map(s=>s.split(String.fromCharCode(92)).join('/').replace(/^\/+/,''));
const approved=pkg.build.files.filter(s=>!s.includes('*'));
for(const f of approved)assert.ok(entries.includes(f),'Missing '+f);
for(const dep of ['parse5','entities'])assert.ok(entries.includes('node_modules/'+dep+'/package.json'),'Missing dependency '+dep);
const dirs=new Set(approved.flatMap(f=>{const p=f.split('/');p.pop();return p.map((_,i)=>p.slice(0,i+1).join('/'));}));
const extra=entries.filter(f=>f&&!approved.includes(f)&&!dirs.has(f)&&f!=='node_modules'&&!/^node_modules\/(?:parse5|entities)(?:\/|$)/.test(f));
assert.deepEqual(extra,[],'Unexpected runtime files');
console.log('PASS explicit application files and only approved parser dependencies');

const fs=require('node:fs'),resources=path.join(__dirname,'../dist/win-unpacked/resources');
for(const f of ['nocturne_cipher.node','third-party-notices/SQLCipher-LICENSE.txt','third-party-notices/OpenSSL-LICENSE.txt'])assert.ok(fs.statSync(path.join(resources,f)).size>100,'Missing '+f);
console.log('PASS native SQLCipher and third-party notices');

// Verify the same audited native module is packaged, and the vulnerable
// SQLite command-line utility is absent. No unexpected executable scripts.
const crypto=require('node:crypto');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const unpacked=path.join(__dirname,'../dist/win-unpacked');
const nativeDigest=digest(path.join(resources,'nocturne_cipher.node'));
assert.equal(nativeDigest,digest(path.join(__dirname,'../native/build/Release/nocturne_cipher.node')),'Packaged native module differs from tested build');
const executableNames=new Set(['Nocturne Notes.exe','chrome_crashpad_handler.exe','notification_helper.exe','resources/elevate.exe'].map(x=>x.toLowerCase()));
const executablePattern=/\.(?:exe|com|bat|cmd|ps1|vbs|msi)$/i;
const shipped=fs.readdirSync(unpacked,{recursive:true}).map(x=>x.replaceAll('\\','/')).filter(x=>executablePattern.test(x));
assert.deepEqual(shipped.filter(x=>!executableNames.has(x.toLowerCase())),[],'Unexpected packaged executable or command script');
assert.deepEqual(entries.filter(x=>executablePattern.test(x)),[],'Unexpected command tool in ASAR');
const auditFile=path.join(__dirname,'../native-audit.json'),audit=JSON.parse(fs.readFileSync(auditFile,'utf8'));
assert.equal(audit.status,'passed-runtime');
assert.deepEqual(audit.errors,[]);assert.deepEqual(audit.blocking,[]);
for(const finding of audit.dispositions){
 assert.equal(finding.id,'CVE-2026-119586');assert.equal(finding.status,'not_affected');
 finding.packageCheck='passed';finding.packagedNativeSha256=nativeDigest;
}
audit.status='passed-package';audit.packagedExecutables=shipped;
fs.writeFileSync(auditFile,JSON.stringify(audit,null,2));
console.log('PASS native advisory package scope; no SQLite command-line utility; native SHA-256 '+nativeDigest);
