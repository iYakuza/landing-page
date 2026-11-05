/* Star Patterns — preset picker, constellation layouts and persistence. */
(() => {
  const patterns = {
    "orion": [[25,24],[33,35],[42,47],[50,39],[58,47],[67,35],[75,24],[50,15],[39,15],[61,15],[30,62],[70,62],[50,72]],
    "ursa-major": [[20,29],[30,23],[41,27],[52,35],[63,43],[72,55],[80,68],[61,64],[48,55],[36,49],[25,44],[19,58],[70,22]],
    "cassiopeia": [[20,38],[31,23],[43,41],[56,22],[69,40],[77,56],[65,68],[51,57],[38,71],[24,59],[44,14],[61,73],[78,26]],
    "cygnus": [[50,10],[50,24],[50,40],[50,57],[50,72],[34,30],[66,30],[25,20],[75,20],[37,49],[63,49],[39,67],[61,67]],
    "scorpius": [[25,15],[36,21],[47,32],[57,45],[64,58],[61,70],[51,76],[73,69],[78,56],[74,42],[65,30],[48,14],[34,10]]
  };
  function applyPattern(button) {
    const map = document.getElementById("vha-world-map");
    const pattern = patterns[button.dataset.constellation];
    const nodes = [...(map?.querySelectorAll(".vha-map-node") || [])];
    if (!map || !pattern || !nodes.length) return;
    const saved = map.vhaConstellation?.getSavedPositions?.() || {};
    nodes.forEach((node, index) => {
      const [x, y] = pattern[index % pattern.length];
      node.style.setProperty("--star-x", x + "%");
      node.style.setProperty("--star-y", y + "%");
      node.style.setProperty("left", x + "%", "important");
      node.style.setProperty("top", y + "%", "important");
      saved[node.dataset.node] = { x, y };
    });
    try { localStorage.setItem(map.vhaConstellation?.storageKey || "stars-v2", JSON.stringify(saved)); } catch {}
    button.closest(".vha-constellation-presets")?.querySelectorAll("[data-constellation]").forEach(item => {
      const selected = item === button;
      item.setAttribute("aria-pressed", String(selected));
      item.classList.toggle("is-selected", selected);
    });
    map.vhaConstellation?.updateRoute?.();
    map.dataset.activeConstellation = button.dataset.constellation;
  }
  function bindPicker() {
    const map = document.getElementById("vha-world-map");
    if (!map || map.dataset.starPatternsBound === "true") return;
    map.dataset.starPatternsBound = "true";
    map.querySelectorAll(".vha-constellation-presets [data-constellation]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        applyPattern(button);
      });
    });
  }
  document.addEventListener("vha-constellation-ready", bindPicker);
  bindPicker();
  document.addEventListener("click", event => {
    const button = event.target.closest('#vha-viewer-tools [data-tool="patterns"]');
    if (!button) return;
    const map = document.getElementById("vha-world-map");
    if (!map) return;
    const open = map.dataset.patternsOpen !== "true";
    map.dataset.patternsOpen = String(open);
    button.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("vha-patterns-open", open);
  });
  window.VHACrystal?.registerTool({
    id: "star-patterns",
    label: "STAR PATTERNS",
    description: "Choose and save a constellation arrangement.",
    presentation: "panel",
    run: () => document.querySelector('[data-tool="patterns"]')?.click()
  });
})();