/* Verse After Hours — shared Crystal runtime.
   The runtime owns lifecycle and tool registration. Page-specific rendering remains
   in the compatibility layer until each legacy tool is migrated into its module. */
(() => {
  if (window.VHACrystal) return;
  const tools = new Map();
  let open = false;
  const api = {
    version: "1.0.0",
    registerTool(tool) {
      if (!tool || !/^[a-z0-9-]+$/.test(tool.id || "") || typeof tool.run !== "function") {
        throw new TypeError("A Crystal tool needs a valid id and run() method.");
      }
      tools.set(tool.id, Object.freeze({ ...tool }));
      document.dispatchEvent(new CustomEvent("vha-crystal-tools-change", {
        detail: { tools: [...tools.values()].map(({ id, label, description, presentation }) => ({ id, label, description, presentation })) }
      }));
      return () => tools.delete(tool.id);
    },
    getTools() { return [...tools.values()]; },
    getTool(id) { return tools.get(id) || null; },
    runTool(id, context = {}) {
      const tool = tools.get(id);
      if (!tool) return false;
      tool.run(context);
      return true;
    },
    setOpen(value, source = "api") {
      open = Boolean(value);
      document.body?.classList.toggle("vha-crystal-open", open);
      document.dispatchEvent(new CustomEvent("vha-crystal-state-change", {
        detail: { open, source }
      }));
    },
    isOpen() { return open; },
    refresh() {
      open = Boolean(document.body?.classList.contains("vha-crystal-open"));
      document.dispatchEvent(new CustomEvent("vha-crystal-ready", {
        detail: { open, tools: [...tools.values()] }
      }));
    }
  };
  window.VHACrystal = api;
  document.addEventListener("vha-crystal-mode-change", event => {
    open = Boolean(event.detail?.open);
    document.dispatchEvent(new CustomEvent("vha-crystal-state-change", {
      detail: { open, source: "legacy-adapter" }
    }));
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => api.refresh(), { once: true });
  } else api.refresh();
})();