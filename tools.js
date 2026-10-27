/* Verse After Hours — saved theme manager and same-origin theme receiver */
(() => {
  function applyTheme(theme) {
    if (!theme || !theme.colors || !theme.typography || !theme.layout || !theme.details) return;
    const c = theme.colors;
    for (const key of ["page","surface","raised","text","muted","accent","secondary","border","glow"]) {
      if (/^#[0-9a-f]{6}$/i.test(c[key] || "")) root.style.setProperty("--theme-" + key, c[key]);
    }
    const attrs = {
      "theme-heading": [theme.typography.heading, ["editorial","modern","mono","condensed","display"], "modern"],
      "theme-body": [theme.typography.body, ["editorial","modern","mono","humanist"], "modern"],
      "theme-scale": [theme.typography.scale, ["compact","balanced","expressive"], "balanced"],
      "theme-weight": [theme.typography.weight, ["light","regular","bold","black"], "bold"],
      "theme-density": [theme.layout.density, ["airy","balanced","dense"], "balanced"],
      "theme-columns": [theme.layout.columns, ["one","two","mosaic","masonry"], "mosaic"],
      "theme-card": [theme.layout.card, ["glass","paper","brutalist","pixel","soft","editorial"], "editorial"],
      "theme-geometry": [theme.layout.geometry, ["square","rounded","cut-corner","organic","stacked"], "cut-corner"],
      "theme-hero": [theme.layout.hero, ["minimal","editorial","immersive","grid","poster"], "poster"],
      "theme-pattern": [theme.details.pattern, ["none","grid","grain","botanical","scanlines","blueprint","paper"], "grid"],
      "theme-media": [theme.details.media, ["clean","film","framed","glow","polaroid"], "framed"],
      "theme-buttons": [theme.details.buttons, ["minimal","outlined","solid","pill","mechanical"], "mechanical"],
      "theme-motion": [theme.details.motion, ["none","subtle","energetic"], "subtle"],
      "theme-shadows": [theme.details.shadows, ["flat","soft","hard","glow"], "glow"],
      "theme-nav": [theme.details.nav, ["minimal","boxed","underline","terminal"], "terminal"]
    };
    for (const [name, [value, allowed, fallback]] of Object.entries(attrs)) root.dataset[name] = allowed.includes(value) ? value : fallback;
    root.dataset.viewerTheme = "custom";
    try { localStorage.setItem("vha-ai-theme", JSON.stringify(theme)); } catch {}
    const colors = {page:c.page,surface:c.surface,raised:c.raised,text:c.text,muted:c.muted,accent:c.accent,secondary:c.secondary,border:c.border,glow:c.glow};
    try { localStorage.setItem("vha-global-theme", JSON.stringify({theme,colors})); } catch {}
  }
  window.addEventListener("message", e => {
    if (e.origin !== location.origin || e.data?.type !== "vha-theme-apply") return;
    applyTheme(e.data.theme);
  });
  try {
    const saved = JSON.parse(localStorage.getItem("vha-global-theme") || "null");
    if (saved?.theme) applyTheme(saved.theme);
  } catch {}
})();

/* Floating Viewer Tools HUD — draggable, compact, and theme-aware. */
(() => {
  if (document.getElementById("vha-viewer-tools")) return;
  const style = document.createElement("style");
  style.id = "vha-viewer-tools-style";
  style.textContent = `
    #vha-viewer-tools{position:fixed;right:18px;bottom:18px;z-index:2147483008;font-family:var(--vha-font,Arial,Helvetica,sans-serif);font-size:11px;line-height:1.25;color:var(--theme-accent,#d8ff3e);touch-action:pan-y}
    #vha-viewer-tools *{box-sizing:border-box}
    #vha-viewer-tools .vha-tools-trigger{position:relative;z-index:2;display:grid;place-items:center;width:52px;height:52px;border:1px solid var(--theme-accent,#d8ff3e);border-radius:50%;background:var(--theme-surface,#080e09);color:var(--theme-accent,#d8ff3e);box-shadow:0 0 0 4px color-mix(in srgb,var(--theme-accent,#d8ff3e) 9%,transparent),0 3px 18px #0008;cursor:grab;touch-action:none;user-select:none;transition:background .15s,box-shadow .15s}
    #vha-viewer-tools .vha-tools-trigger:active{cursor:grabbing}
    #vha-viewer-tools .vha-tools-trigger:hover,#vha-viewer-tools[data-open="true"] .vha-tools-trigger{background:var(--theme-raised,#101910);box-shadow:0 0 0 4px color-mix(in srgb,var(--theme-accent,#d8ff3e) 15%,transparent),0 3px 22px #0009}
    #vha-viewer-tools .vha-tools-trigger svg{width:25px;height:25px}
    #vha-viewer-tools .vha-tools-label{position:absolute;right:0;bottom:calc(100% + 8px);padding:5px 8px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:var(--theme-page,#050906);color:var(--theme-accent,#d8ff3e);font-size:9px;font-weight:700;letter-spacing:1px;white-space:nowrap;pointer-events:none}
    #vha-viewer-tools .vha-tools-panel{position:absolute;right:calc(100% + 10px);bottom:0;width:164px;padding:7px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:color-mix(in srgb,var(--theme-surface,#080e09) 96%,transparent);color:var(--theme-text,#e8f4df);box-shadow:0 8px 26px #0009;backdrop-filter:blur(10px);display:grid;gap:3px;opacity:0;visibility:hidden;transform:translateX(5px);transition:opacity .16s,transform .16s,visibility .16s}
    #vha-viewer-tools[data-open="true"] .vha-tools-panel{opacity:1;visibility:visible;transform:translateX(0)}
    #vha-viewer-tools .vha-tool-row{display:flex;align-items:center;gap:9px;width:100%;min-height:34px;padding:3px 5px;border:0;background:transparent;color:var(--theme-text,#e8f4df);text-align:left;cursor:pointer;font:inherit}
    #vha-viewer-tools .vha-tool-row:hover,#vha-viewer-tools .vha-tool-row:focus-visible{color:var(--theme-accent,#d8ff3e);background:color-mix(in srgb,var(--theme-accent,#d8ff3e) 8%,transparent);outline:1px solid var(--theme-border,var(--theme-accent,#d8ff3e))}
    #vha-viewer-tools .vha-tool-icon{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));color:var(--theme-accent,#d8ff3e);background:var(--theme-page,#050906)}
    #vha-viewer-tools .vha-tool-icon svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    #vha-viewer-tools .vha-tool-row[aria-pressed="true"] .vha-tool-icon{border-color:var(--theme-accent,#d8ff3e)}
    #vha-viewer-tools .vha-tools-help{margin:3px 4px 1px;padding-top:6px;border-top:1px solid var(--theme-border,#d8ff3e35);color:var(--theme-muted,#9aab9c);font-size:8px;letter-spacing:.4px}
    body.vha-tools-hide-ui header,body.vha-tools-hide-ui footer,body.vha-tools-hide-ui nav,body.vha-tools-hide-ui .gd-nav,body.vha-tools-hide-ui .gd-footer{opacity:0!important;pointer-events:none!important;transition:opacity .2s}
    body.vha-tools-hide-ui #vha-viewer-tools{opacity:1!important;pointer-events:auto!important}
    body.vha-tools-large-text main,body.vha-tools-large-text .gd{font-size:1.12em}
    @media(max-width:600px){#vha-viewer-tools{right:12px;bottom:12px}#vha-viewer-tools .vha-tools-trigger{width:46px;height:46px}#vha-viewer-tools .vha-tools-trigger svg{width:22px;height:22px}#vha-viewer-tools .vha-tools-panel{right:calc(100% + 8px);bottom:0;width:152px}#vha-viewer-tools .vha-tool-row{min-height:32px}#vha-viewer-tools .vha-tool-icon{width:26px;height:26px;flex-basis:26px}}
    @media(prefers-reduced-motion:reduce){#vha-viewer-tools *{transition:none!important}}
  `;
  document.head.appendChild(style);
  const icons = {
    tools:'<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L2.5 18.5a2.1 2.1 0 0 0 3 3l5.8-5.8a5 5 0 0 0 6.4-6.4l-3 3-3.1-3.1z"/><path d="m14 10 3.5-3.5a5 5 0 0 1 6.2-5.9l-3.4 3.4 3.1 3.1 3.4-3.4a5 5 0 0 1-5.9 6.2L17.4 13"/>',
    fullscreen:'<path d="M8 3H3v5M3 3l7 7M16 3h5v5m0-5-7 7M3 16v5h5m-5 0 7-7m13 2v5h-5m5 0-7-7"/>',
    moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    text:'<path d="M4 7V4h16v3M12 4v16M8 20h8"/>',
    ui:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1 1-1.8 1.2-1.8 3M12 17h.01"/>'
  };
  const svg = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
  const root = document.createElement("aside");
  root.id = "vha-viewer-tools";
  root.setAttribute("aria-label","Viewer tools");
  root.dataset.open = "false";
  root.innerHTML = '<button class="vha-tools-trigger" type="button" aria-label="Open viewer tools" aria-expanded="false" aria-controls="vha-tools-panel" title="Drag to move; click to open">'+svg("tools")+'</button><div class="vha-tools-label" aria-hidden="true">VIEWER TOOLS</div><div class="vha-tools-panel" id="vha-tools-panel" aria-label="Viewer tools menu"><button class="vha-tool-row" type="button" data-tool="fullscreen"><span class="vha-tool-icon">'+svg("fullscreen")+'</span><span>Fullscreen</span></button><button class="vha-tool-row" type="button" data-tool="dark" aria-pressed="false"><span class="vha-tool-icon">'+svg("moon")+'</span><span>Dark Mode</span></button><button class="vha-tool-row" type="button" data-tool="text" aria-pressed="false"><span class="vha-tool-icon">'+svg("text")+'</span><span>Text Size</span></button><button class="vha-tool-row" type="button" data-tool="ui" aria-pressed="false"><span class="vha-tool-icon">'+svg("ui")+'</span><span>UI Toggle</span></button><button class="vha-tool-row" type="button" data-tool="help"><span class="vha-tool-icon">'+svg("help")+'</span><span>Help</span></button><div class="vha-tools-help">VIEWER CONTROLS</div></div>';
  document.body.appendChild(root);
  const trigger = root.querySelector(".vha-tools-trigger");
  const setOpen = open => { root.dataset.open = String(open); trigger.setAttribute("aria-expanded",String(open)); trigger.setAttribute("aria-label",open?"Close viewer tools":"Open viewer tools"); };
  let dragging=false, moved=false, startX=0, startY=0, originX=0, originY=0;
  const clamp=(n,min,max)=>Math.min(Math.max(n,min),max);
  trigger.addEventListener("pointerdown",e=>{
    if(e.button!==0 && e.pointerType!=="touch") return;
    dragging=true;moved=false;startX=e.clientX;startY=e.clientY;
    const rect=root.getBoundingClientRect();originX=rect.left;originY=rect.top;
    trigger.setPointerCapture?.(e.pointerId);
  });
  trigger.addEventListener("pointermove",e=>{
    if(!dragging)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    if(Math.abs(dx)>4||Math.abs(dy)>4)moved=true;
    if(!moved)return;
    const x=clamp(originX+dx,0,innerWidth-root.offsetWidth);
    const y=clamp(originY+dy,0,innerHeight-root.offsetHeight);
    root.style.left=x+"px";root.style.top=y+"px";root.style.right="auto";root.style.bottom="auto";root.style.transform="none";
    root.dataset.moved="true";
  });
  const finishDrag=()=>{if(!dragging)return;dragging=false;if(moved){setOpen(false);root.dataset.suppressClick="true";setTimeout(()=>delete root.dataset.suppressClick,0)}};
  trigger.addEventListener("pointerup",finishDrag);trigger.addEventListener("pointercancel",finishDrag);
  trigger.addEventListener("click",e=>{if(root.dataset.suppressClick==="true"){e.preventDefault();e.stopPropagation();return}setOpen(root.dataset.open!=="true")});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")setOpen(false)});
  document.addEventListener("click",e=>{if(!root.contains(e.target))setOpen(false)});
  window.addEventListener("resize",()=>{if(root.dataset.moved==="true"){const rect=root.getBoundingClientRect();root.style.left=clamp(rect.left,0,innerWidth-root.offsetWidth)+"px";root.style.top=clamp(rect.top,0,innerHeight-root.offsetHeight)+"px"}});
  root.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",async()=>{
    const tool=button.dataset.tool;
    if(tool==="fullscreen"){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{alert("Fullscreen is not available in this browser or context.")}}
    else if(tool==="dark"){const active=document.documentElement.dataset.vhaToolsDark!=="true";document.documentElement.dataset.vhaToolsDark=String(active);document.documentElement.style.setProperty("--theme-page",active?"#020406":"#050906");document.documentElement.style.setProperty("--theme-surface",active?"#03090b":"#080e09");button.setAttribute("aria-pressed",String(active))}
    else if(tool==="text"){const active=!document.body.classList.contains("vha-tools-large-text");document.body.classList.toggle("vha-tools-large-text",active);button.setAttribute("aria-pressed",String(active))}
    else if(tool==="ui"){const active=!document.body.classList.contains("vha-tools-hide-ui");document.body.classList.toggle("vha-tools-hide-ui",active);button.setAttribute("aria-pressed",String(active))}
    else if(tool==="help"){alert("VIEWER TOOLS\\n\\nDrag the floating icon to reposition it.\\nFullscreen: expand the page.\\nDark Mode: switch to a deeper dark palette.\\nText Size: enlarge page text.\\nUI Toggle: temporarily hide site navigation and footer.")}
  }));
})();
