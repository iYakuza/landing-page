/* Shared in-world navigation shell and accessible world map. */
(() => {
  if (document.documentElement.dataset.gameUiReady === "true") return;
  document.documentElement.dataset.gameUiReady = "true";
  document.body.classList.add("vha-game-interface");

  const path = location.pathname.replace(/\\/+$/, "") || "/";
  const pageMap = [
    ["/secure-your-soul", "CONTINUITY INSTITUTE", "RESTRICTED PROGRAM"],
    ["/human-archive", "HUMAN ARCHIVE", "PERSONAL RECORDS"],
    ["/green-dream", "GREEN DREAM", "EXPLORATION ZONE"],
    ["/posts", "TRANSMISSIONS", "SIGNAL ARCHIVE"],
    ["/community", "THE CIRCLE", "COMMUNITY CHANNEL"],
    ["/cv", "PERSONNEL FILE", "IDENTITY SHARD"],
    ["/music", "LISTENING ROOM", "AUDIO CHANNEL"],
    ["/cms", "CREATOR WORKSHOP", "PRIVATE ACCESS"]
  ];
  const current = pageMap.find(([prefix]) => path.startsWith(prefix)) || ["", "EGO", "PERSONAL NODE"];
  const status = document.createElement("div");
  status.className = "vha-game-status";
  status.setAttribute("role", "region");
  status.setAttribute("aria-label", "World navigation and system status");
  const left = document.createElement("div");
  left.className = "status-left";
  left.innerHTML = '<span class="status-dot" aria-hidden="true"></span><span>NETWORK <b class="status-accent">ONLINE</b></span><span aria-hidden="true">/</span><span></span>';
  left.lastElementChild.textContent = current[1];
  const hud = document.createElement("div");
  hud.className = "vha-game-hud";
  const links = document.createElement("nav");
  links.className = "vha-game-hud-links";
  links.setAttribute("aria-label", "World map shortcuts");
  const routes = [
    ["EGO","/landing-page/"],["GARDEN","/landing-page/green-dream/"],
    ["ARCHIVE","/landing-page/human-archive/"],["SIGNALS","/landing-page/posts/"],
    ["LISTEN","/landing-page/music.html"],["CIRCLE","/landing-page/community/"]
  ];
  routes.forEach(([label,href]) => {
    const a=document.createElement("a");a.href=href;a.textContent=label;
    const target=new URL(href,location.href).pathname.replace(/\\/+$/,"")||"/";
    if(target===path){a.setAttribute("aria-current","page");a.classList.add("is-current")}
    links.appendChild(a);
  });
  const mapButton=document.createElement("button");
  mapButton.type="button";mapButton.className="vha-map-toggle";mapButton.setAttribute("aria-expanded","false");
  mapButton.setAttribute("aria-controls","vha-world-map");
  mapButton.innerHTML='<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2 5.2 7 3l6 2 5-2v11.8l-5 2-6-2-5 2V5.2Z" stroke="currentColor" stroke-width="1.2"/><path d="M7 3v11m6-9v11" stroke="currentColor" stroke-width="1.2"/></svg><span>MAP</span>';
  hud.append(links,mapButton);
  status.append(left,hud);
  const header=document.querySelector("header,.masthead,.ha-nav");
  if(header&&header.parentNode)header.parentNode.insertBefore(status,header);
  else document.body.insertBefore(status,document.body.firstChild);

  const map=document.createElement("div");
  map.className="vha-world-map";map.id="vha-world-map";map.hidden=true;
  map.innerHTML='<section class="vha-world-map-panel" role="dialog" aria-modal="true" aria-labelledby="vha-map-title"><header class="vha-world-map-head"><div><p class="vha-world-map-kicker">SECURE YOUR SOUL / WORLD INDEX</p><h2 id="vha-map-title">Choose where to go.</h2><p>Every route remains open. No path is a permission.</p></div><button class="vha-world-map-close" type="button" aria-label="Close world map">×</button></header><div class="vha-world-map-plot" aria-label="Interactive map of the website sections"><svg class="vha-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50 49 22 30M50 49 78 28M50 49 22 76M50 49 78 75M50 49 50 90"/></svg><a class="vha-map-node" data-node="ego" href="/landing-page/"><span class="node-symbol">◉</span><strong>EGO</strong><small>PERSONAL NODE</small></a><a class="vha-map-node" data-node="garden" href="/landing-page/green-dream/"><span class="node-symbol">✳</span><strong>THE GARDEN</strong><small>EXPLORATION</small></a><a class="vha-map-node" data-node="archive" href="/landing-page/human-archive/"><span class="node-symbol">▤</span><strong>THE ARCHIVE</strong><small>RECORDS</small></a><a class="vha-map-node" data-node="transmissions" href="/landing-page/posts/"><span class="node-symbol">⌁</span><strong>SIGNALS</strong><small>TRANSMISSIONS</small></a><a class="vha-map-node" data-node="listening" href="/landing-page/music.html"><span class="node-symbol">♫</span><strong>LISTENING</strong><small>AUDIO ROOM</small></a><a class="vha-map-node" data-node="circle" href="/landing-page/community/"><span class="node-symbol">◎</span><strong>THE CIRCLE</strong><small>COMMUNITY</small></a></div><div class="vha-world-map-foot"><span><b>INDEX 06</b> / PUBLIC DESTINATIONS</span><span>SELECT A NODE TO TRAVEL</span></div></section>';
  document.body.appendChild(map);
  const close=map.querySelector(".vha-world-map-close");
  function openMap(){map.hidden=false;mapButton.setAttribute("aria-expanded","true");document.body.style.overflow="hidden";close.focus()}
  function closeMap(){map.hidden=true;mapButton.setAttribute("aria-expanded","false");document.body.style.overflow="";mapButton.focus()}
  mapButton.addEventListener("click",openMap);
  close.addEventListener("click",closeMap);
  map.addEventListener("click",e=>{if(e.target===map)closeMap()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!map.hidden)closeMap()});

  document.querySelectorAll("nav a[href]").forEach(link=>{
    try{const target=new URL(link.href,location.href);if(target.origin===location.origin&&(target.pathname.replace(/\\/+$/,"")||"/")===path){link.classList.add("active");link.setAttribute("aria-current","page")}}catch{}
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