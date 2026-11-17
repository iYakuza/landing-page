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
  let closeRequestId = null;
  let closeTimeout = null;

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
  dialog.setAttribute('aria-label', 'New Transmission editor');
  dialog.innerHTML = [
    '<div class="vha-new-transmission-dialog-head">',
    '<span>NEW TRANSMISSION // CMS EDITOR</span>',
    '<button type="button" class="vha-new-transmission-dialog-close" aria-label="Save and close editor">CLOSE ×</button>',
    '</div>',
    '<iframe title="CMS New Transmission editor" loading="eager"></iframe>'
  ].join('');
  document.body.appendChild(dialog);

  const dialogFrame = dialog.querySelector('iframe');
  const closeButton = dialog.querySelector('.vha-new-transmission-dialog-close');

  const modalStyle = document.createElement('style');
  modalStyle.textContent = [
    '.vha-new-transmission-dialog{width:min(1500px,96vw);height:min(960px,94dvh);max-width:none;max-height:none;padding:0;border:1px solid #b9d77a66;border-radius:2px;background:#050906;color:#edf4e8;box-shadow:0 24px 90px #000c;overflow:hidden}',
    '.vha-new-transmission-dialog::backdrop{background:#020604d9;backdrop-filter:blur(7px)}',
    '.vha-new-transmission-dialog-head{height:42px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid #b9d77a35;background:#071316;color:#b9d77a;font:10px monospace;letter-spacing:1.3px}',
    '.vha-new-transmission-dialog-close{border:1px solid #b9d77a55;background:transparent;color:#edf4e8;padding:7px 11px;font:10px monospace;letter-spacing:1px;cursor:pointer}',
    '.vha-new-transmission-dialog iframe{display:block;width:100%;height:calc(100% - 42px);border:0;background:#050906}',
    '.vha-new-transmission-dialog[open]{display:flex;flex-direction:column}',
    '@media(max-width:600px){.vha-new-transmission-dialog{width:100vw;height:100dvh;border:0}.vha-new-transmission-dialog-head{height:48px;flex:0 0 48px}}'
  ].join('');
  document.head.appendChild(modalStyle);

  function closeEditorAfterSave() {
    window.clearTimeout(closeTimeout);
    closeTimeout = null;
    closeRequestId = null;
    dialog.close();
    dialogFrame.src = 'about:blank';
    closeButton.disabled = false;
    closeButton.textContent = 'CLOSE ×';
  }

  function requestEditorClose() {
    if (!dialog.open || !dialogFrame.contentWindow || closeRequestId) return;
    closeRequestId = (window.crypto?.randomUUID?.() || String(Date.now()));
    closeButton.disabled = true;
    closeButton.textContent = 'SAVING…';
    dialogFrame.contentWindow.postMessage({
      type: 'VHA_QUICK_POST_CLOSE_REQUEST',
      requestId: closeRequestId
    }, window.location.origin);
    closeTimeout = window.setTimeout(() => {
      if (!closeRequestId) return;
      closeRequestId = null;
      closeButton.disabled = false;
      closeButton.textContent = 'CLOSE ×';
    }, 20000);
  }

  function openNewTransmission() {
    const url = new URL('/landing-page/cms/', window.location.origin);
    url.searchParams.set('embed', '1');
    url.searchParams.set('new', '1');
    const category = selectedCategoryForPage();
    if (category) url.searchParams.set('category', category);
    dialogFrame.src = url.toString();
    dialog.showModal();
  }

  button.addEventListener('click', openNewTransmission);
  closeButton.addEventListener('click', requestEditorClose);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    requestEditorClose();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) requestEditorClose();
  });
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin ||
        event.source !== dialogFrame.contentWindow ||
        event.data?.type !== 'VHA_QUICK_POST_CLOSE_RESULT' ||
        event.data?.requestId !== closeRequestId) return;
    if (event.data.saved) {
      closeEditorAfterSave();
    } else {
      window.clearTimeout(closeTimeout);
      closeTimeout = null;
      closeRequestId = null;
      closeButton.disabled = false;
      closeButton.textContent = 'CLOSE ×';
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