(() => {
  'use strict';

  const CONFIG = Object.freeze({
    owner: 'iYakuza',
    publicRepo: 'landing-page',
    privateRepo: 'iyakuza-cms-private',
    publicBranch: 'recovery/supabase-content-export-20261119',
    privateBranch: 'main',
    tokenKey: 'vha.github.token.v1',
    api: 'https://api.github.com'
  });

  const memory = { user: null, repos: null, trees: new Map() };
  const authEvent = 'vha:github-auth-changed';

  class GitHubError extends Error {
    constructor(message, status = 0, code = 'GITHUB_ERROR') {
      super(message);
      this.name = 'GitHubError';
      this.status = status;
      this.code = code;
    }
  }

  function tokenFromSession() {
    try { return sessionStorage.getItem(CONFIG.tokenKey) || ''; }
    catch { return ''; }
  }

  function setToken(token) {
    try { sessionStorage.setItem(CONFIG.tokenKey, token); }
    catch { throw new GitHubError('This browser does not allow session storage. Enable it for this site and try again.', 0, 'SESSION_STORAGE_UNAVAILABLE'); }
  }

  function clearToken() {
    try { sessionStorage.removeItem(CONFIG.tokenKey); } catch {}
    memory.user = null;
    memory.repos = null;
    memory.trees.clear();
    window.dispatchEvent(new CustomEvent(authEvent, { detail: { authenticated: false } }));
  }

  function safePath(path) {
    const value = String(path || '').replace(/^\/+/, '');
    if (!value || value.split('/').some(part => !part || part === '.' || part === '..') || value.includes('\\') || value.includes('?') || value.includes('#')) {
      throw new GitHubError('The repository path is invalid.', 0, 'INVALID_PATH');
    }
    return value;
  }

  function repoName(key) {
    if (key === 'public') return CONFIG.publicRepo;
    if (key === 'private') return CONFIG.privateRepo;
    throw new GitHubError('Unknown repository target.', 0, 'INVALID_REPOSITORY');
  }

  function repoFullName(key) { return CONFIG.owner + '/' + repoName(key); }
  function repoBranch(key) { return key === 'public' ? CONFIG.publicBranch : CONFIG.privateBranch; }

  async function request(path, options = {}, suppliedToken = '') {
    const token = suppliedToken || tokenFromSession();
    if (!token) throw new GitHubError('Sign in with your GitHub token first.', 401, 'NOT_AUTHENTICATED');
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('Authorization', 'Bearer ' + token);
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    let response;
    try {
      response = await fetch(CONFIG.api + path, { ...options, headers, credentials: 'omit', cache: 'no-store' });
    } catch {
      throw new GitHubError('GitHub could not be reached. Check your connection and try again.', 0, 'NETWORK_ERROR');
    }
    const raw = await response.text();
    let body = null;
    if (raw) { try { body = JSON.parse(raw); } catch { body = raw; } }
    if (!response.ok) {
      const message = typeof body?.message === 'string' ? body.message : 'GitHub request failed.';
      const code = response.status === 409 || response.status === 422 ? 'GITHUB_CONFLICT' : 'GITHUB_ERROR';
      throw new GitHubError(message, response.status, code);
    }
    return body;
  }

  async function verifyToken(token) {
    const clean = String(token || '').trim();
    if (!/^github_pat_[A-Za-z0-9_]+$/.test(clean)) {
      throw new GitHubError('Use a fine-grained personal access token (the token should start with github_pat_).', 0, 'INVALID_TOKEN_FORMAT');
    }
    const user = await request('/user', {}, clean);
    if (String(user?.login || '').toLowerCase() !== CONFIG.owner.toLowerCase()) {
      throw new GitHubError('This token belongs to a different GitHub account. Sign in with the iYakuza account.', 403, 'WRONG_GITHUB_USER');
    }
    const [publicRepo, privateRepo] = await Promise.all([
      request('/repos/' + CONFIG.owner + '/' + CONFIG.publicRepo, {}, clean),
      request('/repos/' + CONFIG.owner + '/' + CONFIG.privateRepo, {}, clean)
    ]);
    if (publicRepo?.full_name?.toLowerCase() !== repoFullName('public').toLowerCase() || publicRepo?.private !== false) {
      throw new GitHubError('The public website repository could not be verified.', 403, 'PUBLIC_REPOSITORY_MISMATCH');
    }
    if (privateRepo?.full_name?.toLowerCase() !== repoFullName('private').toLowerCase() || privateRepo?.private !== true) {
      throw new GitHubError('The CMS data repository must exist and be private.', 403, 'PRIVATE_REPOSITORY_MISMATCH');
    }
    setToken(clean);
    memory.user = { login: user.login, name: user.name || user.login, avatar_url: user.avatar_url || '' };
    memory.repos = { public: publicRepo, private: privateRepo };
    memory.trees.clear();
    window.dispatchEvent(new CustomEvent(authEvent, { detail: { authenticated: true, user: memory.user } }));
    return { user: memory.user, repositories: memory.repos };
  }

  async function getUser(force = false) {
    if (!tokenFromSession()) return null;
    if (memory.user && !force) return memory.user;
    const user = await request('/user');
    if (String(user?.login || '').toLowerCase() !== CONFIG.owner.toLowerCase()) {
      clearToken();
      throw new GitHubError('The active token no longer matches the CMS owner account.', 403, 'WRONG_GITHUB_USER');
    }
    memory.user = { login: user.login, name: user.name || user.login, avatar_url: user.avatar_url || '' };
    return memory.user;
  }

  function encodeBytes(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function decodeBase64(value) {
    const binary = atob(String(value || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return new TextEncoder().encode(String(value ?? ''));
  }

  async function getBranchHead(key, branchOverride) {
    const branch = branchOverride || repoBranch(key);
    try {
      const ref = await request('/repos/' + repoFullName(key) + '/git/ref/heads/' + branch);
      return ref.object.sha;
    } catch (error) {
      if (error.status === 404 && key === 'private') return null;
      throw error;
    }
  }

  async function getTree(key, commitSha) {
    const cacheKey = key + ':' + commitSha;
    if (memory.trees.has(cacheKey)) return memory.trees.get(cacheKey);
    const commit = await request('/repos/' + repoFullName(key) + '/git/commits/' + commitSha);
    const tree = await request('/repos/' + repoFullName(key) + '/git/trees/' + commit.tree.sha + '?recursive=1');
    if (tree.truncated) throw new GitHubError('The repository tree is too large to inspect safely in one request.', 413, 'TREE_TRUNCATED');
    memory.trees.set(cacheKey, tree.tree || []);
    return tree.tree || [];
  }

  async function readFile(key, path, options = {}) {
    const safe = safePath(path);
    const branch = options.branch || repoBranch(key);
    const head = options.atCommit || await getBranchHead(key, branch);
    if (!head) return null;
    const tree = await getTree(key, head);
    const entry = tree.find(item => item.path === safe && item.type === 'blob');
    if (!entry) return null;
    const blob = await request('/repos/' + repoFullName(key) + '/git/blobs/' + entry.sha);
    const bytes = decodeBase64(blob.content);
    return { path: safe, sha: entry.sha, bytes, text: () => new TextDecoder().decode(bytes), size: blob.size };
  }

  async function readJson(key, path, options = {}) {
    const file = await readFile(key, path, options);
    if (!file) return null;
    try { return { ...file, data: JSON.parse(file.text()) }; }
    catch { throw new GitHubError('The repository file ' + path + ' contains invalid JSON.', 0, 'INVALID_JSON'); }
  }

  async function createBlob(key, bytes) {
    const result = await request('/repos/' + repoFullName(key) + '/git/blobs', {
      method: 'POST', body: JSON.stringify({ content: encodeBytes(bytes), encoding: 'base64' })
    });
    return result.sha;
  }

  async function initializePrivateRepository() {
    const head = await getBranchHead('private');
    if (head) return head;
    const content = '# iYakuza CMS private data\n\nThis repository stores unpublished CMS drafts, private media, favourites, preferences and audit records. Do not make this repository public.\n';
    const blobSha = await createBlob('private', asBytes(content));
    const tree = await request('/repos/' + repoFullName('private') + '/git/trees', {
      method: 'POST', body: JSON.stringify({ tree: [{ path: 'README.md', mode: '100644', type: 'blob', sha: blobSha }] })
    });
    const commit = await request('/repos/' + repoFullName('private') + '/git/commits', {
      method: 'POST', body: JSON.stringify({ message: 'Initialize private CMS data repository', tree: tree.sha, parents: [] })
    });
    await request('/repos/' + repoFullName('private') + '/git/refs', {
      method: 'POST', body: JSON.stringify({ ref: 'refs/heads/' + CONFIG.privateBranch, sha: commit.sha })
    });
    memory.trees.clear();
    return commit.sha;
  }

  async function commitFiles(key, changes, options = {}) {
    if (!Array.isArray(changes) || !changes.length) throw new GitHubError('There are no file changes to save.', 0, 'EMPTY_COMMIT');
    if (key !== 'public' && key !== 'private') throw new GitHubError('Unknown repository target.', 0, 'INVALID_REPOSITORY');
    const paths = new Set();
    for (const change of changes) {
      const path = safePath(change.path);
      if (paths.has(path)) throw new GitHubError('A commit cannot contain duplicate paths.', 0, 'DUPLICATE_PATH');
      paths.add(path);
    }
    let parent = await getBranchHead(key);
    if (!parent && key === 'private') parent = await initializePrivateRepository();
    if (!parent && key === 'public') throw new GitHubError('The configured public recovery branch does not exist.', 404, 'BRANCH_NOT_FOUND');
    if (options.expectedHeadSha && parent !== options.expectedHeadSha) {
      throw new GitHubError('The repository changed since this editor loaded it. Reload before saving to avoid overwriting another edit.', 409, 'EDIT_CONFLICT');
    }
    const entries = [];
    for (const change of changes) {
      const path = safePath(change.path);
      if (change.delete === true) {
        entries.push({ path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      let value = change.content;
      if (typeof Blob !== 'undefined' && value instanceof Blob) value = await value.arrayBuffer();
      const bytes = asBytes(value);
      const sha = await createBlob(key, bytes);
      entries.push({ path, mode: change.executable ? '100755' : '100644', type: 'blob', sha });
    }
    const baseCommit = await request('/repos/' + repoFullName(key) + '/git/commits/' + parent);
    const tree = await request('/repos/' + repoFullName(key) + '/git/trees', {
      method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entries })
    });
    const commit = await request('/repos/' + repoFullName(key) + '/git/commits', {
      method: 'POST', body: JSON.stringify({ message: String(options.message || 'Update CMS content'), tree: tree.sha, parents: [parent] })
    });
    try {
      await request('/repos/' + repoFullName(key) + '/git/refs/heads/' + repoBranch(key), {
        method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false })
      });
    } catch (error) {
      if (error.status === 422 || error.status === 409) {
        throw new GitHubError('GitHub rejected this save because the branch changed. Your changes were not published; reload and reconcile the newer version.', 409, 'EDIT_CONFLICT');
      }
      throw error;
    }
    memory.trees.clear();
    return { commitSha: commit.sha, parentSha: parent, treeSha: tree.sha, paths: [...paths] };
  }

  function onAuthStateChange(callback) {
    if (typeof callback !== 'function') return () => {};
    const handler = event => callback(event.detail?.authenticated ? 'SIGNED_IN' : 'SIGNED_OUT', event.detail?.authenticated ? { user: event.detail.user } : null);
    window.addEventListener(authEvent, handler);
    return () => window.removeEventListener(authEvent, handler);
  }

  async function restoreSession() {
    if (!tokenFromSession()) return null;
    try {
      const user = await getUser(true);
      const [publicRepo, privateRepo] = await Promise.all([
        request('/repos/' + repoFullName('public')),
        request('/repos/' + repoFullName('private'))
      ]);
      if (publicRepo.private || !privateRepo.private) throw new GitHubError('Repository visibility no longer matches the CMS configuration.', 403, 'REPOSITORY_VISIBILITY_MISMATCH');
      memory.repos = { public: publicRepo, private: privateRepo };
      return { user, repositories: memory.repos };
    } catch (error) {
      clearToken();
      throw error;
    }
  }

  window.VHAGitHub = Object.freeze({
    config: CONFIG,
    GitHubError,
    authenticate: verifyToken,
    restoreSession,
    signOut: clearToken,
    getUser,
    onAuthStateChange,
    request,
    getBranchHead,
    readFile,
    readJson,
    commitFiles,
    initializePrivateRepository
  });
})();