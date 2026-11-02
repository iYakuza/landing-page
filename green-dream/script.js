(() => {
  const root=document.querySelector('.gd'); if(!root)return;
  const playlistId='PL-HvxCN6LbEtKhlSDDndY8mdupqTbTlgn';
  const radio=root.querySelector('#gd-radio'),head=root.querySelector('#gd-drag'),track=root.querySelector('#gd-track'),artist=root.querySelector('#gd-artist'),play=root.querySelector('#gd-play'),eq=root.querySelector('.gd-eq'),host=root.querySelector('#gd-player'),note=root.querySelector('#gd-radio-note'),select=root.querySelector('#gd-video-select');
  const close=radio?.querySelector('#gd-close');
  if(!radio||!head||!track||!artist||!play||!eq||!host||!note||!select)return;
  radio.style.setProperty('--acid','#d8ff3e');
  if(radio.parentElement!==document.body)document.body.appendChild(radio);

  let player=null,playing=false,playlistIds=[],apiPromise=null;
  const status=s=>{note.textContent=s};
  function setPlaying(value){
    playing=value;
    play.textContent=value?'■ STOP':'▶ PLAY';
    play.setAttribute('aria-label',value?'Stop radio':'Play radio');
    eq.classList.toggle('paused',!value);
  }
  function updateCurrent(){
    if(!player)return;
    const data=player.getVideoData?.()||{};
    const index=player.getPlaylistIndex?.();
    if(data.title){
      track.textContent=data.title;
      artist.textContent='GREEN DREAM // '+String((Number.isInteger(index)?index:0)+1).padStart(2,'0')+' / '+(playlistIds.length||'…');
      if(Number.isInteger(index)&&select.options[index]){
        select.value=String(index);
        select.options[index].textContent=String(index+1).padStart(2,'0')+' — '+data.title;
      }
    }
  }
  function populatePlaylist(){
    if(!player)return;
    const ids=player.getPlaylist?.()||[];
    if(!ids.length)return false;
    const previous=select.value;
    playlistIds=ids;
    const frag=document.createDocumentFragment();
    ids.forEach((id,index)=>{
      const option=document.createElement('option');
      option.value=String(index);
      option.textContent=String(index+1).padStart(2,'0')+' — Track';
      option.dataset.videoId=id;
      frag.appendChild(option);
    });
    select.replaceChildren(frag);
    const current=player.getPlaylistIndex?.();
    if(Number.isInteger(current)&&current>=0&&current<ids.length)select.value=String(current);
    else if(previous&&Number(previous)<ids.length)select.value=previous;
    status(ids.length+' playlist entries loaded. Select a track to play it.');
    updateCurrent();
    return true;
  }
  function loadApi(){
    if(window.YT?.Player)return Promise.resolve(window.YT);
    if(apiPromise)return apiPromise;
    apiPromise=new Promise((resolve,reject)=>{
      const previous=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{try{previous?.()}catch{} resolve(window.YT)};
      let tag=document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if(!tag){tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';tag.async=true;tag.onerror=()=>reject(new Error('YouTube player API could not load'));document.head.appendChild(tag)}
      else if(window.YT?.Player)resolve(window.YT);
    });
    return apiPromise;
  }
  async function start(){
    host.hidden=false;
    track.textContent='Connecting to Green Dream…';
    artist.textContent='Loading playlist';
    play.disabled=true;
    status('Connecting to the playlist…');
    try{
      const YT=await loadApi();
      if(!player){
        player=new YT.Player(host,{
          width:'100%',height:'180',
          playerVars:{listType:'playlist',list:playlistId,autoplay:1,playsinline:1,rel:0,enablejsapi:1,origin:location.origin},
          events:{
            onReady:event=>{
              setPlaying(true);
              let attempts=0;
              const sync=()=>{
                if(populatePlaylist())return;
                if(++attempts<20)setTimeout(sync,500);
                else status('Player ready, but YouTube did not return the playlist entries.');
              };
              sync();
              event.target.playVideo();
            },
            onStateChange:event=>{
              if(event.data===1){setPlaying(true);updateCurrent()}
              if(event.data===2||event.data===0)setPlaying(false);
              if(event.data===5)updateCurrent();
            },
            onError:event=>{
              setPlaying(false);
              status('YouTube player error ('+event.data+'). This item may be unavailable or blocked from embedding.');
            }
          }
        });
      }else{
        player.playVideo();
        setPlaying(true);
      }
    }catch(error){
      status(error?.message||'Could not connect to YouTube.');
      setPlaying(false);
    }finally{play.disabled=false}
  }
  play.addEventListener('click',()=>{
    if(playing){player?.pauseVideo();setPlaying(false);status('Playback paused.')}
    else start();
  });
  select.addEventListener('change',()=>{
    const index=Number(select.value);
    if(!Number.isInteger(index)||index<0||index>=playlistIds.length)return;
    if(player){player.playVideoAt(index);setPlaying(true);status('Loading selected playlist track…')}
  });
  close?.addEventListener('click',e=>{
    const m=radio.classList.toggle('minimized');
    e.currentTarget.textContent=m?'+':'−';
    e.currentTarget.setAttribute('aria-expanded',String(!m));
    e.currentTarget.setAttribute('aria-label',m?'Expand radio':'Minimize radio');
  });

  const positionKey='vha-green-dream-radio-position-v2';
  let drag=null,suppressClickUntil=0;
  head.style.touchAction='none';head.style.userSelect='none';head.style.cursor='grab';
  radio.style.setProperty('position','fixed','important');
  radio.style.setProperty('right','auto','important');radio.style.setProperty('bottom','auto','important');
  radio.style.setProperty('transform','none','important');
  radio.style.setProperty('max-height','calc(100dvh - 16px)','important');
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
    if((e.pointerType==='mouse'&&e.button!==0)||e.target.closest('button,select,label,a'))return;
    const r=radio.getBoundingClientRect();
    drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,left:r.left,top:r.top,moved:false};
    head.style.cursor='grabbing';
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
    drag=null;head.style.cursor='grab';
  }
  window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',endDrag);window.addEventListener('blur',()=>endDrag());
  head.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){suppressClickUntil=0;e.preventDefault();e.stopImmediatePropagation()}},true);
  window.addEventListener('resize',()=>{const r=radio.getBoundingClientRect();setPosition(r.left,r.top,true)});
  status('Radio ready. Press PLAY to load the Green Dream playlist.');
})();