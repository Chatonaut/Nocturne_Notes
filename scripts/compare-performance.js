'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const current=path.resolve(__dirname,'..'),baseline=path.resolve(process.argv[2]||path.join(current,'_baseline'));
const benchmark=path.join(__dirname,'benchmark-electron.js');
const results={baseline:[],candidate:[]};
for(let i=0;i<3;i++){
 for(const [label,root] of [['baseline',baseline],['candidate',current]]){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nocturne-bench-'));
  try{
   const electron=require(require.resolve('electron',{paths:[root]}));
   const child=spawnSync(electron,[benchmark],{cwd:root,env:{...process.env,NOCTURNE_BENCH_ROOT:root,NOCTURNE_BENCH_PROFILE:profile,NOCTURNE_BENCH_CANDIDATE:label==='candidate'?'1':'0'},encoding:'utf8',timeout:120000});
   if(child.status!==0)throw Error(label+' failed: '+child.status+' '+(child.error||'')+'\n'+child.stdout+'\n'+child.stderr);
   const line=child.stdout.split(/\r?\n/).find(l=>l.startsWith('NOCTURNE_BENCH '));
   if(!line)throw Error('No measurement: '+child.stdout);
   const data=JSON.parse(line.slice('NOCTURNE_BENCH '.length));results[label].push(data);
   console.log(label+' '+(i+1)+' '+JSON.stringify(data));
  }finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 }
}
const median=v=>v.slice().sort((a,b)=>a-b)[Math.floor(v.length/2)];
const metrics=['electronProcessToShownMs','backendReadyMs','windowCreatedToShownMs','workingSetMiB','bodyMs','titleMs'];
const lines=['### Nocturne Notes performance: 1.8.0 vs 2.0.0','Fresh isolated profile on each run; internal startup timing begins in main.js, not OS process launch. 3 alternating runs; synthetic input handler time (not perceived typing latency), summed process working sets (can double-count shared pages).','','| Metric | 1.8.0 | 2.0.0 | Change |','|---|---:|---:|---:|'];
for(const key of metrics){
 const a=median(results.baseline.map(r=>r[key])),b=median(results.candidate.map(r=>r[key]));
 lines.push('| '+key+' | '+a.toFixed(2)+' | '+b.toFixed(2)+' | '+(a?((b-a)/a*100).toFixed(1)+'%':'n/a')+' |');
}
lines.push('', 'Electron baseline: '+results.baseline[0].electronVersion+'; candidate: '+results.candidate[0].electronVersion+'.','Clean note rewritten: baseline '+results.baseline.map(r=>r.unchangedWrite).join(', ')+'; candidate '+results.candidate.map(r=>r.unchangedWrite).join(', ')+'.','CI timings are not a guarantee of speed on the owner’s PC.');
console.log(lines.join('\n'));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
