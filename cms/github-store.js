(() => {
  'use strict';

  const github = () => {
    if (!window.VHAGitHub) throw new Error('The GitHub storage client has not loaded.');
    return window.VHAGitHub;
  };
  const CONFIG = Object.freeze({
    archivePath: 'content/human-archive.json',
    transmissionsPath: 'content/transmissions.json',
    privateRoot: 'cms-data/v1',
    maxMediaBytes: 30 * 1024 * 1024
  });
  const id = value => {
    const clean = String(value || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(clean)) throw new Error('Invalid CMS record identifier.');
    return clean;
  };
  const json = value => JSON.stringify(value, null, 2) + '\n';
  const privatePath = suffix => CONFIG.privateRoot + '/' + suffix;
  const readJson = async (repo, path, fallback) => {
    const file = await github().readJson(repo, path);
    return file ? { ...file, value: file.data } : { sha: null, value: fallback };
  };
  const write = async (repo, changes, message, expectedHeadSha) => {
    return github().commitFiles(repo, changes, { message, expectedHeadSha });
  };
  const currentHead = repo => github().getBranchHead(repo);

  async function getPublicCollections() {
    const [archive, transmissions] = await Promise.all([
      readJson('public', CONFIG.archivePath, null),
      readJson('public', CONFIG.transmissionsPath, [])
    ]);
    if (!archive.value || !Array.isArray(archive.value.records || archive.value.items || archive.value)) {
      throw new Error('The canonical Human Archive collection is missing or has an unexpected structure.');
    }
    if (!Array.isArray(transmissions.value.records)) throw new Error('The canonical Transmissions collection has an unexpected structure.');
    return { archive, transmissions };
  }

  async function savePublicJson(path, value, expectedHeadSha, message) {
    const file = await github().readFile('public', path);
    if (!file) throw new Error('The public content file does not exist: ' + path);
    const head = await currentHead('public');
    if (expectedHeadSha && head !== expectedHeadSha) throw new Error('The public repository changed. Reload before saving.');
    return write('public', [{ path, content: json(value) }], message || 'Update public CMS content', head);
  }

  async function listDrafts() {
    const files = await github().listFiles('private', privatePath('drafts/transmissions'));
    const drafts = [];
    for (const file of files.filter(item => item.path.endsWith('.json'))) {
      const record = await github().readJson('private', file.path);
      if (record?.data) drafts.push({ ...record.data, _path: file.path, _sha: file.sha });
    }
    return drafts.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  }

  async function getDraft(draftId) {
    const path = privatePath('drafts/transmissions/' + id(draftId) + '.json');
    const file = await github().readJson('private', path);
    return file ? { ...file.data, _path: path, _sha: file.sha } : null;
  }

  async function saveDraft(draft, expectedHeadSha) {
    if (!draft || typeof draft !== 'object') throw new Error('A draft object is required.');
    const draftId = id(draft.draft_id || draft.id);
    const path = privatePath('drafts/transmissions/' + draftId + '.json');
    const head = await currentHead('private') || await github().initializePrivateRepository();
    if (expectedHeadSha && head !== expectedHeadSha) throw new Error('The private CMS repository changed. Reload before saving.');
    const value = { ...draft, draft_id: draftId, updated_at: new Date().toISOString() };
    const result = await write('private', [{ path, content: json(value) }], 'Save Transmission draft ' + draftId, head);
    return { draft: value, commitSha: result.commitSha };
  }

  async function deleteDraft(draftId, expectedHeadSha) {
    const path = privatePath('drafts/transmissions/' + id(draftId) + '.json');
    const file = await github().readFile('private', path);
    if (!file) return { deleted: false };
    const head = await currentHead('private');
    if (expectedHeadSha && head !== expectedHeadSha) throw new Error('The private CMS repository changed. Reload before deleting.');
    const result = await write('private', [{ path, delete: true }], 'Delete Transmission draft ' + draftId, head);
    return { deleted: true, commitSha: result.commitSha };
  }

  async function savePrivateMedia(draftId, files) {
    const key = id(draftId);
    const changes = [];
    for (const file of files || []) {
      if (!(file instanceof Blob)) throw new Error('A media upload must be a browser File or Blob.');
      if (file.size > CONFIG.maxMediaBytes) throw new Error(file.name + ' exceeds the 30 MB upload limit.');
      const name = String(file.name || 'media').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(-110) || 'media';
      const suffix = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      changes.push({ path: privatePath('media/drafts/' + key + '/' + suffix + '-' + name), content: file });
    }
    if (!changes.length) return [];
    const head = await currentHead('private') || await github().initializePrivateRepository();
    const result = await write('private', changes, 'Upload private draft media ' + key, head);
    return changes.map(change => ({ path: change.path, commitSha: result.commitSha }));
  }

  async function getFavorites() {
    const file = await readJson('private', privatePath('human-archive-favorites.json'), []);
    if (Array.isArray(file.value)) return file.value.map(item => String(item.record_id));
    return Array.isArray(file.value.record_ids) ? file.value.record_ids.map(String) : [];
  }

  async function setFavorite(recordId, isFavorite) {
    const record = id(recordId);
    const file = await readJson('private', privatePath('human-archive-favorites.json'), []);
    const entries = new Map((Array.isArray(file.value) ? file.value : []).map(item => [String(item.record_id), item]));
    if (isFavorite) { if (!entries.has(record)) entries.set(record, { record_id: Number(record), created_at: new Date().toISOString() }); }
    else entries.delete(record);
    const head = await currentHead('private') || await github().initializePrivateRepository();
    const value = [...entries.values()].sort((a, b) => Number(a.record_id) - Number(b.record_id));
    const result = await write('private', [{ path: privatePath('human-archive-favorites.json'), content: json(value) }], 'Update Human Archive favourites', head);
    return { record_ids: value.map(item => String(item.record_id)), commitSha: result.commitSha };
  }

  async function getSequences() {
    const file = await readJson('private', privatePath('sequences.json'), null);
    return file.value;
  }

  async function seedSequences(transmissionPostId, archiveRecordId) {
    const post = Number(transmissionPostId), record = Number(archiveRecordId);
    if (!Number.isSafeInteger(post) || post < 0 || !Number.isSafeInteger(record) || record < 1) throw new Error('Sequence seeds must be verified non-negative/positive integers.');
    const path = privatePath('sequences.json');
    if (await github().readFile('private', path)) throw new Error('The CMS sequences have already been initialized.');
    const head = await currentHead('private') || await github().initializePrivateRepository();
    const result = await write('private', [{ path, content: json({ transmission_post_id: post, archive_record_id: record, initialized_at: new Date().toISOString() }) }], 'Initialize verified CMS identifier sequences', head);
    return { transmission_post_id: post, archive_record_id: record, commitSha: result.commitSha };
  }

  async function reserveSequence(expectedHeadSha) {
    const file = await readJson('private', privatePath('sequences.json'), null);
    if (!file) throw new Error('CMS identifier sequences have not been initialized from the verified content export.');
    const head = await currentHead('private') || await github().initializePrivateRepository();
    if (expectedHeadSha && head !== expectedHeadSha) throw new Error('The private CMS sequence changed. Reload before creating a record.');
    const next = {
      transmission_post_id: Number(file.value.transmission_post_id || 0) + 1,
      archive_record_id: Number(file.value.archive_record_id || 3008) + 1,
      updated_at: new Date().toISOString()
    };
    const result = await write('private', [{ path: privatePath('sequences.json'), content: json(next) }], 'Reserve CMS record identifiers', head);
    return { ...next, commitSha: result.commitSha };
  }

  async function savePrivateOverride(recordId, override) {
    const key = id(recordId);
    const head = await currentHead('private') || await github().initializePrivateRepository();
    const result = await write('private', [{ path: privatePath('private-overrides/' + key + '.json'), content: json({ record_id: key, ...override, updated_at: new Date().toISOString() }) }], 'Save private archive override ' + key, head);
    return result;
  }

  async function getPrivateOverride(recordId) {
    const file = await github().readJson('private', privatePath('private-overrides/' + id(recordId) + '.json'));
    return file?.data || null;
  }

  window.VHACMSStore = Object.freeze({
    config: CONFIG,
    getPublicCollections,
    savePublicJson,
    listDrafts,
    getDraft,
    saveDraft,
    deleteDraft,
    savePrivateMedia,
    getFavorites,
    setFavorite,
    getSequences,
    seedSequences,
    reserveSequence,
    savePrivateOverride,
    getPrivateOverride
  });
})();