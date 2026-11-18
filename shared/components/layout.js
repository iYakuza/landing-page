/* Shared V/A layout components.
   Each page provides content templates; this single renderer creates the same section shell. */
(() => {
  "use strict";

  const COMPONENT = "section";
  const KINDS = new Set(["hero", "intro", "records"]);

  function createSection(template) {
    const kind = template.dataset.vhaKind;
    if (!KINDS.has(kind)) {
      console.error("[V/A layout] Unsupported section kind:", kind || "(missing)");
      return null;
    }

    const section = document.createElement("section");
    section.classList.add("vha-layout-section", `vha-layout-section--${kind}`);

    (template.dataset.vhaClasses || "")
      .split(/\s+/)
      .filter(name => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name))
      .forEach(name => section.classList.add(name));

    for (const attribute of [...template.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("data-vha-")) continue;
      if (name === "id" || name === "role" || name === "lang" || name.startsWith("aria-")) {
        section.setAttribute(name, attribute.value);
      }
    }

    section.dataset.vhaComponent = COMPONENT;
    section.dataset.vhaKind = kind;
    section.append(template.content.cloneNode(true));
    return section;
  }

  function mount() {
    const root = document.querySelector("[data-vha-layout-root]");
    if (!root || root.dataset.vhaLayoutReady === "true") return;

    root.classList.add("vha-layout-main");

    root.querySelectorAll('template[data-vha-component="section"]').forEach(template => {
      const section = createSection(template);
      if (section) template.replaceWith(section);
    });


    root.dataset.vhaLayoutReady = "true";
    document.dispatchEvent(new CustomEvent("vha-layout-ready", { detail: { root } }));
  }

  mount();
})();
