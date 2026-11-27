'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''));
const runtime=read('native-runtime.json'),sbom=read('sbom-production.json');
const sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'native/build/Release/nocturne_cipher.node'))).digest('hex');
const components=[
 {type:'framework',name:'Electron',version:runtime.electron,'bom-ref':'runtime:electron',purl:'pkg:npm/electron@'+runtime.electron},
 {type:'framework',name:'Chromium',version:'156.0.8078.109','bom-ref':'runtime:chromium'},
 {type:'framework',name:'Node.js',version:runtime.node,'bom-ref':'runtime:node'},
 {type:'library',name:'SQLCipher Community Edition',version:'4.20.0','bom-ref':'native:sqlcipher',properties:[{name:'sourceCommit',value:'355d4db92d3404e71faa8088d071a71d767807f4'}]},
 {type:'library',name:'OpenSSL',version:'3.6.5','bom-ref':'native:openssl',properties:[{name:'sourceCommit',value:'c8bd5a57108599ac650bbae77fcabe3109dab2e8'},{name:'vcpkgCommit',value:'9290f1a2049af5fdd6d580efbb765baaa85a3623'}]},
 {type:'library',name:'SQLCipher embedded SQLite',version:runtime.sqlite,'bom-ref':'native:sqlite'},
 {type:'library',name:'Nocturne SQLCipher Node-API binding',version:read('package.json').version,'bom-ref':'native:binding',hashes:[{alg:'SHA-256',content:sha256}],properties:[{name:'CRT',value:'static MSVC /MT'}]}
];
sbom.components=[...(sbom.components||[]),...components];
sbom.dependencies??=[];
const app=sbom.metadata?.component?.['bom-ref'];
if(app){let d=sbom.dependencies.find(x=>x.ref===app);if(!d){d={ref:app,dependsOn:[]};sbom.dependencies.push(d);}d.dependsOn=[...new Set([...(d.dependsOn||[]),'runtime:electron','native:binding'])];}
sbom.dependencies.push({ref:'runtime:electron',dependsOn:['runtime:chromium','runtime:node']},{ref:'native:binding',dependsOn:['native:sqlcipher','native:openssl']},{ref:'native:sqlcipher',dependsOn:['native:sqlite','native:openssl']});
fs.writeFileSync(path.join(root,'sbom-production.json'),JSON.stringify(sbom,null,2));
console.log('PASS production SBOM includes packaged core runtime and native components (not exhaustive Chromium internals)');
