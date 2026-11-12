import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const REDIRECT_URI = "https://oeyxsqocldlovhsmzcjw.supabase.co/functions/v1/google-drive-oauth-callback";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const COOKIE_NAME = "gd_oauth_state";
const COOKIE_PATH = "/functions/v1/google-drive-oauth-callback";

function htmlEscape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function page(title: string, body: string, status = 200, cookie?: string): Response {
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  });
  if (cookie) headers.append("Set-Cookie", cookie);
  const html = "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" +
    htmlEscape(title) + "</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:720px;margin:8vh auto;padding:0 22px;color:#e9eee9;background:#101712}h1{font-size:1.6rem}p{color:#c5d0c8}textarea{box-sizing:border-box;width:100%;min-height:130px;padding:12px;border:1px solid #718477;border-radius:8px;background:#17231b;color:#fff;overflow-wrap:anywhere}code{overflow-wrap:anywhere}li{margin:.5rem 0}.note{border-left:3px solid #9ab69d;padding-left:14px}</style><main><h1>" +
    htmlEscape(title) + "</h1>" + body + "</main></html>";
  return new Response(html, { status, headers });
}

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function clearStateCookie(): string {
  return COOKIE_NAME + "=; Max-Age=0; Path=" + COOKIE_PATH + "; Secure; HttpOnly; SameSite=Lax";
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") {
    return page("Method not allowed", "<p>Use the browser authorization link.</p>", 405);
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim() || "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim() || "";
  if (!clientId || !clientSecret) {
    return page("Google authorization is not configured", "<p>The site owner must configure the Google OAuth client ID and secret in Supabase Edge Function secrets before authorization can begin.</p>", 503);
  }

  const url = new URL(request.url);
  if (url.searchParams.get("action") === "start") {
    const state = randomState();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: DRIVE_FILE_SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    const cookie = COOKIE_NAME + "=" + state + "; Max-Age=600; Path=" + COOKIE_PATH + "; Secure; HttpOnly; SameSite=Lax";
    return new Response(null, {
      status: 302,
      headers: {
        "Location": GOOGLE_AUTH_URL + "?" + params.toString(),
        "Set-Cookie": cookie,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  const returnedState = url.searchParams.get("state") || "";
  const savedState = cookieValue(request, COOKIE_NAME);
  if (!returnedState || !savedState || !safeEqual(returnedState, savedState)) {
    return page("Authorization could not be verified", "<p>The one-time security check did not match. Close this tab and start authorization again from the supplied link.</p>", 400, clearStateCookie());
  }

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return page("Google authorization was not completed", "<p>Access was not granted. You can close this tab. No backup credentials were saved.</p>", 400, clearStateCookie());
  }

  const code = url.searchParams.get("code") || "";
  if (!code) {
    return page("Authorization code missing", "<p>Google did not return an authorization code. Start again from the authorization link.</p>", 400, clearStateCookie());
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || typeof tokens.refresh_token !== "string" || !tokens.refresh_token) {
    return page("A reusable Drive authorization was not returned", "<p>Google did not return a refresh token. Confirm that the app is in Production, then start authorization again. Do not share any token or client secret in chat.</p>", 502, clearStateCookie());
  }

  const refreshToken = htmlEscape(tokens.refresh_token);
  const body = "<p>Your one-time authorization has completed. The refresh token below is shown only in this response; it is not written to a URL or application log.</p>" +
    "<textarea readonly spellcheck=\"false\">" + refreshToken + "</textarea>" +
    "<ol><li>Copy the entire token.</li><li>Open your GitHub repository settings, then <strong>Secrets and variables → Actions</strong>.</li><li>Create or update the repository secret named <code>GOOGLE_REFRESH_TOKEN</code>.</li><li>Paste the token into that secret and save it.</li><li>Return here and close this tab.</li></ol>" +
    "<p class=\"note\">Never paste this token into ChatGPT, a GitHub file, an issue, or a public message. If this page is closed before you save it, repeat authorization to obtain a new token.</p>";
  return page("Google Drive authorization successful", body, 200, clearStateCookie());
});
