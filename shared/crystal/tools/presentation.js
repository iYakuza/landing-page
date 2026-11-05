/* Presentation — in-page editorial reader and post reading mode.
   This is not a browser fullscreen control. */
(() => {
  // Fullscreen post reader: permalink views use the actual transmission, not the editorial chapter deck.
  const postReaderStyle=document.createElement("style");
  postReaderStyle.id="vha-post-reader-style";
  postReaderStyle.textContent=`
    body.vha-post-fullscreen{overflow:hidden!important;background:#050906!important}
    body.vha-post-fullscreen .gd-nav,body.vha-post-fullscreen .gd-footer,
    body.vha-post-fullscreen .posts-hero,body.vha-post-fullscreen .posts-heading,
    body.vha-post-fullscreen .movement-index,body.vha-post-fullscreen .posts-filters,
    body.vha-post-fullscreen #posts-load-more,body.vha-post-fullscreen #posts-empty-search,
    body.vha-post-fullscreen .posts-note,body.vha-post-fullscreen .post-back,
    body.vha-post-fullscreen .post-edit-button{display:none!important}
    body.vha-post-fullscreen .posts-main,body.vha-post-fullscreen .posts-content,
    body.vha-post-fullscreen #posts-list{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;background:#050906!important}
    body.vha-post-fullscreen #posts-list>.post-card{position:fixed!important;inset:0!important;z-index:2147482990!important;display:block!important;overflow-y:auto!important;overscroll-behavior:contain!important;width:100vw!important;height:100dvh!important;max-width:none!important;margin:0!important;padding:clamp(72px,9vh,112px) clamp(22px,9vw,150px) 90px!important;border:0!important;border-radius:0!important;background:radial-gradient(ellipse at 80% 0%,#17251a 0%,#080d09 48%,#050906 100%)!important;color:#e8f4df!important;box-shadow:none!important}
    body.vha-post-fullscreen .post-card h3{max-width:1100px!important;margin:0 0 28px!important;font-size:clamp(36px,6vw,82px)!important;line-height:1.02!important;letter-spacing:-.045em!important;color:#f0f2e8!important}
    body.vha-post-fullscreen .post-card .post-card-top{display:flex!important;gap:14px!important;margin:0 0 24px!important;color:#aab9a5!important;font:10px/1.5 ui-monospace,monospace!important;letter-spacing:.12em!important;text-transform:uppercase}
    body.vha-post-fullscreen .post-card .post-detail-grid{display:grid!important;grid-template-columns:minmax(0,1.5fr) minmax(220px,.7fr)!important;gap:clamp(24px,5vw,72px)!important;max-width:1250px!important}
    body.vha-post-fullscreen .post-card .post-detail-grid.text-only{display:block!important}
    body.vha-post-fullscreen .post-card .post-detail-copy,body.vha-post-fullscreen .post-card .post-body{max-width:820px!important;color:#d7ded2!important;font-size:clamp(16px,1.5vw,21px)!important;line-height:1.85!important}
    body.vha-post-fullscreen .post-card .post-detail-copy p,body.vha-post-fullscreen .post-card .post-body p{margin:0 0 1.35em!important}
    body.vha-post-fullscreen .post-card .post-detail-copy h2,body.vha-post-fullscreen .post-card .post-body h2{margin:1.8em 0 .65em!important;font-size:clamp(24px,3vw,42px)!important;line-height:1.15!important;color:#e8f4df!important}
    body.vha-post-fullscreen .post-card .post-detail-copy h3,body.vha-post-fullscreen .post-card .post-body h3{font-size:clamp(20px,2.4vw,32px)!important;color:#e8f4df!important}
    body.vha-post-fullscreen .post-card blockquote{margin:2em 0!important;padding:8px 0 8px 22px!important;border-left:2px solid #d8ff3e!important;color:#d8ffb2!important}
    body.vha-post-fullscreen .post-card a{color:#d8ff3e!important}
    body.vha-post-fullscreen .post-card .post-detail-media img,body.vha-post-fullscreen .post-card .post-media img{max-width:100%!important;height:auto!important}
    body.vha-post-fullscreen .post-card video,body.vha-post-fullscreen .post-card audio{max-width:100%!important}
    #vha-post-reader-close{position:fixed;z-index:2147483009;top:18px;right:22px;display:none;align-items:center;gap:9px;padding:10px 13px;border:1px solid #d8ff3e;background:#080e09;color:#d8ff3e;font:10px/1.2 ui-monospace,monospace;letter-spacing:.1em;cursor:pointer}
    body.vha-post-fullscreen #vha-post-reader-close{display:flex}
    #vha-post-reader-close:hover,#vha-post-reader-close:focus-visible{background:#d8ff3e;color:#050906;outline:2px solid #d8ff3e;outline-offset:3px}
    body.vha-post-fullscreen #vha-viewer-tools{z-index:2147483010}
    @media(max-width:700px){body.vha-post-fullscreen #posts-list>.post-card{padding:76px 22px 90px!important}body.vha-post-fullscreen .post-card .post-detail-grid{grid-template-columns:1fr!important}#vha-post-reader-close{top:10px;right:10px}}
  `;
  document.head.appendChild(postReaderStyle);
  const postReaderClose=document.createElement("button");
  postReaderClose.id="vha-post-reader-close";postReaderClose.type="button";
  postReaderClose.innerHTML="&#8592; BACK TO ARCHIVE";
  postReaderClose.setAttribute("aria-label","Exit fullscreen transmission and return to archive");
  document.body.appendChild(postReaderClose);
  function hasPostPermalink(){return Boolean(new URLSearchParams(location.search).get("post"))}
  function startPostReader(){
    const article=document.querySelector("#posts-list > .post-card");
    if(!hasPostPermalink()||!article)return false;
    document.body.classList.add("vha-post-fullscreen");
    document.body.classList.remove("vha-presentation-active");
    const manuscript=document.getElementById("vha-manuscript");
    if(manuscript)manuscript.setAttribute("aria-hidden","true");
    return true;
  }
  function stopPostReader(){
    document.body.classList.remove("vha-post-fullscreen");
    if(hasPostPermalink())document.querySelector("#posts-list > .post-card")?.scrollIntoView({block:"start"});
  }
  postReaderClose.addEventListener("click",()=>{
    stopPostReader();
    const url=new URL(location.href);url.searchParams.delete("post");
    location.href=url.pathname+(url.search?url.search:"")+url.hash;
  });
  const postReaderObserver=new MutationObserver(()=>{if(hasPostPermalink())startPostReader()});
  postReaderObserver.observe(document.body,{childList:true,subtree:true});
  if(hasPostPermalink())startPostReader();

  // Fullscreen opens the project's editorial manuscript: a sequence of designed, navigable chapters.
  let presentationActive = false;
  let slideIndex = 0;
  const manuscriptSlides = [
    {route:"/landing-page/",chapter:"PROLOGUE · THE ARCHIVE",kicker:"VERSE AFTER HOURS / FIELD NOTES 001",title:"A BOOKLET<br>OF <em>WHAT REMAINS.</em>",body:"Not a product tour. Not a deck of talking points. This is a living manuscript assembled from the traces we leave behind.<br><br>Begin at the beginning: before the first witness, before the first story, before anyone could call the universe beautiful.",note:"A project about nature, humanity, memory, and the machine.",visual:"cosmos",mark:"∞"},
    {route:"/landing-page/green-dream/",chapter:"I · SHIVA'S GREEN DREAM",kicker:"THE THESIS / NATURE · GOD · HUMANITY",title:"LET THE MACHINE<br>SERVE <em>LIFE.</em>",body:"Green Dream is a small island in the noise: a place to ask what happens when technology grows faster than wisdom, and when progress forgets the living world that makes it possible.<br><br>Shiva's dream is not an escape from the world. It is a call to see its cycles clearly: creation, preservation, destruction, renewal.",note:"Let life remember what is sacred.",visual:"green",mark:"✧"},
    {route:"/landing-page/posts/the-awakening/",chapter:"II · THE AWAKENING",kicker:"MOVEMENT 01 / ATTENTION RETURNS",title:"FIRST, WE <em>NOTICE.</em>",body:"A signal breaks through the static. Something ordinary becomes strange enough to see again. The first movement is attention: noticing the self, the world, and the quiet distance between what is happening and what we tell ourselves is happening.<br><br>Every journey begins when the automatic becomes visible.",note:"The first act of change is to look.",visual:"human",mark:"01"},
    {route:"/landing-page/posts/the-descent/",chapter:"III · THE DESCENT",kicker:"MOVEMENT 02 / INTO THE UNKNOWN",title:"GO DOWN<br>TO GO <em>DEEPER.</em>",body:"Not every answer waits in the light. The descent enters uncertainty, grief, contradiction, and the truths we postpone because knowing them might ask us to change.<br><br>This is not worship of darkness. It is the courage to stop confusing comfort with truth.",note:"Do not look away from what asks to be understood.",visual:"mirror",mark:"02"},
    {route:"/landing-page/posts/the-reconnection/",chapter:"IV · THE RECONNECTION",kicker:"MOVEMENT 03 / THE LIVING THREAD",title:"WE WERE NEVER<br>ONLY <em>SEPARATE.</em>",body:"A body, a forest, a memory, a friend, a river. The world is not a collection of isolated objects; it is a web of relationships, exchanges, and dependencies.<br><br>Reconnection means returning attention to the living things and small acts that hold us here.",note:"Belonging is a practice, not a possession.",visual:"water",mark:"03"},
    {route:"/landing-page/posts/the-transformation/",chapter:"V · THE TRANSFORMATION",kicker:"MOVEMENT 04 / CHANGE OF FORM",title:"NOTHING LIVES<br>WITHOUT <em>CHANGING.</em>",body:"Stone becomes a grain. A belief becomes a question. A mistake becomes a map. The old form loosens, and what seemed like an ending reveals itself as material for another beginning.<br><br>Transformation is not erasure. It is change that carries traces of what came before.",note:"Become new without pretending you were never old.",visual:"stone",mark:"04"},
    {route:"/landing-page/posts/the-return/",chapter:"VI · THE RETURN",kicker:"MOVEMENT 05 / CARRY THE LIGHT HOME",title:"RETURN WITH<br>DIFFERENT <em>EYES.</em>",body:"The journey turns back toward ordinary life. Nothing is magically solved. The world remains imperfect, and the work remains unfinished. But attention has changed; the things we carry back can change the way we act.<br><br>Integration is the quiet test of every revelation.",note:"Carry the insight into the everyday.",visual:"sacred",mark:"05"},
    {route:"/landing-page/music.html",chapter:"VII · THE SOUND BETWEEN WORDS",kicker:"SOUND ARCHIVE / THE RADIO PLAYS ON",title:"SOME THINGS<br>ARE FELT BEFORE<br>THEY ARE <em>SAID.</em>",body:"Sound makes a room inside time. A song can hold a season, summon a vanished place, or give shape to a feeling that language has not caught up with yet.<br><br>This is the listening room: a companion to the text, not an escape from it.",note:"Listen slowly. Let the silence have its share.",visual:"stars",mark:"♪"},
    {route:"/landing-page/posts/community/",chapter:"VIII · THE COMMON ARCHIVE",kicker:"COMMUNITY SIGNALS / MANY SMALL WITNESSES",title:"A MEMORY IS<br>NEVER ONLY <em>ONE VOICE.</em>",body:"A project becomes more than its author when other people leave traces inside it. A signal, a thought, a question, a fragment of experience: each is a grain that another person may find later.<br><br>This archive is not the whole sea. It is evidence that someone was here, and chose to leave something behind.",note:"Make room for voices that are not your own.",visual:"sand",mark:"∞"},
    {route:"/landing-page/cv/",chapter:"COLOPHON · THE MAKER",kicker:"ABOUT THE PERSON BEHIND THE PROJECT",title:"A HUMAN HAND<br>IN THE <em>LOOP.</em>",body:"This project is made through curiosity, writing, design, experiments, mistakes, repair, and collaboration with tools. It is a work in progress, not a claim to have solved the questions it raises.<br><br>The maker is part of the record, but never the whole story.",note:"The manuscript ends here. The work continues in the world.",visual:"iteration",mark:"V/A"}
  ];
  const manuscriptStyle = document.createElement("style");
  manuscriptStyle.id = "vha-manuscript-style";
  manuscriptStyle.textContent = "\n#vha-manuscript{position:fixed;inset:0;z-index:2147483006;display:none;overflow:hidden;background:#080b09;color:#e8e6d8;font-family:Georgia,'Times New Roman',serif}\n#vha-manuscript[aria-hidden=\"false\"]{display:block}#vha-manuscript *{box-sizing:border-box}\n#vha-manuscript .vm-noise{position:absolute;inset:0;pointer-events:none;opacity:.12;background-image:radial-gradient(#e8e6d8 0.5px,transparent .8px);background-size:5px 5px}\n#vha-manuscript .vm-top{position:absolute;z-index:5;top:0;left:0;right:0;display:flex;justify-content:space-between;gap:12px;padding:20px 4vw;border-bottom:1px solid #e8e6d81c;color:#a7ad9c;font:10px/1.3 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}\n#vha-manuscript .vm-brand{color:#d8ff8a}\n#vha-manuscript .vm-stage{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(260px,.95fr);align-items:center;gap:4vw;padding:100px 9vw;opacity:0;transform:translateX(24px);transition:opacity .3s ease,transform .3s ease;pointer-events:none}\n#vha-manuscript .vm-stage.vm-active{opacity:1;transform:translateX(0);pointer-events:auto}\n#vha-manuscript .vm-copy{position:relative;z-index:2;max-width:760px}\n#vha-manuscript .vm-kicker{margin:0 0 22px;color:#d8ff8a;font:10px/1.5 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase}\n#vha-manuscript .vm-chapter{margin:0 0 18px;color:#8f9b8c;font:10px/1.5 ui-monospace,monospace;letter-spacing:.13em;text-transform:uppercase}\n#vha-manuscript .vm-title{margin:0 0 25px;font-size:clamp(36px,6.3vw,92px);font-weight:400;line-height:.91;letter-spacing:-.065em;text-wrap:balance}\n#vha-manuscript .vm-title em{color:#d8ff8a;font-weight:400}\n#vha-manuscript .vm-body{max-width:650px;color:#d0d3c8;font-size:clamp(15px,1.35vw,20px);line-height:1.7}\n#vha-manuscript .vm-note{margin-top:25px;padding-top:13px;border-top:1px solid #d8ff8a4d;color:#aeb99e;font-size:13px;font-style:italic;line-height:1.6}\n#vha-manuscript .vm-art{position:relative;min-height:min(56vh,570px);height:100%;display:grid;place-items:center;overflow:hidden;isolation:isolate}\n#vha-manuscript .vm-orb{position:relative;width:min(34vw,410px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 35% 30%,#e6e5ce 0%,#9fae95 3%,#384c3a 13%,#101a18 38%,#060908 68%);box-shadow:inset -35px -25px 70px #000c,0 0 100px #a6cb6c15}\n#vha-manuscript .vm-orb:before{content:\"\";position:absolute;inset:-15%;border:1px solid #d8ff8a38;border-radius:50%;transform:rotate(-25deg) scaleY(.3)}\n#vha-manuscript .vm-orb:after{content:\"\";position:absolute;inset:12%;border:1px solid #e8e6d81c;border-radius:50%;transform:rotate(45deg) scaleY(.28)}\n#vha-manuscript .vm-mark{position:absolute;z-index:2;color:#e8e6d8;font-size:clamp(100px,19vw,260px);font-weight:400;line-height:1;opacity:.75;text-shadow:0 0 50px #d8ff8a12}\n#vha-manuscript [data-visual=\"water\"] .vm-orb{border-radius:48% 52% 62% 38%;background:radial-gradient(ellipse at 30% 25%,#8caa9b,#294c4b 20%,#0d2424 55%,#060a09 72%);transform:rotate(-18deg) scaleY(.75)}\n#vha-manuscript [data-visual=\"stone\"] .vm-orb,#vha-manuscript [data-visual=\"sand\"] .vm-orb{width:min(28vw,320px);border-radius:42% 58% 54% 46%;background:radial-gradient(circle at 30% 25%,#c2bda0,#706e58 17%,#34392f 45%,#0a0c09 72%);transform:rotate(23deg) scaleY(.72)}\n#vha-manuscript [data-visual=\"sand\"] .vm-orb{width:min(14vw,170px);background:radial-gradient(circle at 30% 25%,#e4d7a7,#9b8b5e 35%,#393426 75%)}\n#vha-manuscript [data-visual=\"sacred\"] .vm-orb,#vha-manuscript [data-visual=\"green\"] .vm-orb{background:radial-gradient(circle at 50% 50%,#d8ff8a 0%,#667c43 3%,#182419 15%,#050806 60%);box-shadow:0 0 100px #d8ff8a18}\n#vha-manuscript [data-visual=\"machine\"] .vm-orb{border-radius:4px;background:repeating-linear-gradient(0deg,#0a100b 0 10px,#253622 11px 12px),repeating-linear-gradient(90deg,transparent 0 20px,#d8ff8a26 21px 22px)}\n#vha-manuscript [data-visual=\"iteration\"] .vm-orb{background:repeating-radial-gradient(circle at 50% 50%,#0a100b 0 18px,#35482e 19px 20px,#0a100b 21px 34px)}\n#vha-manuscript .vm-bottom{position:absolute;z-index:6;bottom:0;left:0;right:0;display:flex;align-items:center;gap:14px;padding:18px 4vw;border-top:1px solid #e8e6d81c;background:#080b09e8}\n#vha-manuscript .vm-progress-track{height:2px;flex:1;background:#ffffff1b}#vha-manuscript .vm-progress-fill{height:100%;width:0;background:#d8ff8a;transition:width .25s}\n#vha-manuscript .vm-counter{min-width:85px;color:#d8ff8a;font:10px ui-monospace,monospace;letter-spacing:.1em}\n#vha-manuscript .vm-bottom button{width:38px;height:36px;border:1px solid #d8ff8a55;background:transparent;color:#e8e6d8;font-size:18px;cursor:pointer}\n#vha-manuscript .vm-bottom button:hover,#vha-manuscript .vm-bottom button:focus-visible{background:#d8ff8a;color:#080b09;outline:2px solid #d8ff8a;outline-offset:2px}\n#vha-manuscript .vm-exit{margin-left:8px!important;font:10px ui-monospace,monospace!important;width:auto!important;padding:0 12px}\n@media(max-width:760px){#vha-manuscript .vm-top{padding:14px 5vw;font-size:8px}#vha-manuscript .vm-stage{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) 90px;gap:0;padding:76px 7vw 80px;overflow-y:auto;align-content:center}#vha-manuscript .vm-title{font-size:clamp(34px,10vw,64px);margin-bottom:16px}#vha-manuscript .vm-body{font-size:14px;line-height:1.55}#vha-manuscript .vm-note{margin-top:14px;font-size:12px}#vha-manuscript .vm-art{min-height:90px;height:90px}#vha-manuscript .vm-orb{width:90px}#vha-manuscript .vm-mark{font-size:90px}#vha-manuscript .vm-bottom{padding:10px 5vw;gap:8px}#vha-manuscript .vm-counter{min-width:70px;font-size:9px}#vha-manuscript .vm-bottom button{width:34px;height:32px}#vha-manuscript .vm-exit{padding:0 8px!important;margin-left:0!important}}\n@media(max-height:650px) and (min-width:761px){#vha-manuscript .vm-stage{padding-top:72px;padding-bottom:66px}#vha-manuscript .vm-title{font-size:clamp(32px,5vw,64px)}#vha-manuscript .vm-body{font-size:14px;line-height:1.5}#vha-manuscript .vm-art{min-height:250px}}\n@media(prefers-reduced-motion:reduce){#vha-manuscript *{transition:none!important}}\n";
  document.head.appendChild(manuscriptStyle);
  const laurelStyle=document.createElement("style");
  laurelStyle.id="vha-laurel-interface-style";
  laurelStyle.textContent=`
    body:not(.vha-presentation-active)::after{content:"";position:fixed;inset:0;z-index:2147482990;pointer-events:none;opacity:.045;background-image:radial-gradient(#d8ff8a .55px,transparent .75px),radial-gradient(#d8ff8a .45px,transparent .7px);background-size:7px 7px,13px 13px;background-position:0 0,3px 5px}
    .gd-nav{background-image:linear-gradient(180deg,#d8ff3e08,transparent 70%),repeating-linear-gradient(90deg,transparent 0 44px,#d8ff3e04 45px 46px)!important;border-top:1px solid #d8ff3e38!important;box-shadow:inset 0 1px #ffffff08,0 5px 22px #0005!important}
    .gd-nav .vha-laurel-ornament{position:absolute;inset:0 12px;display:flex;align-items:center;justify-content:space-between;pointer-events:none;z-index:0;opacity:.76}
    .gd-nav .vha-laurel-ornament svg{width:31px;height:62px;overflow:visible;filter:drop-shadow(0 0 4px #d8ff3e20)}
    .gd-nav .vha-laurel-ornament path{fill:none;stroke:#b8d98a;stroke-width:1.2;stroke-linecap:round}
    .gd-nav .vha-laurel-ornament ellipse{fill:#b8d98a;fill-opacity:.25;stroke:#b8d98a;stroke-width:.8}
    .gd-nav .vha-laurel-ornament .right{transform:scaleX(-1)}
    .gd-nav>*:not(.vha-laurel-ornament){position:relative;z-index:1}
    .gd-nav .gd-brand b{border-color:#b8d98a!important;box-shadow:inset 0 0 0 2px #b8d98a12,0 0 0 1px #b8d98a1c!important}
    @media(max-width:760px){.gd-nav .vha-laurel-ornament{inset:0 5px;opacity:.38}.gd-nav .vha-laurel-ornament svg{width:17px;height:44px}}
    @media(prefers-reduced-motion:reduce){.gd-nav,.gd-nav *{scroll-behavior:auto!important}}
  `;
  document.head.appendChild(laurelStyle);
  document.querySelectorAll(".gd-nav").forEach(nav=>{
    if(nav.querySelector(".vha-laurel-ornament"))return;
    const ornament=document.createElement("div");
    ornament.className="vha-laurel-ornament";
    ornament.setAttribute("aria-hidden","true");
    ornament.innerHTML='<svg viewBox="0 0 36 72" aria-hidden="true"><path d="M29 66C25 48 19 26 6 7"/><ellipse cx="10" cy="15" rx="3" ry="7" transform="rotate(-35 10 15)"/><ellipse cx="15" cy="24" rx="3" ry="7" transform="rotate(-30 15 24)"/><ellipse cx="19" cy="34" rx="3" ry="7" transform="rotate(-25 19 34)"/><ellipse cx="23" cy="44" rx="3" ry="7" transform="rotate(-20 23 44)"/><ellipse cx="26" cy="54" rx="3" ry="7" transform="rotate(-15 26 54)"/><ellipse cx="7" cy="7" rx="2" ry="5" transform="rotate(-35 7 7)"/></svg><svg class="right" viewBox="0 0 36 72" aria-hidden="true"><path d="M29 66C25 48 19 26 6 7"/><ellipse cx="10" cy="15" rx="3" ry="7" transform="rotate(-35 10 15)"/><ellipse cx="15" cy="24" rx="3" ry="7" transform="rotate(-30 15 24)"/><ellipse cx="19" cy="34" rx="3" ry="7" transform="rotate(-25 19 34)"/><ellipse cx="23" cy="44" rx="3" ry="7" transform="rotate(-20 23 44)"/><ellipse cx="26" cy="54" rx="3" ry="7" transform="rotate(-15 26 54)"/><ellipse cx="7" cy="7" rx="2" ry="5" transform="rotate(-35 7 7)"/></svg>';
    nav.prepend(ornament);
  });
  const manuscript = document.createElement("section");
  manuscript.id = "vha-manuscript";
  manuscript.setAttribute("aria-hidden","true");
  manuscript.setAttribute("aria-label","Verse After Hours project manuscript");
  manuscript.innerHTML = '<div class="vm-noise" aria-hidden="true"></div><header class="vm-top"><span class="vm-brand">V/A · VERSE AFTER HOURS</span><span>THE LIVING MANUSCRIPT / 2026</span></header><div class="vm-slides"></div><footer class="vm-bottom"><button type="button" data-vm="prev" aria-label="Previous chapter" title="Previous chapter">←</button><div class="vm-progress-track"><div class="vm-progress-fill"></div></div><span class="vm-counter" aria-live="polite">01 / 13</span><button type="button" data-vm="next" aria-label="Next chapter" title="Next chapter">→</button><button type="button" class="vm-exit" data-vm="exit">CLOSE ✕</button></footer>';
  document.body.appendChild(manuscript);
  const slideContainer = manuscript.querySelector(".vm-slides");
  manuscriptSlides.forEach((slide,index) => {
    const section = document.createElement("article");
    section.className = "vm-stage" + (index===0?" vm-active":"");
    section.setAttribute("aria-label",slide.chapter);
    section.innerHTML = '<div class="vm-copy"><p class="vm-kicker">'+slide.kicker+'</p><p class="vm-chapter">'+slide.chapter+'</p><h1 class="vm-title">'+slide.title+'</h1><div class="vm-body">'+slide.body+'</div><p class="vm-note">'+slide.note+'</p></div><div class="vm-art" data-visual="'+slide.visual+'" aria-hidden="true"><div class="vm-orb"></div><span class="vm-mark">'+slide.mark+'</span></div>';
    slideContainer.appendChild(section);
  });
  const slideCounter=manuscript.querySelector(".vm-counter");
  const slideProgress=manuscript.querySelector(".vm-progress-fill");
  function normalizedPath(path) {
    const clean=String(path||"/").split(/[?#]/)[0];
    return clean.endsWith("/")?clean:clean+"/";
  }
  function getManuscriptIndex(path) {
    const current=normalizedPath(path||location.pathname);
    let best=-1,bestLength=-1;
    manuscriptSlides.forEach((slide,i)=>{
      const route=normalizedPath(slide.route);
      const matches=current===route || (route!=="/landing-page/" && current.startsWith(route));
      if(matches&&route.length>bestLength){best=i;bestLength=route.length;}
    });
    return best>=0?best:1;
  }
  function navigateManuscriptChapter(next) {
    const target=Math.max(0,Math.min(manuscriptSlides.length-1,next));
    const route=manuscriptSlides[target].route;
    if(normalizedPath(location.pathname)===normalizedPath(route)){showManuscriptSlide(target);return;}
    try{sessionStorage.setItem("vha-manuscript-continue","1")}catch{}
    location.href=route;
  }
  function showManuscriptSlide(next) {
    slideIndex=Math.max(0,Math.min(manuscriptSlides.length-1,next));
    slideContainer.querySelectorAll(".vm-stage").forEach((slide,i)=>slide.classList.toggle("vm-active",i===slideIndex));
    slideCounter.textContent=String(slideIndex+1).padStart(2,"0")+" / "+String(manuscriptSlides.length).padStart(2,"0");
    slideProgress.style.width=((slideIndex+1)/manuscriptSlides.length*100)+"%";
    manuscript.querySelector('[data-vm="prev"]').disabled=slideIndex===0;
    manuscript.querySelector('[data-vm="next"]').disabled=slideIndex===manuscriptSlides.length-1;
    manuscript.querySelector('[data-vm="next"]').setAttribute("aria-label",slideIndex===manuscriptSlides.length-1?"End of manuscript":"Continue to "+manuscriptSlides[slideIndex+1].chapter);
  }
  function startPresentation() {
    presentationActive=true;
    // Focus the reader so keyboard navigation is scoped to the presentation, not the whole page.
    manuscript.setAttribute("tabindex","-1");
    manuscript.focus({preventScroll:true});
    showManuscriptSlide(getManuscriptIndex(location.pathname));
    manuscript.setAttribute("aria-hidden","false");
    document.body.classList.add("vha-presentation-active");
  }
  function stopPresentation() {
    presentationActive=false;
    manuscript.setAttribute("aria-hidden","true");
    document.body.classList.remove("vha-presentation-active");
  }
  manuscript.querySelector('[data-vm="prev"]').addEventListener("click",()=>navigateManuscriptChapter(slideIndex-1));
  manuscript.querySelector('[data-vm="next"]').addEventListener("click",()=>navigateManuscriptChapter(slideIndex+1));
  manuscript.querySelector('[data-vm="exit"]').addEventListener("click",async()=>{
    stopPresentation();
    
  });
  
  manuscript.addEventListener("keydown",e=>{
    if(!presentationActive||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.target&&(e.target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)))return;
    if(["ArrowRight","ArrowDown","PageDown"," "].includes(e.key)){e.preventDefault();navigateManuscriptChapter(slideIndex+1)}
    else if(["ArrowLeft","ArrowUp","PageUp","Backspace"].includes(e.key)){e.preventDefault();navigateManuscriptChapter(slideIndex-1)}
    else if(e.key==="Home"){e.preventDefault();navigateManuscriptChapter(0)}
    else if(e.key==="End"){e.preventDefault();navigateManuscriptChapter(manuscriptSlides.length-1)}
    else if(e.key==="Escape"){stopPresentation()}
  });
  try {
    if(sessionStorage.getItem("vha-manuscript-continue")==="1"){
      sessionStorage.removeItem("vha-manuscript-continue");
      startPresentation();
    }
  } catch {}

  document.addEventListener("click",event=>{
    const button=event.target.closest('#vha-viewer-tools [data-tool="presentation"]');
    if(!button)return;
    if(hasPostPermalink()&&document.querySelector("#posts-list > .post-card")){
      if(document.body.classList.contains("vha-post-fullscreen"))stopPostReader();
      else startPostReader();
    }else if(presentationActive)stopPresentation();
    else startPresentation();
  });
  window.VHACrystal?.registerTool({id:"presentation",label:"PRESENTATION",description:"Present the site's chapters in a focused, navigable sequence.",presentation:"overlay",run:()=>document.querySelector('[data-tool="presentation"]')?.click()});
})();