'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const checksum = (name) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex');
const expected = Object.freeze({
  'index.html': 'caa4be7b42b3b786d18bc27fce0dc94cf865ebd5dd1300f9583c1c3350c9f551',
  'styles.css': '1d7bcc846035a2810764a3225f16fca2a7c4357c9d6b705656086efb7e235ba2'
});
let ok = true;
for (const [name, expectedHash] of Object.entries(expected)) {
  // Approved nonvisual settings and localization scripts before preview.
  // Reject any other difference from the accepted HTML and CSS.
  const content=fs.readFileSync(path.join(root,name),'utf8');
  const insertion='<script src="settings.js"></script>\n<script src="i18n.js"></script>\n';
  const actual=name==='index.html'&&content.split(insertion).length===2
    ?crypto.createHash('sha256').update(content.replace(insertion,'')).digest('hex')
    :name==='index.html'?'missing or duplicate settings script':checksum(name);
  const valid = actual === expectedHash;
  console.log(`${valid ? 'PASS' : 'FAIL'} UI locked file ${name}: ${actual}`);
  if (!valid) ok = false;
}
const preview = fs.readFileSync(path.join(root, 'reference/Nocturne-Notes-Approved-Preview-1.5.html'), 'utf8');
const css = (preview.match(/<style>([\s\S]*?)<\/style>/) || [])[1];
if (!css || css.trim() !== fs.readFileSync(path.join(root, 'styles.css'), 'utf8').trim()) {
  console.error('FAIL: frozen CSS does not match the accepted browser preview.');
  ok = false;
} else console.log('PASS: CSS matches frozen approved browser preview.');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const mustExist = ['index.html','styles.css','brand.css','renderer.js','search.js','preview-api.js','preload.js','main.js','window-shape.js','corner-resize.js','storage.js','recovery.js','windows-shell.css','features.css','undo-buffer.js','settings.js','i18n.js','assets/nocturne-notes-logo.png','assets/nocturne-brand-mark.png'];
const list = pkg.build && pkg.build.files || [];
for (const file of mustExist) {
  const exists = fs.existsSync(path.join(root,file));
  const packed = list.includes(file);
  if (!exists || !packed) {
    console.error(`FAIL: required packaged resource ${file} ${exists?'present':'MISSING'} / ${packed?'included':'NOT PACKAGED'}`);
    ok = false;
  }
}
if (ok) console.log('PASS: visual lock and required Electron resources verified.');
else process.exitCode = 1;

if (checksum('assets/nocturne-brand-mark.png') !== '987a418709736f7c199d24373fd8a3441f171c326323f7aef381280862f0e0dc') { console.error('FAIL: approved logo mark changed'); process.exitCode=1; }

if (!fs.existsSync(path.join(root,'scripts/prepare-windows-icon.py'))) {
 console.error('FAIL: approved-logo ICO build script missing');
 process.exitCode=1;
}
