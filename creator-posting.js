(() => {
  'use strict';
  if (window.__vhaUnifiedNewTransmissionLoaded) return;
  window.__vhaUnifiedNewTransmissionLoaded = true;

  const SUPABASE_URL = 'https://oeyxsqocldlovhsmzcjw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kuUFxaClmROwgZpIw6bzg_ddvb521h';
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
  let closePending = false;

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

  const dialog = document.createElement('dialog');
  dialog.className = 'vha-new-transmission-dialog';
  dialog.setAttribute('aria-label', 'Human Archive Transmission editor');
  dialog.innerHTML = '<iframe title="Human Archive Transmission editor" loading="eager"></iframe>';
  document.body.appendChild(dialog);
  const dialogFrame = dialog.querySelector('iframe');

  const modalStyle = document.createElement('style');
  modalStyle.textContent = [
    '.vha-new-transmission-dialog{width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:transparent;overflow:hidden}',
    '.vha-new-transmission-dialog::backdrop{background:#020604d9;backdrop-filter:blur(7px)}',
    '.vha-new-transmission-dialog iframe{display:block;width:100%;height:100%;border:0;background:#050906}',
    '.vha-new-transmission-dialog[open]{display:block}'
  ].join('');
  document.head.appendChild(modalStyle);

  function closeEditor() {
    if (!dialog.open) return;
    closePending = false;
    dialog.close();
    dialogFrame.src = 'about:blank';
  }

  function requestEditorClose() {
    if (!dialog.open || closePending) return;
    if (!dialogFrame.contentWindow || !dialogFrame.src || dialogFrame.src === 'about:blank') {
      closeEditor();
      return;
    }
    closePending = true;
    dialogFrame.contentWindow.postMessage({ type: 'VHA_TRANSMISSION_EDITOR_CLOSE_REQUEST' }, window.location.origin);
  }

  function openNewTransmission() {
    const url = new URL('/landing-page/human-archive/', window.location.origin);
    url.searchParams.set('new', '1');
    const category = selectedCategoryForPage();
    if (category) url.searchParams.set('category', category);
    closePending = false;
    dialogFrame.src = url.toString();
    dialog.showModal();
  }

  button.addEventListener('click', openNewTransmission);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    requestEditorClose();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) requestEditorClose();
  });
  dialog.addEventListener('close', () => {
    closePending = false;
    dialogFrame.src = 'about:blank';
  });
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.source !== dialogFrame.contentWindow) return;
    if (event.data?.type === 'VHA_TRANSMISSION_EDITOR_CLOSED') {
      closeEditor();
    } else if (event.data?.type === 'VHA_TRANSMISSION_EDITOR_CLOSE_FAILED') {
      closePending = false;
    }
  });

  async function ensureSupabase() {
    if (window.supabase?.createClient) return true;
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0';
      script.async = true;
      script.crossOrigin='anonymous';
      script.referrerPolicy='no-referrer';
      script.onload = () => resolve(Boolean(window.supabase?.createClient));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function refresh(sessionOverride) {
    if (refreshing) return;
    refreshing = true;
    try {
      if (!await ensureSupabase()) {
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
