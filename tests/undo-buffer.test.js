'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {UndoBuffer}=require('../undo-buffer');
const s=x=>({title:'T',html:String(x)});
test('50 logical steps, independent note buffers and redo branch',()=>{
 const h=new UndoBuffer();h.resetCurrent('a',s(0));h.resetCurrent('b',s('b0'));
 for(let i=1;i<=60;i++)h.record('a',s(i));
 for(let i=59;i>=10;i--)assert.equal(h.move('a','undo').html,String(i));
 assert.equal(h.move('a','undo'),null);
 assert.equal(h.move('a','redo').html,'11');
 h.record('a',s('new'));assert.equal(h.move('a','redo'),null);
 h.record('b',s('b1'));assert.equal(h.move('b','undo').html,'b0');
 h.clear();assert.equal(h.can('a','undo'),false);
});
test('global memory cap prunes inactive note buffers',()=>{
 const h=new UndoBuffer(50,100);h.resetCurrent('a',s('x'.repeat(30)));h.record('a',s('y'.repeat(30)));
 h.resetCurrent('b',s('z'.repeat(30)));h.record('b',s('q'.repeat(30)));
 assert.equal(h.notes.has('a'),false);
});
