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

  async function seedSequences(transmissionNumber, archiveRecordId) {
    const post = Number(transmissionNumber), record = Number(archiveRecordId);
    if (!Number.isSafeInteger(post) || post < 0 || !Number.isSafeInteger(record) || record < 1) throw new Error('Sequence seeds must be verified non-negative/positive integers.');
    const path = privatePath('sequences.json');
    if (await github().readFile('private', path)) throw new Error('The CMS sequences have already been initialized.');
    const head = await currentHead('private') || await github().initializePrivateRepository();
    const value = { transmission_number: post, archive_record_id: record, initialized_at: new Date().toISOString() };
    const result = await write('private', [{ path, content: json(value) }], 'Initialize verified CMS identifier sequences', head);
    return { ...value, commitSha: result.commitSha };
  }

  async function reserveSequence(expectedHeadSha) {
    const file = await readJson('private', privatePath('sequences.json'), null);
    if (!file) throw new Error('CMS identifier sequences have not been initialized from the verified content export.');
    const head = await currentHead('private') || await github().initializePrivateRepository();
    if (expectedHeadSha && head !== expectedHeadSha) throw new Error('The private CMS sequence changed. Reload before creating a record.');
    const next = {
      transmission_number: Number(file.value.transmission_number || 0) + 1,
      archive_record_id: Number(file.value.archive_record_id || 0) + 1,
      updated_at: new Date().toISOString()
    };
    const result = await write('private', [{ path: privatePath('sequences.json'), content: json(next) }], 'Reserve CMS record identifiers', head);
    return { ...next, post_id: 'T-' + String(next.transmission_number).padStart(4, '0'), commitSha: result.commitSha };
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


  async function createDraft(metadata = {}, source = 'new') {
    const reserved = await reserveSequence();
    const draftId = crypto.randomUUID ? crypto.randomUUID() : 'draft-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const now = new Date().toISOString();
    const publicHead = await currentHead('public');
    const draft = {
      schema_version: 1, draft_id: draftId, kind: 'transmission',
      record_id: reserved.archive_record_id, post_id: reserved.post_id,
      source, status: 'draft', created_at: now, updated_at: now, revision: 1,
      base_public_commit: source === 'new' ? null : publicHead,
      metadata: { title: '', slug: '', category: '', excerpt: '', media_width: 100, ...metadata },
      content: { transmission_body: '', prompt_style: '', lyrics_style: '', output_text: '',
        output_media: { image: [], audio: [], video: [] }, blocks: [], media_items: [] }
    };
    const saved = await saveDraft(draft);
    return { ...draft, commitSha: saved.commitSha };
  }

  async function uploadDraftMedia(draftId, files, folder = 'attachments') {
    const key = id(draftId);
    const safeFolder = String(folder || 'attachments').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'attachments';
    const changes = [];
    for (const file of files || []) {
      if (!(file instanceof Blob)) throw new Error('A media upload must be a browser File or Blob.');
      if (file.size > CONFIG.maxMediaBytes) throw new Error(file.name + ' exceeds the 30 MB upload limit.');
      const name = String(file.name || 'media').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(-110) || 'media';
      const suffix = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      changes.push({ path: privatePath('media/drafts/' + key + '/' + safeFolder + '/' + suffix + '-' + name), content: file });
    }
    if (!changes.length) return [];
    const head = await currentHead('private') || await github().initializePrivateRepository();
    const result = await write('private', changes, 'Upload private Transmission draft media ' + key, head);
    return changes.map(change => ({ path: change.path, name: change.path.split('/').pop(), commitSha: result.commitSha }));
  }

  async function readPrivateMedia(path) {
    const safe = String(path || '');
    if (!safe.startsWith(privatePath('media/drafts/'))) throw new Error('The requested path is not private draft media.');
    const file = await github().readFile('private', safe);
    if (!file) throw new Error('The private draft media file could not be found.');
    return new Blob([file.bytes]);
  }

  async function getPublicStructure(recordId) {
    const { archive } = await getPublicCollections();
    return (archive.value.editor_structures || []).find(item => String(item.record_id) === String(recordId)) || null;
  }

  async function savePublicStructure(recordId, structure, expectedHeadSha) {
    const { archive } = await getPublicCollections();
    const head = await currentHead('public');
    if (expectedHeadSha && expectedHeadSha !== head) throw new Error('The public repository changed. Reload before saving.');
    const structures = Array.isArray(archive.value.editor_structures) ? [...archive.value.editor_structures] : [];
    const index = structures.findIndex(item => String(item.record_id) === String(recordId));
    const value = { ...structure, record_id: Number(recordId), updated_at: new Date().toISOString() };
    if (index >= 0) structures[index] = value; else structures.push(value);
    archive.value.editor_structures = structures;
    return write('public', [{ path: CONFIG.archivePath, content: json(archive.value) }], 'Save Human Archive editor structure ' + recordId, head);
  }

  async function publishDraft(draftId, options = {}) {
    const draft = await getDraft(draftId);
    if (!draft) throw new Error('The private draft no longer exists.');
    if (draft.kind !== 'transmission' || !draft.metadata || !draft.content) throw new Error('The private draft has an unsupported structure.');
    const [transmissions, archive] = await Promise.all([
      readJson('public', CONFIG.transmissionsPath, null),
      readJson('public', CONFIG.archivePath, null)
    ]);
    if (!transmissions.value?.records || !archive.value?.editor_structures) throw new Error('The canonical public collections are incomplete.');
    const publicHead = await currentHead('public');
    if (options.expectedPublicHead && publicHead !== options.expectedPublicHead) throw new Error('The public repository changed. Reload before publishing.');
    const slug = String(draft.metadata.slug || '').trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('The Transmission slug is invalid.');
    if (!String(draft.metadata.title || '').trim() || String(draft.metadata.title).length > 180) throw new Error('The Transmission title is invalid.');
    if (!String(draft.metadata.category || '').trim()) throw new Error('Choose a Transmission movement before publishing.');
    const duplicateSlug = transmissions.value.records.find(item => item.slug === slug && item.id !== draft.post_id);
    if (duplicateSlug) throw new Error('That public URL slug is already in use.');
    const pathMap = new Map();
    const post = {
      id: draft.post_id, slug, title: draft.metadata.title, status: 'published',
      excerpt: draft.metadata.excerpt || '', category: draft.metadata.category,
      created_at: draft.created_at, updated_at: new Date().toISOString(), published_at: new Date().toISOString(),
      media_width: draft.metadata.media_width || 100,
      content_html: draft.content.transmission_body || '',
      media_items: Array.isArray(draft.content.media_items) ? [...draft.content.media_items] : [],
      archive_record_id: Number(draft.record_id), human_archive_id: 'HA-' + String(draft.record_id)
    };
    const mediaChanges = [];
    const promote = async item => {
      if (!item || !String(item.path || '').startsWith(privatePath('media/drafts/' + id(draftId) + '/'))) return item;
      const source = await github().readFile('private', item.path);
      if (!source) throw new Error('A referenced private media file is missing: ' + item.path);
      const fileName = String(item.name || item.path.split('/').pop()).split('/').pop().replace(/[^a-zA-Z0-9._-]+/g, '-');
      const target = 'media/transmissions/' + draft.post_id + '/' + fileName;
      mediaChanges.push({ path: target, content: source.bytes });
      pathMap.set(item.path, target);
      return { ...item, name: item.name || fileName, path: target, src: target, url: target, storage: 'github-public', status: 'published' };
    };
    post.media_items = await Promise.all(post.media_items.map(promote));
    const outputMedia = {};
    for (const kind of ['image', 'audio', 'video']) {
      outputMedia[kind] = await Promise.all((draft.content.output_media?.[kind] || []).map(promote));
    }
    post.content_html = String(post.content_html).replace(/cms-data\\/v1\\/media\\/drafts\\/[^\\s"'<>)]*/g, match => pathMap.get(match) || match);
    post.media_url = post.media_items[0]?.url || '';
    post.media_path = post.media_items[0]?.path || '';
    post.media_type = post.media_items[0]?.type || '';
    const blocks = (Array.isArray(draft.content.blocks) ? draft.content.blocks : []).map(block => ({
      ...block,
      html: String(block.html || '').replace(/cms-data\\/v1\\/media\\/drafts\\/[^\\s"'<>)]*/g, match => pathMap.get(match) || match)
    }));
    const oldIndex = transmissions.value.records.findIndex(item => item.id === draft.post_id);
    if (oldIndex >= 0) transmissions.value.records[oldIndex] = post;
    else transmissions.value.records.push(post);
    const structure = {
      record_id: Number(draft.record_id),
      transmission_body: draft.content.transmission_body || '',
      prompt_style: draft.content.prompt_style || '',
      lyrics_style: draft.content.lyrics_style || '',
      output_text: draft.content.output_text || '',
      output_media,
      blocks,
      updated_at: new Date().toISOString()
    };
    const structures = archive.value.editor_structures;
    const structureIndex = structures.findIndex(item => String(item.record_id) === String(draft.record_id));
    if (structureIndex >= 0) structures[structureIndex] = structure; else structures.push(structure);
    if (post.content_html.includes('cms-data/v1/media/drafts/') || JSON.stringify(outputMedia).includes('cms-data/v1/media/drafts/')) throw new Error('A private draft media reference could not be promoted safely.');
    const changes = [
      { path: CONFIG.transmissionsPath, content: json(transmissions.value) },
      { path: CONFIG.archivePath, content: json(archive.value) },
      ...mediaChanges
    ];
    const result = await write('public', changes, 'Publish Transmission ' + draft.post_id, publicHead);
    await deleteDraft(draftId);
    return { post, commitSha: result.commitSha };
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
    uploadDraftMedia,
    readPrivateMedia,
    createDraft,
    publishDraft,
    getPublicStructure,
    savePublicStructure,
    getFavorites,
    setFavorite,
    getSequences,
    seedSequences,
    reserveSequence,
    savePrivateOverride,
    getPrivateOverride
  });
})();