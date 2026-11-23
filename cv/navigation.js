/* CV floating section navigation. Contact form behavior lives in shared/contact/contact.js. */
(() => {
  "use strict";
  const embedded = window.parent !== window;
  const hostDoc = embedded ? window.parent.document : document;
  const nav = document.getElementById("cv-floating-nav");
  if (nav) {
    const navStyle = hostDoc.createElement("style");
    navStyle.textContent = `
      .cv-floating-nav{position:fixed;left:18px;top:38%;z-index:2147482999;width:154px;background:rgba(5,9,6,.96);border:1px solid #00eaf588;box-shadow:0 12px 38px #0009;color:#e9f2e8;font:10px monospace;letter-spacing:.6px;box-sizing:border-box;backdrop-filter:blur(10px);touch-action:pan-y}
      .cv-floating-head{display:flex;align-items:center;gap:7px;padding:9px 8px;background:#101a11;border-bottom:1px solid #00eaf555;cursor:move;user-select:none;touch-action:none}
      .cv-floating-grip{color:#00eaf5;font-size:15px;cursor:move}.cv-floating-head strong{flex:1;color:#00eaf5;font-weight:normal;letter-spacing:1.4px}
      .cv-floating-collapse{width:22px;height:22px;padding:0;background:transparent;border:1px solid #00eaf566;color:#e9ed00;font:16px monospace;cursor:pointer}
      .cv-floating-links{display:grid;gap:2px;padding:6px}
      .cv-floating-links button{display:block;width:100%;text-align:left;background:transparent;border:1px solid transparent;color:#c0cbbd;padding:8px 7px;font:9px monospace;letter-spacing:.5px;cursor:pointer}
      .cv-floating-links button:hover,.cv-floating-links button:focus-visible{color:#031116;background:#00eaf5;border-color:#00eaf5;outline:none}
      .cv-floating-nav.is-collapsed .cv-floating-links{display:none}
      @media(max-width:650px){.cv-floating-nav{left:8px;top:auto;bottom:12px;width:138px}.cv-floating-head{padding:7px}.cv-floating-links{padding:4px}.cv-floating-links button{padding:7px 6px}}
    `;
    hostDoc.head.appendChild(navStyle);
    hostDoc.body.appendChild(nav);
    const collapse = nav.querySelector(".cv-floating-collapse");
    collapse?.addEventListener("click", () => {
      const closed = nav.classList.toggle("is-collapsed");
      collapse.textContent = closed ? "+" : "−";
      collapse.setAttribute("aria-expanded", String(!closed));
      collapse.setAttribute("aria-label", closed ? "Expand navigation" : "Collapse navigation");
    });
    nav.querySelectorAll("[data-cv-target]").forEach(button => button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-cv-target");
      const target = document.getElementById(targetId);
      if (target) {
        if (embedded) {
          const frame = hostDoc.querySelector('iframe.gd-cv-frame');
          const frameTop = frame ? frame.getBoundingClientRect().top + hostDoc.defaultView.scrollY : 0;
          const targetTop = frameTop + target.getBoundingClientRect().top;
          hostDoc.defaultView.scrollTo({top:Math.max(0,targetTop-18),behavior:"smooth"});
        } else {
          target.scrollIntoView({behavior:"smooth",block:"start"});
        }
      }
    }));
    const handle = nav.querySelector("#cv-floating-drag");
    let drag = null;
    handle?.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      const rect = nav.getBoundingClientRect();
      drag = {x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
      nav.style.left = rect.left + "px";
      nav.style.top = rect.top + "px";
      nav.style.right = "auto";
      nav.style.bottom = "auto";
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    handle?.addEventListener("pointermove", event => {
      if (!drag) return;
      const left = Math.max(0, Math.min(hostDoc.documentElement.clientWidth-nav.offsetWidth, drag.left+event.clientX-drag.x));
      const top = Math.max(0, Math.min(hostDoc.documentElement.clientHeight-nav.offsetHeight, drag.top+event.clientY-drag.y));
      nav.style.left = left + "px"; nav.style.top = top + "px";
    });
    const stopDrag = () => { drag = null; };
    handle?.addEventListener("pointerup",stopDrag);
    handle?.addEventListener("pointercancel",stopDrag);
  }

})();
