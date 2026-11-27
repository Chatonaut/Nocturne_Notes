'use strict';
const assert=require('node:assert/strict');
// Test actual Chromium layout. Compare against the same dialog with only
// the optical correction disabled, then restore it before the next action.
async function checkDialogButtons(js){
 const result=await js(`(()=>{
  const dialog=document.querySelector('.glass-dialog');
  if(!dialog||dialog.closest('[hidden]'))throw Error('No visible dialog');
  const buttons=[...dialog.querySelectorAll('button')].filter(b=>b.getClientRects().length&&b.getBoundingClientRect().width>0);
  const textButtons=buttons.filter(b=>b.textContent.trim());
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const measure=b=>{
   const label=b.querySelector('.selected-label')||b,range=document.createRange(),style=getComputedStyle(label),rect=b.getBoundingClientRect();
   range.selectNodeContents(label);const text=range.getBoundingClientRect();
   ctx.font=style.fontStyle+' '+style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
   const metrics=ctx.measureText(label.textContent.trim());
   const fontHeight=metrics.fontBoundingBoxAscent+metrics.fontBoundingBoxDescent;
   // Range bounds and font metrics give an estimate of actual glyph ink,
   // not merely the mathematical center of the CSS line box.
   const ink=text.y+(text.height-fontHeight)/2+metrics.fontBoundingBoxAscent+(metrics.actualBoundingBoxDescent-metrics.actualBoundingBoxAscent)/2;
   return {label:label.textContent.trim(),w:rect.width,h:rect.height,x:rect.x,y:rect.y,textX:text.x,textY:text.y,inkOffset:ink-rect.y-rect.height/2,inside:text.top>=rect.top-.1&&text.bottom<=rect.bottom+.1&&text.left>=rect.left-.1&&text.right<=rect.right+.1,footer:!!b.closest('.dialog-buttons')};
  };
  const actual=textButtons.map(measure),previous=dialog.style.getPropertyValue('--dialog-optical-lift');
  let original;
  try{dialog.style.setProperty('--dialog-optical-lift','0px');original=textButtons.map(measure);}
  finally{if(previous)dialog.style.setProperty('--dialog-optical-lift',previous);else dialog.style.removeProperty('--dialog-optical-lift');}
  const icons=buttons.filter(b=>!b.textContent.trim()&&b.querySelector('svg')).map(b=>{const r=b.getBoundingClientRect(),s=b.querySelector('svg').getBoundingClientRect();return {name:b.className,dx:s.x+s.width/2-r.x-r.width/2,dy:s.y+s.height/2-r.y-r.height/2};});
  return {heading:dialog.querySelector('h2').textContent,actual,original,icons};
 })()`);
 assert.ok(result.actual.length,'No visible text buttons in '+result.heading);
 for(let i=0;i<result.actual.length;i++){
  const a=result.actual[i],b=result.original[i],label=result.heading+': '+a.label+' '+JSON.stringify(a);
  for(const key of ['w','h','x','y','textX'])assert.ok(Math.abs(a[key]-b[key])<=.1,'Dialog geometry changed: '+key+' '+label);
  assert.ok(Math.abs(a.textY-b.textY+1)<=.35,'Expected one-pixel optical lift: '+label);
  assert.ok(a.inside,'Label exceeds button bounds: '+label);
  assert.ok(Number.isFinite(a.inkOffset)&&Math.abs(a.inkOffset)<=3.5,'Estimated ink is off center: '+label);
  if(a.footer)assert.ok(Math.abs(a.h-35)<=.1,'Footer height changed: '+label);
 }
 for(const i of result.icons)assert.ok(Math.abs(i.dx)<=.6&&Math.abs(i.dy)<=.6,'Icon-only dialog control is off center: '+JSON.stringify(i));
 console.log('PASS dialog optical alignment '+result.heading+' ('+result.actual.length+' labels, '+result.icons.length+' icons)');
}
module.exports={checkDialogButtons};
