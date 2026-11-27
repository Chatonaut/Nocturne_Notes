'use strict';
const {parseFragment}=require('parse5');
const {serialize,escapeText,safeLink}=require('./content-policy');
const sanitizeHTML=html=>serialize(parseFragment(String(html||'')));
const escapeMarkdown=s=>String(s).replace(/[\\*_{}\[\]<>#~|]/g,'\\$&').replaceAll(String.fromCharCode(96),'\\'+String.fromCharCode(96));
function markdown(html){
 const root=parseFragment(sanitizeHTML(html));
 function walk(n,depth=0,nesting=0){
  // Avoid stack overflow and unbounded nested Markdown indentation on hostile input.
  if(nesting>256)throw new Error('Заметка слишком большая');
  if(n.nodeName==='#text')return escapeMarkdown(n.value);
  const tag=n.tagName,children=n.childNodes||[];
  if(tag==='ul'||tag==='ol'){
   return '\n'+children.filter(c=>c.tagName==='li').map((li,i)=>{
    const nested=(li.childNodes||[]).filter(c=>c.tagName==='ul'||c.tagName==='ol');
    const body=(li.childNodes||[]).filter(c=>!nested.includes(c)).map(c=>walk(c,depth+1,nesting+1)).join('').trim();
    const prefix=tag==='ol'?(i+1)+'. ':'- ',indent=' '.repeat(depth*4);
    return indent+prefix+body.replace(/\n/g,'\n'+indent+' '.repeat(prefix.length))+nested.map(c=>walk(c,depth+1,nesting+1).replace(/\n$/,'')).join('');
   }).join('\n')+'\n';
  }
  const v=children.map(c=>walk(c,depth,nesting+1)).join('');
  if(/^h[1-6]$/.test(tag||''))return '\n'+'#'.repeat(Number(tag[1]))+' '+v.trim()+'\n\n';
  if(tag==='strong')return v?'**'+v+'**':'';
  if(tag==='em')return v?'_'+v+'_':'';
  if(tag==='s')return v?'~~'+v+'~~':'';
  if(tag==='a'){const url=safeLink(n.attrs?.find(a=>a.name==='href')?.value);return url?'['+v+'](<'+url.replace(/</g,'%3C').replace(/>/g,'%3E').replace(/\\/g,'%5C')+'>)':v;}
  if(tag==='blockquote')return '\n'+v.trim().split('\n').map(l=>'> '+l).join('\n')+'\n\n';
  if(tag==='p')return v+'\n\n';if(tag==='br')return '  \n';return v;
 }
 return root.childNodes.map(n=>walk(n)).join('').replace(/\n{3,}/g,'\n\n').trim();
}
function plainText(html){
 const parts=[],stack=parseFragment(sanitizeHTML(html)).childNodes.slice().reverse();
 while(stack.length){
  const n=stack.pop();
  if(typeof n==='string'){parts.push(n);continue;}
  if(n.nodeName==='#text'){parts.push(n.value);continue;}
  if(/^(p|h[1-6]|li|ul|ol|blockquote|br)$/.test(n.tagName||''))stack.push('\n');
  const children=n.childNodes||[];for(let i=children.length-1;i>=0;i--)stack.push(children[i]);
 }
 return parts.join('').replace(/\n{3,}/g,'\n\n').trim();
}
function exportHTML(title,html){return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>'+escapeText(title)+'</title>'+sanitizeHTML(html);}
module.exports={sanitizeHTML,markdown,plainText,exportHTML};
