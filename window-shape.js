'use strict';
// Native window region matching the locked 29 px CSS border radius.
// win.setShape(rects) crops ALL window pixels outside this region on Windows.
// One-pixel scan lines give stable corners on the approved 100%-DPI system.
// No extra dependencies, overlay windows, or CSS changes.
/** @param {number} width @param {number} height @param {number} [radius] */
function roundWindowRegion(width,height,radius=29){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)
  throw new RangeError('Invalid window bounds');
 const r=Math.max(0,Math.min(Math.round(radius),Math.floor(width/2),Math.floor(height/2)));
 if(!r)return [{x:0,y:0,width,height}];
 const regions=[];
 // The middle is rectangular. Only the first/last r pixel rows are curved.
 if(height>2*r)regions.push({x:0,y:r,width,height:height-2*r});
 for(let y=0;y<r;y++){
  const dy=r-y-.5;
  const dx=Math.ceil(r-Math.sqrt(r*r-dy*dy));
  const w=width-dx*2;
  if(w<=0)continue;
  regions.push({x:dx,y,width:w,height:1});
  regions.push({x:dx,y:height-y-1,width:w,height:1});
 }
 return regions;
}
module.exports={roundWindowRegion};
