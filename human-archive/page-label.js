(() => {
 'use strict';
 const value='HUMAN ARCHIVE / COLUMBARIUM';
 const apply=()=>document.querySelectorAll('.game-page-tag').forEach(node=>{if(node.textContent.trim()!==value)node.textContent=value;});
 apply();
 const observer=new MutationObserver(apply);
 observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
