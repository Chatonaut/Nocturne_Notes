'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.join(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');

test('alpha experiment removes opaque backing, retains shape diagnostic',()=>{
 const main=read('main.js');
 assert.match(main,/transparent:!isWin\|\|alphaMode/);
 assert.match(main,/thickFrame:isWin&&!alphaMode/);
 assert.match(main,/cornerMode!=='shape'/);
 assert.match(main,/win\.setShape\(maximized\?\[\]:roundWindowRegion\(width,height,29\)\)/);
 assert.match(main,/const key=maximized\?'maximized'/);
 assert.match(main,/backgroundMaterial:'none'/);
 assert.doesNotMatch(main,/setBackgroundMaterial\('acrylic'\)/);
 const css=read('windows-shell.css');
 assert.match(css,/body\.is-electron\s*\{\s*background:\s*transparent/);
 assert.match(css,/body\.is-electron\s+\.desktop\s*\{[^}]*background:\s*transparent/);
});
test('first frame waits for app boot and the shell stylesheet',()=>{
 const renderer=read('renderer.js'),main=read('main.js'),preload=read('preload.js');
 assert.match(renderer,/await shellStylesReady/);
 assert.match(renderer,/api\.notifyUIReady\(\)/);
 assert.match(preload,/notifyUIReady:\(\)=>ipcRenderer\.send\('app:renderer-ready'\)/);
 assert.match(main,/ipcMain\.on\('app:renderer-ready'/);
 assert.doesNotMatch(main,/once\('ready-to-show',\(\)=>\{win\.show/);
});
test('Windows installer packages only two locales and required assets',()=>{
 const pkg=JSON.parse(read('package.json'));
 const win=pkg.build.win.target.map(v=>v.target);
 assert.deepEqual(win,['portable','nsis']);
 assert.equal(pkg.build.nsis.deleteAppDataOnUninstall,false);
 assert.equal(pkg.build.nsis.include,'build/installer.nsh');
 assert.deepEqual(pkg.build.nsis.installerLanguages,['en_US','ru_RU']);
 assert.equal(pkg.build.portable.requestExecutionLevel,'user');
 assert.equal(pkg.build.portable.artifactName,'Nocturne Notes Portable.exe');
 assert.equal(pkg.build.nsis.artifactName,'Nocturne Notes Setup ${version}.exe');
 assert.deepEqual(pkg.build.electronLanguages,['en-US','ru']);
 assert.equal(pkg.build.nsis.oneClick,false);
 assert.equal(pkg.build.nsis.allowToChangeInstallationDirectory,true);
 assert.equal(pkg.build.productName,'Nocturne Notes');
 assert.ok(pkg.build.files.includes('windows-shell.css'));
 assert.ok(pkg.build.files.includes('brand.css'));
 assert.ok(pkg.build.files.includes('preview-api.js'));
 assert.ok(pkg.build.files.includes('window-shape.js'));
 assert.equal(pkg.version,'2.0.0');
 assert.equal(pkg.devDependencies.electron,'45.4.1');
 assert.ok(pkg.build.files.includes('corner-resize.js'));
 assert.equal(pkg.build.win.icon,'assets/nocturne-notes-refined.ico');
 assert.ok(pkg.build.asar);
});

test('native shell bounds match rendered app bounds',()=>{
 const css=read('windows-shell.css');
 assert.match(css,/padding:\s*0\s*!important/);
 assert.match(css,/width:\s*100%\s*!important;\s*height:\s*100%\s*!important/);
 const html=read('index.html');
 assert.match(html,/class="brand-mark" src="assets\/nocturne-brand-mark.png"/);
});

test('native context menu is dark without changing the approved renderer',()=>{
 const main=read('main.js'),preload=read('preload.js'),css=read('windows-shell.css');
 assert.match(main,/nativeTheme\.themeSource='dark'/);
 assert.match(main,/Menu\.buildFromTemplate\(items\)\.popup/);
 assert.match(preload,/nocturne-native-corner-grip/);
 assert.match(main,/app:corner-resize/);
 assert.match(css,/--footer-gap:\s*round\(nearest,\s*clamp\(3px,\s*calc\(50cqw - 57px\),\s*8px\),\s*1px\)/);
 assert.match(css,/cursor:nwse-resize/);
 assert.match(css,/cursor:nesw-resize/);
});

test('native region updates synchronously on every size change',()=>{
 const main=read('main.js');
 assert.match(main,/win\.on\('resize',updateWindowRegion\)/);
 assert.match(main,/win\.on\('resized',updateWindowRegion\)/);
 assert.match(main,/win\.setBounds\(next\);updateWindowRegion\(\)/);
 assert.doesNotMatch(main,/regionTimer|scheduleRegion/);
 // Keep the proven 1.5.2 real native silhouette, never a CSS corner mask.
 assert.match(main,/win\.setShape\(maximized\?\[\]:roundWindowRegion\(width,height,29\)\)/);
});
test('footer group centers on whole sidebar with identical 36px buttons',()=>{
 const css=read('windows-shell.css');
 assert.match(css,/\.sidebar-footer\s*\{[^}]*width:\s*100%;[^}]*margin:\s*0\s*!important;/s);
 assert.match(css,/\.sidebar-footer\s*\{[^}]*justify-content:\s*flex-start;/s);
 assert.match(css,/padding-left:\s*round\(nearest, max\(0px, calc\(50% - 54px - var\(--footer-gap\)\)\), 1px\)/);
 assert.match(css,/gap:\s*var\(--footer-gap\)/);
 assert.match(css,/> button\s*\{[^}]*flex:\s*0\s+0\s+36px;/s);
 assert.match(css,/> button > svg\s*\{[^}]*transform:\s*none;/s);
 assert.doesNotMatch(css,/grid-template-columns:\s*repeat\(3,\s*36px\)/);
 assert.doesNotMatch(css,/translate\(-\.4px,\s*\.2px\)/);
 for(const width of [120,130,170,205,240,350]){
  const gap=Math.round(Math.max(3,Math.min(8,(width-1)/2-57)));
  const total=3*36+2*gap;
  const firstCenter=Math.round((width-1-total)/2)+18;
  const lastCenter=firstCenter+2*(36+gap);
  assert.ok(total<=width, `controls must fit at sidebar width ${width}`);
  assert.ok(Math.abs((firstCenter+lastCenter)/2-width/2)<=1);
 }
});

test('package includes runtime artwork only, not source/build artwork',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.deepEqual(pkg.build.files.filter(x=>x.startsWith('assets/')).sort(),
  ['assets/nocturne-brand-mark.png','assets/nocturne-notes-logo.png']);
 assert.match(read('main.js'),/width:Math.max\(740,bounds.width\|\|1350\),height:Math.max\(480,bounds.height\|\|790\)/);
});

test('native diagnostic does not block DWM corner hit testing',()=>{
 assert.match(read('main.js'),/additionalArguments:\['--nocturne-corner-mode='/);
 assert.match(read('preload.js'),/if\(cornerMode==='native'\)return/);
});
test('only pointer-driven bounds are coalesced; release applies the last sample',()=>{
 const main=read('main.js');
 assert.match(main,/CORNER_FRAME_MS=16/);
 assert.match(main,/request.phase==='end'\)\{applyCornerMove\(\);stopCornerDrag\(\);return;/);
 assert.match(main,/win.setBounds\(next\);updateWindowRegion\(\)/);
});

test('stable Portable profile is separate and version-independent; all eight grips exist',()=>{
 const main=read('main.js'),preload=read('preload.js'),css=read('windows-shell.css');
 assert.match(main,/const isPortable=app.isPackaged&&!!process.env.PORTABLE_EXECUTABLE_FILE/);
 assert.match(main,/if\(isPortable\)/);
 assert.match(main,/Nocturne Notes Portable'/);
 assert.doesNotMatch(main,/portable\.experiment|Nocturne Notes Portable \d/);
 assert.match(main,/app.setPath\('userData',profile\)/);
 assert.match(preload,/\['nw','ne','sw','se','n','s','w','e'\]/);
 assert.match(css,/\.corner-e \{ right:0/);
 assert.match(css,/\.corner-s \{ bottom:0/);
});

test('footer symmetric icons are centered; only search has individual compensation',()=>{
 const css=read('windows-shell.css');
 assert.match(css,/> button > svg\s*\{[^}]*translate:\s*-50% -50%;/s);
 assert.match(css,/#search-toggle > svg\s*\{[^}]*translate:\s*calc\(-50% - \.46px\) calc\(-50% - \.46px\);/s);
 assert.doesNotMatch(css,/translate:\s*calc\(-50% \+ 1px\)/);
 assert.match(read('features.css'),/\.project-caption\s*\{[^}]*-webkit-app-region:no-drag;/);
});

test('only Start Menu shortcut gets a separate icon',()=>{
 const nsh=read('build/installer.nsh');
 assert.match(nsh,/CreateShortCut "\$newStartMenuLink" "\$appExe" "" "\$INSTDIR\\resources\\nocturne-start-menu\.ico"/);
 assert.match(nsh,/WinShell::SetLnkAUMI "\$newStartMenuLink" "\$\{APP_ID\}"/);
 assert.doesNotMatch(nsh,/newDesktopLink|DESKTOP/);
 assert.match(read('scripts/prepare-windows-icon.py'),/1\.025/);
});
