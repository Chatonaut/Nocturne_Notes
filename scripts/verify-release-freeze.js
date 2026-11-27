'use strict';
// Release freeze: exact Git blobs of the approved application, artwork, native
// source and lockfile, after the reviewed release cleanup and targeted reliability/security fixes.
// A future approved source change requires a new review, not a bypass.
const assert=require('node:assert/strict'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const expected=Object.freeze({
  "assets/approved-logo-original.png": "6e07ee24204c63bb047360bbb91a54191982e97f",
  "assets/nocturne-brand-mark.png": "18b91edf7b176d51d0dbafcc12804ab88b73923c",
  "assets/nocturne-notes-logo.png": "e722d7395c6386492abaf609a43c07f6ea3f164e",
  "assets/nocturne-notes.ico": "4d66978dffb33a22bc8e7d6b143c3b8165fb232f",
  "brand.css": "4f5a57e35f9658580a8ad3e7cb3a5d9b68b2c4e5",
  "build/installer.nsh": "2be43bad6687b49d0248d779185a152c8028df4c",
  "cipher-db.js": "aa0ffcda1cdf305abc20db787409adb3d66b4300",
  "content-policy.js": "b7797008a6f20f13182daf3b3df7faabb9b9061d",
  "corner-resize.js": "a84b246478a2300fe50e3e8b5dc69638ee9c8ba2",
  "drafts.js": "9dd791e2a5f39f02c6cfb9d3b6258f02fbb69c04",
  "features.css": "dcb01f2bb32a96c081b3c4d56ed6699312bdd073",
  "html-content.js": "6ed6a195a8a1dee4d845bdcf0e4fdf7b526e36f8",
  "i18n.js": "7a69aa4460b9ef8d314e4996b13cf86e73db0f3f",
  "index.html": "88128f3a12f9d6d5cd70240761ce385d004c2cd3",
  "ipc-contract.js": "5b87036bfeb2690e50d027c86623725099bbb96b",
  "main.js": "63fde3408a8c10840761e61dede205515009905a",
  "native/binding.gyp": "f0f07a23ef8ff3dd71a537a440662c45cc5e4fa4",
  "native/cipher.cc": "b0ea7970d77068d0446f505853e793408104f010",
  "package-lock.json": "3709b50c83a02095f147072d25167381416277c6",
  "package.json": "0bff3d66294782b33eaa107482734be312b52dfb",
  "preload.js": "7af7107f9869e623a4d89b5a92b4a0cee40e3387",
  "preview-api.js": "c4aaf21bf65c3e247bfe996362199c67572df7c4",
  "recovery.js": "aeb786bbf5d3506141a88ae920b4b3d8e0f9ac40",
  "reference/Nocturne-Notes-Approved-Preview-1.5.html": "a1ce8b34d02dedb962315fdff48b28ed16e024af",
  "renderer.js": "6be5b9c919dc4aff4b5cc65844f2fc2b2af7f062",
  "scripts/build-sqlcipher.ps1": "2d5baa0d2c33357c5d870b810fbed552cd1c1e36",
  "scripts/prepare-windows-icon.py": "e7dc6a206dbbaf8b1ec28993ed3f62fcce7e63be",
  "search.js": "398145f6f0ac66668e084d2a6a0a4d992d9d9f53",
  "settings.js": "6723bbc71069697ba7fe68e89a9a985470ed9496",
  "storage.js": "4cf3a756a1031f0e038e0d36dd33d60cf36de055",
  "styles.css": "d65d7069520ed7d028f78c8dbb1c314f25bcb767",
  "undo-buffer.js": "c1062757ee8526cc8cbaa7f04198811dc24468e2",
  "window-shape.js": "5a055f416c6c138c52875820c302583ae515e33e",
  "windows-shell.css": "68b28b41c3ddf29de76c3b711a167130eb9c9e16"
});
const pkg=require('../package.json');
for(const file of pkg.build.files.filter(f=>!f.includes('*')))assert.ok(Object.hasOwn(expected,file),'Unreviewed runtime path: '+file);
for(const [file,sha] of Object.entries(expected)){
 const actual=execFileSync('git',['hash-object','--path='+file,file],{cwd:root,encoding:'utf8'}).trim();
 assert.equal(actual,sha,'Release freeze changed: '+file);
}
console.log('PASS release freeze: '+Object.keys(expected).length+' reviewed source, artwork and build blobs');
