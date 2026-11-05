/* V/A Radio — complete shared player, YouTube playlist engine, drag/resize and controls. */
(() => {
  if (!document.getElementById("gd-radio")) {
    const radio = document.createElement("aside");
    radio.className = "gd-radio";
    radio.id = "gd-radio";
    radio.setAttribute("aria-label", "Draggable radio player");
    radio.innerHTML = '<div class="gd-radio-head" id="gd-drag"><span>◉ V/A RADIO <small>LIVE SIGNAL</small></span><button id="gd-close" aria-label="Minimize radio" aria-expanded="true">−</button></div><div class="gd-radio-body"><div class="gd-eq paused" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p class="gd-tiny">NOW TRANSMITTING</p><strong class="gd-track" id="gd-track">Green Dream Playlist</strong><small class="gd-artist" id="gd-artist">Choose a video to play</small><div class="gd-controls"><button id="gd-play" aria-label="Play radio">▶ PLAY</button></div><div class="gd-stations gd-video-picker"><label for="gd-video-select">PLAYLIST // SELECT A VIDEO</label><select id="gd-video-select" aria-label="Choose a video from the Green Dream playlist"><option value="">Loading playlist titles…</option></select></div><div class="gd-player" id="gd-player" hidden></div><small class="gd-note" id="gd-radio-note">Loading the video list from your YouTube playlist…</small></div>';
    document.body.appendChild(radio);
  }

(() => {
  const root=document;
  const playlistId='PL-HvxCN6LbEtKhlSDDndY8mdupqTbTlgn';
  const radio=root.querySelector('#gd-radio'),head=root.querySelector('#gd-drag'),track=root.querySelector('#gd-track'),artist=root.querySelector('#gd-artist'),play=root.querySelector('#gd-play'),eq=root.querySelector('.gd-eq'),host=root.querySelector('#gd-player'),note=root.querySelector('#gd-radio-note'),select=root.querySelector('#gd-video-select');
  const close=radio?.querySelector('#gd-close');
  if(!radio||!head||!track||!artist||!play||!eq||!host||!note||!select)return;
  radio.style.setProperty('--acid','#00eaf5');
  const radioTheme=document.createElement("style");
  radioTheme.id="vha-radio-theme";
  radioTheme.textContent=`
    #gd-radio{--radio-cyan:#00eaf5;--radio-yellow:#e9ed00;box-sizing:border-box!important;color:#dce9e9!important;background:linear-gradient(155deg,rgba(5,25,32,.98),rgba(2,12,17,.98))!important;border:1px solid rgba(0,234,245,.68)!important;border-radius:3px!important;box-shadow:0 16px 52px rgba(0,0,0,.58),0 0 26px rgba(0,234,245,.1)!important;backdrop-filter:blur(18px)!important;clip-path:none!important;font-family:ui-monospace,Consolas,monospace!important}
    #gd-radio .gd-radio-head{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:11px 13px!important;border-bottom:1px solid rgba(0,234,245,.25)!important;background:linear-gradient(90deg,rgba(0,234,245,.07),transparent)!important;color:#e9ed00!important;font:700 10px/1.3 ui-monospace,Consolas,monospace!important;letter-spacing:1.3px!important}
    #gd-radio .gd-radio-head small{display:block!important;margin-top:3px!important;color:#00eaf5!important;font-size:7px!important;letter-spacing:1.6px!important}
    #gd-radio .gd-radio-head button{width:25px!important;height:25px!important;padding:0!important;border:1px solid rgba(0,234,245,.38)!important;background:rgba(0,234,245,.05)!important;color:#00eaf5!important;font:17px/1 ui-monospace,monospace!important}
    #gd-radio .gd-radio-body{padding:13px!important}
    #gd-radio .gd-eq i{background:#00eaf5!important;box-shadow:0 0 9px rgba(0,234,245,.35)!important}
    #gd-radio .gd-tiny,#gd-radio .gd-video-picker label{color:#00eaf5!important;font:8px/1.5 ui-monospace,Consolas,monospace!important;letter-spacing:1.4px!important}
    #gd-radio .gd-track{display:block!important;color:#eaf5f6!important;font:600 13px/1.45 Arial,Helvetica,sans-serif!important;overflow-wrap:anywhere!important}
    #gd-radio .gd-artist,#gd-radio .gd-note{color:#91aeb4!important;font:8px/1.55 ui-monospace,Consolas,monospace!important}
    #gd-radio .gd-controls button{min-height:32px!important;border:1px solid #00eaf5!important;background:rgba(0,234,245,.09)!important;color:#00eaf5!important;font:700 9px ui-monospace,Consolas,monospace!important;letter-spacing:1px!important}
    #gd-radio .gd-controls button:first-child{background:#00eaf5!important;color:#031116!important}
    #gd-radio .gd-video-picker{display:grid!important;grid-template-columns:1fr!important;gap:6px!important;margin:12px 0!important;padding-top:10px!important;border-top:1px solid rgba(0,234,245,.22)!important}
    #gd-radio #gd-video-select{width:100%!important;min-width:0!important;max-width:100%!important;min-height:34px!important;padding:7px 9px!important;border:1px solid rgba(0,234,245,.42)!important;border-radius:0!important;background:#031116!important;color:#dce9e9!important;font:9px/1.45 ui-monospace,Consolas,monospace!important}
    #gd-radio #gd-video-select option{background:#031116!important;color:#dce9e9!important}
    #gd-radio .gd-note{display:block!important;margin-top:8px!important}
    #gd-radio .gd-radio-resize:after{background:#00eaf5!important;box-shadow:0 0 6px rgba(0,234,245,.45)!important}
    @media(max-width:640px){#gd-radio .gd-radio-body{padding:10px!important}#gd-radio .gd-radio-head{padding:9px 10px!important}}
  `;
  if(!document.getElementById("vha-radio-theme"))document.head.appendChild(radioTheme);
  const hiddenStyle=document.createElement('style');
  hiddenStyle.textContent='#gd-radio.radio-hidden{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}#gd-radio.vha-radio-floating{box-sizing:border-box!important}#gd-radio.vha-radio-floating .gd-radio-body{max-height:calc(64vh - 48px)!important;overflow:auto!important}';
  document.head.appendChild(hiddenStyle);
  if(radio.parentElement!==document.body)document.body.appendChild(radio);

  const playerTarget=document.createElement("div");
  playerTarget.id="gd-radio-player-frame";
  host.replaceChildren(playerTarget);
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
    if(!player)return false;
    const ids=player.getPlaylist?.()||[];
    if(!ids.length)return false;
    const previous=select.value;
    playlistIds=ids;
    const frag=document.createDocumentFragment();
    ids.forEach((id,index)=>{
      const option=document.createElement('option');
      option.value=String(index);
      option.textContent=String(index+1).padStart(2,'0')+' — Loading title…';
      option.dataset.videoId=id;
      frag.appendChild(option);
    });
    select.replaceChildren(frag);
    const current=player.getPlaylistIndex?.();
    if(Number.isInteger(current)&&current>=0&&current<ids.length)select.value=String(current);
    else if(previous&&Number(previous)<ids.length)select.value=previous;
    status('Loading '+ids.length+' playlist titles…');
    updateCurrent();
    hydratePlaylistTitles(ids);
    return true;
  }
  async function hydratePlaylistTitles(ids){
    let cache={};
    try{cache=JSON.parse(localStorage.getItem('vha-youtube-title-cache-v1')||'{}')||{}}catch{}
    let cursor=0;
    const workers=Array.from({length:Math.min(4,ids.length)},async()=>{
      while(cursor<ids.length){
        const index=cursor++,id=ids[index];
        let title=cache[id];
        if(!title){
          try{
            const url='https://www.youtube.com/watch?v='+encodeURIComponent(id);
            const response=await fetch('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(url),{credentials:'omit'});
            if(!response.ok)throw new Error('Title unavailable');
            const data=await response.json();
            title=String(data.title||'').trim();
            if(title)cache[id]=title;
          }catch{}
        }
        const option=select.options[index];
        if(option&&option.dataset.videoId===id)option.textContent=String(index+1).padStart(2,'0')+' — '+(title||'Video '+String(index+1).padStart(2,'0'));
      }
    });
    await Promise.all(workers);
    try{localStorage.setItem('vha-youtube-title-cache-v1',JSON.stringify(cache))}catch{}
    status(ids.length+' playlist tracks ready. Select a song to play it.');
    updateCurrent();
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
  let playerPromise=null;
  function showPlayer(show){
    host.hidden=false;
    if(show){
      host.style.position='relative';host.style.left='auto';host.style.width='100%';host.style.height='126px';host.style.opacity='1';host.style.pointerEvents='auto';host.style.overflow='visible';
      player?.setSize?.(host.clientWidth||280,126);
    }else{
      host.style.position='absolute';host.style.left='-10000px';host.style.width='1px';host.style.height='1px';host.style.opacity='0';host.style.pointerEvents='none';host.style.overflow='hidden';
    }
  }
  async function start(playNow=true){
    if(player){
      if(playNow){showPlayer(true);player.playVideo();setPlaying(true);status('Playing selected Green Dream track.')}
      else{populatePlaylist();showPlayer(false)}
      return;
    }
    if(playerPromise){
      try{await playerPromise;if(playNow){showPlayer(true);player?.playVideo();setPlaying(true)}}catch{}
      return;
    }
    track.textContent='Connecting to Green Dream…';
    artist.textContent='Loading playlist';
    if(playNow)showPlayer(true);else showPlayer(false);
    play.disabled=true;
    status('Connecting to the playlist…');
    playerPromise=(async()=>{
      const YT=await loadApi();
      await new Promise((resolve,reject)=>{
        player=new YT.Player(playerTarget,{
          width:'1',height:'1',
          playerVars:{listType:'playlist',list:playlistId,autoplay:0,playsinline:1,rel:0,enablejsapi:1,origin:location.origin},
          events:{
            onReady:event=>{
              setPlaying(false);
              let attempts=0;
              const sync=()=>{
                if(populatePlaylist()){resolve();return}
                if(++attempts<24)setTimeout(sync,500);
                else{status('YouTube connected, but the playlist did not return its track list.');resolve()}
              };
              sync();
            },
            onStateChange:event=>{
              if(event.data===1){setPlaying(true);updateCurrent()}
              if(event.data===2||event.data===0)setPlaying(false);
              if(event.data===5)updateCurrent();
            },
            onError:event=>{
              setPlaying(false);
              status('YouTube player error ('+event.data+'). This item may be unavailable or blocked from embedding.');
              reject(new Error('YouTube player error '+event.data));
            }
          }
        });
      });
    })();
    try{
      await playerPromise;
      if(playNow){showPlayer(true);player?.playVideo();setPlaying(true)}
      else{showPlayer(false);setPlaying(false);status('Playlist ready. Choose a song from the dropdown.')}
    }catch(error){
      status(error?.message||'Could not connect to YouTube.');
      setPlaying(false);
    }finally{play.disabled=false}
  }
  play.addEventListener('click',()=>{
    if(playing){player?.pauseVideo();setPlaying(false);status('Playback paused.')}
    else start();
  });
  select.addEventListener('focus',()=>{if(!player&&!playerPromise)start(false)});
  select.addEventListener('pointerdown',()=>{if(!player&&!playerPromise)start(false)});
  select.addEventListener('change',()=>{
    const index=Number(select.value);
    if(!Number.isInteger(index)||index<0||index>=playlistIds.length)return;
    if(player){showPlayer(true);player.playVideoAt(index);setPlaying(true);status('Loading selected playlist track…')}
  });
  function setRadioHidden(hidden){
    radio.classList.toggle('radio-hidden',hidden);
    radio.setAttribute('aria-hidden',String(hidden));
    radio.hidden=hidden;
    radio.style.setProperty('display',hidden?'none':'block','important');
    radio.style.setProperty('visibility',hidden?'hidden':'visible','important');
    radio.style.setProperty('pointer-events',hidden?'none':'auto','important');
    const toolButton=document.querySelector('#vha-viewer-tools [data-tool="radio"]');
    if(toolButton)toolButton.setAttribute('aria-pressed',String(!hidden));
    if(close){
      close.textContent=hidden?'+':'−';
      close.setAttribute('aria-expanded',String(!hidden));
      close.setAttribute('aria-label',hidden?'Open V/A Radio':'Close V/A Radio');
    }
  }

  // The player is a floating Crystal panel, not a draggable page widget.
  radio.classList.add('vha-radio-floating');
  radio.style.setProperty('position','fixed','important');
  radio.style.setProperty('left','50%','important');
  radio.style.setProperty('right','auto','important');
  radio.style.setProperty('top','auto','important');
  radio.style.setProperty('bottom','calc(14px + 58px + 18px)','important');
  radio.style.setProperty('transform','translateX(-50%)','important');
  radio.style.setProperty('width','min(360px, calc(100vw - 24px))','important');
  radio.style.setProperty('max-width','calc(100vw - 24px)','important');
  radio.style.setProperty('max-height','min(64vh, 620px)','important');
  radio.style.setProperty('overflow-y','auto','important');
  radio.style.setProperty('overscroll-behavior','contain','important');
  radio.style.setProperty('z-index','2147483647','important');
  radio.style.setProperty('margin','0','important');

  close?.addEventListener('click',()=>setRadioHidden(true));
  window.addEventListener('vha-radio-toggle',()=>{
    setRadioHidden(!radio.classList.contains('radio-hidden'));
  });
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href="#gd-radio"],a[href="/landing-page/#gd-radio"]');
    if(link)setRadioHidden(false);
  });
  window.addEventListener('hashchange',()=>{if(location.hash==="#gd-radio")setRadioHidden(false)});
  setRadioHidden(true);
  if(location.hash==="#gd-radio")setRadioHidden(false);

  status('Preparing the Green Dream playlist…');
  start(false);
})();
  window.VHACrystal?.registerTool({
    id: "radio",
    label: "V/A RADIO",
    description: "Show or minimise the shared listening player.",
    presentation: "dock",
    run: () => window.dispatchEvent(new Event("vha-radio-toggle"))
  });

})();
