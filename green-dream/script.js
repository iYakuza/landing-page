(() => {
  const root=document.querySelector('.gd'); if(!root)return;
  const playlistId='PL-HvxCN6LbEtKhlSDDndY8mdupqTbTlgn';
  const radio=root.querySelector('#gd-radio'),head=root.querySelector('#gd-drag'),track=root.querySelector('#gd-track'),artist=root.querySelector('#gd-artist'),play=root.querySelector('#gd-play'),eq=root.querySelector('.gd-eq'),host=root.querySelector('#gd-player'),note=root.querySelector('#gd-radio-note');
  const close=radio?.querySelector('#gd-close');
  if(!radio||!head||!track||!artist||!play||!eq||!host||!note)return;
  radio.style.setProperty('--acid','#d8ff3e');
  if(radio.parentElement!==document.body)document.body.appendChild(radio);

  let playing=false;
  const status=s=>{note.textContent=s};
  function stop(){
    host.replaceChildren();
    host.hidden=true;
    playing=false;
    play.textContent='▶ PLAY';
    play.setAttribute('aria-label','Play radio');
    eq.classList.add('paused');
  }
  function start(){
    // Create the YouTube embed directly inside the user's click gesture.
    // No iframe API, hidden probe player, playlist scraping or oEmbed calls.
    const frame=document.createElement('iframe');
    frame.title='Green Dream music playlist';
    frame.width='100%';
    frame.height='180';
    frame.loading='eager';
    frame.allow='autoplay; encrypted-media; picture-in-picture; web-share';
    frame.allowFullscreen=true;
    frame.referrerPolicy='strict-origin-when-cross-origin';
    frame.src='https://www.youtube-nocookie.com/embed/videoseries?list='+encodeURIComponent(playlistId)+'&autoplay=1&playsinline=1&rel=0';
    host.replaceChildren(frame);
    host.hidden=false;
    playing=true;
    track.textContent='Green Dream Playlist';
    artist.textContent='Verse After Hours // YouTube';
    play.textContent='■ STOP';
    play.setAttribute('aria-label','Stop radio');
    eq.classList.remove('paused');
    status('Opening the Green Dream playlist. Use the YouTube controls to choose a track.');
  }
  play.addEventListener('click',()=>{if(playing){stop();status('Playback stopped.')}else start()});
  close?.addEventListener('click',e=>{
    const m=radio.classList.toggle('minimized');
    e.currentTarget.textContent=m?'+':'−';
    e.currentTarget.setAttribute('aria-expanded',String(!m));
    e.currentTarget.setAttribute('aria-label',m?'Expand radio':'Minimize radio');
  });

  // Keep the radio draggable and remember its position.
  const positionKey='vha-green-dream-radio-position-v2';
  let drag=null,suppressClickUntil=0;
  head.style.touchAction='none';head.style.userSelect='none';head.style.cursor='grab';
  radio.style.setProperty('position','fixed','important');
  radio.style.setProperty('right','auto','important');radio.style.setProperty('bottom','auto','important');
  radio.style.setProperty('transform','none','important');radio.style.setProperty('width','min(224px, calc(100vw - 16px))','important');
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
  status('Radio ready. Press PLAY to open the Green Dream playlist.');
})();