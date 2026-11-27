'use strict';
// One allowlist for inert browser templates and parse5's HTML5 tree in main.
(function(root){
 const tags=new Set(['p','div','br','strong','b','em','i','u','s','strike','del','h1','h2','h3','h4','h5','h6','ul','ol','li','a','span','font','blockquote']);
 const blocked=new Set(['script','style','svg','iframe','object','embed','img','link','meta','form','input','button','video','audio','math','textarea','template','noscript','base','select','option','canvas']);
 const aliases={div:'p',b:'strong',i:'em',strike:'s',del:'s',font:'span'};
 const esc=s=>String(s).replace(/&/g,'&amp;').replace(/\u00a0/g,'&nbsp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const attr=s=>esc(s).replace(/"/g,'&quot;');
 function safeLink(raw){
  if(typeof raw!=='string'||raw.length>8192||/[\u0000-\u0020\u007f]/.test(raw)||!/^(https?:\/\/|mailto:)/i.test(raw))return '';
  try{const u=new URL(raw);return ['http:','https:','mailto:'].includes(u.protocol)?raw:'';}catch{return '';}
 }
 function safeColor(raw){
  const v=String(raw||'').trim();
  if(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(v)){const h=v.slice(1),f=h.length===3?[...h].map(c=>c+c).join(''):h;return 'rgb('+[0,2,4].map(i=>parseInt(f.slice(i,i+2),16)).join(', ')+')';}
  const m=/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(v);
  return m&&m.slice(1).every(n=>Number(n)<=255)?'rgb('+m.slice(1).map(Number).join(', ')+')':'';
 }
 const get=(n,k)=>n.getAttribute?n.getAttribute(k):n.attrs?.find(a=>a.name===k&&!a.namespace)?.value;
 function serialize(container){
  const parts=[],stack=Array.from(container.childNodes||[]).reverse();
  while(stack.length){
   const n=stack.pop();
   if(typeof n==='string'){parts.push(n);continue;}
   if(n.nodeType===3||n.nodeName==='#text'){parts.push(esc(n.value??n.textContent??''));continue;}
   const tag=String(n.tagName||'').toLowerCase();
   if(!tag||blocked.has(tag)||(n.namespaceURI&&n.namespaceURI!=='http://www.w3.org/1999/xhtml'))continue;
   const dest=tags.has(tag)?(Object.hasOwn(aliases,tag)?aliases[tag]:tag):'span';
   let attrs='';
   if(dest==='a'){const href=safeLink(get(n,'href'));if(href)attrs=' href="'+attr(href)+'" target="_blank" rel="noopener noreferrer"';}
   if(dest==='span'&&(tag==='font'||tag==='span')){
    const m=/(?:^|;)\s*color\s*:\s*([^;]+)\s*(?:;|$)/i.exec(get(n,'style')||'');
    const c=safeColor(tag==='font'?get(n,'color'):m?.[1]);if(c)attrs=' style="color: '+c+';"';
   }
   parts.push('<'+dest+attrs+'>');if(dest==='br')continue;
   stack.push('</'+dest+'>');const children=n.childNodes||[];for(let i=children.length-1;i>=0;i--)stack.push(children[i]);
  }
  return parts.join('')||'<p></p>';
 }
 function sanitizeDOM(html){const t=document.createElement('template');t.innerHTML=String(html||'');return serialize(t.content);}
 const api=Object.freeze({serialize,sanitizeDOM,safeLink,safeColor,escapeText:esc});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.NocturneContent=api;
})(typeof window==='object'?window:globalThis);
