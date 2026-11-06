/* Crystal core and viewer shell. */
(() => {
 if(window.VHACrystal?.uiReady)return;
 if(!window.VHACrystal)throw new Error("Crystal core was loaded out of order.");
  const icons = {
    mood:'<path d="M12 21s-8-4.4-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.6-8 11-8 11Z"/><path d="M8.5 12.5c1.8 1.8 5.2 1.8 7 0"/>',
    tools:'<path d="M22.1 2.2a7.1 7.1 0 0 1-8.5 8.5L6.2 18.1a2.8 2.8 0 0 1-4-4l7.4-7.4a7.1 7.1 0 0 1 8.5-8.5l-4.2 4.2 3.8 3.8z"/>',
    presentation:'<path d="M3 4h18v13H3z"/><path d="m8 21 4-4 4 4M12 17v4"/>',
    moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    text:'<path d="M4 7V4h16v3M12 4v16M8 20h8"/>',
    reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  };
  const svg = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
  const root = document.createElement("aside");
  root.id = "vha-viewer-tools";
  // Layout is controlled by the shared stylesheet so closed and open states stay centred.
  root.setAttribute("aria-label","Viewer controls");
  root.dataset.moodOpen = "false";
  root.dataset.open = "false";
  root.innerHTML = '<div class="vha-tools-side vha-tools-left" aria-label="Viewer controls left"><button class="vha-tool-row" type="button" data-tool="presentation"><span class="vha-tool-icon">'+svg("presentation")+'</span><span>Presentation</span></button><button class="vha-tool-row" type="button" data-tool="radio" aria-pressed="false"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6M19.5 6.5a9 9 0 0 1 0 11"/></svg></span><span>V/A Radio</span></button><button class="vha-tool-row" type="button" data-tool="text" aria-pressed="false"><span class="vha-tool-icon">'+svg("text")+'</span><span>Text Size</span></button></div><div class="vha-tools-side vha-tools-right" aria-label="Viewer controls right"><button class="vha-tool-row" type="button" data-tool="mood" aria-expanded="false"><span class="vha-tool-icon">'+svg("mood")+'</span><span>Match my mood</span></button><label class="vha-tool-row vha-patterns-dropdown"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></svg></span><select data-tool="patterns" aria-label="Choose a star pattern"><option value="" selected>Star patterns</option><option value="orion">Orion</option><option value="ursa-major">Ursa Major</option><option value="cassiopeia">Cassiopeia</option><option value="cygnus">Cygnus</option><option value="scorpius">Scorpius</option><option value="hello-smile">Hello / Smile</option><option value="heart-signal">Heart Signal</option><option value="north-star">North Star</option><option value="after-hours">After Hours</option><option value="waveform">Waveform</option></select></label><a class="vha-tool-row" href="/landing-page/posts/community/" aria-label="Open Signals community"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18v3M8 21h8M12 3v2M5.6 8.6a9 9 0 0 0 0 6.8M18.4 8.6a9 9 0 0 1 0 6.8M2.8 5.8a13 13 0 0 0 0 12.4M21.2 5.8a13 13 0 0 1 0 12.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg></span><span>SIGNALS</span></a></div><div class="vha-mood-box"><label for="vha-mood-emotion">What emotion is closest to what you feel?</label><select id="vha-mood-emotion"><option value="">Choose an emotion</option><option value="joy">Joy</option><option value="sadness">Sadness</option><option value="anger">Anger</option><option value="fear">Fear</option><option value="anxiety">Anxiety</option><option value="love">Love</option><option value="longing">Longing</option><option value="calm">Calm</option><option value="confusion">Confusion</option><option value="numbness">Numbness</option><option value="hope">Hope</option><option value="gratitude">Gratitude</option><option value="loneliness">Loneliness</option><option value="overwhelm">Overwhelm</option><option value="curiosity">Curiosity</option><option value="nostalgia">Nostalgia</option><option value="frustration">Frustration</option><option value="tenderness">Tenderness</option><option value="anticipation">Anticipation</option><option value="mixed feelings">Mixed feelings</option></select><button type="button" data-tool="generate-prompt">Generate a fresh prompt</button><label for="vha-mood-description">Describe what is happening inside you.</label><textarea id="vha-mood-description" maxlength="900" placeholder="Your generated prompt will appear here. You can change it, add to it, or write freely."></textarea><button type="button" data-tool="apply-mood">Generate a visual response</button><button type="button" data-tool="reset-mood" class="vha-mood-reset"><span class="vha-tool-icon">'+svg("reset")+'</span><span>Reset mood theme</span></button><div class="vha-mood-status" role="status" aria-live="polite"></div></div>';

  // Latest Changelog: a transparent, timestamped record of recent Crystal updates.
  const changelogEntries = [
    { timestamp: "2026-11-06T19:19:13Z", type: "FEATURE", title: "Introduced the Latest Changelog", detail: "Added a Crystal panel that records recent site updates with precise timestamps, change categories, concise explanations and a character quote." },

    { timestamp: "2026-11-06T19:12:33Z", type: "FIX", title: "Removed the obsolete Star Patterns popup", detail: "Kept pattern selection in the Crystal dock dropdown instead of maintaining a duplicate popup." },
    { timestamp: "2026-11-06T19:12:21Z", type: "IMPROVEMENT", title: "Connected the Star Patterns dropdown", detail: "Selecting a pattern now applies its constellation arrangement immediately." },
    { timestamp: "2026-11-06T19:12:06Z", type: "IMPROVEMENT", title: "Replaced the Star Patterns button", detail: "Introduced a native dropdown with ten selectable constellation layouts." },
    { timestamp: "2026-11-06T19:05:22Z", type: "FEATURE", title: "Added Creator Workshop as a standalone star", detail: "Made the private Creator Workshop destination visible in the constellation without connecting it to the other stars." }
  ];
  const changelogButton=document.createElement("button");
  changelogButton.type="button";
  changelogButton.className="vha-tool-row vha-changelog-trigger";
  changelogButton.dataset.tool="changelog";
  changelogButton.setAttribute("aria-expanded","false");
  changelogButton.innerHTML='<span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h10M4 19h16"/><path d="m17 9 3 3-3 3"/></svg></span><span>Latest Changelog</span>';
  root.querySelector(".vha-tools-side.vha-tools-left")?.appendChild(changelogButton);

  const changelogPanel=document.createElement("section");
  changelogPanel.className="vha-changelog-panel";
  changelogPanel.hidden=true;
  changelogPanel.setAttribute("role","dialog");
  changelogPanel.setAttribute("aria-modal","false");
  changelogPanel.setAttribute("aria-labelledby","vha-changelog-title");
  changelogPanel.innerHTML='<header class="vha-changelog-header"><div><span class="vha-changelog-kicker">CRYSTAL DEVELOPMENT LOG</span><h2 id="vha-changelog-title">Latest Changelog</h2></div><button type="button" class="vha-changelog-close" aria-label="Close changelog">×</button></header><div class="vha-changelog-list"></div><footer class="vha-changelog-quote"><blockquote>“Goodbye, V, and never stop fighting.”</blockquote><span>— Johnny Silverhand</span></footer>';
  document.body.appendChild(changelogPanel);
  const changelogList=changelogPanel.querySelector(".vha-changelog-list");
  const dateFormatter=new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/Rome"});
  const timeFormatter=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZone:"Europe/Rome"});
  changelogEntries.forEach(entry=>{
    const date=new Date(entry.timestamp);
    const item=document.createElement("article");
    item.className="vha-changelog-entry";
    const meta=document.createElement("div");meta.className="vha-changelog-meta";
    const stamp=document.createElement("time");stamp.dateTime=entry.timestamp;
    stamp.textContent=dateFormatter.format(date)+" · "+timeFormatter.format(date);
    const type=document.createElement("span");type.className="vha-changelog-type is-"+entry.type.toLowerCase();type.textContent=entry.type;
    meta.append(stamp,type);
    const title=document.createElement("h3");title.textContent=entry.title;
    const detail=document.createElement("p");detail.textContent=entry.detail;
    item.append(meta,title,detail);changelogList.appendChild(item);
  });
  function setChangelogOpen(open){
    changelogPanel.hidden=!open;
    changelogButton.setAttribute("aria-expanded",String(open));
    changelogButton.classList.toggle("is-active",open);
  }
  changelogButton.addEventListener("click",()=>setChangelogOpen(changelogPanel.hidden));
  changelogPanel.querySelector(".vha-changelog-close").addEventListener("click",()=>setChangelogOpen(false));
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!changelogPanel.hidden)setChangelogOpen(false)});
  const changelogStyle=document.createElement("style");
  changelogStyle.id="vha-changelog-style";
  changelogStyle.textContent=`
    .vha-changelog-panel{position:fixed;left:50%;bottom:104px;transform:translateX(-50%);z-index:2147483647;width:min(520px,calc(100vw - 28px));max-height:min(68vh,620px);overflow:auto;padding:18px 20px 16px;border:1px solid rgba(174,199,157,.28);border-radius:15px;background:rgba(5,12,8,.96);color:#e4eddf;box-shadow:0 18px 60px rgba(0,0,0,.55);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
    .vha-changelog-panel[hidden]{display:none!important}
    .vha-changelog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:13px;border-bottom:1px solid rgba(174,199,157,.2)}
    .vha-changelog-kicker{font-size:8px;letter-spacing:.18em;color:#a9c28e}
    .vha-changelog-header h2{margin:5px 0 0;font:500 20px/1.2 Georgia,serif;color:#e8f1df}
    .vha-changelog-close{width:28px;height:28px;border:1px solid rgba(174,199,157,.28);border-radius:8px;background:transparent;color:#dce8d5;font-size:20px;cursor:pointer}
    .vha-changelog-entry{padding:13px 0;border-bottom:1px solid rgba(174,199,157,.13)}
    .vha-changelog-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#9cab99;font-size:9px;letter-spacing:.035em}
    .vha-changelog-type{padding:3px 6px;border:1px solid rgba(174,199,157,.24);border-radius:4px;font-size:8px;letter-spacing:.1em;color:#c5d6b6}
    .vha-changelog-type.is-feature{color:#d7e8a9;border-color:rgba(195,220,135,.4)}
    .vha-changelog-type.is-improvement{color:#a9d2c2;border-color:rgba(139,194,169,.35)}
    .vha-changelog-type.is-fix{color:#d6c39a;border-color:rgba(214,195,154,.35)}
    .vha-changelog-entry h3{margin:7px 0 4px;font:600 12px/1.4 Arial,sans-serif;color:#e4eddf}
    .vha-changelog-entry p{margin:0;color:#aebbad;font:11px/1.55 Arial,sans-serif}
    .vha-changelog-quote{padding-top:14px;text-align:right}
    .vha-changelog-quote blockquote{margin:0;color:#c9d8b9;font:italic 14px/1.45 Georgia,serif}
    .vha-changelog-quote span{display:block;margin-top:5px;color:#8fa18b;font-size:9px;letter-spacing:.08em}
    @media(max-width:600px){.vha-changelog-panel{bottom:76px;padding:14px 15px;max-height:70vh}.vha-changelog-header h2{font-size:18px}.vha-changelog-meta{font-size:8px}}
  `;
  document.head.appendChild(changelogStyle);

  function bindCrystal(){
    const crystal=root.querySelector(".ego-bottom-hud.vha-universal-nav .vha-map-toggle");
    if(!crystal||crystal.dataset.toolsBound==="true")return;
    crystal.dataset.toolsBound="true";
    crystal.addEventListener("click",()=>{
      const open=root.dataset.open!=="true";
      root.dataset.open=String(open);
      root.setAttribute("aria-expanded",String(open));
      document.dispatchEvent(new CustomEvent("vha-tools-state-change",{detail:{open}}));
    });
  }
  root.querySelector('[data-tool="radio"]')?.addEventListener("click",()=>{
    // Reveal the radio without closing Crystal; both panels remain independently usable.
    window.dispatchEvent(new Event("vha-radio-toggle"));
  });
  const crystalObserver=new MutationObserver(bindCrystal);
  crystalObserver.observe(root,{childList:true,subtree:true});
  document.addEventListener("click",event=>{const dragClickUntil=Number(document.body.dataset.vhaStarDragClickUntil||0);if(Date.now()<dragClickUntil)return;if(root.dataset.open==="true"&&!root.contains(event.target)&&!event.target.closest(".vha-journey-note,.vha-map-node,.vha-constellation-presets,#gd-radio,.vha-creator-workshop-star,.vha-changelog-panel")){root.dataset.open="false";root.setAttribute("aria-expanded","false");document.dispatchEvent(new CustomEvent("vha-tools-state-change",{detail:{open:false}}))}});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&root.dataset.open==="true"){root.dataset.open="false";root.setAttribute("aria-expanded","false");document.dispatchEvent(new CustomEvent("vha-tools-state-change",{detail:{open:false}}))}});
  const navHud = document.querySelector(".ego-bottom-hud.vha-universal-nav");
  if (navHud) {
    navHud.parentNode.insertBefore(root, navHud);
    root.insertBefore(navHud,root.querySelector(".vha-tools-side.vha-tools-right"));
    navHud.style.setProperty("position","absolute","important");
    navHud.style.setProperty("left","50%","important");
    navHud.style.setProperty("top","50%","important");
    navHud.style.setProperty("right","auto","important");
    navHud.style.setProperty("bottom","auto","important");
    navHud.style.setProperty("transform","translate(-50%,-50%)","important");
    navHud.style.setProperty("margin","0","important");
  } else {
    document.body.appendChild(root);
  }


  // Scale actual text-bearing elements rather than only the main wrapper's inherited font size.
  // Many site components define their typography in pixels, so a parent font-size alone has no effect.
  const originalTextSizes = new Map();
  function setViewerTextSize(enabled) {
    if (enabled) {
      const candidates = [...document.body.querySelectorAll("*")].filter(el =>
        !el.closest("#vha-viewer-tools") &&
        [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      );
      const sizes = candidates.map(el => ({el, size: parseFloat(getComputedStyle(el).fontSize)}))
        .filter(item => Number.isFinite(item.size));
      for (const {el, size} of sizes) {
        if (!originalTextSizes.has(el)) {
          originalTextSizes.set(el, {
            value: el.style.getPropertyValue("font-size"),
            priority: el.style.getPropertyPriority("font-size")
          });
        }
        el.style.setProperty("font-size", (size * 1.12) + "px", "important");
      }
    } else {
      for (const [el, original] of originalTextSizes) {
        if (!el.isConnected) continue;
        if (original.value) el.style.setProperty("font-size", original.value, original.priority);
        else el.style.removeProperty("font-size");
      }
      originalTextSizes.clear();
    }
    document.body.classList.toggle("vha-tools-large-text", enabled);
  }


 root.querySelectorAll('[data-tool="text"]').forEach(button=>button.addEventListener("click",()=>{const active=!document.body.classList.contains("vha-tools-large-text");setViewerTextSize(active);button.setAttribute("aria-pressed",String(active))}));
 window.VHACrystal.uiReady=true;window.VHACrystal.root=root;
 window.VHACrystal.setToolsOpen=open=>{root.dataset.open=String(Boolean(open));root.setAttribute("aria-expanded",String(Boolean(open)));document.dispatchEvent(new CustomEvent("vha-tools-state-change",{detail:{open:Boolean(open)}}))};
})();