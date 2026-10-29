(() => {
  "use strict";
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