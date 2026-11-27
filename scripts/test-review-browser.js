'use strict';
// Actual Chromium preview, without the desktop preload or Node integration.
const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(process.env.NOCTURNE_REVIEW_ROOT||path.join(__dirname,'..'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-preview-security-'));app.setPath('userData',profile);
app.on('window-all-closed',()=>{});
async function run(){
 await app.whenReady();
 const win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 try{
  await win.loadFile(path.join(root,'index.html'));
  const result=await win.webContents.executeJavaScript('('+async function(){
   const api=window.nocturneNotes;
   if(api.isDesktop)throw Error('Desktop preload unexpectedly active');
   const field=document.querySelector('#browser-import');
   const title='Title </title><script>window.__bad=1</script>';
   const html='<p><strong>Safe</strong> <a href="https://example.com/">link</a><img src="x" onerror="window.__bad=1"><script>window.__bad=1</script><a href="javascript:window.__bad=1">bad link</a></p>';
   const transfer=new window.DataTransfer();
   transfer.items.add(new window.File([JSON.stringify({name:'Synthetic',notes:[{title,html}]})],'synthetic.json',{type:'application/json'}));
   const click=field.click;field.click=()=>{field.files=transfer.files;void field.onchange();};
   let imported;try{imported=await api.openProject();}finally{field.click=click;}
   const n=imported.notes[0],parse=markup=>new DOMParser().parseFromString(markup,'text/html');
   const body=parse(n.html),importSafe=!body.querySelector('script,img,[onerror],a[href^="javascript:"]')&&body.querySelector('strong')?.textContent==='Safe'&&body.querySelector('a[href="https://example.com/"]')?.textContent==='link';
   // Independently exercise export with a potentially hostile note payload.
   await api.updateNote({id:n.id,title,html});
   const create=URL.createObjectURL,revoke=URL.revokeObjectURL,anchorClick=window.HTMLAnchorElement.prototype.click;let blob;
   URL.createObjectURL=value=>{blob=value;return 'blob:synthetic-test';};
   URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=()=>{};
   let exported;
   try{await api.exportNote(n.id,'html');exported=await blob.text();}
   finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;window.HTMLAnchorElement.prototype.click=anchorClick;}
   const doc=parse(exported);
   const exportSafe=doc.title===title&&!doc.querySelector('script,img,[onerror],a[href^="javascript:"]')&&doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content.includes("default-src 'none'")&&doc.querySelector('strong')?.textContent==='Safe';
   return {importSafe,exportSafe,preview:true};
  }.toString()+')()');
  console.log('PREVIEW REVIEW',JSON.stringify(result));
  assert.equal(result.importSafe,true,'browser import sanitization');
  assert.equal(result.exportSafe,true,'browser export sanitization');
 }finally{win.destroy();}
}
run().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1);});
