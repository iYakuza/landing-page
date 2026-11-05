/* Crystal lifecycle API and central tool registry. */
(() => {
  if (window.VHACrystal) return;
  const tools = new Map();
  let open = false;
  window.VHACrystal = {
    version: "1.0.0",
    registerTool(tool) {
      if (!tool || !/^[a-z0-9-]+$/.test(tool.id || "") || typeof tool.run !== "function") throw new TypeError("Invalid Crystal tool.");
      tools.set(tool.id, Object.freeze({ ...tool }));
      document.dispatchEvent(new CustomEvent("vha-crystal-tools-change", { detail: { tools: [...tools.values()] } }));
      return () => tools.delete(tool.id);
    },
    getTools: () => [...tools.values()],
    getTool: id => tools.get(id) || null,
    runTool(id, context = {}) {
      const tool = tools.get(id);
      if (!tool) return false;
      tool.run(context);
      return true;
    },
    setOpen(value, source = "api") {
      open = Boolean(value);
      document.body?.classList.toggle("vha-crystal-open", open);
      document.dispatchEvent(new CustomEvent("vha-crystal-state-change", { detail: { open, source } }));
    },
    isOpen: () => open,
    refresh() {
      open = Boolean(document.body?.classList.contains("vha-crystal-open"));
      document.dispatchEvent(new CustomEvent("vha-crystal-ready", { detail: { open, tools: [...tools.values()] } }));
    }
  };
  document.addEventListener("vha-crystal-mode-change", event => {
    open = Boolean(event.detail?.open);
    document.dispatchEvent(new CustomEvent("vha-crystal-state-change", { detail: { open, source: "constellation" } }));
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.VHACrystal.refresh(), { once: true });
  else window.VHACrystal.refresh();
})();