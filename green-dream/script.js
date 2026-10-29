(() => {
  const root=document.querySelector('.gd'); if(!root)return;
  const playlistId='PL-HvxCN6LbEtKhlSDDndY8mdupqTbTlgn';
  const radio=root.querySelector('#gd-radio'),head=root.querySelector('#gd-drag'),track=root.querySelector('#gd-track'),artist=root.querySelector('#gd-artist'),play=root.querySelector('#gd-play'),eq=root.querySelector('.gd-eq'),host=root.querySelector('#gd-player'),note=root.querySelector('#gd-radio-note'),picker=root.querySelector('#gd-video-select');
  const close=radio?.querySelector('#gd-close');
  // Move the player out of the hero so section overflow/positioning cannot trap it.
  if(radio)radio.style.setProperty('--acid','#d8ff3e');
  if(radio && radio.parentElement!==document.body)document.body.appendChild(radio);

  let videos=[],selectedId='',playing=false,player=null,apiPromise=null,probePlayer=null;
  const status=s=>{if(note)note.textContent=s};
  function setTrack(v){if(!v)return;selectedId=v.id;track.textContent=v.title;artist.textContent='Verse After Hours // YouTube playlist';if(picker)picker.value=v.id}
  function ensureApi(){
    if(window.YT&&window.YT.Player)return Promise.resolve();
    if(apiPromise)return apiPromise;
    apiPromise=new Promise((resolve,reject)=>{
      const old=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{if(typeof old==='function')old();resolve()};
      const tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';tag.async=true;tag.crossOrigin='anonymous';tag.referrerPolicy='no-referrer';tag.dataset.youtubeIframeApi='true';tag.onerror=()=>reject(new Error('YouTube player API could not load.'));document.head.appendChild(tag);
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
  let playlistLoading=null;
  async function loadPlaylist(){
    if(videos.length)return true;
    if(playlistLoading)return playlistLoading;
    playlistLoading=(async()=>{
      let probe=null,p=null,timeoutId=null;
      try{
        status('Loading playlist only because you asked to play it…');
        await ensureApi();
        probe=document.createElement('div');probe.setAttribute('aria-hidden','true');probe.style.cssText='position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';document.body.appendChild(probe);
        p=await new Promise((resolve,reject)=>{timeoutId=setTimeout(()=>reject(new Error('Playlist request timed out.')),15000);probePlayer=new YT.Player(probe,{height:'1',width:'1',playerVars:{listType:'playlist',list:playlistId,playsinline:1,origin:location.origin},events:{onReady:e=>{clearTimeout(timeoutId);resolve(e.target)},onError:()=>{clearTimeout(timeoutId);reject(new Error('YouTube could not load this playlist.'))}}})});
        const ids=(p.getPlaylist()||[]).slice(0,100);
        if(!ids.length)throw new Error('No videos were returned by the playlist.');
        videos=ids.map((id,i)=>({id,title:'Playlist video '+String(i+1).padStart(2,'0')}));
        // Fetch titles in small batches, not one request per video all at once.
        for(let start=0;start<ids.length;start+=4){
          await Promise.all(ids.slice(start,start+4).map(async(id,offset)=>{
            const i=start+offset;
            try{
              const url='https://www.youtube.com/oembed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+id)+'&format=json';
              const res=await fetch(url,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',headers:{Accept:'application/json'}});
              if(res.ok){const data=await res.json();videos[i].title=String(data.title||videos[i].title).slice(0,180)}
            }catch{}
          }));
        }
        picker.replaceChildren();
        videos.forEach((v,i)=>{const o=document.createElement('option');o.value=v.id;o.textContent=String(i+1).padStart(2,'0')+' / '+v.title;picker.appendChild(o)});
        setTrack(videos[0]);status(videos.length+' playlist videos loaded. Choose a title, then press PLAY.');
        return true;
      }catch(e){
        picker.replaceChildren();const o=document.createElement('option');o.value='';o.textContent='Playlist unavailable — press PLAY to retry';picker.appendChild(o);
        status('Could not load playlist titles. '+(e.message||'Check your connection and try again.'));
        return false;
      }finally{
        if(timeoutId)clearTimeout(timeoutId);
        try{p?.destroy()}catch{}
        try{probePlayer?.destroy()}catch{}
        probePlayer=null;
        probe?.remove();
        host.replaceChildren();
        playlistLoading=null;
      }
    })();
    return playlistLoading;
  }
  picker?.addEventListener('change',()=>{const v=videos.find(v=>v.id===picker.value);if(v){setTrack(v);playSelected()}});
  play.addEventListener('click',async()=>{
    if(playing){stop();status('Playback stopped.');return}
    if(!videos.length){play.disabled=true;const loaded=await loadPlaylist();play.disabled=false;if(!loaded||!videos.length)return}
    await playSelected();
  });

  close?.addEventListener('click',e=>{const m=radio.classList.toggle('minimized');e.currentTarget.textContent=m?'+':'−';e.currentTarget.setAttribute('aria-expanded',String(!m));e.currentTarget.setAttribute('aria-label',m?'Expand radio':'Minimize radio')});
  // Inline !important positioning beats the legacy homepage rules that pinned top/bottom.
  const positionKey='vha-green-dream-radio-position-v2';
  let drag=null,suppressClickUntil=0;
  head.style.touchAction='none';head.style.userSelect='none';head.style.cursor='grab';
  radio.style.setProperty('position','fixed','important');
  radio.style.setProperty('right','auto','important');radio.style.setProperty('bottom','auto','important');
  radio.style.setProperty('transform','none','important');radio.style.setProperty('width','min(224px, calc(100vw - 16px))','important');
  radio.style.setProperty('max-height','calc(100vh - 16px)','important');radio.style.setProperty('max-height','calc(100dvh - 16px)','important');
  radio.style.setProperty('overflow-y','auto','important');radio.style.setProperty('overscroll-behavior','contain','important');
  radio.style.setProperty('z-index','2147483000','important');
  function clampPosition(x,y){
    const maxX=Math.max(8,innerWidth-radio.offsetWidth-8),maxY=Math.max(8,innerHeight-radio.offsetHeight-8);
    return {x:Math.max(8,Math.min(maxX,x)),y:Math.max(8,Math.min(maxY,y))};
  }
  function setPosition(x,y,persist=false){
    const p=clampPosition(x,y);
    radio.style.setProperty('position','fixed','important');
    radio.style.setProperty('left',p.x+'px','important');radio.style.setProperty('top',p.y+'px','important');
    radio.style.setProperty('right','auto','important');radio.style.setProperty('bottom','auto','important');
    radio.style.setProperty('transform','none','important');
    if(persist){try{localStorage.setItem(positionKey,JSON.stringify(p))}catch{}}
  }
  let saved=null;try{saved=JSON.parse(localStorage.getItem(positionKey)||'null')}catch{}
  const initial=radio.getBoundingClientRect();
  const initialX=Number.isFinite(saved?.x)?saved.x:innerWidth-initial.width-12;
  const initialY=Number.isFinite(saved?.y)?saved.y:(innerWidth<=760?innerHeight-initial.height-12:(innerHeight-initial.height)/2);
  setPosition(initialX,initialY,false);
  head.addEventListener('dragstart',e=>e.preventDefault());
  head.addEventListener('pointerdown',e=>{
    if((e.pointerType==='mouse'&&e.button!==0)||e.target.closest('button,select,label'))return;
    const r=radio.getBoundingClientRect();
    drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,left:r.left,top:r.top,moved:false};
    head.style.cursor='grabbing';
    // Window-level pointer listeners continue tracking movement without capturing
    // the pointer, so a brand link still clicks normally when the pointer isn't dragged.
  });
  window.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(!drag.moved&&Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
    if(drag.moved){setPosition(drag.left+dx,drag.top+dy,false);if(e.cancelable)e.preventDefault()}
  },{passive:false});
  function endDrag(e){
    if(!drag||(e&&e.pointerId!==drag.id))return;
    if(drag.moved){suppressClickUntil=Date.now()+250;const r=radio.getBoundingClientRect();setPosition(r.left,r.top,true)}
    drag=null;head.style.cursor='grab';radio.classList.remove('dragging');
  }
  window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',endDrag);window.addEventListener('blur',()=>endDrag());
  head.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){suppressClickUntil=0;e.preventDefault();e.stopImmediatePropagation()}},true);
  window.addEventListener('resize',()=>{const r=radio.getBoundingClientRect();setPosition(r.left,r.top,true)});

  status('Radio is idle. Press PLAY to load the playlist.');
})();