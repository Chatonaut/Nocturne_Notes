'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {sameLocalFileURL}=require('../ipc-contract');
const expected='file:///C:/Users/RUNNER%7E1/AppData/Local/Temp/3Mc7Qcbpcwjb98AMQnOjWLMZjST/resources/app.asar/index.html';
test('packaged Chromium URL and Node URL identify the same trusted file',()=>{
 assert.equal(sameLocalFileURL(expected.replace('%7E','~'),expected),true);
 assert.equal(sameLocalFileURL(expected.replace('%7E','%7e'),expected),true);
 assert.equal(sameLocalFileURL(expected,expected),true);
});
test('spaces, Cyrillic, literal percent and reserved filename characters remain exact',()=>{
 const url='file:///C:/%D0%A2%D0%B5%D1%81%D1%82%20%257E%20%23/resources/app.asar/index.html';
 assert.equal(sameLocalFileURL(url,url),true);
 assert.equal(sameLocalFileURL(url.replace('%D0%A2','%d0%a2'),url),true);
 assert.equal(sameLocalFileURL(url.replace('%257E','~'),url),false);
 assert.equal(sameLocalFileURL(url.replace('%23','#'),url),false);
});
test('other origins, files, paths, encoded separators and URL suffixes are rejected',()=>{
 for(const actual of [null,undefined,42,'https://localhost/index.html','data:text/html,hi',expected.replace('file:///','file://other/'),expected.replace('index.html','other.html'),expected.replace('RUNNER%7E1','RUNNER%7E2'),expected.replace('/index.html','%2Findex.html'),expected.replace('/index.html','%5cindex.html'),expected.replace('/index.html','/../app.asar/index.html'),expected.replace('%7E','%257E'),expected+'?x=1',expected+'#',expected+'#x',expected+'%00',expected.replace('%7E','%7G')])assert.equal(sameLocalFileURL(actual,expected),false,String(actual));
});
