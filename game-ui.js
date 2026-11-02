/* Shared in-world navigation shell. No external services; no changes to page routing. */
(() => {
  if (document.documentElement.dataset.gameUiReady === "true") return;
  document.documentElement.dataset.gameUiReady = "true";
  document.body.classList.add("vha-game-interface");

  const path = location.pathname.replace(/\/+$/, "") || "/";
  const pageMap = [
    ["/secure-your-soul", "CONTINUITY INSTITUTE", "RESTRICTED PROGRAM"],
    ["/human-archive", "HUMAN ARCHIVE", "PERSONAL RECORDS"],
    ["/green-dream", "GREEN DREAM", "EXPLORATION ZONE"],
    ["/posts", "TRANSMISSIONS", "SIGNAL ARCHIVE"],
    ["/community", "THE CIRCLE", "COMMUNITY CHANNEL"],
    ["/cv", "PERSONNEL FILE", "IDENTITY SHARD"],
    ["/music", "LISTENING ROOM", "AUDIO CHANNEL"],
    ["/cms", "CREATOR WORKSHOP", "PRIVATE ACCESS"]
  ];
  const current = pageMap.find(([prefix]) => path.startsWith(prefix)) || ["", "EGO", "PERSONAL NODE"];
  const status = document.createElement("div");
  status.className = "vha-game-status";
  status.setAttribute("role", "status");
  status.innerHTML = '<div class="status-left"><span class="status-dot" aria-hidden="true"></span><span>NETWORK <b class="status-accent">ONLINE</b></span><span aria-hidden="true">/</span><span>' + current[1] + '</span></div><div class="status-right"><span>' + current[2] + '</span><span aria-hidden="true">/</span><span>SECURE CONNECTION</span></div>';
  const header = document.querySelector("header, .masthead, .ha-nav");
  if (header && header.parentNode) header.parentNode.insertBefore(status, header);
  else document.body.insertBefore(status, document.body.firstChild);

  document.querySelectorAll("nav a[href]").forEach(link => {
    try {
      const target = new URL(link.href, location.href);
      if (target.origin === location.origin && target.pathname.replace(/\/+$/, "") === path) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
    } catch {}
  });

  const main = document.querySelector("main, #main, .posts-main, .song-main, .cv-shell, .ha-main, .sy-main");
  if (main && !main.querySelector(":scope > .game-page-tag")) {
    const tag = document.createElement("div");
    tag.className = "game-page-tag";
    tag.textContent = current[1] + " / " + current[2];
    main.insertBefore(tag, main.firstChild);
  }

  // Add a discreet in-world location marker without replacing existing footers or controls.
  const footer = document.querySelector("footer, .gd-footer, .ha-footer");
  if (footer && !footer.querySelector(".game-bottomline")) {
    const line = document.createElement("div");
    line.className = "game-bottomline";
    line.innerHTML = '<span>V/A INTERFACE · BUILD 01</span><span>YOUR STORY REMAINS YOURS</span>';
    footer.appendChild(line);
  }
})();