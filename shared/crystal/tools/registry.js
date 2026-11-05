/* Central registry bootstrap for shared navigation and accessibility tools. */
(() => {
  const crystal = window.VHACrystal;
  if (!crystal) throw new Error("Crystal runtime must load before its registry.");
  crystal.registryReady = true;
  crystal.registerTool({
    id: "text-size",
    label: "TEXT SIZE",
    description: "Increase or restore page text size for readability.",
    presentation: "dock",
    run: () => document.querySelector('#vha-viewer-tools [data-tool="text"]')?.click()
  });
  crystal.registerTool({
    id: "constellation",
    label: "CONSTELLATION",
    description: "Open or close the website navigation constellation.",
    presentation: "overlay",
    run: () => document.querySelector(".vha-map-toggle")?.click()
  });
})();