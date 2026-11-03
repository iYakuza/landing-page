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
  const syncRadioVisibility=()=>setRadioHidden(!document.body.classList.contains('vha-crystal-open'));
  document.addEventListener('vha-crystal-mode-change',syncRadioVisibility);
  // Keep the radio in sync even if another interface path changes crystal mode.
  const crystalModeObserver=new MutationObserver(syncRadioVisibility);
  crystalModeObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  syncRadioVisibility();

  const positionKey='vha-green-dream-radio-geometry-v3';
  let drag=null,resize=null,suppressClickUntil=0;
  head.style.touchAction='none';head.style.userSelect='none';head.style.cursor='grab';
  radio.style.setProperty('position','fixed','important');
  radio.style.setProperty('right','auto','important');radio.style.setProperty('bottom','auto','important');
  radio.style.setProperty('transform','none','important');
  radio.style.setProperty('max-height','calc(100dvh - 16px)','important');
  radio.style.setProperty('overflow','auto','important');radio.style.setProperty('overscroll-behavior','contain','important');
  radio.style.setProperty('z-index','2147483000','important');
  const corners=['nw','ne','sw','se'];
  corners.forEach(corner=>{
    const handle=document.createElement('span');
    handle.className='gd-radio-resize';handle.dataset.corner=corner;
    handle.setAttribute('aria-hidden','true');radio.appendChild(handle);
    handle.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      e.preventDefault();e.stopPropagation();
      const r=radio.getBoundingClientRect();
      resize={id:e.pointerId,corner,startX:e.clientX,startY:e.clientY,left:r.left,top:r.top,width:r.width,height:r.height};
    });
  });
  function clampGeometry(left,top,width,height){
    const minW=Math.min(220,innerWidth-16),minH=Math.min(150,innerHeight-16);
    width=Math.max(minW,Math.min(width,innerWidth-16));
    height=Math.max(minH,Math.min(height,innerHeight-16));
    left=Math.max(8,Math.min(left,innerWidth-width-8));
    top=Math.max(8,Math.min(top,innerHeight-height-8));
    return {left,top,width,height};
  }
  function applyGeometry(g,persist=false){
    const p=clampGeometry(g.left,g.top,g.width,g.height);
    radio.style.setProperty('left',p.left+'px','important');
    radio.style.setProperty('top',p.top+'px','important');
    radio.style.setProperty('width',p.width+'px','important');
    radio.style.setProperty('height',p.height+'px','important');
    radio.style.setProperty('right','auto','important');radio.style.setProperty('bottom','auto','important');
    if(persist){try{localStorage.setItem(positionKey,JSON.stringify(p))}catch{}}
  }
  let saved=null;try{saved=JSON.parse(localStorage.getItem(positionKey)||'null')}catch{}
  radio.style.removeProperty('height');
  const initial=radio.getBoundingClientRect();
  const defaultWidth=Math.min(326,innerWidth-24);
  const initialWidth=Number.isFinite(saved?.width)?saved.width:defaultWidth;
  radio.style.setProperty('width',initialWidth+'px','important');
  const contentHeight=Math.min(radio.scrollHeight,innerHeight-24);
  const initialGeometry={
    left:Number.isFinite(saved?.left)?saved.left:innerWidth-initialWidth-12,
    top:Number.isFinite(saved?.top)?saved.top:(innerWidth<=760?innerHeight-contentHeight-12:(innerHeight-contentHeight)/2),
    width:initialWidth,
    height:Number.isFinite(saved?.height)?saved.height:contentHeight
  };
  applyGeometry(initialGeometry,false);
  head.addEventListener('dragstart',e=>e.preventDefault());
  head.addEventListener('pointerdown',e=>{
    if((e.pointerType==='mouse'&&e.button!==0)||e.target.closest('button,select,label,a,.gd-radio-resize'))return;
    const r=radio.getBoundingClientRect();
    drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,left:r.left,top:r.top,width:r.width,height:r.height,moved:false};
    head.style.cursor='grabbing';
  });
  window.addEventListener('pointermove',e=>{
    if(resize&&e.pointerId===resize.id){
      const dx=e.clientX-resize.startX,dy=e.clientY-resize.startY;
      let {left,top,width,height}=resize;
      if(resize.corner.includes('e'))width+=dx;else{left+=dx;width-=dx}
      if(resize.corner.includes('s'))height+=dy;else{top+=dy;height-=dy}
      applyGeometry({left,top,width,height},false);
      if(e.cancelable)e.preventDefault();
      return;
    }
    if(!drag||e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(!drag.moved&&Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
    if(drag.moved){applyGeometry({...drag,left:drag.left+dx,top:drag.top+dy},false);if(e.cancelable)e.preventDefault()}
  },{passive:false});
  function finishPointer(e){
    if(resize&&(!e||e.pointerId===resize.id)){
      const r=radio.getBoundingClientRect();
      applyGeometry({left:r.left,top:r.top,width:r.width,height:r.height},true);
      resize=null;return;
    }
    if(!drag|| (e&&e.pointerId!==drag.id))return;
    if(drag.moved){suppressClickUntil=Date.now()+250;const r=radio.getBoundingClientRect();applyGeometry({left:r.left,top:r.top,width:r.width,height:r.height},true)}
    drag=null;head.style.cursor='grab';
  }
  window.addEventListener('pointerup',finishPointer);window.addEventListener('pointercancel',finishPointer);window.addEventListener('blur',()=>finishPointer());
  head.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){suppressClickUntil=0;e.preventDefault();e.stopImmediatePropagation()}},true);
  window.addEventListener('resize',()=>{const r=radio.getBoundingClientRect();applyGeometry({left:r.left,top:r.top,width:r.width,height:r.height},true)});
  status('Radio ready. Press PLAY to load the Green Dream playlist.');
})();