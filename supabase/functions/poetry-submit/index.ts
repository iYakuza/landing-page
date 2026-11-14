import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const COLLECTION_ID = Deno.env.get("WEBFLOW_COLLECTION_ID") || "6ade13d08e540fa2639705a5";
const MEDIUM_OPTION_IDS: Record<string, string> = {
  poem: "59cc28bcd3273b8143366b8abd7b8ee9",
  music: "53dd4f739fe1f2c97454446915d3f762",
  video: "06419bd0fe033fa34f8f48b68c2cff92",
  photograph: "04144aa883fda05bc8cfa409c016d5a8",
};
const IMAGE_DISPLAY_MODE_IDS: Record<string, string> = {
  "cover-crop": "b0e6a8496480927eb8ae06f1002a3bff",
  "fit-entire-image": "0028f3c38c2f1d97d873c60557e46323",
  "natural-proportions": "4963cb49753bdcb9877269c5e3d41c6c",
  "full-width": "5219fb73454c2f8faac34fd734109b54",
};
const ATTACHMENT_TYPE_IDS: Record<string, string> = {
  image: "f3710b83cd7e4856e4b55e4b2536d191",
  audio: "81251800d6a0e3e1eedc7f52090cff99",
  video: "17fe736e5635d8c3467f466382258fad",
};
const DRILL_ALLOWED_ORIGIN = "https://green-dream-recovery-preview.pages.dev";
const DRILL_ARCHIVE_SNAPSHOT = [{
  id: "6ade2d07405d5ecd5759803e",
  slug: "the-god-beneath-the-noise",
  title: "The God Beneath the Noise",
  medium: "video",
  body: "Before the name,\nbefore the light,\nbefore the day,\nbefore the night\na thousand voices,\na thousand skies,\na thousand echoes\nbehind these eyes;\none breath,\none sound,\none heart...\nNo ground.\n\nNo more seeking,\nno more sound-\n\nI am.",
  bodyHtml: "<p>Before the name,<br>before the light,<br>before the day,<br>before the night<br>a thousand voices,<br>a thousand skies,<br>a thousand echoes<br>behind these eyes;<br>one breath,<br>one sound,<br>one heart...<br>No ground.<br></p><p>No more seeking,<br>no more sound-</p><p>I am.</p>",
  byline: "",
  excerpt: "Before the name, before the light, before the day, before the night a thousand voices, a thousand skies, a thousand echoes behind these eyes; one breath, one sound, one heart... No ground. No more seeking, no more sound-",
  mediaUrl: "https://ioguymqdeuuursizifnn.supabase.co/storage/v1/object/public/poetry-media/owner/9e466f99-9a24-402c-bbac-767c12970737-before-the-name.mp4",
  imageUrl: "",
  videoEmbed: "",
  attachmentType: "video",
  imageDisplayMode: "cover-crop",
  url: "/poetry-archive/the-god-beneath-the-noise",
}];

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/mp4",
  "audio/wav", "audio/ogg", "audio/x-m4a", "video/mp4", "video/webm", "video/quicktime",
]);

function headers(origin: string | null, allowedOrigin: string) {
  const result: Record<string, string> = {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  // Never advertise cross-origin access to a caller outside the configured site.
  if (origin && allowedOrigin && origin === allowedOrigin) {
    result["Access-Control-Allow-Origin"] = allowedOrigin;
  }
  return result;
}
async function readBodyWithLimit(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("Request body limit exceeded.");
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}
function reply(status: number, body: Record<string, unknown>, origin: string | null, allowedOrigin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers(origin, allowedOrigin || "null"), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
async function ensurePrivatePoetryStagingBucket(admin: any): Promise<boolean> {
  const options = {
    public: false,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/mp4",
      "audio/wav", "audio/ogg", "audio/x-m4a", "video/mp4", "video/webm", "video/quicktime",
    ],
  };
  try {
    const updated = await admin.storage.updateBucket("poetry-media-staging", options);
    if (!updated.error) return true;
    const created = await admin.storage.createBucket("poetry-media-staging", options);
    if (!created.error) return true;
    const listed = await admin.storage.listBuckets();
    const existing = (listed.data || []).find((b: any) => b.id === "poetry-media-staging");
    return !!existing && existing.public === false;
  } catch {
    return false;
  }
}

async function removeStorageObject(admin: any, bucket: string, path: string | null) {
  if (!path) return;
  try {
    const { error } = await admin.storage.from(bucket).remove([path]);
    if (error) console.error("Storage cleanup failed for bucket", bucket, error.message);
  } catch {
    console.error("Storage cleanup failed for bucket", bucket);
  }
}

function htmlEscape(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function richText(s: string) {
  return s.split(/\n\s*\n/).map(p => "<p>" + htmlEscape(p).replaceAll("\n", "<br>") + "</p>").join("");
}
function slugify(s: string) {
  const base = s.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 68);
  return (base || "archive-piece") + "-" + crypto.randomUUID().slice(0, 8);
}
function safeFileName(s: string) {
  return s.normalize("NFKD").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-90) || "media-file";
}
async function sha256(s: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a: string, b: string) {
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let i = 0; i < length; i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!key) {
    const map = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (map) { try { key = JSON.parse(map).default || ""; } catch { /* use no key */ } }
  }
  if (!url || !key) throw new Error("Supabase service credentials unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function verifyTurnstile(token: string, secret: string, remoteIp: string) {
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  if (!res.ok) return false;
  const result = await res.json().catch(() => ({}));
  return result.success === true;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  const isRecoveryDrillRequest = (Deno.env.get("SUPABASE_URL") || "").replace(/\\/+$/, "") === "https://ioguymqdeuuursizifnn.supabase.co";
  if (isRecoveryDrillRequest) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: headers(origin, DRILL_ALLOWED_ORIGIN) });
    }
    if (request.method === "GET") {
      if (origin !== DRILL_ALLOWED_ORIGIN) return reply(403, { message: "This website origin is not allowed." }, origin, DRILL_ALLOWED_ORIGIN);
      return reply(200, { ok: true, items: DRILL_ARCHIVE_SNAPSHOT }, origin, DRILL_ALLOWED_ORIGIN);
    }
    return reply(503, { message: "Write operations are disabled on the recovery drill project." }, origin, DRILL_ALLOWED_ORIGIN);
  }
  // Reject oversized bodies before parsing multipart data to reduce memory/CPU abuse.
  const lengthHeader = request.headers.get("content-length");
  const declaredLength = lengthHeader === null ? null : Number(lengthHeader);
  const MAX_REQUEST_BYTES = 30 * 1024 * 1024;
  if (declaredLength !== null && (!Number.isFinite(declaredLength) || declaredLength < 0)) {
    return new Response(JSON.stringify({ message: "Invalid content length." }), {
      status: 400, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
  }
  if (declaredLength !== null && declaredLength > MAX_REQUEST_BYTES) {
    return new Response(JSON.stringify({ message: "Request is too large. Media files must be 25 MB or smaller." }), {
      status: 413,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
  }
  let admin;
  try { admin = getAdminClient(); }
  catch { return reply(503, { message: "Publishing is not configured yet." }, origin, "null"); }

  let config: Record<string, string>;
  try {
    const { data, error } = await admin.rpc("get_poetry_publisher_config");
    if (error || !data || typeof data !== "object") throw new Error("Configuration unavailable");
    config = data as Record<string, string>;
  } catch {
    return reply(503, { message: "Publishing configuration is unavailable. Please try again later." }, origin, "null");
  }

  const isRecoveryDrill = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "") === "https://ioguymqdeuuursizifnn.supabase.co";
  const allowedOrigin = isRecoveryDrill ? "https://green-dream-recovery-preview.pages.dev" : String(config.ALLOWED_ORIGIN || "").trim();
  const webflowToken = String(config.WEBFLOW_API_TOKEN || "").trim();
  const rateSalt = String(config.RATE_LIMIT_SALT || "");
  const turnstileSecret = String(config.TURNSTILE_SECRET_KEY || Deno.env.get("TURNSTILE_SECRET_KEY") || "").trim();
  // The hosted recovery drill must never publish or edit the live Webflow CMS.
  if (isRecoveryDrill && request.method !== "GET" && request.method !== "OPTIONS") {
    return reply(503, { message: "Write operations are disabled on the recovery drill project." }, origin, allowedOrigin);
  }
  let ownerEditToken = "";
  if (request.method === "POST") {
    try {
      const { data: editKey, error: editKeyError } = await admin.rpc("get_poetry_owner_edit_token");
      if (!editKeyError && typeof editKey === "string") ownerEditToken = editKey.trim();
    } catch { /* fail closed: owner edits remain unavailable if the key lookup fails */ }
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headers(origin, allowedOrigin || "null") });
  }
  if (request.method === "GET") {
    if (origin !== allowedOrigin) return reply(403, { message: "This website origin is not allowed." }, origin, allowedOrigin);
    if (!webflowToken || !allowedOrigin) return reply(503, { message: "Archive feed is not configured." }, origin, allowedOrigin);
    const feedResponse = await fetch("https://api.webflow.com/v2/collections/" + COLLECTION_ID + "/items/live?limit=100", {
      headers: { Authorization: "Bearer " + webflowToken, "Accept": "application/json" },
    });
    const feed = await feedResponse.json().catch(() => ({}));
    if (!feedResponse.ok) return reply(502, { message: "The live archive could not be loaded." }, origin, allowedOrigin);
    const items = (Array.isArray(feed.items) ? feed.items : []).map((item: any) => {
      const fd = item.fieldData || {};
      const mediumIds: Record<string, string> = {
        "59cc28bcd3273b8143366b8abd7b8ee9": "poem",
        "53dd4f739fe1f2c97454446915d3f762": "music",
        "06419bd0fe033fa34f8f48b68c2cff92": "video",
        "04144aa883fda05bc8cfa409c016d5a8": "photograph",
      };
      const attachmentIds: Record<string, string> = {
        "f3710b83cd7e4856e4b55e4b2536d191": "image",
        "81251800d6a0e3e1eedc7f52090cff99": "audio",
        "17fe736e5635d8c3467f466382258fad": "video",
      };
      const displayModeIds: Record<string, string> = {
        "b0e6a8496480927eb8ae06f1002a3bff": "cover-crop",
        "0028f3c38c2f1d97d873c60557e46323": "fit-entire-image",
        "4963cb49753bdcb9877269c5e3d41c6c": "natural-proportions",
        "5219fb73454c2f8faac34fd734109b54": "full-width",
      };
      const asUrl = (value: any): string => {
        if (typeof value === "string") return value;
        if (value && typeof value === "object") return String(value.url || value.file?.url || "");
        return "";
      };
      const coverUrl = asUrl(fd["cover-image"]);
      const fileUrl = asUrl(fd["uploaded-media-file"]);
      const mediaUrl = asUrl(fd["external-media-url"]) || fileUrl;
      const videoEmbed = asUrl(fd["video-embed"]);
      const slugValue = String(fd.slug || item.slug || "");
      const htmlBody = String(fd["words-and-note"] || "");
      const plainBody = htmlBody.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>\s*<p[^>]*>/gi, "\n\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      const medium = mediumIds[String(fd.medium || "")] || String(fd.medium || "poem").toLowerCase();
      let attachmentType = attachmentIds[String(fd["attachment-type"] || "")] || String(fd["attachment-type"] || "").toLowerCase();
      if (!["image", "audio", "video"].includes(attachmentType)) {
        const lowerUrl = (mediaUrl || videoEmbed).toLowerCase();
        if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|#|$)/i.test(lowerUrl)) attachmentType = "audio";
        else if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i.test(lowerUrl)) attachmentType = "image";
        else if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(lowerUrl) || videoEmbed) attachmentType = "video";
        else if (medium === "music") attachmentType = "audio";
        else attachmentType = "";
      }
      return {
        id: item.id, slug: slugValue, title: String(fd.name || item.name || "Untitled"),
        medium, body: plainBody, bodyHtml: htmlBody,
        byline: String(fd.byline || ""),
        excerpt: String(fd.excerpt || plainBody.replace(/\s+/g, " ").slice(0, 220)),
        mediaUrl, imageUrl: coverUrl, videoEmbed,
        attachmentType,
        imageDisplayMode: displayModeIds[String(fd["image-display-mode"] || "")] || String(fd["image-display-mode"] || "cover-crop").toLowerCase().replace(/\s+/g, "-"),
        url: "/poetry-archive/" + slugValue,
      };
    });
    return reply(200, { ok: true, items }, origin, allowedOrigin);
  }
  if (request.method !== "POST") return reply(405, { message: "Use GET or POST." }, origin, allowedOrigin);
  if (!allowedOrigin || !webflowToken) {
    return reply(503, { message: "The archive service is not configured. Please try again later." }, origin, allowedOrigin);
  }
  if (origin !== allowedOrigin) return reply(403, { message: "This website origin is not allowed." }, origin, allowedOrigin);

  let form: FormData;
  try {
    const boundedBody = await readBodyWithLimit(request, MAX_REQUEST_BYTES);
    const safeHeaders = new Headers(request.headers);
    safeHeaders.delete("content-length");
    safeHeaders.delete("content-encoding");
    const boundedRequest = new Request(request.url, { method: "POST", headers: safeHeaders, body: boundedBody });
    form = await boundedRequest.formData();
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return reply(413, { message: "Request is too large. Media files must be 25 MB or smaller." }, origin, allowedOrigin);
    }
    return reply(400, { message: "Expected form data." }, origin, allowedOrigin);
  }

  const action = String(form.get("action") || "create").trim().toLowerCase();
  // Protect the legacy owner-key editor against repeated key guessing and bulk abuse.
  if (action === "auth" || action === "update") {
    if (rateSalt.length < 24) return reply(503, { ok: false, message: "Owner console security checks are not configured." }, origin, allowedOrigin);
    const ip = (request.headers.get("cf-connecting-ip") || "unknown").trim().slice(0, 128);
    const limitScope = action === "auth" ? "cms-auth" : "cms-update";
    const limit = action === "auth" ? 10 : 60;
    const ownerIpHash = await sha256(rateSalt + ":" + limitScope + ":" + ip);
    const { data: allowed, error: ownerLimitError } = await admin.rpc("check_contact_rate_limit", {
      p_ip_hash: ownerIpHash,
      p_max_requests: limit,
    });
    if (ownerLimitError) return reply(503, { ok: false, message: "Owner console security checks are temporarily unavailable." }, origin, allowedOrigin);
    if (allowed !== true) return reply(429, { ok: false, message: "Too many owner-console requests. Please try again later." }, origin, allowedOrigin);
  }
  const suppliedOwnerToken = String(form.get("owner_token") || "").trim();
  const ownerTokenValid = ownerEditToken.length >= 32 && constantTimeEqual(suppliedOwnerToken, ownerEditToken);

  if (action === "auth") {
    if (!ownerTokenValid) return reply(403, { ok: false, message: "That owner key was not accepted." }, origin, allowedOrigin);
    return reply(200, { ok: true, action: "auth" }, origin, allowedOrigin);
  }

  if (action === "update") {
    if (!ownerTokenValid) return reply(403, { ok: false, message: "Owner access is required. Enter the owner key and try again." }, origin, allowedOrigin);
    const itemId = String(form.get("item_id") || "").trim();
    const title = String(form.get("title") || "").trim();
    const body = String(form.get("body") || "").trim();
    let medium = String(form.get("medium") || "poem").trim().toLowerCase();
    const byline = String(form.get("byline") || "").trim().slice(0, 120);
    let mediaUrl = String(form.get("media_url") || "").trim();
    const currentCoverUrl = String(form.get("image_url") || "").trim();
    const imageDisplayMode = String(form.get("image_display_mode") || "cover-crop").trim().toLowerCase();
    const fileEntry = form.get("media_file");
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
    let attachmentType: string | null = null;

    if (!/^[a-f0-9]{24}$/i.test(itemId)) return reply(400, { message: "The post could not be identified. Reload the page and try again." }, origin, allowedOrigin);
    if (!title || title.length > 120) return reply(400, { message: "Title must be 1–120 characters." }, origin, allowedOrigin);
    if (body.length > 20000) return reply(400, { message: "Text must be 20,000 characters or fewer." }, origin, allowedOrigin);
    if (!Object.hasOwn(MEDIUM_OPTION_IDS, medium)) return reply(400, { message: "Choose a valid piece type." }, origin, allowedOrigin);
    if (!Object.hasOwn(IMAGE_DISPLAY_MODE_IDS, imageDisplayMode)) return reply(400, { message: "Choose a valid image display mode." }, origin, allowedOrigin);
    if (file && file.size > MAX_FILE_BYTES) return reply(400, { message: "Media files must be 25 MB or smaller." }, origin, allowedOrigin);
    if (file && !ALLOWED_MIME_TYPES.has(file.type)) return reply(400, { message: "Use a JPG, PNG, WebP, MP3, M4A, WAV, OGG, MP4, WebM or MOV file." }, origin, allowedOrigin);
    if (mediaUrl) {
      try { const url = new URL(mediaUrl); if (url.protocol !== "https:") throw new Error(); }
      catch { return reply(400, { message: "Media links must be valid HTTPS URLs." }, origin, allowedOrigin); }
      if (mediaUrl.length > 2048) return reply(400, { message: "Media link is too long." }, origin, allowedOrigin);
    }
    if (currentCoverUrl) {
      try { const url = new URL(currentCoverUrl); if (url.protocol !== "https:") throw new Error(); }
      catch { return reply(400, { message: "The current cover image URL is invalid. Reload and try again." }, origin, allowedOrigin); }
      if (currentCoverUrl.length > 2048) return reply(400, { message: "The cover image URL is too long." }, origin, allowedOrigin);
    }

    if (file) {
      if (file.type.startsWith("image/")) attachmentType = "image";
      else if (file.type.startsWith("audio/")) attachmentType = "audio";
      else if (file.type.startsWith("video/")) attachmentType = "video";
      medium = attachmentType === "image" ? "photograph" : attachmentType === "audio" ? "music" : attachmentType === "video" ? "video" : medium;
    } else if (mediaUrl) {
      const lowerUrl = mediaUrl.toLowerCase();
      if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|#|$)/i.test(lowerUrl)) attachmentType = "audio";
      else if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i.test(lowerUrl)) attachmentType = "image";
      else if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(lowerUrl) || /youtube\.com|youtu\.be|vimeo\.com/i.test(lowerUrl)) attachmentType = "video";
      if (attachmentType) medium = attachmentType === "image" ? "photograph" : attachmentType === "audio" ? "music" : "video";
    } else if (medium === "music") {
      attachmentType = "audio";
    }

    let storagePath: string | null = null;
    let coverImage: { url: string; alt: string } | null = null;
    if (file) {
      storagePath = "owner/" + crypto.randomUUID() + "-" + safeFileName(file.name);
      const upload = await admin.storage.from("poetry-media").upload(storagePath, file, {
        contentType: file.type, upsert: false, cacheControl: "31536000",
      });
      if (upload.error) return reply(502, { message: "The file could not be saved. Please try again." }, origin, allowedOrigin);
      mediaUrl = admin.storage.from("poetry-media").getPublicUrl(storagePath).data.publicUrl;
      if (file.type.startsWith("image/") && file.size <= MAX_IMAGE_BYTES) coverImage = { url: mediaUrl, alt: title };
    }

    let videoEmbed: string | null = null;
    if (attachmentType === "video" && mediaUrl && !file) {
      try {
        const host = new URL(mediaUrl).hostname.replace(/^www\./i, "");
        if (["youtube.com", "youtu.be", "vimeo.com"].includes(host)) videoEmbed = mediaUrl;
      } catch { /* not an embeddable URL */ }
    }

    const fieldData: Record<string, unknown> = {
      name: title,
      medium: MEDIUM_OPTION_IDS[medium],
      featured: false,
      excerpt: body ? body.replace(/\s+/g, " ").slice(0, 220) : "A " + medium + " shared with the archive.",
      "words-and-note": richText(body),
      byline: byline || null,
      "image-display-mode": IMAGE_DISPLAY_MODE_IDS[imageDisplayMode],
      "attachment-type": attachmentType ? ATTACHMENT_TYPE_IDS[attachmentType] : null,
      "external-media-url": mediaUrl || null,
      "video-embed": videoEmbed,
    };
    if (file && file.type.startsWith("image/")) fieldData["cover-image"] = coverImage;
    else if (!file && !mediaUrl && !currentCoverUrl) fieldData["cover-image"] = null;

    const updateResponse = await fetch("https://api.webflow.com/v2/collections/" + COLLECTION_ID + "/items/live?skipInvalidFiles=true", {
      method: "PATCH",
      headers: { Authorization: "Bearer " + webflowToken, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: [{ id: itemId, cmsLocaleId: "6ade13d08e540fa263970584", fieldData }] }),
    });
    const updateResult = await updateResponse.json().catch(() => ({}));
    const updatedItem = Array.isArray(updateResult.items) ? updateResult.items.find((item: any) => item.id === itemId) : null;
    if (!updateResponse.ok || !updatedItem) {
      if (storagePath) await admin.storage.from("poetry-media").remove([storagePath]).catch(() => ({ error: null }));
      return reply(502, { message: "Your changes were not published. " + (String(updateResult.message || updateResult.msg || "Please try saving again.").slice(0, 220)) }, origin, allowedOrigin);
    }

    return reply(200, {
      ok: true, action: "update", itemId, title, medium, body, byline, mediaUrl,
      imageUrl: coverImage?.url || (file && file.type.startsWith("image/") ? "" : currentCoverUrl),
      attachmentType: attachmentType || "",
      imageDisplayMode,
      excerpt: body ? body.replace(/\s+/g, " ").slice(0, 220) : "A " + medium + " shared with the archive.",
      url: "/poetry-archive/" + String(updatedItem.fieldData?.slug || updatedItem.slug || ""),
    }, origin, allowedOrigin);
  }

  if (action !== "create") return reply(400, { message: "Unknown action." }, origin, allowedOrigin);
  if (rateSalt.length < 24 || !turnstileSecret) {
    return reply(503, { message: "Publishing setup is incomplete. Please try again later." }, origin, allowedOrigin);
  }
  if (String(form.get("website") || "").trim()) return reply(200, { ok: true }, origin, allowedOrigin);

  const title = String(form.get("title") || "").trim();
  const medium = String(form.get("medium") || "").trim().toLowerCase();
  const body = String(form.get("body") || "").trim();
  const byline = String(form.get("byline") || "").trim().slice(0, 120);
  const rights = String(form.get("rights_confirmed") || "").trim().toLowerCase() === "yes";
  const externalUrl = String(form.get("media_url") || "").trim();
  const imageDisplayMode = String(form.get("image_display_mode") || "cover-crop").trim().toLowerCase();
  const fileEntry = form.get("media_file");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  let attachmentType: string | null = null;
  if (file) {
    if (file.type.startsWith("image/")) attachmentType = "image";
    else if (file.type.startsWith("audio/")) attachmentType = "audio";
    else if (file.type.startsWith("video/")) attachmentType = "video";
  } else if (externalUrl) {
    const lowerUrl = externalUrl.toLowerCase();
    if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|#|$)/i.test(lowerUrl)) attachmentType = "audio";
    else if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i.test(lowerUrl)) attachmentType = "image";
    else if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(lowerUrl) || /youtube\.com|youtu\.be|vimeo\.com/i.test(lowerUrl)) attachmentType = "video";
    else if (medium === "music") attachmentType = "audio";
  }
  if (!attachmentType && medium === "music") attachmentType = "audio";

  if (!rights) return reply(400, { message: "Confirm that you own this work or have permission to share it." }, origin, allowedOrigin);
  if (title.length < 1 || title.length > 120) return reply(400, { message: "Title must be 1–120 characters." }, origin, allowedOrigin);
  if (body.length > 20000) return reply(400, { message: "Text must be 20,000 characters or fewer." }, origin, allowedOrigin);
  if (!Object.hasOwn(MEDIUM_OPTION_IDS, medium)) return reply(400, { message: "Choose a valid medium." }, origin, allowedOrigin);
  if (!body && !externalUrl && !file) return reply(400, { message: "Add text, a media link or a media file." }, origin, allowedOrigin);
  if (externalUrl) {
    try { const url = new URL(externalUrl); if (url.protocol !== "https:") throw new Error(); }
    catch { return reply(400, { message: "Media links must be valid HTTPS URLs." }, origin, allowedOrigin); }
    if (externalUrl.length > 2048) return reply(400, { message: "Media link is too long." }, origin, allowedOrigin);
  }
  if (file && file.size > MAX_FILE_BYTES) return reply(400, { message: "Media files must be 25 MB or smaller." }, origin, allowedOrigin);
  if (file && !ALLOWED_MIME_TYPES.has(file.type)) return reply(400, { message: "Use a JPG, PNG, WebP, MP3, M4A, WAV, OGG, MP4, WebM or MOV file." }, origin, allowedOrigin);

  const ip = (request.headers.get("cf-connecting-ip") || "unknown").trim().slice(0, 128);
  const ipHash = await sha256(rateSalt + ":" + ip);
  const { data: underLimit, error: limitError } = await admin.rpc("consume_poetry_submission_limit", { p_ip_hash: ipHash, p_max_requests: 5 });
  if (limitError) return reply(503, { message: "Submission service is not ready. Please try again later." }, origin, allowedOrigin);
  if (underLimit !== true) return reply(429, { message: "Please wait before submitting another piece." }, origin, allowedOrigin);

  const challenge = String(form.get("cf-turnstile-response") || "").trim();
  if (!challenge || !(await verifyTurnstile(challenge, turnstileSecret, ip))) {
    return reply(403, { message: "Anti-spam verification failed. Please complete the check and try again." }, origin, allowedOrigin);
  }

  let storagePath: string | null = null;
  let stagingPath: string | null = null;
  let mediaUrl: string | null = externalUrl || null;
  let coverImage: { url: string; alt: string } | null = null;
  const slug = slugify(title);

  if (file) {
    storagePath = ipHash.slice(0, 12) + "/" + crypto.randomUUID() + "-" + safeFileName(file.name);
    const stagingReady = await ensurePrivatePoetryStagingBucket(admin);
    if (!stagingReady) {
      return reply(503, { message: "Private media staging is temporarily unavailable. Please try again later." }, origin, allowedOrigin);
    }
    stagingPath = storagePath;
    const { error } = await admin.storage.from("poetry-media-staging").upload(stagingPath, file, {
      contentType: file.type, upsert: false, cacheControl: "3600",
    });
    if (error) return reply(502, { message: "The media file could not be saved. Please try again." }, origin, allowedOrigin);
    // The public URL is only added to the public bucket after the submission is safely recorded.
    mediaUrl = admin.storage.from("poetry-media").getPublicUrl(storagePath).data.publicUrl;
    if (file.type.startsWith("image/") && file.size <= MAX_IMAGE_BYTES) coverImage = { url: mediaUrl, alt: title };
  }

  const { data: logRow, error: logError } = await admin.from("poetry_submissions").insert({
    title, slug, medium, body, byline, rights_confirmed: true, media_url: mediaUrl,
    storage_path: storagePath, status: "pending", ip_hash: ipHash,
  }).select("id").single();
  if (logError || !logRow) {
    await removeStorageObject(admin, "poetry-media-staging", stagingPath);
    return reply(503, { message: "The submission could not be recorded. Please try again." }, origin, allowedOrigin);
  }

  // Promote staged media only after the internal submission record exists.
  if (file && storagePath) {
    const publicUpload = await admin.storage.from("poetry-media").upload(storagePath, file, {
      contentType: file.type, upsert: false, cacheControl: "31536000",
    });
    if (publicUpload.error) {
      await removeStorageObject(admin, "poetry-media", storagePath);
      await removeStorageObject(admin, "poetry-media-staging", stagingPath);
      await admin.from("poetry_submissions").update({
        status: "failed", error_message: "Media promotion failed", media_url: null, storage_path: null,
      }).eq("id", logRow.id);
      return reply(502, { message: "The submission was recorded, but its media could not be published. Please try again later." }, origin, allowedOrigin);
    }
  }

  const fieldData: Record<string, unknown> = {
    name: title, slug, medium: MEDIUM_OPTION_IDS[medium], featured: false,
    excerpt: body ? body.replace(/\s+/g, " ").slice(0, 220) : "A " + medium + " shared with the archive.",
    "image-display-mode": IMAGE_DISPLAY_MODE_IDS[imageDisplayMode] || IMAGE_DISPLAY_MODE_IDS["cover-crop"],
  };
  if (attachmentType) fieldData["attachment-type"] = ATTACHMENT_TYPE_IDS[attachmentType];
  if (body) fieldData["words-and-note"] = richText(body);
  if (byline) fieldData.byline = byline;
  if (mediaUrl) fieldData["external-media-url"] = mediaUrl;
  if (coverImage) fieldData["cover-image"] = coverImage;
  if (attachmentType === "video" && (externalUrl || mediaUrl)) {
    try {
      const host = new URL(externalUrl || mediaUrl || "").hostname.replace(/^www\./i, "");
      if (["youtube.com", "youtu.be", "vimeo.com"].includes(host)) fieldData["video-embed"] = externalUrl || mediaUrl;
    } catch { /* a stored media file is rendered as a native video element */ }
  }

  let cmsResponse: Response;
  let cmsResult: any;
  try {
    cmsResponse = await fetch("https://api.webflow.com/v2/collections/" + COLLECTION_ID + "/items/live?skipInvalidFiles=true", {
      method: "POST",
      headers: { Authorization: "Bearer " + webflowToken, "Content-Type": "application/json" },
      body: JSON.stringify({ fieldData }),
    });
    cmsResult = await cmsResponse.json().catch(() => ({}));
  } catch {
    // A network failure may happen after Webflow accepted the publish request. Keep the
    // public file to avoid breaking a possibly-live CMS item, but remove the private stage.
    await removeStorageObject(admin, "poetry-media-staging", stagingPath);
    await admin.from("poetry_submissions").update({
      status: "failed", error_message: "Webflow publication result could not be confirmed",
    }).eq("id", logRow.id);
    return reply(502, { message: "The publication result could not be confirmed. The site owner should check the archive before retrying." }, origin, allowedOrigin);
  }
  if (!cmsResponse.ok || !cmsResult.id) {
    await removeStorageObject(admin, "poetry-media", file ? storagePath : null);
    await removeStorageObject(admin, "poetry-media-staging", stagingPath);
    await admin.from("poetry_submissions").update({
      status: "failed",
      error_message: "Webflow CMS API returned HTTP " + cmsResponse.status,
      ...(file ? { media_url: null, storage_path: null } : {}),
    }).eq("id", logRow.id);
    return reply(502, { message: "The submission was saved, but Webflow could not publish it. The site owner has been notified." }, origin, allowedOrigin);
  }

  await removeStorageObject(admin, "poetry-media-staging", stagingPath);
  await admin.from("poetry_submissions").update({
    status: "published", webflow_item_id: cmsResult.id, published_at: new Date().toISOString(), error_message: null,
  }).eq("id", logRow.id);
  return reply(201, { ok: true, itemId: cmsResult.id, slug, title, medium, body, byline, mediaUrl, imageUrl: coverImage?.url || "", attachmentType, imageDisplayMode, excerpt: body ? body.replace(/\s+/g, " ").slice(0, 220) : "A " + medium + " shared with the archive.", url: "/poetry-archive/" + slug }, origin, allowedOrigin);
});
