/* Verse After Hours — site-wide Tools launcher and theme receiver */
(() => {
  if (new URLSearchParams(location.search).get("tool") === "theme") { document.body.classList.add("vha-theme-tool-embed"); return; }
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
