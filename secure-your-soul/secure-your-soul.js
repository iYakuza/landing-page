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
      fill.classList.add("chapter-progress-" + (index + 1));
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

  // Guided reading is an optional, progressively enhanced mode. The full archive
  // remains available as a normal long page unless the visitor opts in.
  const main = document.querySelector("main");
  const hero = document.querySelector(".hero");
  const footer = document.querySelector(".footer");
  const entryButton = document.querySelector('.hero-copy a[href="#origin"]');
  const readerBar = document.createElement("div");
  readerBar.className = "guided-reader-bar";
  readerBar.hidden = true;
  readerBar.setAttribute("aria-label", "Guided story controls");

  const readerStatus = document.createElement("p");
  readerStatus.className = "guided-reader-status";
  readerStatus.setAttribute("aria-live", "polite");
  readerStatus.setAttribute("aria-atomic", "true");

  const exitButton = document.createElement("button");
  exitButton.type = "button";
  exitButton.className = "guided-reader-exit";
  exitButton.textContent = "EXIT CHAPTER MODE";
  readerBar.append(readerStatus, exitButton);
  if (main) main.prepend(readerBar);

  const guidedToggle = document.createElement("button");
  guidedToggle.type = "button";
  guidedToggle.className = "button button-outline guided-reading-toggle";
  guidedToggle.textContent = "ENTER CHAPTER MODE";
  guidedToggle.setAttribute("aria-describedby", "guided-reading-description");
  if (entryButton) entryButton.insertAdjacentElement("afterend", guidedToggle);

  const guidedDescription = document.createElement("p");
  guidedDescription.id = "guided-reading-description";
  guidedDescription.className = "guided-reading-description";
  guidedDescription.textContent = "Read one chapter at a time. You can exit at any point.";
  if (guidedToggle) guidedToggle.insertAdjacentElement("afterend", guidedDescription);

  let guidedMode = false;
  let currentChapterIndex = 0;

  function showChapter(index, focusHeading = true) {
    currentChapterIndex = Math.max(0, Math.min(index, chapters.length - 1));
    chapters.forEach((chapter, chapterIndex) => {
      const section = document.getElementById(chapter.id);
      if (section) section.hidden = guidedMode && chapterIndex !== currentChapterIndex;
    });
    const chapter = chapters[currentChapterIndex];
    readerStatus.textContent = "CHAPTER " + String(currentChapterIndex + 1).padStart(2, "0") +
      " / " + String(chapters.length).padStart(2, "0") + " — " + chapter.name;
    if (guidedMode) {
      history.replaceState(null, "", "#" + chapter.id);
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      if (focusHeading) {
        const heading = document.getElementById(chapter.id)?.querySelector("h2");
        if (heading) {
          heading.setAttribute("tabindex", "-1");
          heading.focus({ preventScroll: true });
        }
      }
    }
  }

  function enterGuidedMode() {
    guidedMode = true;
    document.body.classList.add("guided-reading");
    if (hero) hero.hidden = true;
    if (footer) footer.hidden = true;
    if (readerBar) readerBar.hidden = false;
    showChapter(0);
    exitButton.focus();
  }

  function exitGuidedMode() {
    guidedMode = false;
    document.body.classList.remove("guided-reading");
    chapters.forEach((chapter) => {
      const section = document.getElementById(chapter.id);
      if (section) section.hidden = false;
    });
    if (hero) hero.hidden = false;
    if (footer) footer.hidden = false;
    if (readerBar) readerBar.hidden = true;
    history.replaceState(null, "", "#top");
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    if (entryButton) entryButton.focus({ preventScroll: true });
  }

  guidedToggle.addEventListener("click", enterGuidedMode);
  exitButton.addEventListener("click", exitGuidedMode);

  // Keyboard controls are scoped to the optional reader and never hijack form
  // fields or ordinary page browsing.
  document.addEventListener("keydown", (event) => {
    if (!guidedMode || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      exitGuidedMode();
      return;
    }
    if (event.target instanceof HTMLElement &&
        (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return;
    if (event.key === "ArrowRight" && currentChapterIndex < chapters.length - 1) {
      event.preventDefault();
      showChapter(currentChapterIndex + 1);
    } else if (event.key === "ArrowLeft" && currentChapterIndex > 0) {
      event.preventDefault();
      showChapter(currentChapterIndex - 1);
    }
  });

  document.querySelectorAll(".chapter-navigation").forEach((nav) => {
    nav.addEventListener("click", (event) => {
      if (!guidedMode) return;
      const link = event.target.closest("a[href^='#']");
      if (!link) return;
      event.preventDefault();
      const targetId = link.getAttribute("href").slice(1);
      if (targetId === "top") {
        exitGuidedMode();
        return;
      }
      const nextIndex = chapters.findIndex((chapter) => chapter.id === targetId);
      if (nextIndex !== -1) showChapter(nextIndex);
    });
  });

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