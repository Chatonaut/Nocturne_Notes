'use strict';
// Computes a constrained diagonal resize anchored at the opposite corner.
// Pure math: tested independently of native Windows message handling.
/** @param {{x:number,y:number,width:number,height:number}} bounds @param {string} corner @param {number} dx @param {number} dy @param {number} [minWidth] @param {number} [minHeight] */
function cornerResizeBounds(bounds,corner,dx,dy,minWidth=740,minHeight=480){
 if(!bounds||!['nw','ne','sw','se'].includes(corner))return null;
 if(![bounds.x,bounds.y,bounds.width,bounds.height,dx,dy].every(Number.isFinite))return null;
 const originalX=bounds.x,originalY=bounds.y;
 let x=originalX,y=originalY,width=bounds.width,height=bounds.height;
 if(corner.endsWith('w')){
  width=Math.max(minWidth,Math.round(bounds.width-dx));
  x=originalX+bounds.width-width;
 }else width=Math.max(minWidth,Math.round(bounds.width+dx));
 if(corner.startsWith('n')){
  height=Math.max(minHeight,Math.round(bounds.height-dy));
  y=originalY+bounds.height-height;
 }else height=Math.max(minHeight,Math.round(bounds.height+dy));
 return {x:Math.round(x),y:Math.round(y),width:Math.round(width),height:Math.round(height)};
}
module.exports={cornerResizeBounds};
