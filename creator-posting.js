(() => {
  'use strict';
  if (window.__vhaUnifiedNewTransmissionLoaded) return;
  window.__vhaUnifiedNewTransmissionLoaded = true;

  const SUPABASE_URL = 'https://oeyxsqocldlovhsmzcjw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kuUFxaClmROwgZpGIw6bzg_ddvb521h';
  const EDITOR_VERSION = '20261118-ha-chamber-actions-9';
  let client = null;
  let isCreator = false;
  let refreshing = false;
  let authBound = false;
  let editorLoadPromise = null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'vha-new-transmission-global vha-editor-action';
  button.dataset.actionVariant = 'primary';
  button.textContent = '+ NEW TRANSMISSION';
  button.hidden = true;
  button.disabled = true;
  button.setAttribute('aria-label', 'Create a new transmission');
  document.body.appendChild(button);

  const style = document.createElement('style');
  style.textContent = [
    '.vha-new-transmission-global{position:fixed!important;left:18px!important;right:auto!important;bottom:18px!important;z-index:2147483007!important;padding:12px 16px!important;box-shadow:0 5px 20px #0008!important;white-space:nowrap}',
    '.vha-new-transmission-global[hidden]{display:none!important}',
    '@media(max-width:560px){.vha-new-transmission-global{left:10px!important;right:auto!important;bottom:10px!important;padding:11px 13px!important;font-size:10px!important}}'
  ].join('');
  document.head.appendChild(style);

  function ensureSupabase() {
    if (window.supabase?.createClient) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0';
      script.async = true;
      script.crossOrigin='anonymous';
      script.referrerPolicy='no-referrer';
      script.onload = () => window.supabase?.createClient ? resolve(true) : reject(new Error('Supabase loaded without createClient.'));
      script.onerror = () => reject(new Error('Supabase could not be loaded.'));
      document.head.appendChild(script);
    });
  }

  function loadStylesheet() {
    if (document.querySelector('link[data-vha-chamber-styles]')) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/landing-page/human-archive/chamber.css?v=' + EDITOR_VERSION;
      link.dataset.vhaChamberStyles = 'true';
      link.onload = () => resolve();
      link.onerror = () => {
        link.remove();
        reject(new Error('The shared chamber styles could not be loaded.'));
      };
      document.head.appendChild(link);
    });
  }

  function loadBlockEditorStylesheet() {
    if (document.querySelector('link[data-vha-block-editor-styles],link[href*="/editor-ui/block-editor.css"]')) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/landing-page/editor-ui/block-editor.css?v=' + EDITOR_VERSION;
      link.dataset.vhaBlockEditorStyles = 'true';
      link.onload = () => resolve();
      link.onerror = () => {
        link.remove();
        reject(new Error('The shared block editor styles could not be loaded.'));
      };
      document.head.appendChild(link);
    });
  }

  function loadScript(src, isReady) {
    if (isReady()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const target = new URL(src, window.location.href).href;
      const existing = [...document.scripts].find(item => item.src === target);
      if (existing) {
        const done = () => isReady() ? resolve() : reject(new Error('A shared editor dependency loaded but did not initialize: ' + src));
        existing.addEventListener('load', done, { once: true });
        existing.addEventListener('error', () => reject(new Error('A shared editor dependency could not be loaded: ' + src)), { once: true });
        if (isReady()) resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.addEventListener('load', () => isReady() ? resolve() : reject(new Error('A shared editor dependency loaded but did not initialize: ' + src)), { once: true });
      script.addEventListener('error', () => reject(new Error('A shared editor dependency could not be loaded: ' + src)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureSharedEditor() {
    if (editorLoadPromise) return editorLoadPromise;
    editorLoadPromise = (async () => {
      await ensureSupabase();
      await loadStylesheet();
      await loadBlockEditorStylesheet();
      await loadScript('/landing-page/editor-ui/block-editor.js?v=' + EDITOR_VERSION, () => Boolean(window.VHABlockEditor?.mountBlockEditor));
      await loadScript('/landing-page/editor-ui/rich-text-editor.js?v=' + EDITOR_VERSION, () => Boolean(window.VHAEditorUI?.mountRichTextEditor));
      await loadScript('/landing-page/human-archive/archive.js?v=' + EDITOR_VERSION, () => Boolean(window.__vhaArchiveChamberControllerLoaded));
      if (!window.__vhaArchiveChamberReady) throw new Error('The shared Transmission editor did not start.');
      await window.__vhaArchiveChamberReady;
    })().catch(error => {
      editorLoadPromise = null;
      throw error;
    });
    return editorLoadPromise;
  }

  async function openNewTransmission(trigger = button) {
    if (!isCreator || (trigger === button && button.disabled)) return;
    const isGlobalButton = trigger === button;
    if (isGlobalButton) {
      button.disabled = true;
      button.textContent = 'OPENING TRANSMISSION…';
      button.removeAttribute('title');
    }
    try {
      await ensureSharedEditor();
      window.dispatchEvent(new CustomEvent('VHA_OPEN_NEW_TRANSMISSION', { detail: { trigger } }));
    } catch (error) {
      console.error('The shared Transmission editor could not be opened:', error);
      if (isGlobalButton) button.title = String(error?.message || 'The editor could not be loaded. Please try again.');
      else if (trigger) trigger.title = String(error?.message || 'The editor could not be loaded. Please try again.');
    } finally {
      if (isGlobalButton) {
        button.disabled = false;
        button.textContent = '+ NEW TRANSMISSION';
      }
    }
  }

  async function openExistingTransmission(event) {
    const slug = String(event.detail?.slug || '').trim();
    const trigger = event.detail?.trigger || null;
    const edit = Boolean(event.detail?.edit);
    if (!slug) return;
    try {
      await ensureSharedEditor();
      window.dispatchEvent(new CustomEvent('VHA_OPEN_EXISTING_TRANSMISSION', { detail: { slug, trigger, edit } }));
    } catch (error) {
      console.error('The shared Transmission chamber could not be opened:', error);
      if (trigger) trigger.title = String(error?.message || 'The chamber could not be opened. Please try again.');
    }
  }

  button.addEventListener('click', () => openNewTransmission());
  window.addEventListener('VHA_REQUEST_OPEN_TRANSMISSION', openExistingTransmission);
  window.addEventListener('VHA_TRANSMISSION_CHAMBER_ERROR', event => {
    const trigger = event.detail?.trigger;
    if (trigger) trigger.title = String(event.detail?.message || 'The chamber could not be opened.');
  });
  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-vha-new-transmission]');
    if (!trigger) return;
    event.preventDefault();
    openNewTransmission(trigger);
  });

  async function refresh(sessionOverride) {
    if (refreshing) return;
    refreshing = true;
    try {
      await ensureSupabase();
      if (!client) client = window.__vhaSupabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      window.__vhaSupabaseClient = client;
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
    } catch (error) {
      console.error('Transmission creator permissions could not be refreshed:', error);
      isCreator = false;
    } finally {
      refreshing = false;
      button.hidden = !isCreator;
      button.disabled = !isCreator;
      document.querySelectorAll('[data-vha-new-transmission]').forEach(trigger => {
        trigger.hidden = !isCreator;
        if ('disabled' in trigger) trigger.disabled = !isCreator;
      });
    }
  }

  refresh();
})();
