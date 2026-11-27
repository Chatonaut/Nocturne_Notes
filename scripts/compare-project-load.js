'use strict';
// Sequential, alternating source comparisons. Verify each database after the
// Electron process exits. No timing thresholds are invented for a shared CI host.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const current=path.resolve(__dirname,'..'),baseline=path.resolve(process.argv[2]||path.join(current,'_baseline')),script=path.join(__dirname,'benchmark-project-load.js');
const reportFile=path.join(current,'project-load-comparison.json'),report={method:'5 alternating pairs per size and encryption mode; real Chromium text insertion, two animation frames, synthetic projects; summed working sets can double-count shared pages; not a long-term leak proof',runs:[],summary:[]};
const write=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
const hash=notes=>crypto.createHash('sha256').update(JSON.stringify(notes.map(({id,title,html})=>({id,title,html})))).digest('hex');
const median=v=>v.slice().sort((a,b)=>a-b)[Math.floor(v.length/2)];
for(const size of [100,500,1000])for(const encrypted of [false,true]){
 for(let i=0;i<5;i++)for(const [label,root] of (i%2===0?[['baseline',baseline],['candidate',current]]:[['candidate',current],['baseline',baseline]])){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-large-project-'));
  try{
   const electron=require(require.resolve('electron',{paths:[root]}));
   const p=spawnSync(electron,[script],{cwd:root,env:{...process.env,NOCTURNE_LOAD_ROOT:root,NOCTURNE_LOAD_PROFILE:profile,NOCTURNE_LOAD_SIZE:String(size),NOCTURNE_LOAD_PROTECTED:encrypted?'1':'0'},encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
   assert.ifError(p.error);assert.equal(p.status,0,label+' '+size+' '+encrypted+' failed:\n'+p.stdout+'\n'+p.stderr);
   const line=p.stdout.split(/\r?\n/).find(l=>l.startsWith('NOCTURNE_PROJECT_LOAD '));assert.ok(line,'missing complete workload marker: '+p.stdout);
   const data=JSON.parse(line.slice('NOCTURNE_PROJECT_LOAD '.length));assert.equal(data.size,size);assert.equal(data.protectedProject,encrypted);
   assert.equal(data.electronVersion,require(path.join(current,'package.json')).devDependencies.electron);
   assert.equal(data.input.length,data.rounds*data.events);assert.equal(data.search.length,data.rounds*4);assert.equal(data.switching.length,data.rounds-1);assert.equal(data.memory.length,data.rounds+1);
   assert.ok(Object.values(data.metrics).every(v=>Number.isFinite(v)&&v>=0),'invalid timing/memory data');
   const {ProjectStore}=require(path.join(root,'storage')),key=encrypted?Buffer.from('synthetic load password only'):null;let reopened;
   try{reopened=new ProjectStore(path.join(profile,'load.ns'),key);const snapshot=reopened.snapshot();assert.equal(snapshot.encrypted,encrypted);assert.equal(hash(snapshot.notes),data.expectedHash,'saved data differs after process exit');assert.equal(snapshot.activeId,data.activeId);}
   finally{reopened?.close();key?.fill(0);}
   report.runs.push({label,pair:i+1,...data,reopenVerified:true});write();
   console.log('PASS project load '+label+' '+size+' '+(encrypted?'protected':'plain')+' pair '+(i+1)+' '+JSON.stringify(data.metrics));
  }finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});}
 }
 const rows=report.runs.filter(x=>x.size===size&&x.protectedProject===encrypted),a=rows.filter(x=>x.label==='baseline'),b=rows.filter(x=>x.label==='candidate');
 assert.equal(a.length,5);assert.equal(b.length,5);
 const metrics={};
 for(const k of Object.keys(a[0].metrics)){
  const av=a.map(r=>r.metrics[k]),bv=b.map(r=>r.metrics[k]),x=median(av),y=median(bv);
  metrics[k]={baselineMedian:x,candidateMedian:y,baselineRange:[Math.min(...av),Math.max(...av)],candidateRange:[Math.min(...bv),Math.max(...bv)],changePercent:x?(y-x)*100/x:null};
 }
 report.summary.push({size,encrypted,metrics});write();
}
assert.equal(report.runs.length,60);
const lines=['### Extended real Electron project load comparison','Five alternating pairs per 100/500/1000-note project, ordinary and protected. All runs must preserve data after exit. Input/search/switch include two frame callbacks and IPC. Timing variation is reported, not silently classified as a regression.','| Notes | Mode | Input p95 baseline / candidate (ms) | Search p95 baseline / candidate (ms) | Switch p95 baseline / candidate (ms) | Peak working set baseline / candidate (MiB) |','|---:|---|---:|---:|---:|---:|'];
const fmt=(row,k)=>row.metrics[k].baselineMedian.toFixed(1)+' / '+row.metrics[k].candidateMedian.toFixed(1);
for(const row of report.summary)lines.push('| '+row.size+' | '+(row.encrypted?'protected':'plain')+' | '+fmt(row,'inputP95Ms')+' | '+fmt(row,'searchP95Ms')+' | '+fmt(row,'switchP95Ms')+' | '+fmt(row,'memoryPeakMiB')+' |');
console.log(lines.join('\n'));if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
