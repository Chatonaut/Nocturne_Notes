'use strict';
// Real launcher-to-visible timing on a disposable GitHub Windows runner only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process'),{performance}=require('node:perf_hooks');
const {newProject,sameFile}=require('../storage');
if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'||!process.env.RUNNER_TEMP||!process.env.APPDATA)throw Error('Portable launch test requires a disposable Windows CI runner');
const profile=path.join(process.env.APPDATA,'Nocturne Notes Portable');
if(fs.existsSync(profile))throw Error('Refusing to use an existing Portable profile');
const dir=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP,'nocturne-portable-launch-')),project=path.join(dir,'portable smoke.ns');
const exe=path.resolve(__dirname,'../dist/Nocturne Notes Portable.exe');
const reportFile=path.join(__dirname,'../portable-launch.json'),diagnosticFile=path.join(__dirname,'../portable-launch-diagnostics.json');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function readTrace(){
 const file=path.join(profile,'startup-diagnostics.jsonl');
 try{return fs.readFileSync(file,'utf8').split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});}
 catch(e){if(e.code==='ENOENT')return [];throw e;}
}
function inspectProfile(){
 const result={profileExists:fs.existsSync(profile),owned:false,trace:[],readErrors:[]};
 try{
  const prefs=readJSON(path.join(profile,'preferences.json'));
  result.lastProject=prefs.lastProject||null;
  if(typeof prefs.lastProject==='string'&&prefs.lastProject)result.owned=sameFile(prefs.lastProject,project);
 }catch(e){result.readErrors.push('preferences: '+e.message);}
 try{result.timing=readJSON(path.join(profile,'startup-timing.json'));}
 catch(e){result.readErrors.push('timing: '+e.message);}
 try{result.trace=readTrace();}catch(e){result.readErrors.push('trace: '+e.message);}
 return result;
}
function windowProcesses(){
 const ps=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
  "Get-Process | Where-Object { $_.ProcessName -like 'Nocturne Notes*' } | Select-Object Id,ProcessName,MainWindowTitle,MainWindowHandle,Responding | ConvertTo-Json -Compress"],
  {encoding:'utf8',windowsHide:true,timeout:15000});
 return {status:ps.status,stdout:ps.stdout?.slice(0,12000),stderr:ps.stderr?.slice(0,4000),error:ps.error?.message};
}
async function run(){
 newProject(project,[{title:'Synthetic startup',html:'<p>Portable startup smoke</p>'}]);
 const stdoutPath=path.join(dir,'launcher-stdout.txt'),stderrPath=path.join(dir,'launcher-stderr.txt'),chromiumLog=path.join(dir,'chromium.log');
 const out=fs.openSync(stdoutPath,'w'),err=fs.openSync(stderrPath,'w');
 const start=performance.now();
 let child;
 try{
  child=spawn(exe,[project,'--enable-logging=file','--log-file='+chromiumLog],{
   env:{...process.env,NOCTURNE_CI_STARTUP_TRACE:'1'},stdio:['ignore',out,err],windowsHide:false
  });
 }finally{fs.closeSync(out);fs.closeSync(err);}
 let error,state={};
 child.on('error',e=>{error=e;});
 try{
  const deadline=start+180000;
  while(performance.now()<deadline){
   if(error)throw error;
   if(child.exitCode!==null)throw Error('Portable exited before first frame: '+child.exitCode);
   state=inspectProfile();
   const ready=state.trace.some(x=>x.stage==='window-shown'&&x.visible===true&&x.minimized===false);
   const boot=state.trace.some(x=>x.stage==='bootstrap-ok');
   if(state.owned&&state.timing&&ready&&boot)break;
   const fatal=state.trace.find(x=>['startup-error','preload-error','render-process-gone','did-fail-load','load-file-error','first-frame-timeout','bootstrap-rejected','bootstrap-error','renderer-ready-rejected'].includes(x.stage));
   if(fatal)throw Error('Portable startup '+fatal.stage+': '+JSON.stringify(fatal));
   await delay(100);
  }
  assert.ok(state.owned&&state.timing,'Portable did not open the synthetic project and report timing');
  assert.ok(state.trace.some(x=>x.stage==='bootstrap-ok'),'Synthetic project did not bootstrap');
  assert.ok(state.trace.some(x=>x.stage==='window-shown'&&x.visible===true&&x.minimized===false),'Renderer-ready native window was not visible');
  assert.ok(state.trace.some(x=>x.stage==='main-loaded'&&x.packaged&&x.portable),'Portable profile not confirmed');
  assert.equal(state.timing.electronVersion,require('../package.json').devDependencies.electron);
  for(const key of ['electronProcessToShownMs','backendReadyMs','windowCreatedToShownMs'])assert.ok(Number.isFinite(state.timing[key])&&state.timing[key]>=0,'Invalid '+key);
  const result={launcherToVisibleMs:Math.round(performance.now()-start),internal:state.timing,bytes:fs.statSync(exe).size,note:'Cold isolated profile, launcher extraction included; polling resolution ~100 ms. Trusted renderer bootstrap and native visibility verified.'};
  fs.writeFileSync(reportFile,JSON.stringify(result,null,2));console.log('PASS real Portable launch',JSON.stringify(result));
 }catch(e){
  const tail=file=>{try{return fs.readFileSync(file,'utf8').slice(-16000);}catch{return null;}};
  const diagnostics={message:e.message,elapsedMs:Math.round(performance.now()-start),exitCode:child.exitCode,expectedProfile:profile,syntheticProject:project,state:inspectProfile(),processes:windowProcesses(),stdout:tail(stdoutPath),stderr:tail(stderrPath),chromium:tail(chromiumLog)};
  fs.writeFileSync(diagnosticFile,JSON.stringify(diagnostics,null,2));console.error('PORTABLE STARTUP DIAGNOSTICS',JSON.stringify(diagnostics));
  throw e;
 }finally{
  if(child.pid&&child.exitCode===null)spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',timeout:15000});
  await delay(1000);
  if(fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
  fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:200});
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
