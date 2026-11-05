/* Central tool registry entry point. Tool modules register through VHACrystal. */
(() => {
  if (!window.VHACrystal) throw new Error("Crystal core must load before its tool registry.");
  window.VHACrystal.registryReady = true;
})();