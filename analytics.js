/* Privacy-first page-view analytics. No keystrokes, form fields, IP lookup, or fingerprinting. */
(() => {
  'use strict';
  if (location.pathname.startsWith('/landing-page/cms/') ||
      navigator.doNotTrack === '1' || window.__vhaAnalyticsLoaded) return;
  window.__vhaAnalyticsLoaded = true;

  const endpoint = 'https://oeyxsqocldlovhsmzcjw.supabase.co/rest/v1/vha_site_analytics';
  const key = 'sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
  const safe = (value, limit = 250) => String(value || '').slice(0, limit);

  function recordPageView() {
    let referrerHost = null;
    let referrerPath = null;
    try {
      if (document.referrer) {
        const referrer = new URL(document.referrer);
        if (referrer.origin !== location.origin) {
          referrerHost = safe(referrer.hostname, 255);
          referrerPath = safe(referrer.pathname, 500);
        }
      }
    } catch {}

    let sessionId;
    try {
      sessionId = sessionStorage.getItem('vha_session');
      if (!sessionId) {
        sessionId = crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString(36) + Math.random().toString(36).slice(2);
        sessionStorage.setItem('vha_session', sessionId);
      }
    } catch {
      sessionId = 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    const width = window.innerWidth || 1024;
    const userAgent = navigator.userAgent || '';
    const browser = /Edg\//.test(userAgent) ? 'Edge'
      : /Firefox\//.test(userAgent) ? 'Firefox'
      : /Chrome\//.test(userAgent) ? 'Chrome'
      : /Safari\//.test(userAgent) ? 'Safari' : 'Other';
    const params = new URLSearchParams(location.search);
    const row = {
      page_path: safe(location.pathname, 500),
      page_title: safe(document.title),
      referrer_host: referrerHost,
      referrer_path: referrerPath,
      campaign_source: safe(params.get('utm_source'), 100) || null,
      campaign_medium: safe(params.get('utm_medium'), 100) || null,
      campaign_name: safe(params.get('utm_campaign'), 100) || null,
      session_id: sessionId,
      event_type: 'pageview',
      viewport_class: width < 600 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop',
      device_class: /Mobi|Android/i.test(userAgent) ? 'mobile'
        : /iPad|Tablet/i.test(userAgent) ? 'tablet' : 'desktop',
      browser_class: browser
    };

    fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(row),
      keepalive: true,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer'
    }).catch(() => {});
  }

  recordPageView();
})();
