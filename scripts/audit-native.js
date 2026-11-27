'use strict';
// Public advisory lookups for pinned open-source components only. No project data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),reportFile=path.join(root,'native-audit.json');
const sqliteVersion='3.54.1';
const readJSON=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
// Exact reviewed runtime/build source snapshot, not a general CVE allowlist.
// A relevant source or packaging change requires renewed applicability review.
// Reviewed: release cleanup, file-identity recovery, transactional note
// creation and preference rollback do not add a SQLite command-line shell.
// The native sources, binding and packaging scope are unchanged.
// Subsequent package.json change is solely the product description metadata.
const reviewedSources={
 'cipher-db.js':'aa0ffcda1cdf305abc20db787409adb3d66b4300',
 'ipc-contract.js':'5b87036bfeb2690e50d027c86623725099bbb96b',
 'main.js':'63fde3408a8c10840761e61dede205515009905a',
 'native/binding.gyp':'f0f07a23ef8ff3dd71a537a440662c45cc5e4fa4',
 'native/cipher.cc':'b0ea7970d77068d0446f505853e793408104f010',
 'package.json':'0bff3d66294782b33eaa107482734be312b52dfb',
 'preload.js':'7af7107f9869e623a4d89b5a92b4a0cee40e3387',
 'drafts.js':'9dd791e2a5f39f02c6cfb9d3b6258f02fbb69c04',
 'recovery.js':'aeb786bbf5d3506141a88ae920b4b3d8e0f9ac40',
 'scripts/build-sqlcipher.ps1':'2d5baa0d2c33357c5d870b810fbed552cd1c1e36',
 'storage.js':'4cf3a756a1031f0e038e0d36dd33d60cf36de055'
};
function verifyScope(){
 for(const [file,sha] of Object.entries(reviewedSources))assert.equal(git('hash-object','--path='+file,file),sha,'CVE applicability review required: '+file);
 const binding=readJSON('native/binding.gyp');
 assert.equal(binding.targets.length,1);
 assert.deepEqual(binding.targets[0].sources,['cipher.cc','vendor/sqlite3.c']);
}
function verifyRuntime(){
 const report=readJSON('native-audit.json'),runtime=readJSON('native-runtime.json');
 assert.equal(report.status,'passed-preflight');
 assert.deepEqual(report.pins,pins);
 assert.equal(runtime.sqlite,sqliteVersion,'Embedded SQLite differs from audited version');
 assert.equal(runtime.cipher,'4.20.0 community');
 assert.equal(runtime.provider,'openssl');
 assert.match(runtime.providerVersion,/^OpenSSL 3\.6\.5(?:\s|$)/);
 assert.equal(runtime.memorySecurity,'1');
 assert.equal(runtime.electron,readJSON('package.json').devDependencies.electron);
 if(report.dispositions.length)verifyScope();
 report.runtime=runtime;report.status='passed-runtime';fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
 console.log('PASS actual native runtime matches audited versions');
}
const pins=[
 {name:'OpenSSL',version:'3.6.5',commit:'c8bd5a57108599ac650bbae77fcabe3109dab2e8',vendor:'openssl',product:'openssl'},
 {name:'SQLCipher',version:'4.20.0',commit:'355d4db92d3404e71faa8088d071a71d767807f4',vendor:'zetetic',product:'sqlcipher'},
 {name:'Embedded SQLite',version:sqliteVersion,vendor:'sqlite',product:'sqlite'}
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url,options={}){
 let last;
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}
  catch(e){last=e;if(attempt<2)await sleep(4000*(attempt+1));}
 }
 throw last;
}
async function run(){
 const report={checkedAt:new Date().toISOString(),pins,status:'pending',runtime:null,coverage:'OSV commit and NVD exact-version CPE matches only; missing upstream database coverage is not proof of safety.',osv:[],nvd:[],dispositions:[],blocking:[],errors:[]};
 // The upstream SQLCipher source is checked out before this preflight.
 assert.equal(git('-C','_sqlcipher','rev-parse','HEAD'),pins[1].commit);
 assert.equal(fs.readFileSync(path.join(root,'_sqlcipher','VERSION'),'utf8').trim(),sqliteVersion);
 try{
  const components=pins.filter(p=>p.commit);
  const result=await request('https://api.osv.dev/v1/querybatch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries:components.map(p=>({commit:p.commit}))})});
  if(!Array.isArray(result.results)||result.results.length!==components.length)throw Error('Unexpected OSV result');
  report.osv=components.map((p,i)=>({name:p.name,ids:(result.results[i].vulns||[]).map(v=>v.id)}));
 }catch(e){report.errors.push('OSV: '+e.message);}
 for(const p of pins){
  try{
   const cpe='cpe:2.3:a:'+p.vendor+':'+p.product+':'+p.version+':*:*:*:*:*:*:*';
   const url='https://services.nvd.nist.gov/rest/json/cves/2.0?cpeName='+encodeURIComponent(cpe)+'&isVulnerable';
   const r=await request(url);
   if(!Number.isInteger(r.totalResults)||!Array.isArray(r.vulnerabilities)||r.totalResults!==r.vulnerabilities.length)throw Error('Unexpected or incomplete NVD result');
   report.nvd.push({name:p.name,cpe,total:r.totalResults,ids:r.vulnerabilities.map(v=>v.cve.id)});
  }catch(e){report.errors.push('NVD '+p.name+': '+e.message);}
  await sleep(6500);
 }
 for(const row of report.osv)for(const id of row.ids)report.blocking.push({source:'OSV',component:row.name,id});
 for(const row of report.nvd)for(const id of row.ids){
  if(row.name==='Embedded SQLite'&&row.cpe==='cpe:2.3:a:sqlite:sqlite:3.54.1:*:*:*:*:*:*:*'&&id==='CVE-2026-119586'){
   try{
    verifyScope();
    report.dispositions.push({id,component:row.name,version:sqliteVersion,status:'not_affected',reason:'Affected SQLite command-line shell recovery command is not part of the compiled library or application. Reviewed source scope verified; packaged absence must also pass before artifact upload.',source:'https://sqlite.org/cves.html',advisory:'https://nvd.nist.gov/vuln/detail/CVE-2026-119586',reviewedAt:'2026-11-26',reviewedSources,packageCheck:'pending'});
   }catch(e){report.errors.push('CVE-2026-119586 applicability: '+e.message);report.blocking.push({source:'NVD',component:row.name,id});}
  }else report.blocking.push({source:'NVD',component:row.name,id});
 }
 report.status=report.errors.length||report.blocking.length?'blocked':'passed-preflight';
 fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 if(report.status==='blocked')throw Error('Native advisory review incomplete or findings require manual review');
}
if(process.argv.includes('--verify-runtime')){
 try{verifyRuntime();}catch(e){console.error(e);process.exitCode=1;}
}else run().catch(e=>{console.error(e);process.exitCode=1;});
