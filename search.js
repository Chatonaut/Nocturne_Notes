'use strict';
// Case-insensitive search and formatting-preserving replacement across project notes.
// Operates on text nodes only: links, headings, strong/em, colors and HTML attributes stay intact.
(() => {
 const hits=(haystack,needle)=>{
  if(!needle)return [];
  // Match the original string, preserving UTF-16 offsets (e.g. U+0130).
  const literal=String(needle).replace(/[\\^$.*+?()[\]{}|]/g,'\\$&');
  const pattern=new RegExp(literal,'giu'),text=String(haystack),out=[];
  let match;while((match=pattern.exec(text))!==null)out.push(match.index);
  return out;
 };
 const asRoot=html=>{const holder=document.createElement('div');holder.innerHTML=window.NocturneContent.sanitizeDOM(html);return holder};
 const cache=new Map();let cacheChars=0;
 const invalidate=id=>{const old=cache.get(id);if(old){cacheChars-=old.html.length+old.text.length;cache.delete(id);}};
 const clearCache=()=>{cache.clear();cacheChars=0;};
 function bodyHits(note,q){let old=cache.get(note.id);if(!old||old.html!==note.html){invalidate(note.id);old={html:note.html||'',text:asRoot(note.html).textContent||''};const size=old.html.length+old.text.length;if(size<=8_000_000){while(cache.size&&(cache.size>=256||cacheChars+size>8_000_000))invalidate(cache.keys().next().value);cache.set(note.id,old);cacheChars+=size;}}return hits(old.text,q);}
 const countMatches=(note,query)=>{
  if(!query)return 0;
  return hits(note.title||'',query).length+bodyHits(note,query).length;
 };
 const findInElement=(element,query)=>{
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
  const nodes=[];let text='',node;
  while((node=walker.nextNode())){if(!node.textContent)continue;nodes.push({node,start:text.length,end:text.length+node.textContent.length});text+=node.textContent;}
  return {nodes,positions:hits(text,query),text};
 };
 const locate=(nodes,pos,isEnd)=>{
  let lo=0,hi=nodes.length-1;
  while(lo<=hi){
   const mid=(lo+hi)>>>1,v=nodes[mid];
   if(isEnd?pos<=v.start:pos<v.start)hi=mid-1;
   else if(isEnd?pos>v.end:pos>=v.end)lo=mid+1;
   else return {node:v.node,offset:pos-v.start};
  }
  const last=nodes[nodes.length-1];return last?{node:last.node,offset:last.node.textContent.length}:null;
 };
 const replaceInNote=(note,query,replacement,all=false)=>{
  if(!query)return {...note,count:0};
  const holder=asRoot(note.html);
  const found=findInElement(holder,query);
  let count=0,title=note.title;
  const titlePositions=hits(title,query);
  if(titlePositions.length){
   const toChange=all?titlePositions:[titlePositions[0]];
   if(title.length+toChange.length*(replacement.length-query.length)>250)throw new Error('Результат замены слишком длинный');
   for(const i of [...toChange].reverse())title=title.slice(0,i)+replacement+title.slice(i+query.length);
   count+=toChange.length;
  }
  const changeBody=all?found.positions:(!count?found.positions.slice(0,1):[]);
  if(title.length>250||found.text.length+changeBody.length*(replacement.length-query.length)>5_000_000)throw new Error('Результат замены слишком длинный');
  // Common case: all matches are within individual text nodes. Replace each
  // affected node in one pass instead of creating thousands of DOM ranges.
  const byNode=new Map();let crosses=false;
  for(const pos of changeBody){
   const start=locate(found.nodes,pos,false),end=locate(found.nodes,pos+query.length,true);
   if(!start||!end)continue;
   if(start.node!==end.node){crosses=true;break;}
   if(!byNode.has(start.node))byNode.set(start.node,[]);
   byNode.get(start.node).push([start.offset,end.offset]);
  }
  if(!crosses){
   for(const [node,edits] of byNode){
    const source=node.textContent,parts=[];let cursor=0;
    for(const [begin,end] of edits){parts.push(source.slice(cursor,begin),replacement);cursor=end;count++;}
    parts.push(source.slice(cursor));node.textContent=parts.join('');
   }
  }else{
   // Descending offsets preserve earlier text-node references across markup.
   for(let i=changeBody.length-1;i>=0;i--){
    const pos=changeBody[i],start=locate(found.nodes,pos,false),end=locate(found.nodes,pos+query.length,true);
    if(!start||!end)continue;
    const range=document.createRange();range.setStart(start.node,start.offset);range.setEnd(end.node,end.offset);
    range.deleteContents();range.insertNode(document.createTextNode(replacement));count++;
   }
  }
  // Clean empty spans created when one match crosses multiple styled text nodes.
  holder.querySelectorAll('strong,em,u,s,strike,span,a').forEach(el=>{if(!el.textContent&&el.children.length===0)el.remove()});
  return {...note,title,html:holder.innerHTML,count};
 };
 // Replaces only the specifically selected result; the remaining document is left unchanged.
 const replaceAt=(note,query,replacement,kind,position)=>{
  if(!query)return {...note,count:0};
  if(kind==='title'){
   const positions=hits(note.title||'',query);
   if(!positions.includes(position))return {...note,count:0};
   if(note.title.length+replacement.length-query.length>250)throw new Error('Результат замены слишком длинный');
   const title=note.title.slice(0,position)+replacement+note.title.slice(position+query.length);
   return {...note,title,count:1};
  }
  if(kind==='body'){
   const holder=asRoot(note.html),found=findInElement(holder,query);
   if(!found.positions.includes(position))return {...note,count:0};
   if(found.text.length+replacement.length-query.length>5_000_000)throw new Error('Результат замены слишком длинный');
   const begin=locate(found.nodes,position,false),end=locate(found.nodes,position+query.length,true);
   if(!begin||!end)return {...note,count:0};
   const range=document.createRange();range.setStart(begin.node,begin.offset);range.setEnd(end.node,end.offset);
   range.deleteContents();range.insertNode(document.createTextNode(replacement));
   holder.querySelectorAll('strong,em,u,s,strike,span,a').forEach(el=>{if(!el.textContent&&el.children.length===0)el.remove()});
   return {...note,html:holder.innerHTML,count:1};
  }
  return {...note,count:0};
 };
 const rangesFor=(element,query,selectedOffset=null)=>{
  const found=findInElement(element,query);
  // Bound rendered highlights, not navigation or replacement.
  const positions=found.positions.slice(0,2000);
  if(Number.isInteger(selectedOffset)&&!positions.includes(selectedOffset)&&found.positions.includes(selectedOffset))positions.push(selectedOffset);
  return positions.map(pos=>{
   const begin=locate(found.nodes,pos,false),end=locate(found.nodes,pos+query.length,true);
   if(!begin||!end)return null;
   const range=document.createRange();range.setStart(begin.node,begin.offset);range.setEnd(end.node,end.offset);
   return {offset:pos,range};
  }).filter(Boolean);
 };
 window.nocturneSearch=Object.freeze({hits,countMatches,bodyHits,invalidate,clearCache,findInElement,replaceInNote,replaceAt,rangesFor});
})();
