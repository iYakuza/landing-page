import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const MAX_BODY_BYTES = 24_000;
const MAX_TITLE = 120;
const MAX_MESSAGE = 10_000;

function response(status: number, body: Record<string, unknown>, origin: string | null, allowedOrigin: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin && allowedOrigin && origin === allowedOrigin) headers["Access-Control-Allow-Origin"] = allowedOrigin;
  return new Response(JSON.stringify(body), { status, headers });
}

function htmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function safeContent(value: string) {
  return value.split(/\n\s*\n/).map(part => "<p>" + htmlEscape(part).replaceAll("\n", "<br>") + "</p>").join("");
}

function slugify(value: string) {
  const slug = value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return (slug || "transmission") + "-" + crypto.randomUUID().slice(0, 8);
}

async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(token: string, secret: string, remoteIp: string) {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);
  try {
    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body, signal: AbortSignal.timeout(5000),
    });
    if (!result.ok) return false;
    const json = await result.json().catch(() => ({}));
    return json.success === true;
  } catch {
    return false;
  }
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!key) {
    try { key = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || ""; } catch { /* fail closed */ }
  }
  if (!url || !key) throw new Error("Server credentials unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  const allowedOrigin = (Deno.env.get("SYS_ALLOWED_ORIGIN") || "https://iyakuza.github.io").replace(/\/$/, "");
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": origin === allowedOrigin ? allowedOrigin : "null",
      "Vary": "Origin",
      "Cache-Control": "no-store",
    }});
  }
  if (request.method !== "POST") return response(405, { error: "method_not_allowed" }, origin, allowedOrigin);
  if (origin !== allowedOrigin) return response(403, { error: "origin_not_allowed" }, origin, allowedOrigin);

  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return response(413, { error: "request_too_large" }, origin, allowedOrigin);

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return response(413, { error: "request_too_large" }, origin, allowedOrigin);
    input = JSON.parse(raw);
  } catch {
    return response(400, { error: "invalid_json" }, origin, allowedOrigin);
  }

  let admin;
  try { admin = getAdminClient(); } catch {
    return response(503, { error: "service_not_configured" }, origin, allowedOrigin);
  }

  const action = String(input.action || "submit");
  if (action === "submit") {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const message = typeof input.message === "string" ? input.message.trim() : "";
    const displayName = typeof input.display_name === "string" ? input.display_name.trim() : "";
    const contactEmail = typeof input.contact_email === "string" ? input.contact_email.trim() : "";
    const rightsConfirmed = input.rights_confirmed === true;
    const publicationConsent = input.publication_consent === true;
    const turnstileToken = typeof input.turnstile_token === "string" ? input.turnstile_token.trim() : "";
    // Honeypot field: acknowledge quietly but do not store bot content.
    if (typeof input.website === "string" && input.website.trim()) return response(202, { ok: true }, origin, allowedOrigin);
    if (title.length < 1 || title.length > MAX_TITLE) return response(400, { error: "invalid_title", message: "Title must be 1–120 characters." }, origin, allowedOrigin);
    if (message.length < 1 || message.length > MAX_MESSAGE) return response(400, { error: "invalid_message", message: "Message must be 1–10,000 characters." }, origin, allowedOrigin);
    if (displayName.length > 80) return response(400, { error: "invalid_display_name" }, origin, allowedOrigin);
    if (contactEmail.length > 254 || (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) return response(400, { error: "invalid_contact_email" }, origin, allowedOrigin);
    if (!rightsConfirmed || !publicationConsent) return response(400, { error: "consent_required", message: "Confirm ownership/permission and explicit publication consent." }, origin, allowedOrigin);

    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY") || "";
    const rateSalt = Deno.env.get("SYS_TRANSMISSION_RATE_SALT") || "";
    if (turnstileSecret.length < 10 || rateSalt.length < 32) return response(503, { error: "service_not_configured" }, origin, allowedOrigin);
    const remoteIp = (request.headers.get("cf-connecting-ip") || "unknown").slice(0, 128);
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken, turnstileSecret, remoteIp))) {
      return response(403, { error: "anti_spam_verification_failed" }, origin, allowedOrigin);
    }
    const ipHash = await sha256(rateSalt + ":" + remoteIp);
    const { data: underLimit, error: limitError } = await admin.rpc("consume_sys_transmission_limit", {
      p_ip_hash: ipHash, p_max_requests: 3,
    });
    if (limitError) return response(503, { error: "rate_limit_unavailable" }, origin, allowedOrigin);
    if (underLimit !== true) return response(429, { error: "rate_limited", message: "Please wait before sending another transmission." }, origin, allowedOrigin);

    const { data, error } = await admin.from("sys_transmissions").insert({
      title, message, display_name: displayName || null, contact_email: contactEmail || null,
      rights_confirmed: true, publication_consent: true, status: "pending",
    }).select("id").single();
    if (error || !data) return response(503, { error: "submission_not_saved" }, origin, allowedOrigin);
    return response(201, { ok: true, reference: data.id, status: "pending", message: "Transmission received for human review. Nothing is published automatically." }, origin, allowedOrigin);
  }

  // Moderator operations require a real Supabase user and an explicit admin allowlist entry.
  const authHeader = request.headers.get("authorization") || "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  if (!tokenMatch || !anonKey) return response(401, { error: "authentication_required" }, origin, allowedOrigin);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
    global: { headers: { Authorization: "Bearer " + tokenMatch[1] } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(tokenMatch[1]);
  if (userError || !userData.user) return response(401, { error: "invalid_session" }, origin, allowedOrigin);
  const { data: moderator, error: moderatorError } = await admin.from("vha_cms_admins")
    .select("user_id").eq("user_id", userData.user.id).maybeSingle();
  if (moderatorError || !moderator) return response(403, { error: "moderator_required" }, origin, allowedOrigin);

  if (action === "list_pending") {
    const { data, error } = await admin.from("sys_transmissions")
      .select("id,title,message,display_name,contact_email,rights_confirmed,publication_consent,created_at")
      .eq("status", "pending").order("created_at", { ascending: true }).limit(100);
    if (error) return response(503, { error: "review_queue_unavailable" }, origin, allowedOrigin);
    return response(200, { items: data || [] }, origin, allowedOrigin);
  }

  if (action === "review") {
    const id = typeof input.id === "string" ? input.id : "";
    const decision = typeof input.decision === "string" ? input.decision : "";
    const note = typeof input.moderation_note === "string" ? input.moderation_note.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return response(400, { error: "invalid_id" }, origin, allowedOrigin);
    if (!["publish", "reject", "remove"].includes(decision)) return response(400, { error: "invalid_decision" }, origin, allowedOrigin);
    if (note.length > 1000) return response(400, { error: "moderation_note_too_long" }, origin, allowedOrigin);
    const { data: item, error: itemError } = await admin.from("sys_transmissions")
      .select("id,title,message,display_name,rights_confirmed,publication_consent,status,published_post_id")
      .eq("id", id).maybeSingle();
    if (itemError || !item) return response(404, { error: "transmission_not_found" }, origin, allowedOrigin);

    if (decision === "publish") {
      if (item.status !== "pending" || item.rights_confirmed !== true || item.publication_consent !== true) {
        return response(409, { error: "transmission_not_publishable" }, origin, allowedOrigin);
      }
      // Conditional claim ensures only one moderator can publish a pending row.
      // The temporary rejected state is reverted on publication failure.
      const { data: claimed, error: claimError } = await admin.from("sys_transmissions")
        .update({ status: "reviewing", reviewed_at: new Date().toISOString(), reviewed_by: userData.user.id, moderation_note: note || null })
        .eq("id", id).eq("status", "pending").select("id").maybeSingle();
      if (claimError || !claimed) return response(409, { error: "transmission_already_reviewed" }, origin, allowedOrigin);
      const post = {
        title: item.title,
        slug: slugify(item.title),
        category: "SECURE YOUR SOUL / TRANSMISSION",
        excerpt: item.message.replace(/\s+/g, " ").slice(0, 400),
        content_html: safeContent(item.message),
        status: "published",
        published_at: new Date().toISOString(),
        media_width: 100,
      };
      const { data: createdPost, error: postError } = await admin.from("vha_posts").insert(post).select("id,slug").single();
      if (postError || !createdPost) {
        await admin.from("sys_transmissions").update({ status: "pending", reviewed_at: null, reviewed_by: null, moderation_note: null }).eq("id", id).eq("status", "reviewing");
        return response(503, { error: "publication_failed" }, origin, allowedOrigin);
      }
      const { data: finalized, error: updateError } = await admin.from("sys_transmissions").update({
        status: "published", reviewed_at: new Date().toISOString(), reviewed_by: userData.user.id,
        moderation_note: note || null, published_post_id: createdPost.id,
      }).eq("id", id).eq("status", "reviewing").select("id").maybeSingle();
      if (updateError || !finalized) {
        await admin.from("vha_posts").delete().eq("id", createdPost.id);
        await admin.from("sys_transmissions").update({ status: "pending", reviewed_at: null, reviewed_by: null, moderation_note: null }).eq("id", id).eq("status", "reviewing");
        return response(503, { error: "review_record_update_failed" }, origin, allowedOrigin);
      }
      return response(200, { ok: true, decision, post_id: createdPost.id, slug: createdPost.slug }, origin, allowedOrigin);
    }

    if (decision === "reject" && item.status !== "pending") return response(409, { error: "only_pending_transmissions_can_be_rejected" }, origin, allowedOrigin);
    if (decision === "remove" && item.status !== "published") return response(409, { error: "only_published_transmissions_can_be_removed" }, origin, allowedOrigin);
    if (decision === "remove" && item.published_post_id) {
      const { error: deleteError } = await admin.from("vha_posts").delete().eq("id", item.published_post_id);
      if (deleteError) return response(503, { error: "published_post_removal_failed" }, origin, allowedOrigin);
    }
    const newStatus = decision === "reject" ? "rejected" : "removed";
    const { error: updateError } = await admin.from("sys_transmissions").update({
      status: newStatus, reviewed_at: new Date().toISOString(), reviewed_by: userData.user.id,
      moderation_note: note || null,
    }).eq("id", id);
    if (updateError) return response(503, { error: "review_record_update_failed" }, origin, allowedOrigin);
    return response(200, { ok: true, decision }, origin, allowedOrigin);
  }

  return response(400, { error: "unknown_action" }, origin, allowedOrigin);
});
