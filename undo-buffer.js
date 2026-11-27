'use strict';
(function(root){
 class UndoBuffer {
  constructor(limit=50,maxBytes=64*1024*1024){this.limit=limit;this.maxBytes=maxBytes;this.notes=new Map();}
  clear(){this.notes.clear();}
  drop(id){this.notes.delete(id);}
  same(a,b){return a&&b&&a.title===b.title&&a.html===b.html;}
  resetCurrent(id,s){const h=this.notes.get(id);if(h)h.states[h.index]=s;else this.notes.set(id,{states:[s],index:0});this.trim(id);}
  record(id,s){let h=this.notes.get(id);if(!h){this.resetCurrent(id,s);return;}
   if(this.same(h.states[h.index],s)){h.states[h.index]=s;return;}
   h.states.splice(h.index+1);h.states.push(s);h.index++;
   while(h.states.length>this.limit+1){h.states.shift();h.index--;}
   this.trim(id);
  }
  can(id,dir){const h=this.notes.get(id);return !!h&&(dir==='undo'?h.index>0:h.index<h.states.length-1);}
  move(id,dir){if(!this.can(id,dir))return null;const h=this.notes.get(id);h.index+=dir==='undo'?-1:1;return h.states[h.index];}
  trim(active){
   const bytes=()=>[...this.notes.values()].reduce((total,h)=>total+h.states.reduce((n,s)=>n+2*(s.title.length+s.html.length),0),0);
   while(bytes()>this.maxBytes){
    let changed=false;
    for(const id of this.notes.keys()){if(id!==active){this.notes.delete(id);changed=true;break;}}
    if(changed)continue;
    const h=this.notes.get(active);
    if(!h||h.states.length<=1)break;
    if(h.index>0){h.states.shift();h.index--;}else h.states.pop();
   }
  }
 }
 if(typeof module==='object'&&module.exports)module.exports={UndoBuffer};else root.NocturneUndoBuffer=UndoBuffer;
})(typeof window==='object'?window:globalThis);
