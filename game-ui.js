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
  map.innerHTML='<div class="vha-constellation-field" aria-label="Website constellation"><svg class="vha-constellation-lines" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true"><path d="M500 70 150 170 360 260 820 160 650 330 180 440 500 540 850 450 500 70M150 170 180 440 820 160 850 450M360 260 650 330 500 540"/></svg><div class="vha-map-destinations"></div></div><div class="vha-journey-note" hidden><span>YOUR FIRST STEP</span><strong>Begin with the Human Archive.</strong><p>Enter the living record — the words, memories and questions behind this place.</p><a href="/landing-page/human-archive/">ENTER THE HUMAN ARCHIVE ↗</a></div>';
  document.body.appendChild(map);
  const destinationList=map.querySelector(".vha-map-destinations");
  const starPositions=[[50,13],[17,29],[37,43],[81,26],[65,55],[18,72],[50,86],[86,72],[32,17],[69,16],[91,46],[8,49],[50,58],[78,85]];
  routes.forEach(([name,descriptor,href,key],index)=>{
    const link=document.createElement("a");link.className="vha-map-node";link.dataset.node=key;link.href=href;
    const target=new URL(href,location.href).pathname.replace(/\/+$/,"")||"/";
    if(target===path){link.classList.add("is-current");link.setAttribute("aria-current","page")}
    const position=starPositions[index%starPositions.length];link.style.setProperty("--star-x",position[0]+"%");link.style.setProperty("--star-y",position[1]+"%");
    link.setAttribute("aria-label",name+" — "+descriptor);link.title=name;
    link.innerHTML=key==="ego"?'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 18 20 5l16 13M9 16v18h22V16M16 34V23h8v11"/></svg><span class="vha-star-tooltip" role="tooltip">'+name+'</span>':'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 1 24.8 14.2 39 15.2 28 24.1 31.5 38 20 30.4 8.5 38 12 24.1 1 15.2 15.2 14.2Z"/></svg><span class="vha-star-tooltip" role="tooltip">'+name+'</span>';
    destinationList.appendChild(link);
  });

  function setConstellationVisible(visible){
    map.hidden=!visible;
    mapButton.setAttribute("aria-expanded",String(visible));
    mapButton.setAttribute("aria-label",visible?"Hide website constellation":"Show website constellation");
    mapButton.title=visible?"Hide website constellation":"Show website constellation";
  }
  const isHome=path==="/landing-page"||path==="/";
  let entryIntro=false;
  try{entryIntro=isHome&&sessionStorage.getItem("vha-entry-intro-seen")!=="true"}catch{entryIntro=isHome}
  const journeyNote=map.querySelector(".vha-journey-note");
  if(entryIntro){
    document.body.classList.add("vha-entry-intro");
    map.hidden=true;mapButton.setAttribute("aria-expanded","false");
    const prompt=document.createElement("div");prompt.id="vha-entry-prompt";
    prompt.innerHTML="<span>AN UNFINISHED RECORD</span><strong>Every journey begins with a single point.</strong><p>Touch the crystal to enter.</p>";
    document.body.appendChild(prompt);
    mapButton.setAttribute("aria-label","Enter the constellation");mapButton.title="Enter the constellation";
  }else{
    setConstellationVisible(true);
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
    setConstellationVisible(map.hidden);
    journeyNote.hidden=map.hidden;
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!map.hidden)setConstellationVisible(false)});
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