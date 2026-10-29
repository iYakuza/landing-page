(() => {
  "use strict";
  const chapters = [
    { id: "origin", name: "POINT OF ORIGIN" },
    { id: "protocol", name: "THE PROTOCOL" },
    { id: "archive", name: "THE ARCHIVE" },
    { id: "arcana", name: "THE ARCANA" },
    { id: "unknown", name: "THE UNKNOWN" },
    { id: "signals", name: "THE GARDEN / SIGNALS" },
    { id: "circle", name: "THE CIRCLE" },
    { id: "workshop", name: "THE WORKSHOP" },
    { id: "release", name: "RELEASE" }
  ];

  function buildChapterNavigation() {
    chapters.forEach((chapter, index) => {
      const section = document.getElementById(chapter.id);
      if (!section || section.querySelector(".chapter-navigation")) return;

      const nav = document.createElement("nav");
      nav.className = "chapter-navigation";
      nav.setAttribute("aria-label", "Story chapter navigation");

      const progress = document.createElement("p");
      progress.className = "chapter-progress";
      progress.textContent = "CHAPTER " + String(index + 1).padStart(2, "0") + " / " + String(chapters.length).padStart(2, "0");

      const track = document.createElement("span");
      track.className = "chapter-track";
      track.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.className = "chapter-track-fill";
      fill.style.width = ((index + 1) / chapters.length * 100) + "%";
      track.appendChild(fill);

      const links = document.createElement("div");
      links.className = "chapter-links";

      const previous = document.createElement("a");
      previous.className = "chapter-previous";
      previous.href = index === 0 ? "#top" : "#" + chapters[index - 1].id;
      previous.textContent = index === 0 ? "↑ ENTRANCE" : "← " + chapters[index - 1].name;

      const next = document.createElement("a");
      next.className = "chapter-next";
      next.href = index === chapters.length - 1 ? "#top" : "#" + chapters[index + 1].id;
      next.textContent = index === chapters.length - 1 ? "RETURN TO THE ENTRANCE ↑" : "CONTINUE: " + chapters[index + 1].name + " →";
      next.setAttribute("aria-label", index === chapters.length - 1 ? "Return to the entrance" : "Continue to chapter " + (index + 2) + ": " + chapters[index + 1].name);

      links.append(previous, next);
      nav.append(progress, track, links);
      section.appendChild(nav);
    });
  }

  buildChapterNavigation();

  const paths = {
    street: {
      title: "STREET KID / STREET SIGNALS",
      message: "You begin with lived experience: fragments, music, murals, and testimony. The community route is not connected yet, so this path continues inside the archive for now.",
      href: "#archive",
      label: "FOLLOW THE RECOVERED SHARDS ↘"
    },
    corpo: {
      title: "CORPO / ARCHIVE SUBMISSIONS",
      message: "You begin with records, classifications, and the gap between an official statement and its evidence. Explore the case files before drawing a conclusion.",
      href: "#archive",
      label: "OPEN THE CASE FILES ↘"
    },
    nomad: {
      title: "NOMAD / WILDERNESS TRANSMISSIONS",
      message: "You begin outside the institution, with freedom and the right to leave no trace. Visitor submission is not connected yet; exploring this page sends no personal data.",
      href: "#signals",
      label: "VISIT THE HUMAN COUNTER-ARCHIVE ↘"
    }
  };
  const cards = Array.from(document.querySelectorAll("[data-path]"));
  const response = document.getElementById("path-response");
  const message = document.getElementById("path-message");
  const continueLink = document.getElementById("path-continue");
  const reset = document.getElementById("reset-path");
  if (!cards.length || !response || !message || !continueLink || !reset) return;

  function choosePath(key) {
    const selected = paths[key];
    if (!selected) return;
    cards.forEach((card) => {
      const active = card.dataset.path === key;
      card.setAttribute("aria-pressed", String(active));
    });
    message.textContent = selected.title + " — " + selected.message;
    continueLink.href = selected.href;
    continueLink.textContent = selected.label;
    response.hidden = false;
    response.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  }

  cards.forEach((card) => card.addEventListener("click", () => choosePath(card.dataset.path)));
  reset.addEventListener("click", () => {
    cards.forEach((card) => card.setAttribute("aria-pressed", "false"));
    response.hidden = true;
    message.textContent = "";
    cards[0].focus();
  });
})();