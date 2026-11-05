/* Central registry bootstrap. Tool modules register themselves with the runtime. */
(() => {
  const crystal = window.VHACrystal;
  if (!crystal) throw new Error("Crystal runtime must load before its registry.");
  crystal.registryReady = true;
  crystal.registerTool({
    id: "constellation",
    label: "CONSTELLATION",
    description: "Open or close the website navigation constellation.",
    presentation: "overlay",
    run: () => document.querySelector(".vha-map-toggle")?.click()
  });
})();