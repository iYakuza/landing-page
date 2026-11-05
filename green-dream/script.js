(() => {
  const root=document;
  const playlistId='PL-HvxCN6LbEtKhlSDDndY8mdupqTbTlgn';
  const radio=root.querySelector('#gd-radio'),head=root.querySelector('#gd-drag'),track=root.querySelector('#gd-track'),artist=root.querySelector('#gd-artist'),play=root.querySelector('#gd-play'),eq=root.querySelector('.gd-eq'),host=root.querySelector('#gd-player'),note=root.querySelector('#gd-radio-note'),select=root.querySelector('#gd-video-select');
  const close=radio?.querySelector('#gd-close');
  if(!radio||!head||!track||!artist||!play||!eq||!host||!note||!select)return;
  radio.style.setProperty('--acid','#d8ff3e');
  const hiddenStyle=document.createElement('style');
  hiddenStyle.textContent='#gd-radio.radio-hidden{visibility:hidden!important;opacity:0!important;pointer-events:none!important}';
  document.head.appendChild(hiddenStyle);
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
  function setRadioHidden(hidden){
    radio.classList.toggle('radio-hidden',hidden);
    radio.setAttribute('aria-hidden',String(hidden));
    const toolButton=document.querySelector('#vha-viewer-tools [data-tool="radio"]');
    if(toolButton)toolButton.setAttribute('aria-pressed',String(hidden));
    if(close){
      close.textContent=hidden?'+':'−';
      close.setAttribute('aria-expanded',String(!hidden));
      close.setAttribute('aria-label',hidden?'Restore radio from Viewer Tools':'Minimize radio');
    }
  }
  close?.addEventListener('click',()=>setRadioHidden(true));
  window.addEventListener('vha-radio-toggle',()=>setRadioHidden(false));
  const syncRadioVisibility=()=>setRadioHidden(true);
  document.addEventListener('vha-crystal-mode-change',syncRadioVisibility);
  syncRadioVisibility();

  const positionKey=radio.dataset.positionKey||'vha-green-dream-radio-position-v4';
  let saved=null;try{saved=JSON.parse(localStorage.getItem(positionKey)||'null')}catch{}
  let drag=null,resize=null,suppressClickUntil=0;
  head.style.touchAction='none';head.style.userSelect='none';head.style.cursor='grab';
  radio.style.setProperty('position','fixed','important');
  radio.style.setProperty('right','auto','important');radio.style.setProperty('bottom','auto','important');
  if(Number.isFinite(saved?.width))radio.style.setProperty('width',Math.max(240,Math.min(saved.width,innerWidth-16))+'px','important');
  radio.style.setProperty('height','auto','important');
  radio.style.setProperty('max-height','none','important');
  radio.style.setProperty('overflow','visible','important');
  radio.style.setProperty('overscroll-behavior','visible','important');
  radio.style.setProperty('transform','none','important');
  radio.style.setProperty('z-index','2147483000','important');
  function applyPosition(left,top,persist=false){
    const width=radio.offsetWidth,height=radio.offsetHeight;
    left=Math.max(8,Math.min(left,innerWidth-width-8));
    top=Math.max(8,Math.min(top,innerHeight-height-8));
    radio.style.setProperty('left',left+'px','important');
    radio.style.setProperty('top',top+'px','important');
    if(persist){try{localStorage.setItem(positionKey,JSON.stringify({left,top,width}))}catch{}}
  }
  ['nw','ne','sw','se'].forEach(corner=>{
    const handle=document.createElement('span');
    handle.className='gd-radio-resize';handle.dataset.corner=corner;
    handle.setAttribute('role','separator');handle.setAttribute('aria-label','Resize radio width');
    radio.appendChild(handle);
    handle.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      event.preventDefault();event.stopPropagation();
      const rect=radio.getBoundingClientRect();
      resize={id:event.pointerId,corner,startX:event.clientX,left:rect.left,right:rect.right,top:rect.top};
    });
  });
  requestAnimationFrame(()=>{
    const width=radio.offsetWidth,height=radio.offsetHeight;
    applyPosition(Number.isFinite(saved?.left)?saved.left:innerWidth-width-12,
      Number.isFinite(saved?.top)?saved.top:(innerWidth<=760?innerHeight-height-12:(Number.isFinite(Number(radio.dataset.defaultTop))?Number(radio.dataset.defaultTop):(innerHeight-height)/2)));
  });
  head.addEventListener('dragstart',e=>e.preventDefault());
  head.addEventListener('pointerdown',e=>{
    if((e.pointerType==='mouse'&&e.button!==0)||e.target.closest('button,select,label,a'))return;
    const rect=radio.getBoundingClientRect();
    drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,left:rect.left,top:rect.top,moved:false};
    head.style.cursor='grabbing';
  });
  window.addEventListener('pointermove',e=>{
    if(resize&&e.pointerId===resize.id){
      const dx=e.clientX-resize.startX;
      const width=Math.max(240,Math.min(innerWidth-16,resize.right-resize.left+(resize.corner.includes('e')?dx:-dx)));
      radio.style.setProperty('width',width+'px','important');
      const left=resize.corner.includes('w')?resize.right-width:resize.left;
      applyPosition(left,resize.top,false);
      if(e.cancelable)e.preventDefault();
      return;
    }
    if(!drag||e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(!drag.moved&&Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
    if(drag.moved){applyPosition(drag.left+dx,drag.top+dy,false);if(e.cancelable)e.preventDefault()}
  },{passive:false});
  function finishPointer(e){
    if(resize&&(!e||e.pointerId===resize.id)){
      const rect=radio.getBoundingClientRect();
      applyPosition(rect.left,rect.top,true);
      resize=null;
      return;
    }
    if(!drag||(e&&e.pointerId!==drag.id))return;
    if(drag.moved){suppressClickUntil=Date.now()+250;const rect=radio.getBoundingClientRect();applyPosition(rect.left,rect.top,true)}
    drag=null;head.style.cursor='grab';
  }
  window.addEventListener('pointerup',finishPointer);
  window.addEventListener('pointercancel',finishPointer);
  window.addEventListener('blur',()=>finishPointer());
  head.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){suppressClickUntil=0;e.preventDefault();e.stopImmediatePropagation()}},true);
  window.addEventListener('resize',()=>{
    const rect=radio.getBoundingClientRect();
    applyPosition(rect.left,rect.top,true);
  });
  status('Radio ready. Press PLAY to load the Green Dream playlist.');
})();