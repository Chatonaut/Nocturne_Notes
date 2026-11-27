'use strict';
const readonly=Object.fromEntries(['console','process','Buffer','require','module','exports','__dirname','__filename','setTimeout','clearTimeout','setInterval','clearInterval','setImmediate','clearImmediate','queueMicrotask','URL','URLSearchParams','performance','fetch','AbortController','AbortSignal','TextEncoder','TextDecoder','structuredClone','crypto','window','document','navigator','localStorage','sessionStorage','Node','NodeFilter','CSS','Highlight','ResizeObserver','MutationObserver','InputEvent','Event','MouseEvent','KeyboardEvent','PointerEvent','DOMParser','HTMLElement','Element','HTMLInputElement','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','Blob','alert','location','Image','Range','atob','btoa'].map(k=>[k,'readonly']));
module.exports=[
 {ignores:['dist/**','node_modules/**','native/**','_sqlcipher/**','_vcpkg/**','_baseline/**','reference/**','coverage/**']},
 {files:['*.js','scripts/*.js','tests/*.js'],languageOptions:{ecmaVersion:'latest',sourceType:'commonjs',globals:readonly},
  rules:{'no-undef':'error','no-dupe-keys':'error','no-dupe-args':'error','no-unreachable':'error','no-invalid-regexp':'error','no-unsafe-finally':'error','no-func-assign':'error','no-class-assign':'error','no-debugger':'error','no-unused-vars':['warn',{argsIgnorePattern:'^_',caughtErrors:'none'}]}}
];
