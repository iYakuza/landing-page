
(()=>{const root=document.querySelector('.gd');if(!root)return;
const tracks=['Lofi Hip Hop Radio','Synthwave Radio','Jazz Lofi Radio','Asian Lofi Radio','Sleep Lofi Radio','Classic Hip Hop Radio'];let index=0,playing=false;
const track=root.querySelector('#gd-track'),play=root.querySelector('#gd-play'),eq=root.querySelector('.gd-eq'),radio=root.querySelector('#gd-radio'),head=root.querySelector('#gd-drag');
function setTrack(i){index=(i+tracks.length)%tracks.length;track.textContent=tracks[index];root.querySelectorAll('[data-track]').forEach((b,j)=>b.classList.toggle('selected',tracks[index]===b.dataset.track));}
root.querySelectorAll('[data-track]').forEach(b=>b.addEventListener('click',()=>{setTrack(tracks.indexOf(b.dataset.track));root.querySelector('#gd-radio-note').textContent='STATION SELECTED · CONNECT AN AUDIO URL TO ENABLE PLAYBACK';}));
root.querySelector('#gd-next').addEventListener('click',()=>setTrack(index+1));root.querySelector('#gd-prev').addEventListener('click',()=>setTrack(index-1));
play.addEventListener('click',()=>{playing=!playing;play.textContent=playing?'Ⅱ':'▶';play.setAttribute('aria-pressed',String(playing));eq.classList.toggle('paused',!playing);root.querySelector('#gd-radio-note').textContent=playing?'VISUAL PLAY STATE · AUDIO SOURCE NOT CONNECTED':'VISUAL RADIO CONTROLS · AUDIO SOURCE NOT CONNECTED';});
root.querySelector('#gd-close').addEventListener('click',()=>{radio.classList.toggle('minimized');root.querySelector('#gd-close').textContent=radio.classList.contains('minimized')?'+':'−';});
let drag=false,ox=0,oy=0;head.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;drag=true;const r=radio.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;head.setPointerCapture(e.pointerId);radio.classList.add('dragging');});head.addEventListener('pointermove',e=>{if(!drag)return;radio.style.left=Math.max(0,e.clientX-ox)+'px';radio.style.top=Math.max(0,e.clientY-oy+window.scrollY)+'px';radio.style.right='auto';});head.addEventListener('pointerup',()=>{drag=false;radio.classList.remove('dragging')});setTrack(0);
})();
