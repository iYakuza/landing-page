/* One-line integration point for every page on the site. */
(() => {
  if (window.__vhaCrystalLoaderStarted) return;
  window.__vhaCrystalLoaderStarted = true;
  const base = "/landing-page/shared/crystal/";
  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = base + src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load Crystal module: " + src));
    document.head.appendChild(script);
  });
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = base + "crystal.css";
  document.head.appendChild(stylesheet);
  (async () => {
    try {
      await loadScript("crystal.js");
      await loadScript("tools/registry.js");
      for (const tool of ["star-patterns.js", "mood.js", "radio.js", "constellation.js", "presentation.js"]) {
        await loadScript("tools/" + tool);
      }
      document.documentElement.dataset.vhaCrystalRuntime = "ready";
      window.VHACrystal?.refresh();
    } catch (error) {
      document.documentElement.dataset.vhaCrystalRuntime = "error";
      console.error("[V/A Crystal]", error);
    }
  })();
})();