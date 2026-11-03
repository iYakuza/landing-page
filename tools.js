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
    #vha-viewer-tools{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:2147483008;width:min(1240px,calc(100vw - 24px));min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 12px;border:1px solid var(--theme-border,rgba(185,215,122,.35));background:color-mix(in srgb,var(--theme-surface,#080e09) 94%,transparent);box-shadow:0 8px 28px #0009;backdrop-filter:blur(12px);font-family:var(--vha-font,Arial,Helvetica,sans-serif);font-size:10px;line-height:1.2;color:var(--theme-accent,#d8ff3e);pointer-events:auto}
    #vha-viewer-tools *{box-sizing:border-box}
    #vha-viewer-tools>.ego-bottom-hud.vha-universal-nav{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;flex:0 0 54px!important;width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important;order:2!important}
    #vha-viewer-tools .vha-tools-trigger{position:relative;z-index:2;display:grid;place-items:center;width:52px;height:52px;border:1px solid var(--theme-accent,#d8ff3e);border-radius:50%;background:var(--theme-surface,#080e09);color:var(--theme-accent,#d8ff3e);box-shadow:0 0 0 4px color-mix(in srgb,var(--theme-accent,#d8ff3e) 9%,transparent),0 3px 18px #0008;cursor:grab;touch-action:none;user-select:none;transition:background .15s,box-shadow .15s}
    #vha-viewer-tools .vha-tools-trigger:active{cursor:grabbing}
    #vha-viewer-tools .vha-tools-trigger:hover,#vha-viewer-tools[data-open="true"] .vha-tools-trigger{background:var(--theme-raised,#101910);box-shadow:0 0 0 4px color-mix(in srgb,var(--theme-accent,#d8ff3e) 15%,transparent),0 3px 22px #0009}
    #vha-viewer-tools .vha-tools-trigger svg{width:25px;height:25px;stroke:#fff!important;fill:#fff!important;color:#fff!important}#vha-viewer-tools .vha-tools-trigger svg path{stroke:#fff!important;fill:#fff!important}
    #vha-viewer-tools .vha-tools-label{position:absolute;right:0;bottom:calc(100% + 8px);padding:5px 8px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:var(--theme-page,#050906);color:var(--theme-accent,#d8ff3e);font-size:9px;font-weight:700;letter-spacing:1px;white-space:nowrap;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .12s,visibility .12s}
    #vha-viewer-tools .vha-tools-trigger:hover + .vha-tools-label{opacity:1;visibility:visible}
    #vha-viewer-tools .vha-tool-row{display:flex;align-items:center;justify-content:center;gap:6px;flex:1 1 auto;width:auto;min-width:0;min-height:42px;padding:4px 6px;border:0;background:transparent;color:var(--theme-text,#e8f4df);text-align:center;white-space:nowrap;cursor:pointer;font:inherit}
    #vha-viewer-tools .vha-tool-row:hover,#vha-viewer-tools .vha-tool-row:focus-visible{color:var(--theme-accent,#d8ff3e);background:color-mix(in srgb,var(--theme-accent,#d8ff3e) 8%,transparent);outline:1px solid var(--theme-border,var(--theme-accent,#d8ff3e))}
    #vha-viewer-tools .vha-tool-icon{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));color:var(--theme-accent,#d8ff3e);background:var(--theme-page,#050906)}
    #vha-viewer-tools .vha-tool-icon svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    #vha-viewer-tools .vha-tool-row[aria-pressed="true"] .vha-tool-icon{border-color:var(--theme-accent,#d8ff3e)}
    #vha-viewer-tools .vha-tools-side{display:flex;align-items:center;justify-content:space-evenly;gap:3px;min-width:0;flex:1 1 0;pointer-events:auto}#vha-viewer-tools .vha-mood-box{display:none;border-top:1px solid var(--theme-border,#d8ff3e35);margin-top:4px;padding:8px 3px 2px;gap:6px;grid-column:1/-1}
    #vha-viewer-tools[data-mood-open="true"] .vha-mood-box{display:grid}
    #vha-viewer-tools .vha-mood-box label{font-size:10px;color:var(--theme-accent,#d8ff3e)}
    #vha-viewer-tools .vha-mood-box textarea{width:100%;min-height:62px;resize:vertical;padding:7px;border:1px solid var(--theme-border,#d8ff3e35);background:var(--theme-page,#050906);color:var(--theme-text,#e8f4df);font:inherit;line-height:1.4}
    #vha-viewer-tools .vha-mood-box textarea:focus-visible{outline:1px solid var(--theme-accent,#d8ff3e)}
    #vha-viewer-tools .vha-mood-box button{min-width:0;max-width:100%;padding:7px;border:1px solid var(--theme-accent,#d8ff3e);background:var(--theme-accent,#d8ff3e);color:var(--theme-page,#050906);font:inherit;font-weight:700;cursor:pointer;overflow-wrap:anywhere}#vha-viewer-tools .vha-mood-presets{display:grid;grid-template-columns:repeat(auto-fit,minmax(58px,1fr));gap:4px;min-width:0}#vha-viewer-tools .vha-mood-presets button{min-width:0;max-width:100%;padding:6px 3px;background:transparent;color:var(--theme-text,#e8f4df);font-size:9px;line-height:1.2;text-transform:capitalize;white-space:normal;overflow-wrap:anywhere;word-break:normal}#vha-viewer-tools .vha-mood-presets button:hover,#vha-viewer-tools .vha-mood-presets button:focus-visible{background:var(--theme-accent,#d8ff3e);color:var(--theme-page,#050906)}
    #vha-viewer-tools .vha-mood-status{font-size:9px;color:var(--theme-muted,#9aab9c);min-height:12px}
    #vha-presentation-bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483007;display:none;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:color-mix(in srgb,var(--theme-surface,#080e09) 96%,transparent);color:var(--theme-text,#e8f4df);font:11px/1.2 Arial,Helvetica,sans-serif;box-shadow:0 8px 28px #0009;backdrop-filter:blur(12px);max-width:calc(100vw - 24px)}
    body.vha-presentation-active #vha-presentation-bar{display:flex}
    #vha-presentation-bar button{min-width:34px;min-height:32px;padding:5px 9px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e));background:transparent;color:var(--theme-text,#e8f4df);font:inherit;cursor:pointer}
    #vha-presentation-bar button:hover,#vha-presentation-bar button:focus-visible{background:var(--theme-accent,#d8ff3e);color:var(--theme-page,#050906);outline:2px solid var(--theme-accent,#d8ff3e);outline-offset:2px}
    #vha-presentation-progress{min-width:100px;text-align:center;white-space:nowrap;color:var(--theme-accent,#d8ff3e);font:700 10px/1.2 ui-monospace,monospace;letter-spacing:.5px}
    #vha-presentation-hint{font-size:9px;color:var(--theme-muted,#9aab9c);white-space:nowrap}
    body.vha-presentation-active{scroll-behavior:auto}
    @media(max-width:600px){#vha-presentation-bar{bottom:10px;gap:5px;padding:6px}#vha-presentation-hint{display:none}#vha-presentation-progress{min-width:84px}}
    body.vha-tools-hide-ui header,body.vha-tools-hide-ui footer,body.vha-tools-hide-ui nav,body.vha-tools-hide-ui .gd-nav,body.vha-tools-hide-ui .gd-footer{opacity:0!important;pointer-events:none!important;transition:opacity .2s}
    body.vha-tools-hide-ui #vha-viewer-tools{opacity:1!important;pointer-events:auto!important}
    body.vha-tools-large-text main,body.vha-tools-large-text .gd{font-size:1.12em}
    #vha-viewer-tools .vha-mood-box{position:absolute;right:0;bottom:calc(100% + 12px);width:min(320px,calc(100vw - 24px));padding:12px;border:1px solid var(--theme-border,var(--theme-accent,#d8ff3e35));background:var(--theme-surface,#080e09);box-shadow:0 8px 26px #0009;pointer-events:auto}
    @media(max-width:760px){body.vha-game-interface{padding-bottom:88px!important}#vha-viewer-tools{width:calc(100vw - 12px);bottom:6px;gap:4px;padding:4px 5px;min-height:54px;overflow-x:auto;justify-content:flex-start;scrollbar-width:thin}#vha-viewer-tools .vha-mood-box{position:fixed!important;right:10px!important;bottom:68px!important}#vha-viewer-tools .vha-tools-side{flex:0 0 auto;gap:2px}#vha-viewer-tools .vha-tool-row{flex:0 0 auto;min-height:38px;gap:4px;padding:2px 5px;font-size:8px}#vha-viewer-tools .vha-tool-icon{width:22px;height:22px;flex-basis:22px}#vha-viewer-tools .vha-tool-icon svg{width:14px;height:14px}#vha-viewer-tools>.ego-bottom-hud.vha-universal-nav{flex-basis:46px!important;width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important}}
    @media(max-width:420px){#vha-viewer-tools{gap:2px}#vha-viewer-tools .vha-tool-row{font-size:7px;gap:3px;padding:2px 4px}#vha-viewer-tools .vha-tool-icon{width:19px;height:19px;flex-basis:19px}}
    /* Crystal-led viewer controls: closed by default, expanded on crystal press. */
    #vha-viewer-tools{display:flex;align-items:center;justify-content:center;gap:10px;width:58px;min-height:58px;height:58px;padding:0;border:0;background:transparent;box-shadow:none;backdrop-filter:none;overflow:visible;transition:width .2s,min-height .2s}
    #vha-viewer-tools>.vha-tools-side{display:none}
    #vha-viewer-tools>.ego-bottom-hud.vha-universal-nav{order:0!important;flex:0 0 58px!important;width:58px!important;height:58px!important;min-width:58px!important;min-height:58px!important}
    #vha-viewer-tools[data-open="true"]{width:min(1240px,calc(100vw - 24px));min-height:64px;height:auto;padding:5px 12px;border:1px solid var(--theme-border,rgba(185,215,122,.35));background:color-mix(in srgb,var(--theme-surface,#080e09) 94%,transparent);box-shadow:0 8px 28px #0009;backdrop-filter:blur(12px)}
    #vha-viewer-tools[data-open="true"]>.vha-tools-side{display:flex}
    #vha-viewer-tools[data-open="true"]>.ego-bottom-hud.vha-universal-nav{order:2!important}
    @media(max-width:760px){#vha-viewer-tools{width:52px;height:52px;min-height:52px}#vha-viewer-tools>.ego-bottom-hud.vha-universal-nav{flex-basis:52px!important;width:52px!important;height:52px!important;min-width:52px!important;min-height:52px!important}#vha-viewer-tools[data-open="true"]{width:calc(100vw - 12px);min-height:54px;height:auto;bottom:6px;gap:4px;padding:4px 5px;overflow-x:auto;justify-content:flex-start;scrollbar-width:thin}#vha-viewer-tools[data-open="true"]>.vha-tools-side{flex:0 0 auto;gap:2px}#vha-viewer-tools[data-open="true"]>.ego-bottom-hud.vha-universal-nav{flex-basis:46px!important;width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important}}
    @media(prefers-reduced-motion:reduce){#vha-viewer-tools *{transition:none!important}}
    /* Soft glass crystal dock: quiet contrast, translucent forest tones, and generous breathing room. */
    #vha-viewer-tools{
      width:min(880px,calc(100vw - 32px))!important;min-height:66px!important;height:auto!important;
      padding:7px 16px!important;gap:12px!important;border:1px solid rgba(174,199,157,.18)!important;
      border-radius:22px!important;background:rgba(7,16,11,.68)!important;
      background:color-mix(in srgb,var(--theme-surface,#0a130d) 76%,transparent)!important;
      box-shadow:0 10px 38px rgba(0,0,0,.22),inset 0 1px 0 rgba(231,241,222,.055)!important;
      -webkit-backdrop-filter:blur(26px) saturate(118%)!important;backdrop-filter:blur(26px) saturate(118%)!important;
      transition:width .45s cubic-bezier(.2,.7,.2,1),min-height .35s ease,background .35s ease,border-color .35s ease,box-shadow .35s ease!important;
    }
    #vha-viewer-tools[data-open="true"]{width:min(880px,calc(100vw - 32px))!important}
    #vha-viewer-tools .vha-tools-side{gap:5px!important}
    #vha-viewer-tools .vha-tool-row{min-height:46px!important;padding:5px 9px!important;gap:7px!important;border-radius:13px!important;color:rgba(224,233,218,.78)!important;font-size:10px!important;letter-spacing:.025em!important;transition:background .25s ease,color .25s ease,opacity .25s ease!important}
    #vha-viewer-tools .vha-tool-row:hover,#vha-viewer-tools .vha-tool-row:focus-visible{color:var(--theme-text,#e8f4df)!important;background:rgba(173,196,151,.085)!important;outline:1px solid rgba(173,196,151,.16)!important}
    #vha-viewer-tools .vha-tool-icon{width:26px!important;height:26px!important;flex-basis:26px!important;border:1px solid rgba(174,199,157,.18)!important;border-radius:9px!important;background:rgba(5,12,8,.32)!important;color:rgba(196,216,176,.86)!important}
    #vha-viewer-tools .vha-tool-icon svg{width:15px!important;height:15px!important}
    #vha-viewer-tools>.ego-bottom-hud.vha-universal-nav{flex-basis:58px!important;width:58px!important;height:58px!important;min-width:58px!important;min-height:58px!important;margin-inline:12px!important}
    #vha-viewer-tools .vha-map-toggle{border-radius:50%!important;background:radial-gradient(circle at 50% 35%,rgba(177,207,151,.13),rgba(8,17,11,.18) 72%)!important;filter:drop-shadow(0 0 10px rgba(164,194,138,.16))!important;transition:filter .35s ease,transform .35s ease!important}
    #vha-viewer-tools .vha-map-toggle:hover{filter:drop-shadow(0 0 15px rgba(164,194,138,.28))!important;transform:scale(1.035)}
    #vha-viewer-tools .vha-map-toggle svg{filter:drop-shadow(0 0 5px rgba(190,214,165,.18))!important}
    @media(max-width:760px){
      #vha-viewer-tools{width:calc(100vw - 18px)!important;min-height:58px!important;padding:5px 7px!important;gap:4px!important;border-radius:18px!important}
      #vha-viewer-tools[data-open="true"]{width:calc(100vw - 18px)!important;max-width:none!important;overflow-x:auto!important;scrollbar-width:none!important}
      #vha-viewer-tools[data-open="true"]::-webkit-scrollbar{display:none}
      #vha-viewer-tools .vha-tools-side{gap:1px!important}
      #vha-viewer-tools .vha-tool-row{min-height:42px!important;padding:3px 5px!important;gap:4px!important;font-size:8px!important}
      #vha-viewer-tools .vha-tool-icon{width:22px!important;height:22px!important;flex-basis:22px!important;border-radius:7px!important}
      #vha-viewer-tools>.ego-bottom-hud.vha-universal-nav{margin-inline:3px!important;flex-basis:48px!important;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important}
    }
    @media(prefers-reduced-motion:reduce){#vha-viewer-tools,#vha-viewer-tools *{transition:none!important}}

  `;
  document.head.appendChild(style);
  const icons = {
    mood:'<path d="M12 21s-8-4.4-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.6-8 11-8 11Z"/><path d="M8.5 12.5c1.8 1.8 5.2 1.8 7 0"/>',
    tools:'<path d="M22.1 2.2a7.1 7.1 0 0 1-8.5 8.5L6.2 18.1a2.8 2.8 0 0 1-4-4l7.4-7.4a7.1 7.1 0 0 1 8.5-8.5l-4.2 4.2 3.8 3.8z"/>',
    fullscreen:'<path d="M8 3H3v5M3 3l7 7M16 3h5v5m0-5-7 7M3 16v5h5m-5 0 7-7m13 2v5h-5m5 0-7-7"/>',
    moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    text:'<path d="M4 7V4h16v3M12 4v16M8 20h8"/>',
    reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  };
  const svg = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
  const root = document.createElement("aside");
  root.id = "vha-viewer-tools";
  root.setAttribute("aria-label","Viewer controls");
  root.dataset.moodOpen = "false";
  root.dataset.open = "false";
  root.innerHTML = '<div class="vha-tools-side vha-tools-left" aria-label="Viewer controls left"><button class="vha-tool-row" type="button" data-tool="fullscreen"><span class="vha-tool-icon">'+svg("fullscreen")+'</span><span>Fullscreen</span></button><button class="vha-tool-row" type="button" data-tool="radio" aria-pressed="false"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6M19.5 6.5a9 9 0 0 1 0 11"/></svg></span><span>V/A Radio</span></button><button class="vha-tool-row" type="button" data-tool="text" aria-pressed="false"><span class="vha-tool-icon">'+svg("text")+'</span><span>Text Size</span></button></div><div class="vha-tools-side vha-tools-right" aria-label="Viewer controls right"><button class="vha-tool-row" type="button" data-tool="mood" aria-expanded="false"><span class="vha-tool-icon">'+svg("mood")+'</span><span>Match my mood</span></button><button class="vha-tool-row" type="button" data-tool="reset-mood"><span class="vha-tool-icon">'+svg("reset")+'</span><span>Reset mood theme</span></button><a class="vha-tool-row" href="/landing-page/posts/community/" aria-label="Open Signals community"><span class="vha-tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18v3M8 21h8M12 3v2M5.6 8.6a9 9 0 0 0 0 6.8M18.4 8.6a9 9 0 0 1 0 6.8M2.8 5.8a13 13 0 0 0 0 12.4M21.2 5.8a13 13 0 0 1 0 12.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg></span><span>SIGNALS</span></a></div><div class="vha-mood-box"><label for="vha-mood-description">How are you feeling right now?</label><textarea id="vha-mood-description" maxlength="500" placeholder="Describe it in your own words…"></textarea><div class="vha-mood-presets" aria-label="Choose a feeling"><button type="button" data-mood-preset="calm">Calm</button><button type="button" data-mood-preset="sad">Sad</button><button type="button" data-mood-preset="anxious">Anxious</button><button type="button" data-mood-preset="happy">Happy</button><button type="button" data-mood-preset="angry">Angry</button><button type="button" data-mood-preset="tired">Tired</button><button type="button" data-mood-preset="focused">Focused</button><button type="button" data-mood-preset="hopeful">Hopeful</button><button type="button" data-mood-preset="romantic">Romantic</button></div><button type="button" data-tool="apply-mood">Adapt the site</button><div class="vha-mood-status" role="status" aria-live="polite"></div></div>';
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
  const crystalObserver=new MutationObserver(bindCrystal);
  crystalObserver.observe(root,{childList:true,subtree:true});
  document.addEventListener("click",event=>{if(root.dataset.open==="true"&&!root.contains(event.target)&&!event.target.closest(".vha-journey-note")){root.dataset.open="false";root.setAttribute("aria-expanded","false");document.dispatchEvent(new CustomEvent("vha-tools-state-change",{detail:{open:false}}))}});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&root.dataset.open==="true"){root.dataset.open="false";root.setAttribute("aria-expanded","false");document.dispatchEvent(new CustomEvent("vha-tools-state-change",{detail:{open:false}}))}});
  const navHud = document.querySelector(".ego-bottom-hud.vha-universal-nav");
  if (navHud) {
    navHud.parentNode.insertBefore(root, navHud);
    root.insertBefore(navHud,root.querySelector(".vha-tools-side.vha-tools-right"));
  } else {
    document.body.appendChild(root);
  }

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
    if(document.fullscreenElement){try{await document.exitFullscreen()}catch{}}
  });
  document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&presentationActive)stopPresentation()});
  manuscript.addEventListener("keydown",e=>{
    if(!presentationActive||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.target&&(e.target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)))return;
    if(["ArrowRight","ArrowDown","PageDown"," "].includes(e.key)){e.preventDefault();navigateManuscriptChapter(slideIndex+1)}
    else if(["ArrowLeft","ArrowUp","PageUp","Backspace"].includes(e.key)){e.preventDefault();navigateManuscriptChapter(slideIndex-1)}
    else if(e.key==="Home"){e.preventDefault();navigateManuscriptChapter(0)}
    else if(e.key==="End"){e.preventDefault();navigateManuscriptChapter(manuscriptSlides.length-1)}
    else if(e.key==="Escape"&&!document.fullscreenElement){stopPresentation()}
  });
  try {
    if(sessionStorage.getItem("vha-manuscript-continue")==="1"){
      sessionStorage.removeItem("vha-manuscript-continue");
      startPresentation();
    }
  } catch {}
  function setMoodTheme(name,colors){
    const [page,surface,textColor,accent]=colors,html=document.documentElement;
    html.style.setProperty("--theme-page",page);html.style.setProperty("--theme-surface",surface);html.style.setProperty("--theme-raised",surface);html.style.setProperty("--theme-text",textColor);html.style.setProperty("--theme-muted",textColor+"b0");html.style.setProperty("--theme-accent",accent);html.style.setProperty("--theme-secondary",accent);html.style.setProperty("--theme-border",accent+"70");html.style.setProperty("--theme-glow",accent+"35");
    html.dataset.vhaMood=name;document.body.style.backgroundColor=page;document.body.style.color=textColor;
    let fontLink=document.getElementById("vha-mood-fonts");
    if(!fontLink){fontLink=document.createElement("link");fontLink.id="vha-mood-fonts";fontLink.rel="stylesheet";fontLink.href="https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&family=Great+Vibes&family=Metal+Mania&display=swap";document.head.appendChild(fontLink);}
    let globalStyle=document.getElementById("vha-mood-global-overrides");
    if(!globalStyle){globalStyle=document.createElement("style");globalStyle.id="vha-mood-global-overrides";document.head.appendChild(globalStyle);}
    globalStyle.textContent=`html[data-vha-mood],html[data-vha-mood] body,html[data-vha-mood] body>*,html[data-vha-mood] body>div,html[data-vha-mood] #app,html[data-vha-mood] #root,html[data-vha-mood] main,html[data-vha-mood] .gd,html[data-vha-mood] .gd-main,html[data-vha-mood] .gd-shell,html[data-vha-mood] .gd-page,html[data-vha-mood] .posts-main,html[data-vha-mood] .posts-content,html[data-vha-mood] .posts-page,html[data-vha-mood] .song-page,html[data-vha-mood] .cv-page,html[data-vha-mood] .cv-shell,html[data-vha-mood] .page-shell,html[data-vha-mood] .site-shell,html[data-vha-mood] .hero,html[data-vha-mood] .gd-hero{background-color:var(--theme-page)!important;color:var(--theme-text)!important}html[data-vha-mood] header,html[data-vha-mood] footer,html[data-vha-mood] nav,html[data-vha-mood] section,html[data-vha-mood] article,html[data-vha-mood] aside:not(#vha-viewer-tools),html[data-vha-mood] .gd-nav,html[data-vha-mood] .gd-footer,html[data-vha-mood] .gd-panel,html[data-vha-mood] .gd-card,html[data-vha-mood] .gd-radio,html[data-vha-mood] .gd-move,html[data-vha-mood] .post-card,html[data-vha-mood] .posts-note,html[data-vha-mood] .posts-filters,html[data-vha-mood] .viewer-console,html[data-vha-mood] .song-panel,html[data-vha-mood] .song-player-card,html[data-vha-mood] .cv-card,html[data-vha-mood] .cv-section,html[data-vha-mood] .transmission-card{background-color:var(--theme-surface)!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}html[data-vha-mood] h1,html[data-vha-mood] h2,html[data-vha-mood] h3,html[data-vha-mood] p,html[data-vha-mood] li,html[data-vha-mood] label,html[data-vha-mood] .gd-brand strong,html[data-vha-mood] .gd-brand small{color:var(--theme-text)!important}html[data-vha-mood] a:not(.vha-tools-trigger),html[data-vha-mood] em,html[data-vha-mood] .gd-kicker,html[data-vha-mood] .gd-status,html[data-vha-mood] .post-category{color:var(--theme-accent)!important;border-color:var(--theme-border)!important}html[data-vha-mood] input,html[data-vha-mood] textarea,html[data-vha-mood] select,html[data-vha-mood] [contenteditable=true]{background:var(--theme-surface)!important;background-image:none!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}
/* Explicitly theme high-specificity components on the CV and shared navigation. */
html[data-vha-mood] .cv-wrap,html[data-vha-mood] .cv-hero,html[data-vha-mood] .cv-section,html[data-vha-mood] .cv-targets,html[data-vha-mood] .cv-floating-nav,html[data-vha-mood] .cv-floating-head,html[data-vha-mood] .cv-contact-panel,html[data-vha-mood] .cv-skills span,html[data-vha-mood] .cv-quicklinks,html[data-vha-mood] .cv-actions,html[data-vha-mood] .cv-actions a,html[data-vha-mood] .cv-actions button,html[data-vha-mood] .cv-floating-links button{background-color:var(--theme-surface)!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important}
html[data-vha-mood] .vha-main-nav,html[data-vha-mood] .vha-main-nav>a,html[data-vha-mood] .vha-nav-dropdown,html[data-vha-mood] .vha-nav-dropdown>summary,html[data-vha-mood] .vha-nav-menu,html[data-vha-mood] .vha-nav-menu>a,html[data-vha-mood] .vha-community-button,html[data-vha-mood] .gd-nav,html[data-vha-mood] .gd-nav>a{background-color:var(--theme-surface)!important;color:var(--theme-text)!important;border-color:var(--theme-border)!important;box-shadow:none!important}
html[data-vha-mood] .vha-main-nav>a:hover,html[data-vha-mood] .vha-main-nav>a:focus-visible,html[data-vha-mood] .vha-nav-dropdown>summary:hover,html[data-vha-mood] .vha-nav-menu>a:hover,html[data-vha-mood] .vha-community-button:hover,html[data-vha-mood] .cv-floating-links button:hover,html[data-vha-mood] .cv-actions a:hover,html[data-vha-mood] .cv-actions button:hover{background-color:var(--theme-accent)!important;color:var(--theme-page)!important}
html[data-vha-mood] .cv-name span,html[data-vha-mood] .cv-kicker,html[data-vha-mood] .cv-role,html[data-vha-mood] .cv-floating-head strong,html[data-vha-mood] .cv-section h2 em{color:var(--theme-accent)!important}
html[data-vha-mood] .vha-main-nav .active,html[data-vha-mood] .vha-main-nav [aria-current=page]{border-color:var(--theme-accent)!important;color:var(--theme-accent)!important}
/* Complete coverage for Green Dream components that use their own fixed colours. */
html[data-vha-mood] .gd-cv-profile,
html[data-vha-mood] .gd-cvgrid,
html[data-vha-mood] .gd-circle-portal,
html[data-vha-mood] .gd-listening,
html[data-vha-mood] #gd-listening,
html[data-vha-mood] .gd-media-row,
html[data-vha-mood] .gd-suno-row,
html[data-vha-mood] .gd-nav-dropdown,
html[data-vha-mood] .gd-nav-dropdown[open] .gd-nav-menu,
html[data-vha-mood] .vha-nav-dropdown,
html[data-vha-mood] .vha-nav-dropdown[open] .vha-nav-menu {
  color:var(--theme-text)!important;
  background-color:var(--theme-surface)!important;
  border-color:var(--theme-border)!important;
  box-shadow:var(--vha-mood-shadow,none)!important;
}
html[data-vha-mood] .gd-cv-profile,
html[data-vha-mood] .gd-circle-portal,
html[data-vha-mood] .gd-listening,
html[data-vha-mood] #gd-listening,
html[data-vha-mood] .gd-media-row,
html[data-vha-mood] .gd-suno-row,
html[data-vha-mood] .gd-nav-dropdown .gd-nav-menu,
html[data-vha-mood] .vha-nav-dropdown .vha-nav-menu {
  background-image:none!important;
}
html[data-vha-mood] .gd-cv-profile *,
html[data-vha-mood] .gd-cvgrid *,
html[data-vha-mood] .gd-circle-portal *,
html[data-vha-mood] .gd-listening *,
html[data-vha-mood] #gd-listening *,
html[data-vha-mood] .gd-media-row *,
html[data-vha-mood] .gd-suno-row *,
html[data-vha-mood] .gd-nav-dropdown *,
html[data-vha-mood] .vha-nav-dropdown * {
  border-color:var(--theme-border)!important;
}
html[data-vha-mood] .gd-cv-profile :is(h1,h2,h3,h4,p,span,strong,small,li,label),
html[data-vha-mood] .gd-cvgrid :is(h1,h2,h3,h4,p,span,strong,small,li,label),
html[data-vha-mood] .gd-circle-portal :is(h1,h2,h3,h4,p,span,strong,small,li,label),
html[data-vha-mood] .gd-listening :is(h1,h2,h3,h4,p,span,strong,small,li,label),
html[data-vha-mood] #gd-listening :is(h1,h2,h3,h4,p,span,strong,small,li,label),
html[data-vha-mood] .gd-media-row :is(h1,h2,h3,h4,p,span,strong,small,li,label),
html[data-vha-mood] .gd-suno-row :is(h1,h2,h3,h4,p,span,strong,small,li,label),
html[data-vha-mood] .gd-nav-dropdown :is(summary,a,span,strong,small),
html[data-vha-mood] .vha-nav-dropdown :is(summary,a,span,strong,small) {
  color:var(--theme-text)!important;
}
html[data-vha-mood] .gd-cv-profile :is(a,button),
html[data-vha-mood] .gd-cvgrid :is(a,button),
html[data-vha-mood] .gd-circle-portal :is(a,button),
html[data-vha-mood] .gd-listening :is(a,button),
html[data-vha-mood] #gd-listening :is(a,button),
html[data-vha-mood] .gd-media-row :is(a,button),
html[data-vha-mood] .gd-suno-row :is(a,button),
html[data-vha-mood] .gd-nav-dropdown .gd-nav-menu a,
html[data-vha-mood] .vha-nav-dropdown .vha-nav-menu a {
  color:var(--theme-accent)!important;
  border-color:var(--theme-border)!important;
}
html[data-vha-mood] .gd-cv-profile :is(a,button):hover,
html[data-vha-mood] .gd-cvgrid :is(a,button):hover,
html[data-vha-mood] .gd-circle-portal :is(a,button):hover,
html[data-vha-mood] .gd-listening :is(a,button):hover,
html[data-vha-mood] #gd-listening :is(a,button):hover,
html[data-vha-mood] .gd-media-row :is(a,button):hover,
html[data-vha-mood] .gd-suno-row :is(a,button):hover,
html[data-vha-mood] .gd-nav-dropdown .gd-nav-menu a:hover,
html[data-vha-mood] .vha-nav-dropdown .vha-nav-menu a:hover {
  background-color:var(--theme-accent)!important;
  color:var(--theme-page)!important;
}
html[data-vha-mood] .gd-cv-profile :is(button,input,select,textarea),
html[data-vha-mood] .gd-cvgrid :is(button,input,select,textarea),
html[data-vha-mood] .gd-circle-portal :is(button,input,select,textarea),
html[data-vha-mood] .gd-listening :is(button,input,select,textarea),
html[data-vha-mood] #gd-listening :is(button,input,select,textarea),
html[data-vha-mood] .gd-media-row :is(button,input,select,textarea),
html[data-vha-mood] .gd-suno-row :is(button,input,select,textarea) {
  background-color:var(--theme-surface)!important;
  color:var(--theme-text)!important;
  border-color:var(--theme-border)!important;
}
html[data-vha-mood] .gd-cv-profile,
html[data-vha-mood] .gd-circle-portal,
html[data-vha-mood] .gd-listening,
html[data-vha-mood] #gd-listening,
html[data-vha-mood] .gd-media-row,
html[data-vha-mood] .gd-suno-row,
html[data-vha-mood] .gd-nav-dropdown .gd-nav-menu,
html[data-vha-mood] .vha-nav-dropdown .vha-nav-menu {
  border-radius:var(--vha-mood-radius)!important;
  transition:background-color .35s ease,color .35s ease,border-color .35s ease,border-radius .35s ease,box-shadow .35s ease;
}
html[data-vha-mood] .gd-cv-profile :is(svg),
html[data-vha-mood] .gd-circle-portal :is(svg),
html[data-vha-mood] .gd-listening :is(svg),
html[data-vha-mood] #gd-listening :is(svg),
html[data-vha-mood] .gd-media-row :is(svg),
html[data-vha-mood] .gd-suno-row :is(svg) {
  color:var(--theme-accent)!important;
  stroke:var(--theme-accent)!important;
}
`;
    const moodProfiles={
      calm:{radius:"16px",shadow:"0 8px 26px #0002",line:"1.9",spacing:"0.015em",font:'Arial,Helvetica,sans-serif',display:'Arial,Helvetica,sans-serif',gap:"28px",panelPadding:"32px"},
      sad:{radius:"9px",shadow:"0 5px 20px #0003",line:"1.85",spacing:"0.01em",font:'Georgia,"Times New Roman",serif',display:'Georgia,"Times New Roman",serif',gap:"20px",panelPadding:"26px"},
      anxious:{radius:"10px",shadow:"none",line:"1.8",spacing:"0.01em",font:'Arial,Helvetica,sans-serif',display:'Arial,Helvetica,sans-serif',gap:"30px",panelPadding:"32px"},
      happy:{radius:"22px",shadow:"0 10px 30px #0003",line:"1.75",spacing:"0.01em",font:'"Comic Neue","Comic Sans MS",cursive',display:'"Comic Neue","Comic Sans MS",cursive',gap:"22px",panelPadding:"30px"},
      angry:{radius:"2px",shadow:"0 4px 18px #0005",line:"1.6",spacing:"0.04em",font:'Arial,Helvetica,sans-serif',display:'"Metal Mania",Impact,fantasy',gap:"14px",panelPadding:"22px"},
      romantic:{radius:"20px",shadow:"0 10px 32px #0003",line:"1.9",spacing:"0.01em",font:'Georgia,"Times New Roman",serif',display:'"Great Vibes","Brush Script MT",cursive',gap:"34px",panelPadding:"36px"},
      tired:{radius:"13px",shadow:"none",line:"1.95",spacing:"0.005em",font:'Arial,Helvetica,sans-serif',display:'Georgia,"Times New Roman",serif',gap:"30px",panelPadding:"32px"},
      focused:{radius:"4px",shadow:"none",line:"1.6",spacing:"0.025em",font:'Arial,Helvetica,sans-serif',display:'Arial,Helvetica,sans-serif',gap:"16px",panelPadding:"22px"},
      hopeful:{radius:"22px",shadow:"0 10px 30px #0002",line:"1.85",spacing:"0.015em",font:'"Trebuchet MS",Arial,sans-serif',display:'"Trebuchet MS",Arial,sans-serif',gap:"30px",panelPadding:"34px"},
      reflective:{radius:"9px",shadow:"0 8px 24px #0003",line:"1.75",spacing:"0.015em",font:'Georgia,"Times New Roman",serif',display:'Georgia,"Times New Roman",serif',gap:"24px",panelPadding:"30px"}
    };
    const profile=moodProfiles[name]||moodProfiles.reflective;
    let moodStyle=document.getElementById("vha-mood-profile");
    if(!moodStyle){moodStyle=document.createElement("style");moodStyle.id="vha-mood-profile";document.head.appendChild(moodStyle);}
    moodStyle.textContent=`html[data-vha-mood]{--vha-mood-radius:${profile.radius};--vha-mood-shadow:${profile.shadow};--vha-mood-line:${profile.line};--vha-mood-spacing:${profile.spacing};--vha-mood-font:${profile.font};--vha-mood-display-font:${profile.display};--vha-mood-gap:${profile.gap};--vha-mood-panel-padding:${profile.panelPadding}}
      html[data-vha-mood] body,html[data-vha-mood] body *{font-family:var(--vha-mood-font)!important}
      html[data-vha-mood] :is(h1,h2,h3,h4,h5,h6,.gd-hero h1,.gd-section h2,.gd-listening h2,.cv-name,.cv-section h2,.post-title,.posts-title){font-family:var(--vha-mood-display-font)!important}
      html[data-vha-mood] :is(.gd-movements,.gd-lower,.gd-listening,.cv-columns,.cv-skills,.gd-cvgrid,.posts-grid,#posts-list,.gd-section-head){gap:var(--vha-mood-gap)!important}
      html[data-vha-mood] :is(.gd-panel,.cv-hero,.cv-contact-panel){padding:var(--vha-mood-panel-padding)!important}
      html[data-vha-mood] .gd-panel,html[data-vha-mood] .gd-card,html[data-vha-mood] .gd-radio,html[data-vha-mood] .gd-move,html[data-vha-mood] .post-card,html[data-vha-mood] .posts-note,html[data-vha-mood] .posts-filters,html[data-vha-mood] .viewer-console,html[data-vha-mood] .song-panel,html[data-vha-mood] .song-player-card,html[data-vha-mood] .cv-card,html[data-vha-mood] .cv-section,html[data-vha-mood] .transmission-card,html[data-vha-mood] .cv-wrap{border-radius:var(--vha-mood-radius)!important;box-shadow:var(--vha-mood-shadow)!important;transition:border-radius .35s ease,box-shadow .35s ease,background-color .35s ease}
      html[data-vha-mood] p,html[data-vha-mood] li,html[data-vha-mood] .post-excerpt,html[data-vha-mood] .gd-copy{line-height:var(--vha-mood-line)!important;letter-spacing:var(--vha-mood-spacing)}
      html[data-vha-mood="calm"] .gd-panel,html[data-vha-mood="calm"] .post-card,html[data-vha-mood="calm"] .cv-card{border-width:1px!important}
      html[data-vha-mood="sad"] .gd-kicker,html[data-vha-mood="sad"] .post-category{opacity:.82}
      html[data-vha-mood="anxious"] *,html[data-vha-mood="anxious"] *::before,html[data-vha-mood="anxious"] *::after,html[data-vha-mood="tired"] *,html[data-vha-mood="tired"] *::before,html[data-vha-mood="tired"] *::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.12s!important}
      html[data-vha-mood="happy"] button,html[data-vha-mood="happy"] .gd-button,html[data-vha-mood="happy"] .post-card{border-radius:var(--vha-mood-radius)!important}
      html[data-vha-mood="angry"] h1,html[data-vha-mood="angry"] h2,html[data-vha-mood="angry"] h3{font-weight:800!important;letter-spacing:.045em}
      html[data-vha-mood="focused"] .gd-panel,html[data-vha-mood="focused"] .post-card,html[data-vha-mood="focused"] .cv-card{border-width:1px!important}
      html[data-vha-mood="focused"] a:not(.vha-tools-trigger){text-decoration-thickness:1px;text-underline-offset:3px}
      html[data-vha-mood="tired"] p,html[data-vha-mood="tired"] li{font-size:1.035em}
      html[data-vha-mood="hopeful"] .gd-panel,html[data-vha-mood="hopeful"] .post-card,html[data-vha-mood="hopeful"] .cv-card{border-width:1px!important}`;
    try{localStorage.setItem("vha-mood-palette",JSON.stringify({name,colors}));}catch{}
  }
  function resetMoodTheme(){
    const html=document.documentElement;
    ["--theme-page","--theme-surface","--theme-raised","--theme-text","--theme-muted","--theme-accent","--theme-secondary","--theme-border","--theme-glow"].forEach(k=>html.style.removeProperty(k));
    delete html.dataset.vhaMood;document.body.style.removeProperty("background-color");document.body.style.removeProperty("color");document.getElementById("vha-mood-global-overrides")?.remove();document.getElementById("vha-mood-profile")?.remove();document.getElementById("vha-mood-fonts")?.remove();
    try{localStorage.removeItem("vha-mood-palette");}catch{}
  }
  try{const saved=JSON.parse(localStorage.getItem("vha-mood-palette")||"null");if(saved?.name&&Array.isArray(saved.colors)&&saved.colors.length===4)setMoodTheme(saved.name,saved.colors);}catch{}
  const trigger = root.querySelector(".vha-tools-trigger");
  const panel = root.querySelector(".vha-tools-panel");
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

  root.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",async()=>{
    const tool=button.dataset.tool;
    if(tool==="radio"){
      const radio=document.getElementById("gd-radio");
      if(!radio)return;
      const hidden=radio.classList.contains("radio-hidden");
      radio.classList.toggle("radio-hidden",!hidden);
      radio.setAttribute("aria-hidden",String(!hidden));
      button.setAttribute("aria-pressed",String(!hidden));
      const close=radio.querySelector("#gd-close");
      if(close){
        close.textContent=hidden?"−":"+";
        close.setAttribute("aria-expanded",String(hidden));
        close.setAttribute("aria-label",hidden?"Minimize radio":"Restore radio from Viewer Tools");
      }
      return;
    }if(tool==="mood"){const open=root.dataset.moodOpen!=="true";root.dataset.moodOpen=String(open);button.setAttribute("aria-expanded",String(open));if(open)root.querySelector("#vha-mood-description").focus();return}
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
        {name:"romantic",words:["romantic","in love","love","loving","tender","affectionate","intimate","dreamy","yearning"],colors:["#160d17","#251326","#f4dfeb","#d99abd"]},
        {name:"angry",words:["angry","furious","mad","frustrated","irritated","rage"],colors:["#160b0b","#26100e","#f1d2c7","#ec8067"]},
        {name:"tired",words:["tired","exhausted","sleepy","drained","burnt out","burned out","fatigued"],colors:["#0d1013","#171d22","#d2dce0","#9eafb8"]},
        {name:"focused",words:["focused","productive","determined","motivated","ready to work","concentrate"],colors:["#080f12","#0d1b20","#d0e6e9","#72c4cc"]},
        {name:"hopeful",words:["hopeful","optimistic","inspired","curious","looking forward","encouraged"],colors:["#0b1008","#14200d","#e1efc8","#a8d66b"]}
      ];
      const ranked=moods.map(m=>({...m,score:m.words.reduce((score,word)=>score+(t.includes(word)?(word.includes(" ") ? 2 : 1):0),0)})).sort((a,b)=>b.score-a.score);
      const match=ranked[0]?.score>0?ranked[0]:null;
      const palette=match||{name:"reflective",colors:["#050906","#080e09","#e8f4df","#d8ff3e"]};
      setMoodTheme(palette.name,palette.colors);
      const moodName=match?.name||"reflective";
      const article=["anxious","angry"].includes(moodName)?"an":"a";
      status.textContent=match?"The website is now tuned for "+article+" "+moodName+" mood. Colours, typography, spacing and visual treatment have been adjusted across pages.":"No clear mood was detected, so a reflective theme was applied. Try words such as calm, anxious, happy or focused.";
      return;
    }
    if(tool==="reset-mood"){
      resetMoodTheme();
      root.querySelector("#vha-mood-description").value="";
      root.querySelector(".vha-mood-status").textContent="Default website theme restored across the website.";return;
    }
    if(tool==="fullscreen"){if(hasPostPermalink()&&document.querySelector("#posts-list > .post-card")){if(document.body.classList.contains("vha-post-fullscreen"))stopPostReader();else startPostReader()}else{try{if(!document.fullscreenElement){await document.documentElement.requestFullscreen();startPresentation()}else{stopPresentation();await document.exitFullscreen()}}catch{startPresentation();alert("Browser fullscreen is unavailable here. Presentation navigation is still active; use the arrows or Space to move through the page.")}}}
    else if(tool==="text"){const active=!document.body.classList.contains("vha-tools-large-text");setViewerTextSize(active);button.setAttribute("aria-pressed",String(active))}
  }));
})();


/* Viewer HUD // crystal centred between the page controls. */
(() => {
 const style=document.createElement("style");
 style.id="vha-viewer-tools-centre-style";
 style.textContent=`
  #vha-viewer-tools[data-open="true"]{justify-content:space-between!important}
  #vha-viewer-tools[data-open="true"]>.vha-tools-side{flex:1 1 0!important;min-width:0!important}
  #vha-viewer-tools[data-open="true"]>.ego-bottom-hud.vha-universal-nav{order:1!important;flex:0 0 58px!important;margin-inline:clamp(8px,2vw,28px)!important}
  #vha-viewer-tools[data-open="true"]>.vha-tools-side.vha-tools-left{order:0!important}
  #vha-viewer-tools[data-open="true"]>.vha-tools-side.vha-tools-right{order:2!important}
  @media(max-width:760px){
   #vha-viewer-tools[data-open="true"]{justify-content:center!important}
   #vha-viewer-tools[data-open="true"]>.vha-tools-side{flex:1 1 0!important}
   #vha-viewer-tools[data-open="true"]>.ego-bottom-hud.vha-universal-nav{order:1!important;flex:0 0 46px!important;margin-inline:3px!important}
  }
 `;
 document.head.appendChild(style);
})();
