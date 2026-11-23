/*
 * Verse After Hours — Google Apps Script contact endpoint.
 *
 * Deploy as a Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Set Script Property CONTACT_RECIPIENT to the destination email address.
 * The script sends email only. It does not write submissions to Drive,
 * Sheets, Properties, or any message database.
 */

const CONTACT_CONFIG = Object.freeze({
  SITE_ORIGIN: "https://iyakuza.github.io",
  MIN_FORM_AGE_MS: 1800,
  MAX_FORM_AGE_MS: 2 * 60 * 60 * 1000,
  RATE_LIMIT_SECONDS: 20,
  MAX_NAME_LENGTH: 120,
  MAX_EMAIL_LENGTH: 254,
  MAX_SUBJECT_LENGTH: 180,
  MAX_LINK_LENGTH: 2048,
  MAX_MESSAGE_LENGTH: 5000
});

function doGet() {
  return HtmlService.createHtmlOutput(
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Contact endpoint</title></head>" +
    "<body><p>Verse After Hours contact endpoint is available. Submit messages through the website form.</p></body></html>"
  ).setTitle("Verse After Hours — Contact Endpoint");
}

function doPost(e) {
  const fields = e && e.parameter ? e.parameter : {};
  const requestId = String(fields.requestId || "");

  if (!/^[a-f0-9-]{32,36}$/i.test(requestId)) {
    return createContactResponse("", false);
  }

  // Quietly discard the hidden honeypot field. This gives simple bots no
  // useful signal and does not create an email or retain the submitted data.
  if (String(fields.website || "").trim()) {
    return createContactResponse(requestId, true);
  }

  try {
    const startedAt = Number(fields.startedAt);
    const elapsed = Date.now() - startedAt;
    if (!Number.isFinite(startedAt) ||
        elapsed < CONTACT_CONFIG.MIN_FORM_AGE_MS ||
        elapsed > CONTACT_CONFIG.MAX_FORM_AGE_MS) {
      throw new Error("Invalid submission timing.");
    }

    const name = cleanText(fields.name, CONTACT_CONFIG.MAX_NAME_LENGTH);
    const senderEmail = cleanText(fields.email, CONTACT_CONFIG.MAX_EMAIL_LENGTH).toLowerCase();
    const subject = cleanText(fields.subject, CONTACT_CONFIG.MAX_SUBJECT_LENGTH);
    const link = cleanText(fields.url, CONTACT_CONFIG.MAX_LINK_LENGTH);
    const message = String(fields.message || "").trim();
    const context = String(fields.contactContext || "website");

    if (!name || !senderEmail || !message || message.length > CONTACT_CONFIG.MAX_MESSAGE_LENGTH) {
      throw new Error("Required fields are missing or too long.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
      throw new Error("Invalid email address.");
    }
    if (link && !/^https?:\/\/[^\s<>"']+$/i.test(link)) {
      throw new Error("Invalid link.");
    }

    const contextLabels = {
      website: "Website contact",
      career: "CV / career enquiry",
      subscription: "Subscription request"
    };
    const contextLabel = contextLabels[context] || contextLabels.website;
    const recipient = PropertiesService.getScriptProperties().getProperty("CONTACT_RECIPIENT");
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new Error("Contact recipient is not configured.");
    }

    const mailSubject = (contextLabel + ": " + (subject || "New message")).slice(0, 250);
    const body = [
      "A new message was submitted through the Verse After Hours website.",
      "",
      "Name: " + name,
      "Email: " + senderEmail,
      "Context: " + contextLabel,
      "Subject: " + (subject || "(not provided)"),
      "Link: " + (link || "(not provided)"),
      "",
      "Message:",
      message
    ].join("\n");

    // A short global burst limit protects the inbox without retaining visitor
    // messages or personal identifiers. Cache entries expire automatically.
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      throw new Error("Contact endpoint is busy.");
    }

    try {
      const cache = CacheService.getScriptCache();
      if (cache.get("vha-contact-last-send")) {
        throw new Error("Please wait before sending another message.");
      }
      if (MailApp.getRemainingDailyQuota() < 1) {
        throw new Error("Daily email quota reached.");
      }

      MailApp.sendEmail(recipient, mailSubject, body, {
        name: "Verse After Hours contact",
        replyTo: senderEmail
      });
      cache.put("vha-contact-last-send", "1", CONTACT_CONFIG.RATE_LIMIT_SECONDS);
    } finally {
      lock.releaseLock();
    }

    return createContactResponse(requestId, true);
  } catch (error) {
    // Do not log visitor content or return internal error details to the browser.
    return createContactResponse(requestId, false);
  }
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function createContactResponse(requestId, success) {
  const payload = JSON.stringify({
    type: "vha-contact-result",
    requestId: requestId,
    success: Boolean(success)
  }).replace(/</g, "\\u003c");

  const html = [
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Contact response</title></head>",
    "<body><script>",
    "window.top.postMessage(" + payload + ", " + JSON.stringify(CONTACT_CONFIG.SITE_ORIGIN) + ");",
    "</script></body></html>"
  ].join("");

  return HtmlService.createHtmlOutput(html)
    .setTitle("Verse After Hours — Contact response")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
