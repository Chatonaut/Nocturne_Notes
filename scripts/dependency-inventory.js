'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),pkg=require(path.join(root,'package.json')),lock=require(path.join(root,'package-lock.json'));
const deprecated=Object.entries(lock.packages).filter(([,v])=>v.deprecated).map(([name,v])=>({name,version:v.version,developmentOnly:!!v.dev,reason:v.deprecated}));
const report={directRuntime:pkg.dependencies,directDevelopment:pkg.devDependencies,deprecated,note:'Deprecation is not equivalent to a CVE. Do not override transitive packages or automatically upgrade runtime dependencies without compatibility tests.'};
fs.writeFileSync(path.join(root,'dependency-inventory.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
