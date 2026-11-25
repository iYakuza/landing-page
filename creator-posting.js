(() => {
  'use strict';
  if (window.__vhaUnifiedNewTransmissionLoaded) return;
  window.__vhaUnifiedNewTransmissionLoaded = true;

  const EDITOR_VERSION = '20261125-ha-standard-2';
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
      await loadScript('/landing-page/cms/github-client.js?v=20261120-github-cms-4', () => Boolean(window.VHAGitHub));
      await loadScript('/landing-page/cms/github-store.js?v=20261120-github-cms-4', () => Boolean(window.VHACMSStore));
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

  function openAddressedTransmission(){
    if(document.body.dataset.archive==='community')return;
    const params=new URLSearchParams(window.location.search);
    const recordId=params.get('record');
    const legacySlug=params.get('post');
    const index=Array.isArray(window.__vhaTransmissionIndex)?window.__vhaTransmissionIndex:[];
    const record=recordId?index.find(item=>String(item.id)===recordId):index.find(item=>item.slug===legacySlug);
    if(!record||window.__vhaAddressedTransmissionOpened===String(record.id))return;
    window.__vhaAddressedTransmissionOpened=String(record.id);
    if(!recordId){
      const url=new URL(window.location.href);
      url.searchParams.delete('post');url.searchParams.set('record',String(record.id));
      history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    }
    openExistingTransmission({detail:{slug:record.slug,trigger:null}});
  }
  window.addEventListener('VHA_TRANSMISSIONS_READY',openAddressedTransmission);
  openAddressedTransmission();

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

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      if (!window.VHAGitHub) {
        await loadScript('/landing-page/cms/github-client.js?v=20261120-github-cms-4', () => Boolean(window.VHAGitHub));
      }
      const session = await window.VHAGitHub.restoreSession();
      isCreator = Boolean(session?.user && String(session.user.login || '').toLowerCase() === 'iyakuza');
      if (!authBound) {
        authBound = true;
        window.VHAGitHub.onAuthStateChange(() => {
          window.setTimeout(() => refresh(), 0);
        });
      }
    } catch (error) {
      if (error?.code !== 'NOT_AUTHENTICATED') console.error('Transmission creator permissions could not be refreshed:', error);
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
