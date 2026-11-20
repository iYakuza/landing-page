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
  const readJson = async (repo, path, fallback, options = {}) => {
    const file = await github().readJson(repo, path, options);
    return file ? { ...file, value: file.data } : { sha: null, value: fallback };
  };
  const write = async (repo, changes, message, expectedHeadSha) => {
    return github().commitFiles(repo, changes, { message, expectedHeadSha });
  };
  const currentHead = repo => github().getBranchHead(repo);

  async function getPublicCollections() {
    const commitSha = await currentHead('public');
    const [archive, transmissions] = await Promise.all([
      readJson('public', CONFIG.archivePath, null, { atCommit: commitSha }),
      readJson('public', CONFIG.transmissionsPath, null, { atCommit: commitSha })
    ]);
    if (!archive.value || !Array.isArray(archive.value.records || archive.value.items || archive.value)) {
      throw new Error('The canonical Human Archive collection is missing or has an unexpected structure.');
    }
    if (!Array.isArray(transmissions.value.records)) throw new Error('The canonical Transmissions collection has an unexpected structure.');
    return { archive, transmissions, commitSha };
  }

  async function savePublicJson(path, value, expectedHeadSha, message) {
    const head = await currentHead('public');
    const file = await github().readFile('public', path, { atCommit: head });
    if (!file) throw new Error('The public content file does not exist: ' + path);
    if (expectedHeadSha && head !== expectedHeadSha) throw new Error('The public repository changed. Reload before saving.');
    return write('public', [{ path, content: json(value) }], message || 'Update public CMS content', head);
  }

  async function listDrafts() {
    const commitSha = await currentHead('private');
    if (!commitSha) return [];
    const files = await github().listFiles('private', privatePath('drafts/transmissions'), { atCommit: commitSha });
    const drafts = [];
    for (const file of files.filter(item => item.path.endsWith('.json'))) {
      const record = await github().readJson('private', file.path, { atCommit: commitSha });
      if (record?.data) drafts.push({ ...record.data, _path: file.path, _sha: file.sha, _repoCommitSha: commitSha });
    }
    return drafts.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  }

  async function getDraft(draftId) {
    const path = privatePath('drafts/transmissions/' + id(draftId) + '.json');
    const commitSha = await currentHead('private');
    if (!commitSha) return null;
    const file = await github().readJson('private', path, { atCommit: commitSha });
    return file ? { ...file.data, _path: path, _sha: file.sha, _repoCommitSha: commitSha } : null;
  }

  async function saveDraft(draft, expectedHeadSha) {
    if (!draft || typeof draft !== 'object') throw new Error('A draft object is required.');
    const draftId = id(draft.draft_id || draft.id);
    const path = privatePath('drafts/transmissions/' + draftId + '.json');
    const head = await currentHead('private') || await github().initializePrivateRepository();
    if (expectedHeadSha && head !== expectedHeadSha) throw new Error('The private CMS repository changed. Reload before saving.');
    const { _path, _sha, _repoCommitSha, commitSha, ...draftData } = draft;
    const value = { ...draftData, draft_id: draftId, revision: Number(draft.revision || 0) + 1, updated_at: new Date().toISOString() };
    const result = await write('private', [{ path, content: json(value) }], 'Save Transmission draft ' + draftId, head);
    return { draft: value, commitSha: result.commitSha };
  }

  async function deleteDraft(draftId, expectedHeadSha) {
    const key = id(draftId);
    const path = privatePath('drafts/transmissions/' + key + '.json');
    const head = await currentHead('private');
    const file = await github().readFile('private', path, { atCommit: head });
    if (!file) return { deleted: false };
    if (expectedHeadSha && head !== expectedHeadSha) throw new Error('The private CMS repository changed. Reload before deleting.');
    const media = await github().listFiles('private', privatePath('media/drafts/' + key));
    const changes = [{ path, delete: true }, ...media.map(item => ({ path: item.path, delete: true }))];
    const result = await write('private', changes, 'Delete Transmission draft and private media ' + key, head);
    return { deleted: true, removedMediaCount: media.length, commitSha: result.commitSha };
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
    const head = await currentHead('private') || await github().initializePrivateRepository();
    const file = await readJson('private', privatePath('human-archive-favorites.json'), [], { atCommit: head });
    const entries = new Map((Array.isArray(file.value) ? file.value : []).map(item => [String(item.record_id), item]));
    if (isFavorite) { if (!entries.has(record)) entries.set(record, { record_id: Number(record), created_at: new Date().toISOString() }); }
    else entries.delete(record);
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
    const head = await currentHead('private') || await github().initializePrivateRepository();
    if (await github().readFile('private', path, { atCommit: head })) throw new Error('The CMS sequences have already been initialized.');
    const value = { transmission_number: post, archive_record_id: record, initialized_at: new Date().toISOString() };
    const result = await write('private', [{ path, content: json(value) }], 'Initialize verified CMS identifier sequences', head);
    return { ...value, commitSha: result.commitSha };
  }

  async function reserveSequence(expectedHeadSha) {
    const head = await currentHead('private') || await github().initializePrivateRepository();
    const file = await readJson('private', privatePath('sequences.json'), null, { atCommit: head });
    if (!file?.data) throw new Error('CMS identifier sequences have not been initialized from the verified content export.');
    if (!Number.isSafeInteger(Number(file.data.transmission_number)) || !Number.isSafeInteger(Number(file.data.archive_record_id))) throw new Error('The CMS identifier sequence file is invalid. Reconcile it before creating records.');
    if (expectedHeadSha && head !== expectedHeadSha) throw new Error('The private CMS sequence changed. Reload before creating a record.');
    const next = {
      transmission_number: Number(file.data.transmission_number) + 1,
      archive_record_id: Number(file.data.archive_record_id) + 1,
      updated_at: new Date().toISOString()
    };
    const result = await write('private', [{ path: privatePath('sequences.json'), content: json(next) }], 'Reserve CMS record identifiers', head);
    return { ...next, post_id: 'T-' + String(next.transmission_number).padStart(4, '0'), commitSha: result.commitSha };
  }


  async function uploadPublicMedia(recordId, files, folder = 'blocks', expectedHeadSha) {
    const record = Number(recordId);
    if (!Number.isSafeInteger(record) || record < 1) throw new Error('A valid Human Archive record ID is required.');
    const safeFolder = String(folder || 'blocks').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'blocks';
    const changes = [];
    for (const file of files || []) {
      if (!(file instanceof Blob)) throw new Error('A media upload must be a browser File or Blob.');
      if (file.size > CONFIG.maxMediaBytes) throw new Error(file.name + ' exceeds the 30 MB upload limit.');
      const name = String(file.name || 'media').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(-110) || 'media';
      const suffix = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      changes.push({ path: 'media/human-archive/HA-' + String(record).padStart(4, '0') + '/' + safeFolder + '/' + suffix + '-' + name, content: file });
    }
    if (!changes.length) return [];
    const head = await currentHead('public');
    if (expectedHeadSha && expectedHeadSha !== head) throw new Error('The public repository changed. Reload before uploading media.');
    const result = await write('public', changes, 'Upload Human Archive media HA-' + record, head);
    return changes.map((change, index) => ({
      path: change.path, url: '/landing-page/' + change.path, name: change.path.split('/').pop(),
      mime_type: files[index].type || 'application/octet-stream', commitSha: result.commitSha
    }));
  }

  async function deletePublicMedia(recordId, paths, expectedHeadSha) {
    const record = Number(recordId);
    const prefix = 'media/human-archive/HA-' + String(record).padStart(4, '0') + '/';
    const safe = [...new Set((paths || []).filter(path => typeof path === 'string' && path.startsWith(prefix)))];
    if (!safe.length) return { deleted: 0 };
    const head = await currentHead('public');
    if (expectedHeadSha && expectedHeadSha !== head) throw new Error('The public repository changed. Reload before cleaning up media.');
    const existing = await github().listFiles('public', prefix, { atCommit: head });
    const allowed = new Set(existing.map(item => item.path));
    const changes = safe.filter(path => allowed.has(path)).map(path => ({ path, delete: true }));
    if (!changes.length) return { deleted: 0 };
    const result = await write('public', changes, 'Remove unused Human Archive media HA-' + record, head);
    return { deleted: changes.length, commitSha: result.commitSha };
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
    return { ...draft, revision: saved.draft.revision, _repoCommitSha: saved.commitSha, commitSha: saved.commitSha };
  }

  async function uploadDraftMedia(draftId, files, folder = 'attachments', expectedHeadSha) {
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
    if (expectedHeadSha && expectedHeadSha !== head) throw new Error('The private CMS repository changed. Reload before uploading media.');
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



  async function deleteDraftMedia(draftId, paths, expectedHeadSha) {
    const key = id(draftId);
    const prefix = privatePath('media/drafts/' + key + '/');
    const safe = [...new Set((paths || []).filter(path => typeof path === 'string' && path.startsWith(prefix)))];
    if (!safe.length) return { deleted: 0 };
    const head = await currentHead('private');
    if (expectedHeadSha && head !== expectedHeadSha) throw new Error('The private CMS repository changed. Reload before cleaning up media.');
    const existing = await github().listFiles('private', prefix, { atCommit: head });
    const allowed = new Set(existing.map(item => item.path));
    const changes = safe.filter(path => allowed.has(path)).map(path => ({ path, delete: true }));
    if (!changes.length) return { deleted: 0 };
    const result = await write('private', changes, 'Remove unused private Transmission draft media ' + key, head);
    return { deleted: changes.length, commitSha: result.commitSha };
  }

  async function getDraftMediaFiles(draftId) {
    const key = id(draftId);
    const commitSha = await currentHead('private');
    if (!commitSha) return [];
    const prefix = privatePath('media/drafts/' + key);
    const files = await github().listFiles('private', prefix, { atCommit: commitSha });
    const mimeFor = name => {
      const ext = String(name).split('.').pop().toLowerCase();
      return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm' })[ext] || 'application/octet-stream';
    };
    const result = [];
    for (const item of files) {
      const file = await github().readFile('private', item.path, { atCommit: commitSha });
      if (!file) continue;
      const name = item.path.split('/').pop();
      const mime_type = mimeFor(name);
      const blob = new Blob([file.bytes], { type: mime_type });
      result.push({ path: item.path, name, mime_type, type: mime_type.split('/')[0], url: URL.createObjectURL(blob) });
    }
    return result;
  }

  async function getPublicStructure(recordId) {
    const { archive } = await getPublicCollections();
    return (archive.value.editor_structures || []).find(item => String(item.record_id) === String(recordId)) || null;
  }

  async function savePublicStructure(recordId, structure, expectedHeadSha) {
    const head = await currentHead('public');
    const archive = await readJson('public', CONFIG.archivePath, null, { atCommit: head });
    if (!archive?.data?.editor_structures) throw new Error('The canonical Human Archive collection could not be read.');
    if (expectedHeadSha && expectedHeadSha !== head) throw new Error('The public repository changed. Reload before saving.');
    const structures = Array.isArray(archive.data.editor_structures) ? [...archive.data.editor_structures] : [];
    const index = structures.findIndex(item => String(item.record_id) === String(recordId));
    const value = { ...structure, record_id: Number(recordId), updated_at: new Date().toISOString() };
    if (index >= 0) structures[index] = value; else structures.push(value);
    archive.data.editor_structures = structures;
    return write('public', [{ path: CONFIG.archivePath, content: json(archive.data) }], 'Save Human Archive editor structure ' + recordId, head);
  }

  async function publishDraft(draftId, options = {}) {
    const draft = await getDraft(draftId);
    if (!draft) throw new Error('The private draft no longer exists.');
    if (draft.kind !== 'transmission' || !draft.metadata || !draft.content) throw new Error('The private draft has an unsupported structure.');
    const publicHead = await currentHead('public');
    const [transmissions, archive] = await Promise.all([
      readJson('public', CONFIG.transmissionsPath, null, { atCommit: publicHead }),
      readJson('public', CONFIG.archivePath, null, { atCommit: publicHead })
    ]);
    if (!transmissions?.data?.records || !archive?.data?.editor_structures) throw new Error('The canonical public collections are incomplete.');
    transmissions.value = transmissions.data; archive.value = archive.data;
    const expectedPublicHead = options.expectedPublicHead || (draft.source === 'existing' ? draft.base_public_commit : null);
    if (expectedPublicHead && publicHead !== expectedPublicHead) throw new Error('The public Transmission changed after this draft was opened. Reload and reconcile before publishing.');
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
      const source = await github().readFile('private', item.path, { atCommit: draft._repoCommitSha });
      if (!source) throw new Error('A referenced private media file is missing: ' + item.path);
      const fileName = String(item.path.split('/').pop() || item.name || 'media').replace(/[^a-zA-Z0-9._-]+/g, '-');
      const target = 'media/transmissions/' + draft.post_id + '/' + fileName;
      mediaChanges.push({ path: target, content: source.bytes });
      pathMap.set(item.path, target);
      return { ...item, name: item.name || fileName, path: target, src: target, url: target, storage: 'github-public', status: 'available' };
    };
    post.media_items = await Promise.all(post.media_items.map(promote));
    const outputMedia = {};
    for (const kind of ['image', 'audio', 'video']) {
      outputMedia[kind] = await Promise.all((draft.content.output_media?.[kind] || []).map(promote));
    }
    post.content_html = String(post.content_html).replace(/cms-data\/v1\/media\/drafts\/[^\s"'<>)]*/g, match => pathMap.get(match) || match);
    post.media_url = post.media_items[0]?.url || '';
    post.media_path = post.media_items[0]?.path || '';
    post.media_type = post.media_items[0]?.type || '';
    const blocks = (Array.isArray(draft.content.blocks) ? draft.content.blocks : []).map(block => ({
      ...block,
      html: String(block.html || '').replace(/cms-data\/v1\/media\/drafts\/[^\s"'<>)]*/g, match => pathMap.get(match) || match)
    }));
    const oldIndex = transmissions.value.records.findIndex(item => item.id === draft.post_id);
    if (oldIndex >= 0) transmissions.value.records[oldIndex] = post;
    else transmissions.value.records.push(post);
    const structure = {
      record_id: Number(draft.record_id),
      transmission_body: post.content_html,
      prompt_style: draft.content.prompt_style || '',
      lyrics_style: draft.content.lyrics_style || '',
      output_text: draft.content.output_text || '',
      output_media: outputMedia,
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
    let privateCleanupPending = false;
    try {
      await deleteDraft(draftId, draft._repoCommitSha);
    } catch (cleanupError) {
      const latest = await getDraft(draftId);
      if (latest && latest.revision === draft.revision && latest.updated_at === draft.updated_at) {
        try { await deleteDraft(draftId, latest._repoCommitSha); }
        catch (retryError) { privateCleanupPending = true; }
      } else privateCleanupPending = true;
      if (privateCleanupPending) console.warn('Transmission published, but the private draft was retained because it changed during publication.', cleanupError);
    }
    return { post, commitSha: result.commitSha, privateCleanupPending };
  }


  async function createEditDraft(postId) {
    const privateHead = await currentHead('private') || await github().initializePrivateRepository();
    if (privateHead) {
      const existing = (await listDrafts()).find(item => item.post_id === postId && item.source === 'existing');
      if (existing) return existing;
    }
    const publicHead = await currentHead('public');
    const [transmissions, archive] = await Promise.all([
      readJson('public', CONFIG.transmissionsPath, null, { atCommit: publicHead }),
      readJson('public', CONFIG.archivePath, null, { atCommit: publicHead })
    ]);
    if (!transmissions?.data?.records || !archive?.data?.editor_structures) throw new Error('The canonical public collections are incomplete.');
    transmissions.value = transmissions.data; archive.value = archive.data;
    const post = transmissions.value.records.find(item => item.id === postId);
    if (!post) throw new Error('The published Transmission could not be found.');
    const structure = (archive.value.editor_structures || []).find(item => String(item.record_id) === String(post.archive_record_id)) || {};
    const draftId = crypto.randomUUID ? crypto.randomUUID() : 'draft-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const now = new Date().toISOString();
    const draft = {
      schema_version: 1, draft_id: draftId, kind: 'transmission',
      record_id: Number(post.archive_record_id), post_id: post.id, source: 'existing',
      status: 'draft', created_at: now, updated_at: now, revision: 1,
      base_public_commit: publicHead,
      metadata: { title: post.title || '', slug: post.slug || '', category: post.category || '', excerpt: post.excerpt || '', media_width: post.media_width || 100 },
      content: {
        transmission_body: structure.transmission_body || post.content_html || '',
        prompt_style: structure.prompt_style || '', lyrics_style: structure.lyrics_style || '',
        output_text: structure.output_text || '',
        output_media: structure.output_media || { image: [], audio: [], video: [] },
        blocks: Array.isArray(structure.blocks) ? structure.blocks : [],
        media_items: Array.isArray(post.media_items) ? post.media_items : []
      }
    };
    const saved = await saveDraft(draft, privateHead || undefined);
    return { ...draft, revision: saved.draft.revision, _repoCommitSha: saved.commitSha, commitSha: saved.commitSha };
  }


  async function unpublishDraft(draftId) {
    const draft = await getDraft(draftId);
    if (!draft || draft.kind !== 'transmission') throw new Error('Only a Transmission draft can be unpublished.');
    const publicHead = await currentHead('public');
    if (draft.base_public_commit && draft.base_public_commit !== publicHead) throw new Error('The public repository changed after this edit draft was opened. Reload and reconcile before unpublishing.');
    const [transmissions, archive] = await Promise.all([
      readJson('public', CONFIG.transmissionsPath, null, { atCommit: publicHead }),
      readJson('public', CONFIG.archivePath, null, { atCommit: publicHead })
    ]);
    if (!transmissions?.data?.records || !archive?.data?.editor_structures) throw new Error('The canonical public collections are incomplete.');
    const postExists = transmissions.data.records.some(item => item.id === draft.post_id);
    if (!postExists) {
      draft.source = 'existing';
      draft.base_public_commit = publicHead;
      const saved = await saveDraft(draft, draft._repoCommitSha);
      return { commitSha: publicHead, privateCommitSha: saved.commitSha, alreadyUnpublished: true };
    }
    transmissions.data.records = transmissions.data.records.filter(item => item.id !== draft.post_id);
    archive.data.editor_structures = archive.data.editor_structures.filter(item => String(item.record_id) !== String(draft.record_id));
    const result = await write('public', [
      { path: CONFIG.transmissionsPath, content: json(transmissions.data) },
      { path: CONFIG.archivePath, content: json(archive.data) }
    ], 'Unpublish Transmission ' + draft.post_id, publicHead);
    draft.source = 'existing';
    draft.base_public_commit = result.commitSha;
    let saved;
    try {
      saved = await saveDraft(draft, draft._repoCommitSha);
    } catch (saveError) {
      const latest = await getDraft(draftId);
      if (!latest) throw new Error('The public Transmission was unpublished, but its private draft could not be reconciled. Preserve the private repository before retrying.');
      latest.base_public_commit = result.commitSha;
      saved = await saveDraft(latest, latest._repoCommitSha);
    }
    return { commitSha: result.commitSha, privateCommitSha: saved.commitSha };
  }

  async function unpublishTransmission(postId) {
    const publicHead = await currentHead('public');
    const [transmissions, archive] = await Promise.all([
      readJson('public', CONFIG.transmissionsPath, null, { atCommit: publicHead }),
      readJson('public', CONFIG.archivePath, null, { atCommit: publicHead })
    ]);
    if (!transmissions?.data?.records || !archive?.data?.editor_structures) throw new Error('The canonical public collections are incomplete.');
    transmissions.value = transmissions.data; archive.value = archive.data;
    const post = transmissions.value.records.find(item => item.id === postId);
    if (!post) throw new Error('The published Transmission could not be found.');
    const structureIndex = (archive.value.editor_structures || []).findIndex(item => String(item.record_id) === String(post.archive_record_id));
    const structure = structureIndex >= 0 ? archive.value.editor_structures[structureIndex] : {};
    const draftId = crypto.randomUUID ? crypto.randomUUID() : 'draft-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const now = new Date().toISOString();
    const draft = {
      schema_version: 1, draft_id: draftId, kind: 'transmission',
      record_id: Number(post.archive_record_id), post_id: post.id, source: 'existing',
      status: 'draft', created_at: now, updated_at: now, revision: 1,
      base_public_commit: publicHead,
      metadata: { title: post.title || '', slug: post.slug || '', category: post.category || '', excerpt: post.excerpt || '', media_width: post.media_width || 100 },
      content: {
        transmission_body: structure.transmission_body || post.content_html || '',
        prompt_style: structure.prompt_style || '', lyrics_style: structure.lyrics_style || '',
        output_text: structure.output_text || '',
        output_media: structure.output_media || { image: [], audio: [], video: [] },
        blocks: Array.isArray(structure.blocks) ? structure.blocks : [],
        media_items: Array.isArray(post.media_items) ? post.media_items : []
      }
    };
    await saveDraft(draft);
    const head = publicHead;
    transmissions.value.records = transmissions.value.records.filter(item => item.id !== postId);
    if (structureIndex >= 0) archive.value.editor_structures.splice(structureIndex, 1);
    const result = await write('public', [
      { path: CONFIG.transmissionsPath, content: json(transmissions.value) },
      { path: CONFIG.archivePath, content: json(archive.value) }
    ], 'Unpublish Transmission ' + postId, head);
    draft.base_public_commit = result.commitSha;
    await saveDraft(draft);
    return { draftId, commitSha: result.commitSha };
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
    getDraftMediaFiles,
    deleteDraftMedia,
    createDraft,
    publishDraft,
    createEditDraft,
    unpublishTransmission,
    unpublishDraft,
    getPublicStructure,
    savePublicStructure,
    uploadPublicMedia,
    deletePublicMedia,
    getFavorites,
    setFavorite,
    getSequences,
    seedSequences,
    reserveSequence,
    savePrivateOverride,
    getPrivateOverride
  });
})();