/*
 * Verse After Hours — Google Apps Script contact endpoint.
 *
 * Deploy as a Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Set Script Property CONTACT_RECIPIENT to the destination email address.
 * Messages and attachments are emailed only. They are not written to Drive,
 * Sheets, Properties, GitHub, or a database.
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
  MAX_MESSAGE_LENGTH: 5000,
  MAX_ATTACHMENTS: 5,
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MAX_TOTAL_ATTACHMENT_BYTES: 10 * 1024 * 1024
});

const CONTACT_ATTACHMENT_TYPES = Object.freeze({
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"]
});

function doGet(e) {
  if (e && e.parameter && e.parameter.mode === "upload") {
    return HtmlService.createHtmlOutputFromFile("Upload")
      .setTitle("Verse After Hours — Attachments")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutput(
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Contact endpoint</title></head>" +
    "<body><p>Verse After Hours contact endpoint is available. Submit messages through the website form.</p></body></html>"
  ).setTitle("Verse After Hours — Contact Endpoint");
}

/*
 * Backward-compatible POST endpoint for text-only form submissions.
 * The current website uses the HTML Service upload bridge so file inputs can
 * become Apps Script Blob objects and be attached directly to the email.
 */
function doPost(e) {
  const fields = e && e.parameter ? e.parameter : {};
  const requestId = String(fields.requestId || "");

  if (!/^[a-f0-9-]{32,36}$/i.test(requestId)) {
    return createContactResponse("", false);
  }

  try {
    const success = sendContactMessage_(fields, []);
    return createContactResponse(requestId, success);
  } catch (error) {
    return createContactResponse(requestId, false);
  }
}

/*
 * Called only from the Google-hosted Upload.html page with its form element.
 * Apps Script converts each single-file input into a Blob before invoking
 * this function. File bytes are held only for this execution and email send.
 */
function submitContactForm(formObject) {
  const requestId = String(formObject && formObject.requestId || "");
  try {
    const attachments = collectContactAttachments_(formObject || {});
    const success = sendContactMessage_(formObject || {}, attachments);
    return {
      type: "vha-contact-result",
      requestId: requestId,
      success: Boolean(success)
    };
  } catch (error) {
    // Do not log visitor content, file names, or internal error details.
    return {
      type: "vha-contact-result",
      requestId: requestId,
      success: false
    };
  }
}

function sendContactMessage_(fields, attachments) {
  const requestId = String(fields.requestId || "");
  if (!/^[a-f0-9-]{32,36}$/i.test(requestId)) {
    throw new Error("Invalid request identifier.");
  }

  // Quietly discard the hidden honeypot. Nothing from this request is retained.
  if (String(fields.website || "").trim()) {
    return true;
  }

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

  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const attachmentLines = safeAttachments.length
    ? safeAttachments.map(blob => {
        const bytes = blob.getBytes();
        return blob.getName() + " (" + formatAttachmentSize_(bytes.length) + ")";
      })
    : ["(none)"];

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
    message,
    "",
    "Attachments:",
    ...attachmentLines
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
      replyTo: senderEmail,
      attachments: safeAttachments
    });
    cache.put("vha-contact-last-send", "1", CONTACT_CONFIG.RATE_LIMIT_SECONDS);
  } finally {
    lock.releaseLock();
  }

  return true;
}

function collectContactAttachments_(formObject) {
  const fieldNames = ["attachment1", "attachment2", "attachment3", "attachment4", "attachment5"];
  const attachments = [];
  let totalBytes = 0;

  fieldNames.forEach(fieldName => {
    const blob = formObject[fieldName];
    if (!blob || typeof blob.getBytes !== "function") {
      return;
    }

    const bytes = blob.getBytes();
    if (!bytes || bytes.length === 0) {
      return;
    }
    if (bytes.length > CONTACT_CONFIG.MAX_FILE_BYTES) {
      throw new Error("An attachment exceeds the per-file size limit.");
    }

    const originalName = typeof blob.getName === "function" ? blob.getName() : fieldName;
    const safeName = String(originalName || fieldName)
      .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 120);
    const extensionMatch = /\.([a-z0-9]{1,8})$/i.exec(safeName);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "";
    const allowedMimeTypes = CONTACT_ATTACHMENT_TYPES[extension];
    if (!allowedMimeTypes) {
      throw new Error("Unsupported attachment type.");
    }

    const contentType = typeof blob.getContentType === "function"
      ? String(blob.getContentType() || "").toLowerCase()
      : "";
    if (contentType &&
        contentType !== "application/octet-stream" &&
        allowedMimeTypes.indexOf(contentType) === -1) {
      throw new Error("Attachment type does not match its file extension.");
    }

    totalBytes += bytes.length;
    if (totalBytes > CONTACT_CONFIG.MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new Error("Attachments exceed the combined size limit.");
    }

    if (typeof blob.setName === "function") {
      blob.setName(safeName);
    }
    attachments.push(blob);
  });

  if (attachments.length > CONTACT_CONFIG.MAX_ATTACHMENTS) {
    throw new Error("Too many attachments.");
  }

  return attachments;
}

function formatAttachmentSize_(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
