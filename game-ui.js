/* Shared in-world navigation shell and accessible world map. */
(() => {
  if (document.documentElement.dataset.gameUiReady === "true") return;
  document.documentElement.dataset.gameUiReady = "true";
  document.body.classList.add("vha-game-interface");

  const path = location.pathname.replace(/\/+$/, "") || "/";
  const pageMap = [
    ["/landing-page/secure-your-soul", "SECURE YOUR SOUL", "RESTRICTED PROGRAM"],
    ["/landing-page/human-archive", "HUMAN ARCHIVE", "PERSONAL RECORDS"],
    ["/landing-page/green-dream", "GREEN DREAM", "EXPLORATION ZONE"],
    ["/landing-page/posts/the-awakening", "THE AWAKENING", "MOVEMENT 01"],
    ["/landing-page/posts/the-descent", "THE DESCENT", "MOVEMENT 02"],
    ["/landing-page/posts/the-reconnection", "THE RECONNECTION", "MOVEMENT 03"],
    ["/landing-page/posts/the-transformation", "THE TRANSFORMATION", "MOVEMENT 04"],
    ["/landing-page/posts/the-return", "THE RETURN", "MOVEMENT 05"],
    ["/landing-page/posts", "TRANSMISSIONS", "SIGNAL ARCHIVE"],
    ["/landing-page/community", "THE CIRCLE", "COMMUNITY CHANNEL"],
    ["/landing-page/cv", "CV", "PERSONNEL FILE"],
    ["/landing-page/music", "V/A RADIO", "LISTENING ROOM"],
    ["/landing-page/cms", "CREATOR WORKSHOP", "PRIVATE ACCESS"]
  ];
  const current = pageMap.find(([prefix]) => path.startsWith(prefix)) || ["", "EGO", "PERSONAL NODE"];
  const routes = [
    ["EGO","PERSONAL NODE","/landing-page/","ego"],
    ["GREEN DREAM","EXPLORATION ZONE","/landing-page/green-dream/","garden"],
    ["TRANSMISSIONS","SIGNAL ARCHIVE","/landing-page/posts/","transmissions"],
    ["THE AWAKENING","MOVEMENT 01","/landing-page/posts/the-awakening/","awakening"],
    ["THE DESCENT","MOVEMENT 02","/landing-page/posts/the-descent/","descent"],
    ["THE RECONNECTION","MOVEMENT 03","/landing-page/posts/the-reconnection/","reconnection"],
    ["THE TRANSFORMATION","MOVEMENT 04","/landing-page/posts/the-transformation/","transformation"],
    ["THE RETURN","MOVEMENT 05","/landing-page/posts/the-return/","return"],
    ["HUMAN ARCHIVE","PERSONAL RECORDS","/landing-page/human-archive/","archive"],
    ["V/A RADIO","LISTENING ROOM","/landing-page/music.html","listening"],
    ["THE CIRCLE","COMMUNITY CHANNEL","/landing-page/community/","circle"],
    ["CV","PERSONNEL FILE","/landing-page/cv/","cv"],
    ["SECURE YOUR SOUL","RESTRICTED PROGRAM","/landing-page/secure-your-soul/","secure"]
  ];
  const cmsSessionKey="sb-oeyxsqocldlovhsmzcjw-auth-token";
  let hasSession=false;
  try{const session=JSON.parse(localStorage.getItem(cmsSessionKey)||"null");hasSession=Boolean(session&&session.access_token)}catch{}
  if(hasSession||path.startsWith("/landing-page/cms"))routes.push(["CREATOR WORKSHOP","PRIVATE ACCESS","/landing-page/cms/","cms"]);
  // Remove the page-level header entirely. The shared bottom navigation remains the sole global navigation.
  document.querySelectorAll("body header, .masthead, .mast, .ha-nav, .gd-nav, .toplinks, .vha-main-nav").forEach(el=>el.remove());
  document.querySelectorAll(".ego-bottom-hud").forEach(el=>el.remove());

  const bottom=document.createElement("div");
  bottom.className="ego-bottom-hud vha-universal-nav";
  bottom.setAttribute("role","navigation");
  bottom.setAttribute("aria-label","Main navigation");
  const mapButton=document.createElement("button");
  mapButton.type="button";mapButton.className="vha-map-toggle";
  mapButton.setAttribute("aria-expanded","true");mapButton.setAttribute("aria-controls","vha-world-map");
  mapButton.setAttribute('aria-label','Open world constellation');mapButton.title='Open world constellation';mapButton.innerHTML='<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 3 37 16 24 45 11 16 24 3Z"/><path d="M11 16h26M24 3v42M11 16l13 10 13-10"/></svg>';
  bottom.appendChild(mapButton);
  document.body.appendChild(bottom);
  const viewerTools=document.getElementById("vha-viewer-tools");
  if(viewerTools)viewerTools.insertBefore(bottom,viewerTools.querySelector(".vha-tools-side.vha-tools-right"));

  const map=document.createElement("div");
  map.className="vha-world-map";map.id="vha-world-map";map.hidden=true;
  const journeySteps = [
    ["/landing-page","HUMAN ARCHIVE","Begin with the traces that came before this place.","/landing-page/human-archive/"],
    ["/landing-page/human-archive","GREEN DREAM","Leave the memorial and return to the living world.","/landing-page/green-dream/"],
    ["/landing-page/green-dream","TRANSMISSIONS","Follow the signals left along the way.","/landing-page/posts/"],
    ["/landing-page/posts","THE AWAKENING","Enter the first movement of the journey.","/landing-page/posts/the-awakening/"],
    ["/landing-page/posts/the-awakening","THE DESCENT","Continue into the second movement.","/landing-page/posts/the-descent/"],
    ["/landing-page/posts/the-descent","THE RECONNECTION","Find the thread that leads back.","/landing-page/posts/the-reconnection/"],
    ["/landing-page/posts/the-reconnection","THE TRANSFORMATION","Move into what comes after reconnection.","/landing-page/posts/the-transformation/"],
    ["/landing-page/posts/the-transformation","THE RETURN","Follow the final movement home.","/landing-page/posts/the-return/"],
    ["/landing-page/posts/the-return","THE CIRCLE","The journey opens outward. Find the others.","/landing-page/community/"],
    ["/landing-page/community","SECURE YOUR SOUL","Enter the restricted layer beneath the surface.","/landing-page/secure-your-soul/"],
    ["/landing-page/secure-your-soul","PERSONNEL FILE","Return to the human behind the interface.","/landing-page/cv/"],
    ["/landing-page/cv","V/A RADIO","Stay a while. Let the signal play.","/landing-page/music.html"],
    ["/landing-page/music","THE SURFACE","Return to the point where the journey began.","/landing-page/"]
  ];
  const nextJourney = journeySteps.find(([route]) => path === route);
  const journeyMarkup = nextJourney
    ? '<div class="vha-journey-note" hidden><span>NEXT PART OF THE JOURNEY</span><strong>' + nextJourney[1] + '</strong><p>' + nextJourney[2] + '</p><a href="' + nextJourney[3] + '">CONTINUE THE JOURNEY ↗</a></div>'
    : '<div class="vha-journey-note" hidden><span>THE JOURNEY CONTINUES</span><strong>Choose the next trace.</strong><p>Follow a point in the constellation to continue exploring.</p></div>';
  map.innerHTML='<div class="vha-constellation-field" aria-label="Website constellation"><svg class="vha-constellation-lines" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true"><path class="vha-constellation-route" d=""/></svg><div class="vha-map-destinations"></div></div>' + journeyMarkup;
  document.body.appendChild(map);
  const destinationList=map.querySelector(".vha-map-destinations");
  const constellationField=map.querySelector(".vha-constellation-field");
  const constellationRoute=map.querySelector(".vha-constellation-route");
  const starPositions=[[50,13],[17,29],[37,43],[81,26],[65,55],[18,72],[50,86],[86,72],[32,17],[69,16],[91,46],[8,49],[50,58],[78,85]];
  const constellationPositionKey="vha-constellation-star-positions";
  let savedStarPositions={};
  try{savedStarPositions=JSON.parse(localStorage.getItem(constellationPositionKey)||"{}")||{}}catch{}
  function updateConstellationRoute(){
    const points=[...destinationList.querySelectorAll(".vha-map-node")].map(node=>{
      const x=parseFloat(node.style.getPropertyValue("--star-x"))*10;
      const y=parseFloat(node.style.getPropertyValue("--star-y"))*6.2;
      return Number.isFinite(x)&&Number.isFinite(y)?[x,y]:null;
    }).filter(Boolean);
    if(points.length)constellationRoute.setAttribute("d",points.map((point,index)=>(index?"L":"M")+point[0].toFixed(1)+" "+point[1].toFixed(1)).join(" "));
  }
  let activeStar=null;
  window.addEventListener("pointermove",event=>{
    const drag=activeStar;
    if(!drag||event.pointerId!==drag.pointerId)return;
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    if(!drag.moved&&Math.hypot(dx,dy)<5)return;
    drag.moved=true;
    const rect=constellationField.getBoundingClientRect();
    const x=Math.max(3,Math.min(97,((event.clientX-rect.left)/rect.width)*100));
    const y=Math.max(4,Math.min(96,((event.clientY-rect.top)/rect.height)*100));
    drag.node.style.setProperty("--star-x",x.toFixed(2)+"%");
    drag.node.style.setProperty("--star-y",y.toFixed(2)+"%");
    updateConstellationRoute();
    if(event.cancelable)event.preventDefault();
  },{passive:false});
  window.addEventListener("pointerup",finishConstellationDrag);
  window.addEventListener("pointercancel",finishConstellationDrag);
  function finishConstellationDrag(event){
    const drag=activeStar;
    if(!drag||(event&&event.pointerId!==drag.pointerId))return;
    activeStar=null;
    drag.node.classList.remove("is-dragging");
    if(drag.moved){
      drag.node.dataset.dragged="true";
      const x=parseFloat(drag.node.style.getPropertyValue("--star-x"));
      const y=parseFloat(drag.node.style.getPropertyValue("--star-y"));
      savedStarPositions[drag.key]={x,y};
      try{localStorage.setItem(constellationPositionKey,JSON.stringify(savedStarPositions))}catch{}
    }
  }
  routes.forEach(([name,descriptor,href,key],index)=>{
    const link=document.createElement("a");link.className="vha-map-node";link.dataset.node=key;link.href=href;
    const target=new URL(href,location.href).pathname.replace(/\/+$/,"")||"/";
    if(target===path){link.classList.add("is-current");link.setAttribute("aria-current","page")}
    const position=savedStarPositions[key]&&Number.isFinite(savedStarPositions[key].x)&&Number.isFinite(savedStarPositions[key].y)
      ?[Math.max(3,Math.min(97,savedStarPositions[key].x)),Math.max(4,Math.min(96,savedStarPositions[key].y))]
      :starPositions[index%starPositions.length];
    link.style.setProperty("--star-x",position[0]+"%");link.style.setProperty("--star-y",position[1]+"%");
    link.setAttribute("aria-label",name+" — "+descriptor);link.title=name;
    link.innerHTML=key==="ego"?'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 18 20 5l16 13M9 16v18h22V16M16 34V23h8v11"/></svg><span class="vha-star-tooltip" role="tooltip">'+name+'</span>':'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 1 24.8 14.2 39 15.2 28 24.1 31.5 38 20 30.4 8.5 38 12 24.1 1 15.2 15.2 14.2Z"/></svg><span class="vha-star-tooltip" role="tooltip">'+name+'</span>';
    destinationList.appendChild(link);

    // Drag by pointer position relative to the full-screen constellation field.
    // This avoids cumulative percentage drift and keeps movement aligned with the visible map.
    link.style.touchAction="none";
    link.addEventListener("pointerdown",event=>{
      if(event.button!==undefined&&event.button!==0)return;
      event.preventDefault();
      event.stopPropagation();
      activeStar={node:link,key,pointerId:event.pointerId,moved:false,startX:event.clientX,startY:event.clientY};
      link.setPointerCapture(event.pointerId);
      link.classList.add("is-dragging");
    });

    // Each ghost label breathes in, lingers briefly, then fades away.
    const tooltip=link.querySelector(".vha-star-tooltip");
    if(tooltip){
      tooltip.setAttribute("aria-label",name+" tooltip — drag to reposition");
      const reveal=()=>{tooltip.classList.add("is-hovered")};
      link.addEventListener("pointerenter",reveal);
      link.addEventListener("focusin",reveal);
    }
  });
  updateConstellationRoute();

  // V/A Radio is a shared site component, not a Green Dream-only element.
  if(!document.getElementById("gd-radio")){
    const radio=document.createElement("aside");
    radio.className="gd-radio";
    radio.id="gd-radio";
    radio.setAttribute("aria-label","Draggable radio player");
    radio.innerHTML='<div class="gd-radio-head" id="gd-drag"><span>◉ V/A RADIO <small>LIVE SIGNAL</small></span><button id="gd-close" aria-label="Minimize radio" aria-expanded="true">−</button></div><div class="gd-radio-body"><div class="gd-eq paused" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p class="gd-tiny">NOW TRANSMITTING</p><strong class="gd-track" id="gd-track">Green Dream Playlist</strong><small class="gd-artist" id="gd-artist">Choose a video to play</small><div class="gd-controls"><button id="gd-play" aria-label="Play radio">▶ PLAY</button></div><div class="gd-stations gd-video-picker"><label for="gd-video-select">PLAYLIST // SELECT A VIDEO</label><select id="gd-video-select" aria-label="Choose a video from the Green Dream playlist"><option value="">Loading playlist titles…</option></select></div><div class="gd-player" id="gd-player" hidden></div><small class="gd-note" id="gd-radio-note">Loading the video list from your YouTube playlist…</small></div>';
    document.body.appendChild(radio);
    const playerScript=document.createElement("script");
    playerScript.src="/landing-page/green-dream/script.js?v=20261103-radio-global-1";
    playerScript.async=false;
    document.body.appendChild(playerScript);
  }
  function setConstellationVisible(visible){
    document.body.classList.toggle("vha-crystal-open",visible);
    document.dispatchEvent(new CustomEvent("vha-crystal-mode-change",{detail:{open:visible}}));
    map.hidden=!visible;
    mapButton.setAttribute("aria-expanded",String(visible));
    mapButton.setAttribute("aria-label",visible?"Hide website constellation":"Show website constellation");
    mapButton.title=visible?"Hide website constellation":"Show website constellation";
  }
  const isHome=path==="/landing-page"||path==="/";
  let entryIntro=false;
  try{entryIntro=isHome&&sessionStorage.getItem("vha-entry-intro-seen")!=="true"}catch{entryIntro=isHome}
  const journeyNote=map.querySelector(".vha-journey-note");
  if(journeyNote){
    journeyNote.setAttribute("role","group");
    journeyNote.setAttribute("aria-label","Next part of the journey. Drag to reposition.");
    const positionKey="vha-journey-note-position";
    try{
      const saved=JSON.parse(localStorage.getItem(positionKey)||"null");
      if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){
        journeyNote.style.left=Math.max(8,Math.min(innerWidth-300,saved.x))+"px";
        journeyNote.style.top=Math.max(8,Math.min(innerHeight-journeyNote.offsetHeight-8,saved.y))+"px";
        journeyNote.style.transform="none";
      }
    }catch{}
    let dragging=false,moved=false,startX=0,startY=0,originX=0,originY=0;
    journeyNote.addEventListener("pointerdown",event=>{
      if(event.target.closest("a,button"))return;
      dragging=true;moved=false;startX=event.clientX;startY=event.clientY;
      const rect=journeyNote.getBoundingClientRect();originX=rect.left;originY=rect.top;
      journeyNote.style.left=originX+"px";journeyNote.style.top=originY+"px";journeyNote.style.transform="none";
      journeyNote.setPointerCapture(event.pointerId);
      journeyNote.classList.add("is-dragging");
    });
    journeyNote.addEventListener("pointermove",event=>{
      if(!dragging)return;
      const dx=event.clientX-startX,dy=event.clientY-startY;
      if(Math.abs(dx)+Math.abs(dy)>3)moved=true;
      if(!moved)return;
      journeyNote.style.left=Math.max(8,Math.min(innerWidth-journeyNote.offsetWidth-8,originX+dx))+"px";
      journeyNote.style.top=Math.max(8,Math.min(innerHeight-journeyNote.offsetHeight-8,originY+dy))+"px";
      journeyNote.style.transform="none";
    });
    const finishJourneyDrag=()=>{
      if(!dragging)return;
      dragging=false;journeyNote.classList.remove("is-dragging");
      if(moved){
        try{const rect=journeyNote.getBoundingClientRect();localStorage.setItem(positionKey,JSON.stringify({x:rect.left,y:rect.top}))}catch{}
      }
    };
    journeyNote.addEventListener("pointerup",finishJourneyDrag);
    journeyNote.addEventListener("pointercancel",finishJourneyDrag);
  }
  if(entryIntro){
    document.body.classList.add("vha-entry-intro");
    map.hidden=true;mapButton.setAttribute("aria-expanded","false");
    const prompt=document.createElement("div");prompt.id="vha-entry-prompt";
    prompt.innerHTML="<span>AN UNFINISHED RECORD</span><strong>Every journey begins with a single point.</strong><p>Touch the crystal to enter.</p>";
    document.body.appendChild(prompt);
    mapButton.setAttribute("aria-label","Enter the constellation");mapButton.title="Enter the constellation";
  }else{
    // The constellation and expanded viewer tools share one state: both begin docked.
    setConstellationVisible(false);
    journeyNote.hidden=true;
  }
  mapButton.addEventListener("click",()=>{
    if(document.body.classList.contains("vha-entry-intro")){
      document.body.classList.remove("vha-entry-intro");
      document.getElementById("vha-entry-prompt")?.remove();
      try{sessionStorage.setItem("vha-entry-intro-seen","true")}catch{}
      setConstellationVisible(true);
      journeyNote.hidden=false;
      return;
    }
    const toolsOpen=document.getElementById("vha-viewer-tools")?.dataset.open==="true";
    setConstellationVisible(toolsOpen);
    journeyNote.hidden=!toolsOpen;
  });
  document.addEventListener("vha-tools-state-change",event=>{
    const open=Boolean(event.detail?.open);
    if(document.body.classList.contains("vha-entry-intro")&&open){
      document.body.classList.remove("vha-entry-intro");
      document.getElementById("vha-entry-prompt")?.remove();
      try{sessionStorage.setItem("vha-entry-intro-seen","true")}catch{}
    }
    setConstellationVisible(open);
    journeyNote.hidden=!open;
  });
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&!map.hidden){
      setConstellationVisible(false);
      journeyNote.hidden=true;
      const tools=document.getElementById("vha-viewer-tools");
      if(tools){tools.dataset.open="false";tools.setAttribute("aria-expanded","false")}
    }
  });
  document.querySelectorAll("nav a[href]").forEach(link=>{
    try{const target=new URL(link.href,location.href);if(target.origin===location.origin&&(target.pathname.replace(/\/+$/,"")||"/")===path){link.classList.add("active");link.setAttribute("aria-current","page")}}catch{}
  });
  const main=document.querySelector("main,#main,.posts-main,.song-main,.cv-shell,.ha-main,.sy-main");
  if(main&&!main.querySelector(":scope > .game-page-tag")){
    const tag=document.createElement("div");tag.className="game-page-tag";tag.textContent=current[1]+" / "+current[2];main.insertBefore(tag,main.firstChild);
  }
  const footer=document.querySelector("footer,.gd-footer,.ha-footer");
  if(footer&&!footer.querySelector(".game-bottomline")){
    const line=document.createElement("div");line.className="game-bottomline";
    line.innerHTML="<span>V/A INTERFACE · BUILD 02</span><span>YOUR STORY REMAINS YOURS</span>";footer.appendChild(line);
  }

  // Replace the footer return link with a draggable, dismissible surface control.
  const returnLink=[...document.querySelectorAll("footer a")].find(a=>a.textContent.trim()==="RETURN TO THE SURFACE ↑");
  if(returnLink){
    returnLink.remove();
    const dock=document.createElement("div");
    dock.id="vha-surface-dock";
    dock.innerHTML='<a class="vha-surface-link" href="/landing-page/" aria-label="Return to the surface">RETURN TO THE SURFACE <span aria-hidden="true">↑</span></a><button class="vha-surface-hide" type="button" aria-label="Hide return button" title="Hide">×</button>';
    const restore=document.createElement("button");
    restore.id="vha-surface-restore";
    restore.type="button";
    restore.textContent="↑";
    restore.setAttribute("aria-label","Show return to the surface button");
    restore.title="Show return button";
    document.body.append(dock,restore);
    const saved=(()=>{try{return JSON.parse(localStorage.getItem("vha-surface-dock-position")||"null")}catch{return null}})();
    if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){
      dock.style.left=Math.max(8,Math.min(innerWidth-150,saved.x))+"px";
      dock.style.top=Math.max(8,Math.min(innerHeight-48,saved.y))+"px";
      dock.style.right="auto";dock.style.bottom="auto";
    }
    let hidden=false,dragging=false,moved=false,startX=0,startY=0,originX=0,originY=0;
    const hide=dock.querySelector(".vha-surface-hide");
    const link=dock.querySelector(".vha-surface-link");
    hide.addEventListener("click",()=>{hidden=true;dock.hidden=true;restore.hidden=false});
    restore.addEventListener("click",()=>{hidden=false;dock.hidden=false;restore.hidden=true});
    dock.addEventListener("pointerdown",event=>{
      if(event.target.closest("button"))return;
      dragging=true;moved=false;startX=event.clientX;startY=event.clientY;
      const rect=dock.getBoundingClientRect();originX=rect.left;originY=rect.top;
      dock.setPointerCapture(event.pointerId);
    });
    dock.addEventListener("pointermove",event=>{
      if(!dragging)return;
      const dx=event.clientX-startX,dy=event.clientY-startY;
      if(Math.abs(dx)+Math.abs(dy)>5)moved=true;
      if(!moved)return;
      dock.style.left=Math.max(8,Math.min(innerWidth-dock.offsetWidth-8,originX+dx))+"px";
      dock.style.top=Math.max(8,Math.min(innerHeight-dock.offsetHeight-8,originY+dy))+"px";
      dock.style.right="auto";dock.style.bottom="auto";
    });
    const stopDrag=()=>{
      if(!dragging)return;dragging=false;
      if(moved){try{const rect=dock.getBoundingClientRect();localStorage.setItem("vha-surface-dock-position",JSON.stringify({x:rect.left,y:rect.top}))}catch{}}
    };
    dock.addEventListener("pointerup",stopDrag);
    dock.addEventListener("pointercancel",stopDrag);
    link.addEventListener("click",event=>{if(moved){event.preventDefault();moved=false}});
    restore.hidden=true;
    const style=document.createElement("style");
    style.id="vha-surface-dock-style";
    style.textContent=`
      #vha-surface-dock{position:fixed;z-index:2147482998;right:18px;bottom:22px;display:flex;align-items:center;gap:5px;padding:5px 6px 5px 12px;border:1px solid rgba(185,215,122,.28);background:rgba(5,12,8,.82);box-shadow:0 5px 22px rgba(0,0,0,.28);backdrop-filter:blur(9px);touch-action:none;cursor:grab;user-select:none}
      #vha-surface-dock:active{cursor:grabbing}
      #vha-surface-dock[hidden],#vha-surface-restore[hidden]{display:none!important}
      #vha-surface-dock .vha-surface-link{color:rgba(220,235,207,.82);font:8px/1.3 ui-monospace,monospace;letter-spacing:.13em;text-decoration:none;white-space:nowrap}
      #vha-surface-dock .vha-surface-link span{color:#c8dca7;margin-left:4px}
      #vha-surface-dock .vha-surface-hide{width:19px;height:19px;padding:0;border:0;background:transparent;color:rgba(198,211,193,.52);font:15px/1 Arial;cursor:pointer}
      #vha-surface-dock .vha-surface-hide:hover{color:#e8f4df}
      #vha-surface-restore{position:fixed;right:12px;bottom:14px;z-index:2147482998;width:27px;height:27px;border:1px solid rgba(185,215,122,.3);background:rgba(5,12,8,.72);color:#c8dca7;font:13px ui-monospace,monospace;backdrop-filter:blur(8px);cursor:pointer}
      @media(max-width:600px){#vha-surface-dock{right:10px;bottom:12px}#vha-surface-dock .vha-surface-link{font-size:7px}}
    `;
    document.head.appendChild(style);
  }
})();