(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const github = window.VHAGitHub;
  const store = window.VHACMSStore;
  const loginPanel = $('login-panel');
  const workspace = $('workspace');
  const setupNote = $('setup-note');
  const loginForm = $('login-form');
  const loginMessage = $('login-message');
  const sequencePanel = $('github-sequence-setup');
  const sequenceMessage = $('sequence-message');
  const communityPanel = $('community-review');
  let currentUser = null;

  function message(element, value, isError = false) {
    if (!element) return;
    element.textContent = value;
    element.classList.toggle('error', Boolean(isError));
  }

  function showLogin() {
    loginPanel.hidden = false;
    workspace.hidden = true;
    setupNote.hidden = true;
    if (sequencePanel) sequencePanel.hidden = true;
    if (communityPanel) communityPanel.hidden = true;
  }

  async function showWorkspace(user) {
    currentUser = user;
    loginPanel.hidden = true;
    workspace.hidden = false;
    setupNote.hidden = true;
    if (communityPanel) communityPanel.hidden = true;
    $('user-line').textContent = 'SIGNED IN // ' + (user.login || 'iYakuza') + ' // GITHUB OWNER';
    try {
      const sequences = await store.getSequences();
      sequencePanel.hidden = Boolean(sequences);
      if (sequences) {
        $('user-line').textContent += ' // IDENTIFIERS READY';
        message(sequenceMessage, 'IDENTIFIERS INITIALIZED // NEXT: T-' + String(Number(sequences.transmission_number) + 1).padStart(4, '0') + ' / ' + (Number(sequences.archive_record_id) + 1));
      } else {
        message(sequenceMessage, 'The private repository is ready for its one-time sequence initialization.');
      }
    } catch (error) {
      sequencePanel.hidden = false;
      message(sequenceMessage, error.message || 'Could not inspect the private CMS repository.', true);
    }
  }

  async function connect(token) {
    if (!github || !store) throw new Error('The GitHub CMS modules did not load. Refresh this page and try again.');
    const result = await github.authenticate(token);
    $('github-token').value = '';
    await showWorkspace(result.user);
    message(loginMessage, '');
  }

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    message(loginMessage, 'VERIFYING GITHUB ACCOUNT AND BOTH REPOSITORIES…');
    try {
      await connect($('github-token').value);
    } catch (error) {
      message(loginMessage, error.message || 'GitHub authentication failed.', true);
    } finally {
      button.disabled = false;
    }
  });

  $('initialize-sequences')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    message(sequenceMessage, 'INITIALIZING THE PRIVATE CMS REPOSITORY…');
    try {
      const result = await store.seedSequences(6, 3008);
      sequencePanel.hidden = false;
      button.hidden = true;
      message(sequenceMessage, 'SEQUENCES INITIALIZED // NEXT: T-' + String(result.transmission_number + 1).padStart(4, '0') + ' / ' + (result.archive_record_id + 1));
    } catch (error) {
      message(sequenceMessage, error.message || 'The sequence initialization failed.', true);
    } finally {
      button.disabled = false;
    }
  });

  $('sign-out')?.addEventListener('click', () => {
    github?.signOut();
    currentUser = null;
    showLogin();
    message(loginMessage, 'Signed out. The session token has been cleared from this tab.');
  });

  github?.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      showLogin();
    } else if (event === 'SIGNED_IN' && session?.user) {
      showWorkspace(session.user);
    }
  });

  window.__vhaCmsAuthReady = (async () => {
    try {
      const session = await github?.restoreSession();
      if (session?.user) await showWorkspace(session.user);
      else showLogin();
    } catch (error) {
      showLogin();
      message(loginMessage, error.message || 'The saved GitHub session could not be restored. Sign in again.', true);
    }
  })();
})();