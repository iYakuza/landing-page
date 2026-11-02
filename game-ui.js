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
  mapButton.setAttribute("aria-expanded","false");mapButton.setAttribute("aria-controls","vha-world-map");
  mapButton.innerHTML='<span aria-hidden="true">⌖</span><span>MAP</span>';
  bottom.appendChild(mapButton);
  document.body.appendChild(bottom);

  const map=document.createElement("div");
  map.className="vha-world-map";map.id="vha-world-map";map.hidden=true;
  map.innerHTML='<section class="vha-world-map-panel" role="dialog" aria-modal="true" aria-labelledby="vha-map-title"><header class="vha-world-map-head"><div><p class="vha-world-map-kicker">GREEN DREAM / WORLD INDEX</p><h2 id="vha-map-title">Choose your destination.</h2></div><button class="vha-world-map-close" type="button" aria-label="Close world map">×</button></header><div class="vha-world-map-orbit" aria-label="Website destinations"><div class="vha-map-core"><span>⌖</span><strong>MAP</strong><small>WORLD INDEX</small></div><div class="vha-map-destinations"></div></div><div class="vha-world-map-foot"><span>ALL PATHS REMAIN OPEN</span><span>SELECT A DESTINATION</span></div></section>';
  document.body.appendChild(map);
  const destinationList=map.querySelector(".vha-map-destinations");
  routes.forEach(([name,descriptor,href,key])=>{
    const link=document.createElement("a");link.className="vha-map-node";link.dataset.node=key;link.href=href;
    const target=new URL(href,location.href).pathname.replace(/\/+$/,"")||"/";
    if(target===path){link.classList.add("is-current");link.setAttribute("aria-current","page")}
    link.innerHTML='<strong>'+name+'</strong><small>'+descriptor+'</small>';
    destinationList.appendChild(link);
  });

  const close=map.querySelector(".vha-world-map-close");
  let mapReturnFocus=null,previousBodyOverflow="";
  function openMap(){
    mapReturnFocus=document.activeElement;
    previousBodyOverflow=document.body.style.overflow;
    map.hidden=false;mapButton.setAttribute("aria-expanded","true");
    document.body.style.overflow="hidden";close.focus();
  }
  function closeMap(){
    map.hidden=true;mapButton.setAttribute("aria-expanded","false");
    document.body.style.overflow=previousBodyOverflow;
    if(mapReturnFocus&&typeof mapReturnFocus.focus==="function")mapReturnFocus.focus();
    else mapButton.focus();
    mapReturnFocus=null;
  }
  mapButton.addEventListener("click",openMap);
  close.addEventListener("click",closeMap);
  map.addEventListener("click",e=>{if(e.target===map)closeMap()});
  document.addEventListener("keydown",e=>{
    if(map.hidden)return;
    if(e.key==="Escape"){e.preventDefault();closeMap();return}
    if(e.key!=="Tab")return;
    const focusable=[...map.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length);
    if(!focusable.length){e.preventDefault();close.focus();return}
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
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
})();