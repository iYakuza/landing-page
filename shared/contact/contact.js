/* Verse After Hours — shared Google Apps Script contact form. */
(() => {
  "use strict";

  if (window.__vhaContactComponentLoaded) return;
  window.__vhaContactComponentLoaded = true;

  // Add the deployed Google Apps Script /exec URL here after it has been
  // created and tested. Until then the form remains safely disabled.
  const CONFIG = Object.freeze({
    endpointUrl: "https://script.google.com/macros/s/AKfycbxvWmMr0yZR2EBJ3kj7xknUeB70UsMxCzKJOuECQCeKa52d1rmjVs95O14blfX5NkQ1/exec",
    siteOrigin: "https://iyakuza.github.io",
    responseTimeoutMs: 90000,
    defaultSubject: "Website contact — Verse After Hours",
    subjects: {
      website: "Website contact — Verse After Hours",
      career: "CV contact — Role opportunity",
      subscription: "Subscribe to Verse After Hours updates"
    }
  });

  const endpointReady = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(CONFIG.endpointUrl);

  let hostWindow = window;
  let hostDocument = document;
  try {
    if (window.parent !== window) {
      hostWindow = window.parent;
      hostDocument = hostWindow.document;
    }
  } catch (_) {
    hostWindow = window;
    hostDocument = document;
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
      ".cv-contact-honeypot{position:absolute!important;left:-10000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important}",
      ".cv-contact-submit{grid-column:1/-1;display:flex;align-items:center;flex-wrap:wrap;gap:12px}",
      ".cv-contact-submit button{min-height:42px;padding:12px 16px;border:1px solid #b6e833;background:#b6e833;color:#071007;font:800 9px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.1em;cursor:pointer}",
      ".cv-contact-submit button:hover,.cv-contact-submit button:focus-visible{border-color:#d8ff3e;background:#d8ff3e;outline:2px solid #d8ff3e;outline-offset:2px}",
      ".cv-contact-submit button:disabled{border-color:#58644a;background:#58644a;color:#d1d9c8;cursor:not-allowed;opacity:.8}",
      ".cv-contact-upload-frame{display:block;width:100%;height:112px;border:1px solid rgba(182,232,51,.28);background:rgba(1,8,5,.72)}",
      ".cv-contact-status{flex:1 1 220px;margin:0;color:#c1d5a0;font:10px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}",
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
          '<p id="cv-contact-description">Send a message directly to Emanuel. It will be delivered by email and will not be published on this website.</p>' +
          '<form class="cv-contact-form" id="cv-contact-form" accept-charset="UTF-8">' +
            '<input type="hidden" name="contactContext" value="website">' +
            '<input type="hidden" name="requestId" value="">' +
            '<input type="hidden" name="startedAt" value="">' +
            '<div class="cv-contact-honeypot" aria-hidden="true"><label for="cv-contact-website">Leave this field empty</label><input id="cv-contact-website" name="website" tabindex="-1" autocomplete="off"></div>' +
            '<div class="cv-contact-field"><label for="cv-contact-name">YOUR NAME *</label><input id="cv-contact-name" name="name" autocomplete="name" maxlength="120" required></div>' +
            '<div class="cv-contact-field"><label for="cv-contact-email">YOUR EMAIL *</label><input id="cv-contact-email" name="email" type="email" autocomplete="email" maxlength="254" required></div>' +
            '<div class="cv-contact-field full"><label for="cv-contact-subject">SUBJECT</label><input id="cv-contact-subject" name="subject" maxlength="180" placeholder="What would you like to talk about?"></div>' +
            '<div class="cv-contact-field full"><label for="cv-contact-url">LINK (OPTIONAL)</label><input id="cv-contact-url" name="url" type="url" inputmode="url" maxlength="2048" placeholder="https://…"></div>' +
            '<div class="cv-contact-field full"><label for="cv-contact-upload-frame">ATTACHMENTS (OPTIONAL)</label><div class="cv-contact-upload-host"></div><p class="cv-contact-hint">Up to five files · 5 MB each · 10 MB total. PDF, Office documents, text, CSV and common images. Files are emailed directly and are not stored online.</p></div>' +
            '<div class="cv-contact-field full"><label for="cv-contact-message">MESSAGE *</label><textarea id="cv-contact-message" name="message" maxlength="5000" required placeholder="Write your message…"></textarea></div>' +
            '<div class="cv-contact-submit"><button type="submit" disabled>GOOGLE SETUP REQUIRED</button><p class="cv-contact-status" id="cv-contact-status" role="status" aria-live="polite">Online submission is not enabled yet. No information is sent or stored.</p></div>' +
          '</form>' +
        '</div>' +
      '</div>'
    );
    dialog = hostDocument.getElementById("vha-contact-dialog");
  }

  if (!dialog) return;
  if (dialog.dataset.vhaInitialized === "true") {
    if (hostDocument !== document) {
      document.addEventListener("click", event => {
        const trigger = event.target.closest?.(".va-cv-contact-trigger, .cv-contact-open, [data-vha-contact-open]");
        if (!trigger) return;
        event.preventDefault();
        hostDocument.dispatchEvent(new hostWindow.CustomEvent("vha-contact-open", {
          detail: { context: trigger.dataset.contactContext || "website" }
        }));
      });
    }
    return;
  }
  dialog.dataset.vhaInitialized = "true";

  const form = hostDocument.getElementById("cv-contact-form");
  const closeButton = dialog.querySelector(".cv-contact-close");
  const status = hostDocument.getElementById("cv-contact-status");
  const nameField = hostDocument.getElementById("cv-contact-name");
  const subjectField = hostDocument.getElementById("cv-contact-subject");
  const urlField = hostDocument.getElementById("cv-contact-url");
  const title = hostDocument.getElementById("cv-contact-title");
  const description = hostDocument.getElementById("cv-contact-description");
  const submitButton = form.querySelector('button[type="submit"]');
  const requestIdField = form.querySelector('[name="requestId"]');
  const startedAtField = form.querySelector('[name="startedAt"]');
  const contextField = form.querySelector('[name="contactContext"]');
  const uploadFrame = hostDocument.createElement("iframe");
  uploadFrame.id = "cv-contact-upload-frame";
  uploadFrame.name = "vha-contact-upload-frame";
  uploadFrame.title = "Choose optional contact attachments";
  uploadFrame.className = "cv-contact-upload-frame";
  uploadFrame.referrerPolicy = "no-referrer";
  uploadFrame.src = endpointReady ? CONFIG.endpointUrl + "?mode=upload" : "about:blank";
  form.querySelector(".cv-contact-upload-host").appendChild(uploadFrame);

  let previousFocus = null;
  let previousOverflow = "";
  let activeContext = "website";
  let pendingRequestId = "";
  let pendingTimer = null;
  let uploadFrameOrigin = "";
  let uploadFrameReady = false;

  function isTrustedAppsScriptOrigin(origin) {
    return /^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com|[a-z0-9-]+-script\.googleusercontent\.com)$/.test(origin);
  }

  function updateSubmitButton() {
    submitButton.disabled = !endpointReady || !uploadFrameReady || Boolean(pendingRequestId);
    submitButton.textContent = !endpointReady
      ? "GOOGLE SETUP REQUIRED"
      : !uploadFrameReady
        ? "CONNECTING TO GOOGLE…"
        : "SEND MESSAGE";
  }

  function postUploadMessage(data) {
    if (!uploadFrameReady || !uploadFrameOrigin) return false;
    uploadFrame.contentWindow.postMessage(data, uploadFrameOrigin);
    return true;
  }

  function resetUploadFrame() {
    postUploadMessage({ type: "vha-contact-reset" });
  }

  updateSubmitButton();

  function createRequestId() {
    if (hostWindow.crypto && typeof hostWindow.crypto.randomUUID === "function") {
      return hostWindow.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (hostWindow.crypto && typeof hostWindow.crypto.getRandomValues === "function") {
      hostWindow.crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function handleEndpointMessage(event) {
    if (event.source !== uploadFrame.contentWindow || !isTrustedAppsScriptOrigin(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "vha-contact-upload-ready") {
      uploadFrameOrigin = event.origin;
      uploadFrameReady = true;
      updateSubmitButton();
      resetUploadFrame();
      return;
    }

    if (data.type !== "vha-contact-result" || data.requestId !== pendingRequestId) return;
    if (pendingTimer !== null) {
      hostWindow.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    pendingRequestId = "";
    updateSubmitButton();

    if (data.success === true) {
      form.reset();
      resetUploadFrame();
      status.textContent = "Your message has been sent. Thank you.";
    } else {
      status.textContent = "We couldn't send your message. Check the fields and attachments, then try again.";
    }
  }

  hostWindow.addEventListener("message", handleEndpointMessage);

  function openDialog(context) {
    previousFocus = hostDocument.activeElement;
    activeContext = Object.prototype.hasOwnProperty.call(CONFIG.subjects, context) ? context : "website";
    form.reset();
    resetUploadFrame();
    subjectField.value = CONFIG.subjects[activeContext] || CONFIG.defaultSubject;
    contextField.value = activeContext;
    startedAtField.value = String(Date.now());
    title.innerHTML = activeContext === "career" ? "LET'S TALK ABOUT <em>THE ROLE.</em>" : "SEND A <em>MESSAGE.</em>";
    description.textContent = activeContext === "career"
      ? "Share a few details about the opportunity. Your message will be delivered directly by email."
      : activeContext === "subscription"
        ? "Send a subscription request. Your message will be delivered directly by email."
        : "Have a thought, a question, or something you would like to share? Send a message directly by email.";
    status.textContent = endpointReady
      ? "Your message will be emailed directly and will not be published on this website."
      : "Online submission is not enabled yet. No information is sent or stored.";
    updateSubmitButton();
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
    const focusable = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),iframe:not([hidden]),a[href]:not([hidden])')]
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

  hostDocument.addEventListener("vha-contact-open", event => {
    openDialog(event.detail?.context || "website");
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!endpointReady) {
      status.textContent = "Google Apps Script is not configured yet. Your message has not been sent.";
      return;
    }
    if (!uploadFrameReady || !uploadFrameOrigin) {
      status.textContent = "Google's secure attachment service is still loading. Please try again in a moment.";
      return;
    }
    if (pendingRequestId) return;

    const requestAge = Date.now() - Number(startedAtField.value);
    if (!Number.isFinite(requestAge) || requestAge < 1800) {
      status.textContent = "Please take a moment to complete the form before sending.";
      return;
    }

    pendingRequestId = createRequestId();
    requestIdField.value = pendingRequestId;
    contextField.value = activeContext;
    updateSubmitButton();
    status.textContent = "Sending your message securely through Google…";

    const fields = {};
    ["requestId", "startedAt", "contactContext", "website", "name", "email", "subject", "url", "message"]
      .forEach(name => {
        const field = form.elements.namedItem(name);
        fields[name] = field ? field.value : "";
      });

    pendingTimer = hostWindow.setTimeout(() => {
      pendingTimer = null;
      pendingRequestId = "";
      updateSubmitButton();
      status.textContent = "We couldn't confirm whether Google completed the submission. Please check your inbox before trying again.";
    }, CONFIG.responseTimeoutMs);

    try {
      uploadFrame.contentWindow.postMessage({
        type: "vha-contact-submit",
        requestId: pendingRequestId,
        fields
      }, uploadFrameOrigin);
    } catch (_) {
      hostWindow.clearTimeout(pendingTimer);
      pendingTimer = null;
      pendingRequestId = "";
      updateSubmitButton();
      status.textContent = "The message could not be submitted. Please try again.";
    }
  });

  // Event delegation lets every Contact button open the same shared dialog.
  document.addEventListener("click", event => {
    const trigger = event.target.closest?.(".va-cv-contact-trigger, .cv-contact-open, [data-vha-contact-open]");
    if (!trigger) return;
    event.preventDefault();
    hostDocument.dispatchEvent(new hostWindow.CustomEvent("vha-contact-open", {
      detail: { context: trigger.dataset.contactContext || "website" }
    }));
  });
})();
