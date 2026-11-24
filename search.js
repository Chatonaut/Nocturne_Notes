'use strict';
// Case-insensitive search and formatting-preserving replacement across project notes.
// Operates on text nodes only: links, headings, strong/em, colors and HTML attributes stay intact.
(() => {
 const hits=(haystack,needle)=>{
  if(!needle)return [];
  const text=String(haystack).toLocaleLowerCase('ru-RU');
  const find=String(needle).toLocaleLowerCase('ru-RU');
  const out=[];let from=0;
  while(from<text.length){const i=text.indexOf(find,from);if(i<0)break;out.push(i);from=i+Math.max(1,find.length)}
  return out;
 };
 const asRoot=html=>{const holder=document.createElement('div');holder.innerHTML=String(html||'');return holder};
 const countMatches=(note,query)=>{
  if(!query)return 0;
  const holder=asRoot(note.html);
  return hits(note.title||'',query).length+hits(holder.textContent||'',query).length;
 };
 const findInElement=(element,query)=>{
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
  const nodes=[];let text='',node;
  while((node=walker.nextNode())){if(!node.textContent)continue;nodes.push({node,start:text.length,end:text.length+node.textContent.length});text+=node.textContent;}
  return {nodes,positions:hits(text,query),text};
 };
 const locate=(nodes,pos,isEnd)=>{
  const found=nodes.find(v=>isEnd?(pos>v.start&&pos<=v.end):(pos>=v.start&&pos<v.end));
  if(found)return {node:found.node,offset:pos-found.start};
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
   for(const i of [...toChange].reverse())title=title.slice(0,i)+replacement+title.slice(i+query.length);
   count+=toChange.length;
  }
  const changeBody=all?found.positions:(!count?found.positions.slice(0,1):[]);
  // Descending offsets preserve references to earlier text nodes.
  for(const pos of [...changeBody].reverse()){
   const start=locate(found.nodes,pos,false),end=locate(found.nodes,pos+query.length,true);
   if(!start||!end)continue;
   const range=document.createRange();range.setStart(start.node,start.offset);range.setEnd(end.node,end.offset);
   range.deleteContents();range.insertNode(document.createTextNode(replacement));count++;
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
   const title=note.title.slice(0,position)+replacement+note.title.slice(position+query.length);
   return {...note,title,count:1};
  }
  if(kind==='body'){
   const holder=asRoot(note.html),found=findInElement(holder,query);
   if(!found.positions.includes(position))return {...note,count:0};
   const begin=locate(found.nodes,position,false),end=locate(found.nodes,position+query.length,true);
   if(!begin||!end)return {...note,count:0};
   const range=document.createRange();range.setStart(begin.node,begin.offset);range.setEnd(end.node,end.offset);
   range.deleteContents();range.insertNode(document.createTextNode(replacement));
   holder.querySelectorAll('strong,em,u,s,strike,span,a').forEach(el=>{if(!el.textContent&&el.children.length===0)el.remove()});
   return {...note,html:holder.innerHTML,count:1};
  }
  return {...note,count:0};
 };
 const rangesFor=(element,query)=>{
  const found=findInElement(element,query);
  return found.positions.map(pos=>{
   const begin=locate(found.nodes,pos,false),end=locate(found.nodes,pos+query.length,true);
   if(!begin||!end)return null;
   const range=document.createRange();range.setStart(begin.node,begin.offset);range.setEnd(end.node,end.offset);
   return {offset:pos,range};
  }).filter(Boolean);
 };
 window.nocturneSearch=Object.freeze({hits,countMatches,findInElement,replaceInNote,replaceAt,rangesFor});
})();
