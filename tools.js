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

/* Floating Viewer Tools HUD — shared across every page loading tools.js. */
(() => {
  if (document.getElementById("vha-viewer-tools")) return;
  const style = document.createElement("style");
  style.id = "vha-viewer-tools-style";
  style.textContent = `
    #vha-viewer-tools{position:fixed;right:clamp(14px,3vw,42px);top:50%;transform:translateY(-50%);z-index:2147483008;font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:#7fffea}
    #vha-viewer-tools *{box-sizing:border-box}
    #vha-viewer-tools .vha-tools-trigger{position:relative;z-index:2;display:grid;place-items:center;width:78px;height:78px;border:2px solid #00f5d4;border-radius:50%;background:rgba(1,17,19,.94);color:#00f5d4;box-shadow:0 0 0 7px #00f5d410,0 0 24px #00f5d42b;cursor:pointer;transition:transform .2s,background .2s,box-shadow .2s}
    #vha-viewer-tools .vha-tools-trigger:hover,#vha-viewer-tools[data-open="true"] .vha-tools-trigger{transform:scale(1.04);background:#062b2b;box-shadow:0 0 0 7px #00f5d41a,0 0 30px #00f5d45c}
    #vha-viewer-tools .vha-tools-trigger svg{width:36px;height:36px}
    #vha-viewer-tools .vha-tools-label{position:absolute;left:calc(100% - 2px);top:-37px;padding:9px 14px;border:1px solid #00cdb2;border-radius:10px;background:#021012;color:#00f5d4;letter-spacing:1.5px;white-space:nowrap}
    #vha-viewer-tools .vha-tools-label:before{content:"";position:absolute;right:100%;top:50%;width:26px;border-top:1px solid #00cdb2}
    #vha-viewer-tools .vha-tools-panel{position:absolute;right:0;top:calc(100% - 6px);width:200px;padding:24px 12px 12px;border:1px solid #007f78;border-radius:13px;background:rgba(1,12,15,.96);box-shadow:0 12px 36px #0009,inset 0 0 22px #00e6cb0b;backdrop-filter:blur(12px);display:grid;gap:7px;opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .18s,transform .18s,visibility .18s}
    #vha-viewer-tools[data-open="true"] .vha-tools-panel{opacity:1;visibility:visible;transform:translateY(0)}
    #vha-viewer-tools .vha-tool-row{display:flex;align-items:center;gap:12px;width:100%;min-height:46px;padding:4px 8px;border:0;background:transparent;color:#76d9dc;text-align:left;cursor:pointer;font:12px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace}
    #vha-viewer-tools .vha-tool-row:hover,#vha-viewer-tools .vha-tool-row:focus-visible{color:#00f5d4;background:#00f5d410;outline:1px solid #00cdb255}
    #vha-viewer-tools .vha-tool-icon{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border:1px solid #007f86;border-radius:12px;color:#d8fffc;background:#031619}
    #vha-viewer-tools .vha-tool-icon svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    #vha-viewer-tools .vha-tool-row[aria-pressed="true"] .vha-tool-icon{border-color:#00f5d4;color:#00f5d4}
    #vha-viewer-tools .vha-tools-help{margin:6px 6px 2px;padding-top:10px;border-top:1px solid #00f5d42c;color:#4b9b9d;font-size:9px;letter-spacing:.5px}
    body.vha-tools-hide-ui header,body.vha-tools-hide-ui footer,body.vha-tools-hide-ui nav,body.vha-tools-hide-ui .gd-nav,body.vha-tools-hide-ui .gd-footer{opacity:0!important;pointer-events:none!important;transition:opacity .2s}
    body.vha-tools-hide-ui #vha-viewer-tools{opacity:1!important;pointer-events:auto!important}
    body.vha-tools-large-text main,body.vha-tools-large-text .gd{font-size:1.12em}
    @media(max-width:600px){#vha-viewer-tools{right:12px;top:auto;bottom:20px;transform:none}#vha-viewer-tools .vha-tools-trigger{width:60px;height:60px}#vha-viewer-tools .vha-tools-trigger svg{width:29px;height:29px}#vha-viewer-tools .vha-tools-label{top:-28px;font-size:9px;padding:6px 9px}#vha-viewer-tools .vha-tools-panel{top:auto;bottom:calc(100% - 2px);padding:12px;width:190px}#vha-viewer-tools .vha-tool-row{min-height:42px}#vha-viewer-tools .vha-tool-icon{width:38px;height:38px;flex-basis:38px}}
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
  const svg = (name) => '<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
  const root = document.createElement("aside");
  root.id = "vha-viewer-tools";
  root.setAttribute("aria-label","Viewer tools");
  root.dataset.open = "false";
  root.innerHTML = '<button class="vha-tools-trigger" type="button" aria-label="Open viewer tools" aria-expanded="false" aria-controls="vha-tools-panel">'+svg("tools")+'</button><div class="vha-tools-label" aria-hidden="true">VIEWER TOOLS</div><div class="vha-tools-panel" id="vha-tools-panel" aria-label="Viewer tools menu"><button class="vha-tool-row" type="button" data-tool="fullscreen"><span class="vha-tool-icon">'+svg("fullscreen")+'</span><span>Fullscreen</span></button><button class="vha-tool-row" type="button" data-tool="dark" aria-pressed="false"><span class="vha-tool-icon">'+svg("moon")+'</span><span>Dark Mode</span></button><button class="vha-tool-row" type="button" data-tool="text" aria-pressed="false"><span class="vha-tool-icon">'+svg("text")+'</span><span>Text Size</span></button><button class="vha-tool-row" type="button" data-tool="ui" aria-pressed="false"><span class="vha-tool-icon">'+svg("ui")+'</span><span>UI Toggle</span></button><button class="vha-tool-row" type="button" data-tool="help"><span class="vha-tool-icon">'+svg("help")+'</span><span>Help</span></button><div class="vha-tools-help">LOCAL VIEWER CONTROLS</div></div>';
  document.body.appendChild(root);
  const trigger = root.querySelector(".vha-tools-trigger");
  const setOpen = open => { root.dataset.open = String(open); trigger.setAttribute("aria-expanded",String(open)); trigger.setAttribute("aria-label",open?"Close viewer tools":"Open viewer tools"); };
  trigger.addEventListener("click",()=>setOpen(root.dataset.open!=="true"));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")setOpen(false)});
  document.addEventListener("click",e=>{if(!root.contains(e.target))setOpen(false)});
  root.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",async()=>{
    const tool=button.dataset.tool;
    if(tool==="fullscreen"){
      try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{alert("Fullscreen is not available in this browser or context.")}
    } else if(tool==="dark"){
      const active=document.documentElement.dataset.vhaToolsDark!=="true";
      document.documentElement.dataset.vhaToolsDark=String(active);
      document.documentElement.style.setProperty("--theme-page",active?"#020406":"#050906");
      document.documentElement.style.setProperty("--theme-surface",active?"#03090b":"#080e09");
      button.setAttribute("aria-pressed",String(active));
    } else if(tool==="text"){
      const active=!document.body.classList.contains("vha-tools-large-text");
      document.body.classList.toggle("vha-tools-large-text",active);button.setAttribute("aria-pressed",String(active));
    } else if(tool==="ui"){
      const active=!document.body.classList.contains("vha-tools-hide-ui");
      document.body.classList.toggle("vha-tools-hide-ui",active);button.setAttribute("aria-pressed",String(active));
    } else if(tool==="help"){
      alert("VIEWER TOOLS\n\nFullscreen: expand the page.\nDark Mode: switch to a deeper dark palette.\nText Size: enlarge page text.\nUI Toggle: temporarily hide site navigation and footer.\n\nClick outside this panel or press Escape to close it.");
    }
  }));
})();
