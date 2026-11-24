'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {cornerResizeBounds}=require('../corner-resize');
const start={x:100,y:100,width:900,height:700};

test('native diagonal drags move the correct corner and retain the opposite corner',()=>{
 assert.deepEqual(cornerResizeBounds(start,'nw',30,50),{x:130,y:150,width:870,height:650});
 assert.deepEqual(cornerResizeBounds(start,'ne',30,-50),{x:100,y:50,width:930,height:750});
 assert.deepEqual(cornerResizeBounds(start,'sw',-30,50),{x:70,y:100,width:930,height:750});
 assert.deepEqual(cornerResizeBounds(start,'se',30,50),{x:100,y:100,width:930,height:750});
});

test('minimum window size is respected without shifting opposite corner',()=>{
 const nw=cornerResizeBounds(start,'nw',1000,1000,740,480);
 assert.deepEqual(nw,{x:260,y:320,width:740,height:480});
 const ne=cornerResizeBounds(start,'ne',-1000,1000,740,480);
 assert.deepEqual(ne,{x:100,y:320,width:740,height:480});
 const sw=cornerResizeBounds(start,'sw',1000,-1000,740,480);
 assert.deepEqual(sw,{x:260,y:100,width:740,height:480});
 const se=cornerResizeBounds(start,'se',-1000,-1000,740,480);
 assert.deepEqual(se,{x:100,y:100,width:740,height:480});
});

test('invalid corner and pointer deltas are ignored safely',()=>{
 assert.equal(cornerResizeBounds(start,'left',12,4),null);
 assert.equal(cornerResizeBounds(start,'ne',NaN,4),null);
 assert.equal(cornerResizeBounds(null,'nw',0,0),null);
});
