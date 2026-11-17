(() => {
  'use strict';
  if (window.__vhaUnifiedNewTransmissionLoaded) return;
  window.__vhaUnifiedNewTransmissionLoaded = true;

  const SUPABASE_URL = 'https://oeyxsqocldlovhsmzcjw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
  const MOVEMENTS = [
    ['THE AWAKENING', 'the-awakening'],
    ['THE DESCENT', 'the-descent'],
    ['THE RECONNECTION', 'the-reconnection'],
    ['THE TRANSFORMATION', 'the-transformation'],
    ['THE RETURN', 'the-return']
  ];
  let client = null;
  let isCreator = false;
  let refreshing = false;
  let authBound = false;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'vha-new-transmission-global vha-editor-action';
  button.dataset.actionVariant = 'primary';
  button.textContent = '+ NEW TRANSMISSION';
  button.hidden = true;
  button.setAttribute('aria-label', 'Create a new transmission');
  document.body.appendChild(button);

  const style = document.createElement('style');
  style.textContent = [
    '.vha-new-transmission-global{position:fixed!important;right:18px!important;bottom:18px!important;left:auto!important;z-index:2147483007!important;padding:12px 16px!important;box-shadow:0 5px 20px #0008!important;white-space:nowrap}',
    '.vha-new-transmission-global[hidden]{display:none!important}',
    '@media(max-width:560px){.vha-new-transmission-global{right:10px!important;bottom:10px!important;padding:11px 13px!important;font-size:10px!important}}'
  ].join('');
  document.head.appendChild(style);

  function selectedCategoryForPage() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/human-archive/')) return 'HUMAN ARCHIVE';
    const bodyMovement = String(document.body.dataset.movement || '').trim().toUpperCase();
    if (MOVEMENTS.some(([name]) => name === bodyMovement)) return bodyMovement;
    const movement = MOVEMENTS.find(([, slug]) => path.split('/').includes(slug));
    return movement ? movement[0] : '';
  }

  function openNewTransmission() {
    const url = new URL('/landing-page/cms/', window.location.origin);
    url.searchParams.set('new', '1');
    const category = selectedCategoryForPage();
    if (category) url.searchParams.set('category', category);
    window.location.assign(url.toString());
  }

  button.addEventListener('click', openNewTransmission);

  async function refresh(sessionOverride) {
    if (refreshing) return;
    refreshing = true;
    try {
      if (!window.supabase?.createClient) {
        isCreator = false;
        return;
      }
      if (!client) client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      let session = sessionOverride;
      if (sessionOverride === undefined) {
        const result = await client.auth.getSession();
        session = result.data?.session;
        if (result.error) isCreator = false;
      }
      if (!session?.user) {
        isCreator = false;
      } else {
        const { data, error } = await client.from('vha_cms_admins')
          .select('user_id').eq('user_id', session.user.id).maybeSingle();
        isCreator = !error && Boolean(data);
      }
      if (!authBound) {
        authBound = true;
        client.auth.onAuthStateChange((_event, session) => {
          window.setTimeout(() => refresh(session), 0);
        });
      }
    } catch {
      isCreator = false;
    } finally {
      refreshing = false;
      button.hidden = !isCreator;
    }
  }

  refresh();
})();