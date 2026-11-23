/* Verse After Hours — standalone, no-service contact composer.
   GitHub Pages cannot send email server-side. This component opens the visitor's
   own email application with a message addressed to the configured recipient. */
(() => {
  "use strict";

  if (window.__vhaContactComponentLoaded) return;
  window.__vhaContactComponentLoaded = true;

  // The only place where the recipient and contact defaults are configured.
  const CONFIG = Object.freeze({
    recipient: "emanuel.stefancu@gmail.com",
    defaultSubject: "Website contact — Verse After Hours",
    subjects: {
      website: "Website contact — Verse After Hours",
      career: "CV contact — Role opportunity",
      subscription: "Subscribe to Verse After Hours updates"
    }
  });

  let hostWindow = window;
  let hostDocument = document;
  try {
    if (window.parent !== window) {
      hostWindow = window.parent;
      hostDocument = hostWindow.document;
    }
  } catch (_) {
    // Cross-origin embedding is not expected; fall back to this document.
  }

  const styleId = "vha-contact-styles";
  if (!hostDocument.getElementById(styleId)) {
    const style = hostDocument.createElement("style");
    style.id = styleId;
    style.textContent = [
      ".cv-contact-dialog{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:clamp(12px,3vw,30px);box-sizing:border-box;background:rgba(1,8,11,.86);backdrop-filter:blur(12px) brightness(.68)}",
      ".cv-contact-dialog[hidden]{display:none!important}",
      ".cv-contact-dialog.is-open{display:flex}",
      ".cv-contact-panel{position:relative;width:min(680px,100%);max-height:min(880px,calc(100dvh - 28px));overflow:auto;box-sizing:border-box;padding:clamp(20px,3vw,32px);border:1px solid rgba(182,232,51,.55);background:linear-gradient(145deg,#101a11,#070b08);color:#e9f2e8;box-shadow:0 28px 100px rgba(0,0,0,.72),0 0 38px rgba(182,232,51,.07)}",
      ".cv-contact-panel:before{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,#b6e833 20%,#d8ff3e 78%,transparent)}",
      ".cv-contact-panel .gd-kicker{display:flex;align-items:center;gap:9px;margin:0 42px 14px 0;color:#b6e833;font:700 9px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.14em}",
      ".cv-contact-panel .gd-kicker:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,rgba(182,232,51,.5),transparent)}",
      ".cv-contact-panel h2{margin:0 48px 10px 0;color:#edf2e9;font:700 clamp(28px,4.5vw,42px)/1 Georgia,Arial,sans-serif;letter-spacing:-.045em}",
      ".cv-contact-panel h2 em{font-style:normal;color:#b6e833}",
      ".cv-contact-panel>p:not(.gd-kicker){max-width:580px;margin:10px 0 18px;color:#aebbad;font:12px/1.8 Arial,Helvetica,sans-serif}",
      ".cv-contact-close{position:absolute;right:18px;top:18px;width:36px;height:36px;border:1px solid rgba(182,232,51,.38);background:rgba(182,232,51,.04);color:#d8ff3e;font:24px/1 Arial,sans-serif;cursor:pointer}",
      ".cv-contact-close:hover,.cv-contact-close:focus-visible{border-color:#d8ff3e;background:rgba(182,232,51,.12);outline:2px solid #d8ff3e;outline-offset:2px}",
      ".cv-contact-form{display:grid;grid-template-columns:1fr 1fr;gap:13px 15px;margin-top:18px;padding-top:18px;border-top:1px solid rgba(182,232,51,.2)}",
      ".cv-contact-field{display:flex;flex-direction:column;gap:6px;min-width:0}",
      ".cv-contact-field.full{grid-column:1/-1}",
      ".cv-contact-field label{color:#b6e833;font:700 9px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.1em}",
      ".cv-contact-field input,.cv-contact-field textarea{display:block;width:100%;min-height:42px;box-sizing:border-box;padding:10px 12px;border:1px solid rgba(182,232,51,.28);border-radius:0;background:rgba(1,8,5,.72);color:#e9f2e8;font:13px/1.5 Arial,Helvetica,sans-serif}",
      ".cv-contact-field textarea{min-height:125px;resize:vertical}",
      ".cv-contact-field input:focus,.cv-contact-field textarea:focus{outline:0;border-color:#d8ff3e;box-shadow:0 0 0 2px rgba(216,255,62,.13)}",
      ".cv-contact-hint{margin:0;color:#91a18e;font:10px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}",
      ".cv-contact-submit{grid-column:1/-1;display:flex;align-items:center;flex-wrap:wrap;gap:12px}",
      ".cv-contact-submit button{min-height:42px;padding:12px 16px;border:1px solid #b6e833;background:#b6e833;color:#071007;font:800 9px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.1em;cursor:pointer}",
      ".cv-contact-submit button:hover,.cv-contact-submit button:focus-visible{border-color:#d8ff3e;background:#d8ff3e;outline:2px solid #d8ff3e;outline-offset:2px}",
      ".cv-contact-status{flex:1 1 220px;margin:0;color:#c1d5a0;font:10px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}",
      ".cv-contact-fallback{display:inline-block;color:#d8ff3e;font:10px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;text-decoration:underline;text-underline-offset:3px}",
      ".cv-contact-fallback[hidden]{display:none!important}",
      "@media(max-width:560px){.cv-contact-form{grid-template-columns:1fr;gap:11px}.cv-contact-field.full,.cv-contact-submit{grid-column:1}.cv-contact-panel{padding:22px 17px}.cv-contact-panel .gd-kicker{font-size:8px;gap:6px;margin-right:36px}.cv-contact-panel h2{font-size:clamp(26px,8vw,36px);margin-right:38px}.cv-contact-panel>p:not(.gd-kicker){font-size:11px}.cv-contact-panel textarea{min-height:110px}.cv-contact-close{right:13px;top:13px;width:32px;height:32px}}",
      "@media(prefers-reduced-motion:reduce){.cv-contact-dialog{backdrop-filter:none}}"
    ].join("\n");
    hostDocument.head.appendChild(style);
  }

  let dialog = hostDocument.getElementById("vha-contact-dialog");
  if (!dialog) {
    hostDocument.body.insertAdjacentHTML("beforeend",
      '<div class="cv-contact-dialog" id="vha-contact-dialog" role="dialog" aria-modal="true" aria-labelledby="cv-contact-title" aria-describedby="cv-contact-description" hidden>' +
        '<div class="cv-contact-panel">' +
          '<button class="cv-contact-close" type="button" aria-label="Close contact form">×</button>' +
          '<p class="gd-kicker">INCOMING TRANSMISSION // CONTACT</p>' +
          '<h2 id="cv-contact-title">SEND A <em>MESSAGE.</em></h2>' +
          '<p id="cv-contact-description">Write your message below. Your email application will open with the message addressed to Emanuel.</p>' +
          '<form class="cv-contact-form" id="cv-contact-form">' +
            '<div class="cv-contact-field"><label for="cv-contact-name">YOUR NAME *</label><input id="cv-contact-name" name="name" autocomplete="name" maxlength="120" required></div>' +
            '<div class="cv-contact-field"><label for="cv-contact-email">YOUR EMAIL *</label><input id="cv-contact-email" name="email" type="email" autocomplete="email" maxlength="254" required></div>' +
            '<div class="cv-contact-field full"><label for="cv-contact-subject">SUBJECT</label><input id="cv-contact-subject" name="subject" maxlength="180" placeholder="What would you like to talk about?"></div>' +
            '<div class="cv-contact-field full"><label for="cv-contact-url">LINK (OPTIONAL)</label><input id="cv-contact-url" name="url" type="url" inputmode="url" maxlength="2048" placeholder="https://…"></div>' +
            '<div class="cv-contact-field full"><label for="cv-contact-message">MESSAGE *</label><textarea id="cv-contact-message" name="message" maxlength="5000" required placeholder="Write your message…"></textarea><p class="cv-contact-hint">Need to attach a file? Add it in your email application after the draft opens.</p></div>' +
            '<div class="cv-contact-submit"><button type="submit">OPEN EMAIL DRAFT ↗</button><p class="cv-contact-status" id="cv-contact-status" role="status" aria-live="polite">No third-party form service is used. Your email application sends the message from your account.</p></div>' +
            '<a class="cv-contact-fallback" id="cv-contact-fallback" href="#" hidden>OPEN EMAIL DRAFT AGAIN ↗</a>' +
          '</form>' +
        '</div>' +
      '</div>'
    );
    dialog = hostDocument.getElementById("vha-contact-dialog");
  }

  if (!dialog || dialog.dataset.vhaInitialized === "true") return;
  dialog.dataset.vhaInitialized = "true";

  const form = hostDocument.getElementById("cv-contact-form");
  const closeButton = dialog.querySelector(".cv-contact-close");
  const status = hostDocument.getElementById("cv-contact-status");
  const fallback = hostDocument.getElementById("cv-contact-fallback");
  const nameField = hostDocument.getElementById("cv-contact-name");
  const emailField = hostDocument.getElementById("cv-contact-email");
  const subjectField = hostDocument.getElementById("cv-contact-subject");
  const urlField = hostDocument.getElementById("cv-contact-url");
  const messageField = hostDocument.getElementById("cv-contact-message");
  const title = hostDocument.getElementById("cv-contact-title");
  const description = hostDocument.getElementById("cv-contact-description");
  let previousFocus = null;
  let previousOverflow = "";

  function openDialog(context) {
    previousFocus = hostDocument.activeElement;
    if (context === "subscription") {
      if (!subjectField.value.trim()) subjectField.value = CONFIG.subjects.subscription;
    } else {
      form.reset();
      subjectField.value = CONFIG.subjects[context] || CONFIG.defaultSubject;
    }
    title.innerHTML = context === "career" ? "LET'S TALK ABOUT <em>THE ROLE.</em>" : "SEND A <em>MESSAGE.</em>";
    description.textContent = context === "career"
      ? "Share a few details about the opportunity. Your email application will open with the message addressed to Emanuel."
      : context === "subscription"
        ? "Confirm your subscription request in your email application. The message will be addressed to Emanuel."
        : "Have a thought, a question, or something you would like to share? Write it below and continue in your email application.";
    status.textContent = "Your email application will open with a draft addressed to " + CONFIG.recipient + ". Review it there and press Send.";
    fallback.hidden = true;
    dialog.hidden = false;
    dialog.classList.add("is-open");
    previousOverflow = hostDocument.body.style.overflow;
    hostDocument.body.style.overflow = "hidden";
    nameField.focus();
  }

  function closeDialog() {
    dialog.classList.remove("is-open");
    dialog.hidden = true;
    hostDocument.body.style.overflow = previousOverflow;
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  }

  closeButton.addEventListener("click", closeDialog);
  dialog.addEventListener("click", event => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href]:not([hidden])')]
      .filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && hostDocument.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && hostDocument.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const name = nameField.value.trim();
    const sender = emailField.value.trim();
    const subject = subjectField.value.trim() || CONFIG.defaultSubject;
    const reference = urlField.value.trim();
    const message = messageField.value.trim();
    const body = [
      "Name: " + name,
      "Email: " + sender,
      reference ? "Link: " + reference : "",
      "",
      "Message:",
      message,
      "",
      "Sent via Verse After Hours: https://iyakuza.github.io/landing-page/"
    ].join("\n");
    const mailto = "mailto:" + CONFIG.recipient +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);

    status.textContent = "Your email application should open with this draft addressed to " + CONFIG.recipient + ". Review it there and press Send. This website does not send or store your message.";
    fallback.href = mailto;
    fallback.hidden = false;

    try {
      hostWindow.location.href = mailto;
    } catch (error) {
      status.textContent = "Your browser could not open the email application. Use the link below to try again.";
    }
  });

  // Event delegation lets every Contact button open the same shared dialog.
  document.addEventListener("click", event => {
    const trigger = event.target.closest?.(".va-cv-contact-trigger, .cv-contact-open, [data-vha-contact-open]");
    if (!trigger) return;
    event.preventDefault();
    openDialog(trigger.dataset.contactContext || "website");
  });
})();
