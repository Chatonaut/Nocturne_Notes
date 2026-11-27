'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const current=path.resolve(__dirname,'..'),baseline=path.resolve(process.argv[2]||path.join(current,'_baseline'));
const benchmark=path.join(__dirname,'benchmark-electron.js'),sameRuntime=process.argv[3]==='same-runtime';
const output='performance-comparison.json';
const results={baseline:[],candidate:[]};
for(let i=0;i<5;i++){
 for(const [label,root] of (i%2===0?[['baseline',baseline],['candidate',current]]:[['candidate',current],['baseline',baseline]])){ 
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-bench-'));
  try{
   const electron=require(require.resolve('electron',{paths:[root]}));
   const child=spawnSync(electron,[benchmark],{cwd:root,env:{...process.env,NOCTURNE_BENCH_ROOT:root,NOCTURNE_BENCH_PROFILE:profile,NOCTURNE_BENCH_CANDIDATE:label==='candidate'?'1':'0',NOCTURNE_BENCH_REQUIRE_REUSE:label==='candidate'?'1':'0'},encoding:'utf8',timeout:120000});
   if(child.status!==0)throw Error(label+' failed: '+child.status+' '+(child.error||'')+'\n'+child.stdout+'\n'+child.stderr);
   const line=child.stdout.split(/\r?\n/).find(l=>l.startsWith('NOCTURNE_BENCH '));
   if(!line)throw Error('No measurement: '+child.stdout);
   const data=JSON.parse(line.slice('NOCTURNE_BENCH '.length));results[label].push(data);
   console.log(label+' '+(i+1)+' '+JSON.stringify(data));
  }finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 }
}
const median=v=>v.slice().sort((a,b)=>a-b)[Math.floor(v.length/2)];
const metrics=['electronProcessToShownMs','backendReadyMs','windowCreatedToShownMs','workingSetMiB','bodyMs','titleMs','searchMs','projectSearchMs','retainedRows','plainCreate20Ms','plainRecoveryWrite20Ms','plainRecoveryRestoreMs','protectedCreate20Ms','protectedRecoveryWrite20Ms','protectedRecoveryRestoreMs'];
const baselineVersion=require(path.join(baseline,'package.json')).version,candidateVersion=require(path.join(current,'package.json')).version;
if(sameRuntime&&results.baseline.some(x=>x.electronVersion!==results.candidate[0].electronVersion))throw Error('Same-runtime comparison must use identical Electron versions');
const baselineLabel='Baseline ('+baselineVersion+')',candidateLabel=candidateVersion+' release candidate';
const lines=['### Nocturne Notes performance: '+baselineLabel+' vs '+candidateLabel,'Fresh isolated profile on each run; internal startup timing begins in main.js, not OS process launch. 5 alternating runs per source; 20 durable note creates and recovery writes per backend measurement; synthetic input handler time (not perceived typing latency), 40 alternating search queries (synchronous handler time, not rendered-frame latency), summed process working sets (can double-count shared pages).','','| Metric | '+baselineLabel+' | '+candidateLabel+' | Change |','|---|---:|---:|---:|'];
for(const key of metrics){
 if(![...results.baseline,...results.candidate].every(r=>Number.isFinite(r[key])&&r[key]>=0))throw Error('Missing/invalid benchmark metric '+key);
 const a=median(results.baseline.map(r=>r[key])),b=median(results.candidate.map(r=>r[key]));
 lines.push('| '+key+' | '+a.toFixed(2)+' | '+b.toFixed(2)+' | '+(a?((b-a)/a*100).toFixed(1)+'%':'n/a')+' |');
}
lines.push('', 'Electron baseline: '+results.baseline[0].electronVersion+'; candidate: '+results.candidate[0].electronVersion+'.','Clean note rewritten: baseline '+results.baseline.map(r=>r.unchangedWrite).join(', ')+'; candidate '+results.candidate.map(r=>r.unchangedWrite).join(', ')+'.','CI timings are not a guarantee of speed on the owner’s PC. The two sources use the same compiled native addon and Electron version.');
fs.writeFileSync(path.join(current,output),JSON.stringify(results,null,2));
console.log(lines.join('\n'));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
