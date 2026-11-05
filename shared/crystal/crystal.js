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
  root.innerHTML = '<div class="vha-tools-side vha-tools-left" aria-label="Viewer controls left"><button class="vha-tool-row" type="button" data-tool="presentation"><span class="vha-tool-icon">'+svg("presentation")+'</span><span>Presentation</span></button><button class="vha-tool-row" type="button" data-tool="radio" aria-pressed="false"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6M19.5 6.5a9 9 0 0 1 0 11"/></svg></span><span>V/A Radio</span></button><button class="vha-tool-row" type="button" data-tool="text" aria-pressed="false"><span class="vha-tool-icon">'+svg("text")+'</span><span>Text Size</span></button></div><div class="vha-tools-side vha-tools-right" aria-label="Viewer controls right"><button class="vha-tool-row" type="button" data-tool="mood" aria-expanded="false"><span class="vha-tool-icon">'+svg("mood")+'</span><span>Match my mood</span></button><button class="vha-tool-row" type="button" data-tool="patterns" aria-expanded="false"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></svg></span><span>Star patterns</span></button><a class="vha-tool-row" href="/landing-page/posts/community/" aria-label="Open Signals community"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18v3M8 21h8M12 3v2M5.6 8.6a9 9 0 0 0 0 6.8M18.4 8.6a9 9 0 0 1 0 6.8M2.8 5.8a13 13 0 0 0 0 12.4M21.2 5.8a13 13 0 0 1 0 12.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg></span><span>SIGNALS</span></a></div><div class="vha-mood-box"><label for="vha-mood-emotion">What emotion is closest to what you feel?</label><select id="vha-mood-emotion"><option value="">Choose an emotion</option><option value="joy">Joy</option><option value="sadness">Sadness</option><option value="anger">Anger</option><option value="fear">Fear</option><option value="anxiety">Anxiety</option><option value="love">Love</option><option value="longing">Longing</option><option value="calm">Calm</option><option value="confusion">Confusion</option><option value="numbness">Numbness</option><option value="hope">Hope</option><option value="gratitude">Gratitude</option><option value="loneliness">Loneliness</option><option value="overwhelm">Overwhelm</option><option value="curiosity">Curiosity</option><option value="nostalgia">Nostalgia</option><option value="frustration">Frustration</option><option value="tenderness">Tenderness</option><option value="anticipation">Anticipation</option><option value="mixed feelings">Mixed feelings</option></select><button type="button" data-tool="generate-prompt">Generate a fresh prompt</button><label for="vha-mood-description">Describe what is happening inside you.</label><textarea id="vha-mood-description" maxlength="900" placeholder="Your generated prompt will appear here. You can change it, add to it, or write freely."></textarea><button type="button" data-tool="apply-mood">Generate a visual response</button><button type="button" data-tool="reset-mood" class="vha-mood-reset"><span class="vha-tool-icon">'+svg("reset")+'</span><span>Reset mood theme</span></button><div class="vha-mood-status" role="status" aria-live="polite"></div></div>';
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
    // Close the constellation first, then reveal the radio after its close-state sync runs.
    root.dataset.open="false";
    root.setAttribute("aria-expanded","false");
    document.dispatchEvent(new CustomEvent("vha-tools-state-change",{detail:{open:false}}));
    window.dispatchEvent(new Event("vha-radio-toggle"));
  });
  const crystalObserver=new MutationObserver(bindCrystal);
  crystalObserver.observe(root,{childList:true,subtree:true});
  document.addEventListener("click",event=>{const dragClickUntil=Number(document.body.dataset.vhaStarDragClickUntil||0);if(Date.now()<dragClickUntil)return;if(root.dataset.open==="true"&&!root.contains(event.target)&&!event.target.closest(".vha-journey-note,#vha-world-map,.vha-constellation-presets,#gd-radio")){root.dataset.open="false";root.setAttribute("aria-expanded","false");document.dispatchEvent(new CustomEvent("vha-tools-state-change",{detail:{open:false}}))}});
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