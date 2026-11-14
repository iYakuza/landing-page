import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGIN = "https://iyakuza.github.io";
const MAX_BODY_BYTES = 15 * 1024 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "image/png", "image/jpeg", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);
const MAX_REQUESTS_PER_WINDOW = 8;

function response(status: number, body: Record<string, unknown>, origin?: string | null) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  });
  if (origin === ALLOWED_ORIGIN) headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  return new Response(JSON.stringify(body), { status, headers });
}
function cleanHeader(value: unknown, max: number, fallback = "") {
  return String(value ?? fallback).replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}
async function rateLimited(ip: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  const salt = Deno.env.get("CONTACT_RATE_LIMIT_SALT") || key;
  if (!url || !key || !salt) throw new Error("Rate limiter is not configured.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + ip));
  const ipHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const res = await fetch(url.replace(/\/+$/, "") + "/rest/v1/rpc/check_contact_rate_limit", {
    method: "POST",
    headers: { "apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_ip_hash: ipHash, p_max_requests: MAX_REQUESTS_PER_WINDOW }),
  });
  if (!res.ok) throw new Error("Rate limiter request failed.");
  return (await res.json()) !== true;
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin !== ALLOWED_ORIGIN) return response(403, { error: "Origin not allowed." }, origin);
  if (req.method === "OPTIONS") {
    if (origin !== ALLOWED_ORIGIN) return response(403, { error: "Origin not allowed." }, origin);
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"
    }});
  }
  if (req.method !== "POST") return response(405, { error: "Method not allowed." }, origin);
  // Never send email from the isolated hosted recovery drill.
  const isRecoveryDrill = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "") === "https://ioguymqdeuuursizifnn.supabase.co";
  if (isRecoveryDrill) return response(503, { error: "Email delivery is disabled on the recovery drill project." }, origin);
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) return response(415, { error: "JSON requests only." }, origin);
  const lengthHeader = req.headers.get("content-length");
  const length = lengthHeader === null ? null : Number(lengthHeader);
  if (length !== null && (!Number.isFinite(length) || length < 0)) return response(400, { error: "Invalid content length." }, origin);
  if (length !== null && length > MAX_BODY_BYTES) return response(413, { error: "Request is too large." }, origin);
  const trustedEdgeIp = req.headers.get("cf-connecting-ip")?.trim();
  // Do not trust client-supplied X-Forwarded-For for abuse controls.
  // If the trusted edge header is absent, use one shared bucket rather than accepting spoofable IPs.
  const ip = trustedEdgeIp || "unknown";
  try { if (await rateLimited(ip)) return response(429, { error: "Too many messages from this connection. Please try again later." }, origin); } catch { console.error("Contact rate limiter unavailable."); return response(503, { error: "Contact service is temporarily unavailable. Please try again later." }, origin); }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return response(503, { error: "Email delivery is not configured yet. Please try again later." }, origin);
    let rawBody: string;
    try { rawBody = await readBodyWithLimit(req, MAX_BODY_BYTES); }
    catch (error) {
      if (error instanceof Error && error.message === "BODY_TOO_LARGE") return response(413, { error: "Request is too large." }, origin);
      return response(400, { error: "Request body must be valid UTF-8." }, origin);
    }
    let data: Record<string, unknown>;
    try { data = JSON.parse(rawBody); } catch { return response(400, { error: "Invalid JSON request." }, origin); }
    if (!data || typeof data !== "object" || Array.isArray(data)) return response(400, { error: "Invalid request." }, origin);
    if (typeof data.website === "string" && data.website.trim()) return response(200, { ok: true }, origin);

    const name = cleanHeader(data.name, 120);
    const email = cleanHeader(data.email, 254);
    const subject = cleanHeader(data.subject, 180, "Website contact — Verse After Hours") || "Website contact — Verse After Hours";
    const message = String(data.message ?? "").replace(/\u0000/g, "").trim().slice(0, 10000);
    const files = Array.isArray(data.attachments) ? data.attachments : [];
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) {
      return response(400, { error: "Please provide your name, a valid email address, and a message." }, origin);
    }
    if (files.length > 5) return response(400, { error: "Please attach no more than 5 files." }, origin);
    const attachments: { filename: string; content: string }[] = [];
    let totalBytes = 0;
    for (const file of files) {
      if (!file || typeof file.filename !== "string" || typeof file.content !== "string" || typeof file.type !== "string") {
        return response(400, { error: "Invalid attachment." }, origin);
      }
      if (!ALLOWED_TYPES.has(file.type.toLowerCase())) return response(400, { error: "Unsupported attachment type." }, origin);
      const encoded = file.content.replace(/^data:[^,]*,/, "");
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return response(400, { error: "Invalid attachment encoding." }, origin);
      const bytes = Math.floor(encoded.length * 3 / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
      totalBytes += bytes;
      if (bytes > MAX_FILE_BYTES || totalBytes > MAX_TOTAL_BYTES) return response(400, { error: "Attachments must be 5 MB each or 10 MB total." }, origin);
      const filename = file.filename.replace(/[^a-zA-Z0-9._ ()-]/g, "_").slice(0, 120) || "attachment";
      attachments.push({ filename, content: encoded });
    }
    const text = `Website contact — Verse After Hours\n\nFrom: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}\n`;
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Verse After Hours <onboarding@resend.dev>",
        to: ["stefancu.emanuel@gmail.com"],
        reply_to: email,
        subject: `Website contact: ${subject}`,
        text,
        attachments,
      }),
    });
    if (!emailResponse.ok) {
      console.error("Resend delivery failed with status", emailResponse.status);
      return response(502, { error: "The message could not be sent right now. Please try again later." }, origin);
    }
    return response(200, { ok: true }, origin);
  } catch {
    return response(400, { error: "Could not process the form. Please try again." }, origin);
  }
});