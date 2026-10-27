(() => {
  const root=document.querySelector('.gd'); if(!root)return;
  const playlistId='PL-HvxCN6LbEtKhlSDDndY8mdupqTbTlgn';
  const radio=root.querySelector('#gd-radio'),head=root.querySelector('#gd-drag'),track=root.querySelector('#gd-track'),artist=root.querySelector('#gd-artist'),play=root.querySelector('#gd-play'),eq=root.querySelector('.gd-eq'),host=root.querySelector('#gd-player'),note=root.querySelector('#gd-radio-note'),picker=root.querySelector('#gd-video-select');
  let videos=[],selectedId='',playing=false,player=null,apiPromise=null,probePlayer=null;
  const status=s=>{if(note)note.textContent=s};
  function setTrack(v){if(!v)return;selectedId=v.id;track.textContent=v.title;artist.textContent='Verse After Hours // YouTube playlist';if(picker)picker.value=v.id}
  function ensureApi(){
    if(window.YT&&window.YT.Player)return Promise.resolve();
    if(apiPromise)return apiPromise;
    apiPromise=new Promise((resolve,reject)=>{
      const old=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{if(typeof old==='function')old();resolve()};
      const tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';tag.async=true;tag.dataset.youtubeIframeApi='true';tag.onerror=()=>reject(new Error('YouTube player API could not load.'));document.head.appendChild(tag);
      setTimeout(()=>reject(new Error('YouTube player API timed out.')),15000);
    });return apiPromise;
  }
  function stop(){if(player&&player.stopVideo)player.stopVideo();host.hidden=true;playing=false;play.textContent='▶ PLAY';play.setAttribute('aria-label','Play selected video');eq.classList.add('paused')}
  async function playSelected(){
    if(!selectedId){status('Playlist is not ready yet. Please try again shortly.');return}
    host.hidden=false;
    try{
      await ensureApi();
      if(!player){
        player=new YT.Player(host,{height:'180',width:'100%',videoId:selectedId,playerVars:{autoplay:1,rel:0,playsinline:1,origin:location.origin},events:{onReady:()=>{},onStateChange:e=>{if(e.data===YT.PlayerState.ENDED){playing=false;play.textContent='▶ PLAY';eq.classList.add('paused')}}}});
      }else player.loadVideoById(selectedId);
      playing=true;play.textContent='■ STOP';play.setAttribute('aria-label','Stop playback');eq.classList.remove('paused');status('Playing: '+(videos.find(v=>v.id===selectedId)?.title||'selected video'));
    }catch(e){status(e.message||'YouTube could not start.')}
  }
  async function loadPlaylist(){
    try{
      await ensureApi();
      const probe=document.createElement('div');probe.setAttribute('aria-hidden','true');probe.style.cssText='position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';document.body.appendChild(probe);
      const p=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Playlist request timed out.')),15000);probePlayer=new YT.Player(probe,{height:'1',width:'1',playerVars:{listType:'playlist',list:playlistId,playsinline:1,origin:location.origin},events:{onReady:e=>{clearTimeout(timeout);resolve(e.target)},onError:()=>{clearTimeout(timeout);reject(new Error('YouTube could not load this playlist.'))}}})});
      const ids=p.getPlaylist()||[];if(!ids.length)throw new Error('No videos were returned by the playlist.');
      videos=await Promise.all(ids.map(async(id,i)=>{try{const url='https://www.youtube.com/oembed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+id)+'&format=json';const res=await fetch(url,{headers:{Accept:'application/json'}});if(!res.ok)throw new Error();const data=await res.json();return{id,title:String(data.title||'').slice(0,180)||('Playlist video '+(i+1))}}catch{return{id,title:'Playlist video '+String(i+1).padStart(2,'0')+' (title unavailable)'}}}));
      picker.replaceChildren();videos.forEach((v,i)=>{const o=document.createElement('option');o.value=v.id;o.textContent=String(i+1).padStart(2,'0')+' / '+v.title;picker.appendChild(o)});
      setTrack(videos[0]);status(videos.length+' playlist videos loaded. Choose a title, then press PLAY.');
      p.destroy();probePlayer=null;probe.remove();host.replaceChildren();
    }catch(e){picker.replaceChildren();const o=document.createElement('option');o.value='';o.textContent='Playlist unavailable — reload to retry';picker.appendChild(o);status('Could not load playlist titles. '+(e.message||'Check your connection and reload.'))}
  }
  picker?.addEventListener('change',()=>{const v=videos.find(v=>v.id===picker.value);if(v){setTrack(v);playSelected()}});
  play.addEventListener('click',()=>playing?(stop(),status('Playback stopped.')):playSelected());
  function move(n){if(!videos.length)return;let i=videos.findIndex(v=>v.id===selectedId);setTrack(videos[(i+n+videos.length)%videos.length]);if(playing)playSelected();else status('Selected: '+track.textContent+'. Press PLAY to start.')}
  root.querySelector('#gd-next')?.addEventListener('click',()=>move(1));root.querySelector('#gd-prev')?.addEventListener('click',()=>move(-1));
  root.querySelector('#gd-close').addEventListener('click',e=>{const m=radio.classList.toggle('minimized');e.currentTarget.textContent=m?'+':'−';e.currentTarget.setAttribute('aria-expanded',String(!m));e.currentTarget.setAttribute('aria-label',m?'Expand radio':'Minimize radio')});
  let dragging=false,dx=0,dy=0;
  head.addEventListener('pointerdown',e=>{if(e.target.closest('button,select,label'))return;dragging=true;const r=radio.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;head.setPointerCapture(e.pointerId);radio.classList.add('dragging')});
  head.addEventListener('pointermove',e=>{if(!dragging)return;radio.style.left=Math.max(0,Math.min(innerWidth-radio.offsetWidth,e.clientX-dx))+'px';radio.style.top=Math.max(0,Math.min(innerHeight-radio.offsetHeight,e.clientY-dy)+scrollY)+'px';radio.style.right='auto';radio.style.bottom='auto'});
  const end=()=>{dragging=false;radio.classList.remove('dragging')};head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);
  loadPlaylist();
})();