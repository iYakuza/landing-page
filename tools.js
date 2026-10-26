/* Verse After Hours — site-wide Tools launcher and theme receiver */
(() => {
  if (new URLSearchParams(location.search).get("tool") === "theme") { document.body.classList.add("vha-theme-tool-embed"); return; }
  if (document.getElementById("vha-tools-launcher")) return;
  const root = document.documentElement;
  const launcher = document.createElement("aside");
  launcher.id = "vha-tools-launcher";
  launcher.innerHTML = '<button id="vha-tools-trigger" type="button" aria-label="Open tools" aria-expanded="false" title="Tools"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/><path d="m19.4 13.5 1.1.9-1.4 2.5-1.4-.5a7.8 7.8 0 0 1-1.6.9l-.3 1.5h-2.9l-.3-1.5a7.8 7.8 0 0 1-1.6-.9l-1.4.5-1.4-2.5 1.1-.9a7.2 7.2 0 0 1 0-1.8l-1.1-.9 1.4-2.5 1.4.5a7.8 7.8 0 0 1 1.6-.9l.3-1.5h2.9l.3 1.5a7.8 7.8 0 0 1 1.6.9l1.4-.5 1.4 2.5-1.1.9a7.2 7.2 0 0 1 0 1.8Z" transform="translate(-1 -1) scale(.96)"/></svg></button><button id="vha-tools-menu-item" type="button" aria-expanded="false">LOCAL THEME STUDIO <span>↖</span></button><section id="vha-tools-panel" aria-label="Website tools" aria-hidden="true"><header class="vha-tools-head"><strong>TOOLS // LOCAL THEME STUDIO</strong><button type="button" id="vha-tools-close" aria-label="Close tools">CLOSE ×</button></header><iframe title="Local Theme Studio" src="' + "/landing-page/posts/?tool=theme" + '" loading="lazy"></iframe><div class="vha-tool-note">Describe how you feel. Apply a theme to this page in your browser.</div></section>';
  document.body.appendChild(launcher);
  const trigger = launcher.querySelector("#vha-tools-trigger");
  const panel = launcher.querySelector("#vha-tools-panel");
  const frame = launcher.querySelector("iframe");
  function open(opened) {
    panel.classList.toggle("is-open", opened);
    panel.setAttribute("aria-hidden", String(!opened));
    trigger.setAttribute("aria-expanded", String(opened));
    trigger.setAttribute("aria-label", opened ? "Close tools" : "Open tools");
    if (opened && !frame.dataset.loaded) frame.dataset.loaded = "true";
  }
  trigger.addEventListener("click", () => open(!panel.classList.contains("is-open")));
  launcher.querySelector("#vha-tools-close").addEventListener("click", () => open(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape") open(false); });
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
    if (e.source !== frame.contentWindow || e.data?.type !== "vha-theme-apply") return;
    applyTheme(e.data.theme);
  });
  try {
    const saved = JSON.parse(localStorage.getItem("vha-global-theme") || "null");
    if (saved?.theme) applyTheme(saved.theme);
  } catch {}
})();
