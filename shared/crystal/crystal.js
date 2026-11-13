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
  root.innerHTML = '<div class="vha-tools-side vha-tools-left" aria-label="Viewer controls left"><span class="vha-scroll-cue vha-scroll-cue-start" aria-hidden="true">‹</span><button class="vha-tool-row" type="button" data-tool="presentation"><span class="vha-tool-icon">'+svg("presentation")+'</span><span>Presentation</span></button><button class="vha-tool-row" type="button" data-tool="radio" aria-pressed="false"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6M19.5 6.5a9 9 0 0 1 0 11"/></svg></span><span>V/A Radio</span></button><button class="vha-tool-row" type="button" data-tool="text" aria-pressed="false"><span class="vha-tool-icon">'+svg("text")+'</span><span>Text Size</span></button><span class="vha-scroll-cue vha-scroll-cue-end" aria-hidden="true">›</span></div><div class="vha-tools-side vha-tools-right" aria-label="Viewer controls right"><span class="vha-scroll-cue vha-scroll-cue-start" aria-hidden="true">‹</span><button class="vha-tool-row" type="button" data-tool="mood" aria-expanded="false"><span class="vha-tool-icon">'+svg("mood")+'</span><span>Match my mood</span></button><label class="vha-tool-row vha-patterns-dropdown"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></svg></span><select data-tool="patterns" aria-label="Choose a star pattern"><option value="" selected>Star patterns</option><option value="orion">Orion</option><option value="ursa-major">Ursa Major</option><option value="cassiopeia">Cassiopeia</option><option value="cygnus">Cygnus</option><option value="scorpius">Scorpius</option><option value="hello-smile">Hello / Smile</option><option value="heart-signal">Heart Signal</option><option value="north-star">North Star</option><option value="after-hours">After Hours</option><option value="waveform">Waveform</option></select></label><a class="vha-tool-row" href="/landing-page/posts/community/" aria-label="Open Signals community"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18v3M8 21h8M12 3v2M5.6 8.6a9 9 0 0 0 0 6.8M18.4 8.6a9 9 0 0 1 0 6.8M2.8 5.8a13 13 0 0 0 0 12.4M21.2 5.8a13 13 0 0 1 0 12.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0-8Z"/></svg></span><span>SIGNALS</span></a><span class="vha-scroll-cue vha-scroll-cue-end" aria-hidden="true">›</span></div><div class="vha-mood-box"><label for="vha-mood-emotion">Which feeling is closest right now?</label><select id="vha-mood-emotion" aria-describedby="vha-mood-note"><option value="">Choose an emotion</option><option value="joy">Joy</option><option value="trust">Trust</option><option value="fear">Fear</option><option value="surprise">Surprise</option><option value="sadness">Sadness</option><option value="disgust">Disgust</option><option value="anger">Anger</option><option value="anticipation">Anticipation</option></select><p class="vha-mood-note" id="vha-mood-note">Eight core emotions, each with its own palette, typography and rhythm. Your choice stays in this browser.</p><button type="button" data-tool="apply-mood">Apply this atmosphere</button><button type="button" data-tool="reset-mood" class="vha-mood-reset"><span class="vha-tool-icon">'+svg("reset")+'</span><span>Reset mood theme</span></button><div class="vha-mood-status" role="status" aria-live="polite"></div></div>';

  // Keep horizontal-scroll arrows pinned to each bank's edges and reflect its current position.
  const toolBanks = [...root.querySelectorAll(".vha-tools-side")];
  function updateScrollCues(bank){
    const max = Math.max(0, bank.scrollWidth - bank.clientWidth);
    bank.dataset.scrollStart = String(bank.scrollLeft <= 2);
    bank.dataset.scrollEnd = String(bank.scrollLeft >= max - 2);
    bank.dataset.scrollable = String(max > 2);
  }
  toolBanks.forEach(bank=>{
    bank.addEventListener("scroll",()=>updateScrollCues(bank),{passive:true});
    updateScrollCues(bank);
  });
  if("ResizeObserver" in window){
    const cueResizeObserver = new ResizeObserver(()=>toolBanks.forEach(updateScrollCues));
    toolBanks.forEach(bank=>cueResizeObserver.observe(bank));
  }
  document.addEventListener("vha-tools-state-change",()=>requestAnimationFrame(()=>toolBanks.forEach(updateScrollCues)));

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