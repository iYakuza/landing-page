/* Star Patterns — native dropdown, constellation layouts and persistence. */
(() => {
  const patterns = {
    "orion": [[25,24],[33,35],[42,47],[50,39],[58,47],[67,35],[75,24],[50,15],[39,15],[61,15],[30,62],[70,62]],
    "ursa-major": [[20,29],[30,23],[41,27],[52,35],[63,43],[72,55],[80,68],[61,64],[48,55],[36,49],[25,44],[19,58]],
    "cassiopeia": [[20,38],[31,23],[43,41],[56,22],[69,40],[77,56],[65,68],[51,57],[38,71],[24,59],[44,14],[61,73]],
    "cygnus": [[50,10],[50,24],[50,40],[50,57],[50,72],[34,30],[66,30],[25,20],[75,20],[37,49],[63,49],[50,88]],
    "scorpius": [[25,15],[36,21],[47,32],[57,45],[64,58],[61,70],[51,76],[73,69],[78,56],[74,42],[65,30],[48,14]],
    "hello-smile": [[50,12],[30,30],[70,30],[24,50],[76,50],[31,69],[40,79],[50,83],[60,79],[69,69],[40,48],[60,48]],
    "heart-signal": [[50,82],[30,64],[18,43],[19,27],[32,17],[45,25],[50,36],[55,25],[68,17],[81,27],[82,43],[70,64]],
    "north-star": [[50,8],[56,35],[84,35],[62,52],[70,82],[50,65],[30,82],[38,52],[16,35],[44,35],[50,8],[50,92]],
    "after-hours": [[50,10],[36,20],[27,36],[25,54],[34,71],[50,83],[43,65],[42,49],[46,33],[56,20],[68,16],[78,22]],
    "waveform": [[8,50],[16,50],[24,50],[32,50],[40,50],[48,50],[56,50],[64,50],[72,50],[80,50],[88,50],[96,50]]
  };

  function applyPattern(patternName) {
    const map = document.getElementById("vha-world-map");
    const pattern = patterns[patternName];
    const nodes = [...(map?.querySelectorAll(".vha-map-node") || [])].filter(node => node.dataset.node !== "creator");
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
    const creator = map.querySelector('.vha-map-node[data-node="creator"]');
    if (creator) {
      creator.style.setProperty("--star-x", "88%");
      creator.style.setProperty("--star-y", "18%");
      creator.style.setProperty("left", "88%", "important");
      creator.style.setProperty("top", "18%", "important");
      saved.creator = { x: 88, y: 18 };
    }
    try { localStorage.setItem(map.vhaConstellation?.storageKey || "stars-v2", JSON.stringify(saved)); } catch {}
    map.vhaConstellation?.updateRoute?.();
    map.dataset.activeConstellation = patternName;
  }

  function bindDropdown() {
    const select = document.querySelector('#vha-viewer-tools [data-tool="patterns"]');
    if (!select || select.dataset.patternsBound === "true") return;
    select.dataset.patternsBound = "true";
    select.addEventListener("change", () => {
      if (select.value) applyPattern(select.value);
    });
  }

  document.addEventListener("vha-constellation-ready", bindDropdown);
  document.addEventListener("vha-crystal-ready", bindDropdown);
  bindDropdown();

  window.VHACrystal?.registerTool({
    id: "star-patterns",
    label: "STAR PATTERNS",
    description: "Choose a constellation arrangement from the Crystal controls.",
    presentation: "dock",
    run: () => document.querySelector('#vha-viewer-tools [data-tool="patterns"]')?.focus()
  });
})();
