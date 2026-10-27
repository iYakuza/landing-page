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
    #vha-viewer-tools .vha-tools-trigger svg{width:25px;height:25px;stroke:#fff!important;fill:#fff!important;color:#fff!important}#vha-viewer-tools .vha-tools-trigger svg path{stroke:#fff!important;fill:#fff!important}
    #vha-viewer-tools .vha-tools-label{position:absolute;right:0;bottom:calc(100% + 8px);padding:5px 8px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:var(--theme-page,#050906);color:var(--theme-accent,#d8ff3e);font-size:9px;font-weight:700;letter-spacing:1px;white-space:nowrap;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .12s,visibility .12s}
    #vha-viewer-tools .vha-tools-trigger:hover + .vha-tools-label{opacity:1;visibility:visible}
    #vha-viewer-tools .vha-tools-panel{position:absolute;right:calc(100% + 10px);bottom:0;width:164px;padding:7px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:color-mix(in srgb,var(--theme-surface,#080e09) 96%,transparent);color:var(--theme-text,#e8f4df);box-shadow:0 8px 26px #0009;backdrop-filter:blur(10px);display:grid;gap:3px;opacity:0;visibility:hidden;transform:translateX(5px);transition:opacity .16s,transform .16s,visibility .16s}
    #vha-viewer-tools[data-open="true"] .vha-tools-panel{opacity:1;visibility:visible;transform:translateX(0)}
    #vha-viewer-tools .vha-tool-row{display:flex;align-items:center;gap:9px;width:100%;min-height:34px;padding:3px 5px;border:0;background:transparent;color:var(--theme-text,#e8f4df);text-align:left;cursor:pointer;font:inherit}
    #vha-viewer-tools .vha-tool-row:hover,#vha-viewer-tools .vha-tool-row:focus-visible{color:var(--theme-accent,#d8ff3e);background:color-mix(in srgb,var(--theme-accent,#d8ff3e) 8%,transparent);outline:1px solid var(--theme-border,var(--theme-accent,#d8ff3e))}
    #vha-viewer-tools .vha-tool-icon{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));color:var(--theme-accent,#d8ff3e);background:var(--theme-page,#050906)}
    #vha-viewer-tools .vha-tool-icon svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    #vha-viewer-tools .vha-tool-row[aria-pressed="true"] .vha-tool-icon{border-color:var(--theme-accent,#d8ff3e)}
    #vha-viewer-tools .vha-mood-box{display:none;border-top:1px solid var(--theme-border,#d8ff3e35);margin-top:4px;padding:8px 3px 2px;gap:6px}
    #vha-viewer-tools[data-mood-open="true"] .vha-mood-box{display:grid}
    #vha-viewer-tools .vha-mood-box label{font-size:10px;color:var(--theme-accent,#d8ff3e)}
    #vha-viewer-tools .vha-mood-box textarea{width:100%;min-height:62px;resize:vertical;padding:7px;border:1px solid var(--theme-border,#d8ff3e35);background:var(--theme-page,#050906);color:var(--theme-text,#e8f4df);font:inherit;line-height:1.4}
    #vha-viewer-tools .vha-mood-box textarea:focus-visible{outline:1px solid var(--theme-accent,#d8ff3e)}
    #vha-viewer-tools .vha-mood-box button{padding:7px;border:1px solid var(--theme-accent,#d8ff3e);background:var(--theme-accent,#d8ff3e);color:var(--theme-page,#050906);font:inherit;font-weight:700;cursor:pointer}#vha-viewer-tools .vha-mood-presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}#vha-viewer-tools .vha-mood-presets button{padding:6px 2px;background:transparent;color:var(--theme-text,#e8f4df);font-size:9px;text-transform:capitalize}#vha-viewer-tools .vha-mood-presets button:hover,#vha-viewer-tools .vha-mood-presets button:focus-visible{background:var(--theme-accent,#d8ff3e);color:var(--theme-page,#050906)}
    #vha-viewer-tools .vha-mood-status{font-size:9px;color:var(--theme-muted,#9aab9c);min-height:12px}
    #vha-viewer-tools .vha-tools-help{margin:3px 4px 1px;padding-top:6px;border-top:1px solid var(--theme-border,#d8ff3e35);color:var(--theme-muted,#9aab9c);font-size:8px;letter-spacing:.4px}
    body.vha-tools-hide-ui header,body.vha-tools-hide-ui footer,body.vha-tools-hide-ui nav,body.vha-tools-hide-ui .gd-nav,body.vha-tools-hide-ui .gd-footer{opacity:0!important;pointer-events:none!important;transition:opacity .2s}
    body.vha-tools-hide-ui #vha-viewer-tools{opacity:1!important;pointer-events:auto!important}
    body.vha-tools-large-text main,body.vha-tools-large-text .gd{font-size:1.12em}
    @media(max-width:600px){#vha-viewer-tools{right:12px;bottom:12px}#vha-viewer-tools .vha-tools-trigger{width:46px;height:46px}#vha-viewer-tools .vha-tools-trigger svg{width:22px;height:22px}#vha-viewer-tools .vha-tools-panel{right:calc(100% + 8px);bottom:0;width:152px}#vha-viewer-tools .vha-tool-row{min-height:32px}#vha-viewer-tools .vha-tool-icon{width:26px;height:26px;flex-basis:26px}}
    @media(prefers-reduced-motion:reduce){#vha-viewer-tools *{transition:none!important}}
  `;
  document.head.appendChild(style);
  const icons = {
    mood:'<path d="M12 21s-8-4.4-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.6-8 11-8 11Z"/><path d="M8.5 12.5c1.8 1.8 5.2 1.8 7 0"/>',
    tools:'<path d="M22.1 2.2a7.1 7.1 0 0 1-8.5 8.5L6.2 18.1a2.8 2.8 0 0 1-4-4l7.4-7.4a7.1 7.1 0 0 1 8.5-8.5l-4.2 4.2 3.8 3.8z"/>',
    fullscreen:'<path d="M8 3H3v5M3 3l7 7M16 3h5v5m0-5-7 7M3 16v5h5m-5 0 7-7m13 2v5h-5m5 0-7-7"/>',
    moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    text:'<path d="M4 7V4h16v3M12 4v16M8 20h8"/>',
    ui:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1 1-1.8 1.2-1.8 3M12 17h.01"/>'
  };
  const svg = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
  const root = document.createElement("aside");
  root.id = "vha-viewer-tools";
  root.setAttribute("aria-label","Viewer tools");
  root.dataset.open = "false";
  root.innerHTML = '<button class="vha-tools-trigger" type="button" aria-label="Open viewer tools" aria-expanded="false" aria-controls="vha-tools-panel" title="Drag to move; click to open">'+svg("tools")+'</button><div class="vha-tools-label" aria-hidden="true">VIEWER TOOLS</div><div class="vha-tools-panel" id="vha-tools-panel" aria-label="Viewer tools menu"><button class="vha-tool-row" type="button" data-tool="fullscreen"><span class="vha-tool-icon">'+svg("fullscreen")+'</span><span>Fullscreen</span></button><button class="vha-tool-row" type="button" data-tool="dark" aria-pressed="false"><span class="vha-tool-icon">'+svg("moon")+'</span><span>Dark Mode</span></button><button class="vha-tool-row" type="button" data-tool="text" aria-pressed="false"><span class="vha-tool-icon">'+svg("text")+'</span><span>Text Size</span></button><button class="vha-tool-row" type="button" data-tool="ui" aria-pressed="false"><span class="vha-tool-icon">'+svg("ui")+'</span><span>UI Toggle</span></button><button class="vha-tool-row" type="button" data-tool="mood" aria-expanded="false"><span class="vha-tool-icon">'+svg("mood")+'</span><span>Match my mood</span></button><div class="vha-mood-box"><label for="vha-mood-description">How are you feeling right now?</label><textarea id="vha-mood-description" maxlength="500" placeholder="Describe it in your own words…"></textarea><div class="vha-mood-presets" aria-label="Choose a feeling"><button type="button" data-mood-preset="calm">Calm</button><button type="button" data-mood-preset="sad">Sad</button><button type="button" data-mood-preset="anxious">Anxious</button><button type="button" data-mood-preset="happy">Happy</button><button type="button" data-mood-preset="angry">Angry</button><button type="button" data-mood-preset="tired">Tired</button><button type="button" data-mood-preset="focused">Focused</button><button type="button" data-mood-preset="hopeful">Hopeful</button></div><button type="button" data-tool="apply-mood">Adapt the site</button><div class="vha-mood-status" role="status" aria-live="polite"></div></div><button class="vha-tool-row" type="button" data-tool="reset-mood"><span class="vha-tool-icon">'+svg("reset")+'</span><span>Reset mood theme</span></button><button class="vha-tool-row" type="button" data-tool="help"><span class="vha-tool-icon">'+svg("help")+'</span><span>Help</span></button><div class="vha-tools-help">VIEWER CONTROLS</div></div>';
  document.body.appendChild(root);
  function setMoodTheme(name,colors){
    const [page,surface,textColor,accent]=colors,html=document.documentElement;
    html.style.setProperty("--theme-page",page);html.style.setProperty("--theme-surface",surface);html.style.setProperty("--theme-raised",surface);html.style.setProperty("--theme-text",textColor);html.style.setProperty("--theme-muted",textColor+"b0");html.style.setProperty("--theme-accent",accent);html.style.setProperty("--theme-secondary",accent);html.style.setProperty("--theme-border",accent+"70");html.style.setProperty("--theme-glow",accent+"35");
    html.dataset.vhaMood=name;document.body.style.backgroundColor=page;document.body.style.color=textColor;
    let globalStyle=document.getElementById("vha-mood-global-overrides");
    if(!globalStyle){globalStyle=document.createElement("style");globalStyle.id="vha-mood-global-overrides";document.head.appendChild(globalStyle);}
    globalStyle.textContent='html[data-vha-mood],html[data-vha-mood] body,html[data-vha-mood] body>*,html[data-vha-mood] body>div,html[data-vha-mood] #app,html[data-vha-mood] #root,html[data-vha-mood] main,html[data-vha-mood] .gd,html[data-vha-mood] .gd-main,html[data-vha-mood] .gd-shell,html[data-vha-mood] .gd-page,html[data-vha-mood] .posts-main,html[data-vha-mood] .posts-content,html[data-vha-mood] .posts-page,html[data-vha-mood] .song-page,html[data-vha-mood] .cv-page,html[data-vha-mood] .cv-shell,html[data-vha-mood] .page-shell,html[data-vha-mood] .site-shell,html[data-vha-mood] .hero,html[data-vha-mood] .gd-hero{background-color:var(--theme-page)!important;background-image:none!important;color:var(--theme-text)!important}html[data-vha-mood] header,html[data-vha-mood] footer,html[data-vha-mood] nav,html[data-vha-mood] section,html[data-vha-mood] article,html[data-vha-mood] aside:not(#vha-viewer-tools),html[data-vha-mood] .gd-nav,html[data-vha-mood] .gd-footer,html[data-vha-mood] .gd-panel,html[data-vha-mood] .gd-card,html[data-vha-mood] .gd-radio,html[data-vha-mood] .gd-move,html[data-vha-mood] .post-card,html[data-vha-mood] .posts-note,html[data-vha-mood] .posts-filters,html[data-vha-mood] .viewer-console,html[data-vha-mood] .song-panel,html[data-vha-mood] .song-player-card,html[data-vha-mood] .cv-card,html[data-vha-mood] .cv-section,html[data-vha-mood] .transmission-card{background-color:var(--theme-surface)!important;background-image:none!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}html[data-vha-mood] h1,html[data-vha-mood] h2,html[data-vha-mood] h3,html[data-vha-mood] p,html[data-vha-mood] li,html[data-vha-mood] label,html[data-vha-mood] .gd-brand strong,html[data-vha-mood] .gd-brand small{color:var(--theme-text)!important}html[data-vha-mood] a:not(.vha-tools-trigger),html[data-vha-mood] em,html[data-vha-mood] .gd-kicker,html[data-vha-mood] .gd-status,html[data-vha-mood] .post-category{color:var(--theme-accent)!important;border-color:var(--theme-border)!important}html[data-vha-mood] input,html[data-vha-mood] textarea,html[data-vha-mood] select,html[data-vha-mood] [contenteditable=true]{background:var(--theme-surface)!important;background-image:none!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}
/* Explicitly theme high-specificity components on the CV and shared navigation. */
html[data-vha-mood] .cv-wrap,html[data-vha-mood] .cv-hero,html[data-vha-mood] .cv-section,html[data-vha-mood] .cv-targets,html[data-vha-mood] .cv-floating-nav,html[data-vha-mood] .cv-floating-head,html[data-vha-mood] .cv-contact-panel,html[data-vha-mood] .cv-skills span,html[data-vha-mood] .cv-quicklinks,html[data-vha-mood] .cv-actions,html[data-vha-mood] .cv-actions a,html[data-vha-mood] .cv-actions button,html[data-vha-mood] .cv-floating-links button{background-color:var(--theme-surface)!important;background-image:none!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}
html[data-vha-mood] .vha-main-nav,html[data-vha-mood] .vha-main-nav>a,html[data-vha-mood] .vha-nav-dropdown,html[data-vha-mood] .vha-nav-dropdown>summary,html[data-vha-mood] .vha-nav-menu,html[data-vha-mood] .vha-nav-menu>a,html[data-vha-mood] .vha-community-button,html[data-vha-mood] .gd-nav,html[data-vha-mood] .gd-nav>a{background-color:var(--theme-surface)!important;background-image:none!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important;box-shadow:none!important}
html[data-vha-mood] .vha-main-nav>a:hover,html[data-vha-mood] .vha-main-nav>a:focus-visible,html[data-vha-mood] .vha-nav-dropdown>summary:hover,html[data-vha-mood] .vha-nav-menu>a:hover,html[data-vha-mood] .vha-community-button:hover,html[data-vha-mood] .cv-floating-links button:hover,html[data-vha-mood] .cv-actions a:hover,html[data-vha-mood] .cv-actions button:hover{background-color:var(--theme-accent)!important;color:var(--theme-page)!important}
html[data-vha-mood] .cv-name span,html[data-vha-mood] .cv-kicker,html[data-vha-mood] .cv-role,html[data-vha-mood] .cv-floating-head strong,html[data-vha-mood] .cv-section h2 em{color:var(--theme-accent)!important}
html[data-vha-mood] .vha-main-nav .active,html[data-vha-mood] .vha-main-nav [aria-current=page]{border-color:var(--theme-accent)!important;color:var(--theme-accent)!important}';
    try{localStorage.setItem("vha-mood-palette",JSON.stringify({name,colors}));}catch{}
  }
  function resetMoodTheme(){
    const html=document.documentElement;
    ["--theme-page","--theme-surface","--theme-raised","--theme-text","--theme-muted","--theme-accent","--theme-secondary","--theme-border","--theme-glow"].forEach(k=>html.style.removeProperty(k));
    delete html.dataset.vhaMood;document.body.style.removeProperty("background-color");document.body.style.removeProperty("color");document.getElementById("vha-mood-global-overrides")?.remove();
    try{localStorage.removeItem("vha-mood-palette");}catch{}
  }
  try{const saved=JSON.parse(localStorage.getItem("vha-mood-palette")||"null");if(saved?.name&&Array.isArray(saved.colors)&&saved.colors.length===4)setMoodTheme(saved.name,saved.colors);}catch{}
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
  root.querySelectorAll("[data-mood-preset]").forEach(button=>button.addEventListener("click",()=>{const mood=button.dataset.moodPreset;const prompts={calm:"I feel calm and peaceful. Adapt the website to feel serene, spacious, and grounded.",sad:"I feel sad and a little low. Adapt the website to feel gentle, quiet, and comforting.",anxious:"I feel anxious and overwhelmed. Adapt the website to feel steady, soft, and low-stimulation.",happy:"I feel happy and upbeat. Adapt the website to feel warm, bright, and optimistic.",angry:"I feel angry or frustrated. Adapt the website to feel strong, grounded, and controlled.",tired:"I feel tired and drained. Adapt the website to feel restful, muted, and easy on the eyes.",focused:"I feel focused and ready to work. Adapt the website to feel clear, structured, and distraction-free.",hopeful:"I feel hopeful and inspired. Adapt the website to feel fresh, open, and uplifting."};const textarea=root.querySelector("#vha-mood-description");textarea.value=prompts[mood]||"";textarea.focus();root.querySelector(".vha-mood-status").textContent="Prompt ready. Choose Adapt the site to apply this feeling.";root.querySelectorAll("[data-mood-preset]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));}));
  root.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",async()=>{
    const tool=button.dataset.tool;
    if(tool==="mood"){const open=root.dataset.moodOpen!=="true";root.dataset.moodOpen=String(open);button.setAttribute("aria-expanded",String(open));if(open)root.querySelector("#vha-mood-description").focus();return}
    if(tool==="apply-mood"){
      const input=root.querySelector("#vha-mood-description").value.trim();
      const status=root.querySelector(".vha-mood-status");
      if(!input){status.textContent="Tell me a little about how you feel first.";return}
      const t=input.toLowerCase();
      const moods=[
        {name:"calm",words:["calm","peaceful","relaxed","serene","grounded","at ease"],colors:["#07110f","#0b1b17","#b8d8c6","#83b9a0"]},
        {name:"sad",words:["sad","down","grief","grieving","lonely","heartbroken","blue","empty"],colors:["#0a0d18","#11182a","#d7deef","#9aaed0"]},
        {name:"anxious",words:["anxious","anxiety","worried","overwhelmed","stressed","panic","uneasy","nervous"],colors:["#111019","#1a1728","#e0d8f4","#b6a4e0"]},
        {name:"happy",words:["happy","joy","joyful","excited","great","delighted","content","cheerful"],colors:["#101007","#1b1a0b","#f5edbd","#e3d46a"]},
        {name:"angry",words:["angry","furious","mad","frustrated","irritated","rage"],colors:["#160b0b","#26100e","#f1d2c7","#ec8067"]},
        {name:"tired",words:["tired","exhausted","sleepy","drained","burnt out","burned out","fatigued"],colors:["#0d1013","#171d22","#d2dce0","#9eafb8"]},
        {name:"focused",words:["focused","productive","determined","motivated","ready to work","concentrate"],colors:["#080f12","#0d1b20","#d0e6e9","#72c4cc"]},
        {name:"hopeful",words:["hopeful","optimistic","inspired","curious","looking forward","encouraged"],colors:["#0b1008","#14200d","#e1efc8","#a8d66b"]}
      ];
      const match=moods.find(m=>m.words.some(word=>t.includes(word)));
      const palette=match||{name:"reflective",colors:["#050906","#080e09","#e8f4df","#d8ff3e"]};
      setMoodTheme(palette.name,palette.colors);
      status.textContent=match?"Theme adapted for a "+match+" mood across the website.":"Applied the default theme; no clear mood keyword was found.";
      return;
    }
    if(tool==="reset-mood"){
      resetMoodTheme();
      root.querySelector("#vha-mood-description").value="";
      root.querySelector(".vha-mood-status").textContent="Default website theme restored across the website.";return;
    }
    if(tool==="fullscreen"){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{alert("Fullscreen is not available in this browser or context.")}}
    else if(tool==="dark"){const active=document.documentElement.dataset.vhaToolsDark!=="true";document.documentElement.dataset.vhaToolsDark=String(active);document.documentElement.style.setProperty("--theme-page",active?"#020406":"#050906");document.documentElement.style.setProperty("--theme-surface",active?"#03090b":"#080e09");button.setAttribute("aria-pressed",String(active))}
    else if(tool==="text"){const active=!document.body.classList.contains("vha-tools-large-text");document.body.classList.toggle("vha-tools-large-text",active);button.setAttribute("aria-pressed",String(active))}
    else if(tool==="ui"){const active=!document.body.classList.contains("vha-tools-hide-ui");document.body.classList.toggle("vha-tools-hide-ui",active);button.setAttribute("aria-pressed",String(active))}
    else if(tool==="help"){alert("VIEWER TOOLS\\n\\nDrag the floating icon to reposition it.\\nFullscreen: expand the page.\\nDark Mode: switch to a deeper dark palette.\\nText Size: enlarge page text.\\nUI Toggle: temporarily hide site navigation and footer.")}
  }));
})();
