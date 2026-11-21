'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'cms', 'github-store.js'), 'utf8');
const archiveSource = fs.readFileSync(path.join(__dirname, '..', 'human-archive', 'archive.js'), 'utf8');
const context = vm.createContext({ window: {}, URL });
vm.runInContext(source, context, { filename: 'cms/github-store.js' });

const collect = context.window.VHACMSStore.getPublicMediaReferencesFromHtml;
const buildManifest = context.window.VHACMSStore.buildPublishedMediaItems;
const plain = value => JSON.parse(JSON.stringify(value));

test('collects local images, audio and video from saved block HTML', () => {
  const html = [
    '<figure><img src="/landing-page-preview/media/human-archive/HA-0001/cover%20image.png"></figure>',
    '<audio src="media/transmissions/T-0007/song.mp3" controls></audio>',
    '<video src="https://iyakuza.github.io/landing-page/media/transmissions/T-0007/clip.mp4"></video>'
  ].join('');

  assert.deepEqual(plain(collect(html)), [
    { path: 'media/human-archive/HA-0001/cover image.png', type: 'image' },
    { path: 'media/transmissions/T-0007/song.mp3', type: 'audio' },
    { path: 'media/transmissions/T-0007/clip.mp4', type: 'video' }
  ]);
});

test('deduplicates repeated references to the same public asset', () => {
  const html = [
    '<audio src="media/transmissions/T-0007/song.mp3"></audio>',
    '<audio controls src="/landing-page/media/transmissions/T-0007/song.mp3"></audio>'
  ].join('');

  assert.deepEqual(plain(collect(html)), [
    { path: 'media/transmissions/T-0007/song.mp3', type: 'audio' }
  ]);
});

test('ignores external storage, other hosts, blob URLs and data URLs', () => {
  const html = [
    '<img src="https://example.com/media/remote.png">',
    '<video src="https://oeyxsqocldlovhsmzcjw.supabase.co/storage/object/video.mp4"></video>',
    '<audio src="blob:https://iyakuza.github.io/1234"></audio>',
    '<img src="data:image/png;base64,AAAA">'
  ].join('');

  assert.deepEqual(plain(collect(html)), []);
});

test('rejects traversal paths and does not treat unrelated links as media', () => {
  const html = [
    '<img src="/landing-page/media/../private/secret.png">',
    '<video src="/landing-page-preview/content/transmissions.json"></video>',
    '<a href="media/transmissions/T-0007/song.mp3">Download</a>'
  ].join('');

  assert.deepEqual(plain(collect(html)), []);
});

test('uses the HTML element type when a media extension is ambiguous', () => {
  const html = '<audio src="media/transmissions/T-0007/recording.mp4"></audio>';

  assert.deepEqual(plain(collect(html)), [
    { path: 'media/transmissions/T-0007/recording.mp4', type: 'audio' }
  ]);
});

test('adds block-only media to the published manifest when the file exists', () => {
  // This is the actual T-0001 pattern found in Preview: the MP3 exists in
  // media/transmissions/T-0001 but the post had an empty media_items array.
  const asset = 'media/transmissions/T-0001/46e3f478-0e5a-4c6d-9050-bd33f58d9936-Bing-Bong-I-Am-a-Spoon.mp3';
  const html = '<div class="ha-audio-block"><audio controls src="' + asset + '"></audio></div>';
  const manifest = buildManifest([], [html], new Set([asset]));

  assert.deepEqual(plain(manifest), [{
    name: '46e3f478-0e5a-4c6d-9050-bd33f58d9936-Bing-Bong-I-Am-a-Spoon.mp3',
    type: 'audio',
    mime_type: 'audio/mpeg',
    path: asset,
    src: asset,
    url: asset,
    storage: 'github-public',
    status: 'available'
  }]);
});

test('does not mark a missing legacy media file as recovered', () => {
  const missing = 'media/transmissions/T-0001/audio.mp3';
  const pending = {
    name: 'Purtata corporatriștilor - mp3.mp3',
    type: 'audio',
    src: missing,
    url: missing,
    status: 'pending_recovery'
  };
  const manifest = buildManifest([pending], ['<audio src="' + missing + '"></audio>'], new Set());

  assert.deepEqual(plain(manifest), [pending]);
});

test('promotes an existing pending reference once its file is verified', () => {
  const asset = 'media/transmissions/T-0006/featured.jpg';
  const pending = {
    name: 'featured.jpg',
    type: 'image',
    src: asset,
    url: asset,
    status: 'pending_recovery'
  };
  const manifest = buildManifest([pending], ['<img src="' + asset + '">'], new Set([asset]));

  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].status, 'available');
  assert.equal(manifest[0].storage, 'github-public');
  assert.equal(manifest[0].path, asset);
});


test('editing an existing Transmission preserves original dates and legacy metadata', () => {
  const original = {
    id: 'T-0001',
    slug: 'purtata-corporatristilor',
    title: 'Original title',
    status: 'published',
    created_at: '2024-01-02T03:04:05.000Z',
    published_at: '2024-02-03T04:05:06.000Z',
    updated_at: '2024-02-03T04:05:06.000Z',
    legacy_id: 'legacy-uuid-123',
    legacy_media_url: 'https://legacy.example/media.mp3',
    custom_legacy_field: { preserve: true },
    content_html: '<p>Old content</p>',
    media_items: [{ path: 'media/transmissions/T-0001/old.mp3' }],
    media_url: 'old.mp3',
    media_path: 'media/transmissions/T-0001/old.mp3',
    media_type: 'audio'
  };
  const draft = {
    source: 'existing',
    post_id: original.id,
    record_id: 3008,
    created_at: '2026-11-21T10:00:00.000Z',
    metadata: { slug: 'purtata-corporatristilor', title: 'Revised title', category: 'THE AWAKENING', excerpt: 'Updated', media_width: 100 },
    content: { transmission_body: '<p>Updated content</p>', media_items: [] }
  };
  const publishedAt = '2026-11-21T12:00:00.000Z';
  const result = context.window.VHACMSStore.buildPublishedPost(draft, original, publishedAt);

  assert.equal(result.created_at, original.created_at);
  assert.equal(result.published_at, original.published_at);
  assert.equal(result.updated_at, publishedAt);
  assert.equal(result.legacy_id, original.legacy_id);
  assert.equal(result.legacy_media_url, original.legacy_media_url);
  assert.deepEqual(plain(result.custom_legacy_field), original.custom_legacy_field);
  assert.equal(result.content_html, '<p>Updated content</p>');
  assert.equal(result.title, 'Revised title');
});

test('republishing an unpublished edit draft preserves its original post snapshot', () => {
  const original = {
    id: 'T-0002',
    created_at: '2023-05-06T07:08:09.000Z',
    published_at: '2023-05-07T08:09:10.000Z',
    legacy_id: 'legacy-uuid-456',
    legacy_media_url: 'https://legacy.example/cover.jpg',
    custom_field: 'keep me'
  };
  const draft = {
    source: 'existing',
    post_id: 'T-0002',
    record_id: 3006,
    original_post: original,
    metadata: { slug: 'sunt-o-culoare', title: 'Sunt o culoare', category: 'THE DESCENT', excerpt: '', media_width: 100 },
    content: { transmission_body: '<p>Restored</p>', media_items: [] }
  };
  const result = context.window.VHACMSStore.buildPublishedPost(draft, null, '2026-11-21T12:00:00.000Z');

  assert.equal(result.created_at, original.created_at);
  assert.equal(result.published_at, original.published_at);
  assert.equal(result.legacy_id, original.legacy_id);
  assert.equal(result.legacy_media_url, original.legacy_media_url);
  assert.equal(result.custom_field, 'keep me');
});

test('a new Transmission receives publication time without inheriting legacy metadata', () => {
  const draft = {
    source: 'new',
    post_id: 'T-0007',
    record_id: 3009,
    created_at: '2026-11-21T10:00:00.000Z',
    metadata: { slug: 'new-transmission', title: 'New Transmission', category: 'THE RETURN', excerpt: '', media_width: 100 },
    content: { transmission_body: '<p>New</p>', media_items: [] }
  };
  const result = context.window.VHACMSStore.buildPublishedPost(draft, null, '2026-11-21T12:00:00.000Z');

  assert.equal(result.created_at, draft.created_at);
  assert.equal(result.published_at, '2026-11-21T12:00:00.000Z');
  assert.equal(result.legacy_id, undefined);
});

test('editing an existing Transmission preserves Human Archive structure metadata', () => {
  const original = {
    record_id: 3008,
    public_record_id: 'HA-3008',
    legacy_structure_id: 'structure-uuid-1',
    created_by: 'legacy-owner',
    transmission_body: '<p>Original</p>',
    prompt_style: 'Original prompt',
    lyrics_style: 'Original lyrics',
    output_text: 'Original output',
    output_media: { image: [], audio: [], video: [] },
    blocks: [{ id: 'old-block', type: 'paragraph', html: '<p>Original</p>' }],
    updated_at: '2024-01-01T00:00:00.000Z'
  };
  const draft = {
    source: 'existing',
    record_id: 3008,
    original_structure: context.window.VHACMSStore.snapshotStructureMetadata(original),
    content: {
      transmission_body: '<p>Revised</p>',
      prompt_style: 'Revised prompt',
      lyrics_style: 'Revised lyrics',
      output_text: 'Revised output',
      output_media: { image: [], audio: [], video: [] },
      blocks: [{ id: 'new-block', type: 'paragraph', html: '<p>Revised</p>' }]
    }
  };
  const result = context.window.VHACMSStore.buildPublishedStructure(draft, original, '2026-11-21T12:00:00.000Z');

  assert.equal(result.public_record_id, 'HA-3008');
  assert.equal(result.legacy_structure_id, 'structure-uuid-1');
  assert.equal(result.created_by, 'legacy-owner');
  assert.equal(result.transmission_body, '<p>Revised</p>');
  assert.equal(result.updated_at, '2026-11-21T12:00:00.000Z');
});

test('republishing an unpublished edit restores structure metadata snapshot', () => {
  const draft = {
    source: 'existing',
    record_id: 3008,
    original_structure: { record_id: 3008, public_record_id: 'HA-3008', legacy_structure_id: 'structure-uuid-1' },
    content: { transmission_body: '<p>Restored</p>', blocks: [], output_media: { image: [], audio: [], video: [] } }
  };
  const result = context.window.VHACMSStore.buildPublishedStructure(draft, null, '2026-11-21T12:00:00.000Z');
  assert.equal(result.public_record_id, 'HA-3008');
  assert.equal(result.legacy_structure_id, 'structure-uuid-1');
});


test('recognizes only private draft blob URLs mapped to a stored draft path', () => {
  const helperStart = archiveSource.indexOf('function isPrivateDraftBlobUrl(raw){');
  const helperEnd = archiveSource.indexOf('function markUsed', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, 'archive renderer must define its private draft blob guard');
  const helper = archiveSource.slice(helperStart, helperEnd).trim();

  const mapped = 'blob:https://iyakuza.github.io/landing-page-preview/allowed-upload';
  const unmapped = 'blob:https://iyakuza.github.io/landing-page-preview/not-in-private-store';
  const helperContext = vm.createContext({ privateMediaUrlToPath: new Set([mapped]) });
  vm.runInContext(helper + '; this.isPrivateDraftBlobUrl = isPrivateDraftBlobUrl;', helperContext);

  assert.equal(helperContext.isPrivateDraftBlobUrl(mapped), true);
  assert.equal(helperContext.isPrivateDraftBlobUrl(unmapped), false);
  assert.equal(helperContext.isPrivateDraftBlobUrl('https://example.com/audio.mp3'), false);
  assert.equal(helperContext.isPrivateDraftBlobUrl('media/transmissions/T-0010/audio.mp3'), false);
});

test('audio, video and source elements accept mapped private draft blobs', () => {
  const audioStart = archiveSource.indexOf("if(tag==='AUDIO'||tag==='VIDEO'){");
  const sourceStart = archiveSource.indexOf("if(tag==='SOURCE'){", audioStart);
  const iframeStart = archiveSource.indexOf("if(tag==='IFRAME'){", sourceStart);
  assert.ok(audioStart >= 0 && sourceStart > audioStart && iframeStart > sourceStart);

  const mediaBranch = archiveSource.slice(audioStart, sourceStart);
  const sourceBranch = archiveSource.slice(sourceStart, iframeStart);
  assert.ok(mediaBranch.includes('const privateDraftBlob=isPrivateDraftBlobUrl(raw);'));
  assert.ok(mediaBranch.includes('privateDraftBlob||'));
  assert.ok(sourceBranch.includes('const privateDraftBlob=isPrivateDraftBlobUrl(raw);'));
  assert.ok(sourceBranch.includes('source.src=privateDraftBlob?raw:localMediaUrl(item)'));
});

test('creates a new Transmission in one atomic sequence-and-draft commit', async () => {
  const calls = [];
  const privateHead = 'private-head-before';
  const mockGitHub = {
    getBranchHead: async key => {
      calls.push({ operation: 'head', key });
      return key === 'private' ? privateHead : 'public-head';
    },
    readJson: async (key, filePath, options) => {
      calls.push({ operation: 'read-json', key, path: filePath, atCommit: options?.atCommit });
      return { data: { transmission_number: 9, archive_record_id: 3012 } };
    },
    commitFiles: async (key, changes, options) => {
      calls.push({ operation: 'commit', key, changes, options });
      return { commitSha: 'private-head-after' };
    },
    initializePrivateRepository: async () => privateHead
  };
  const apiWindow = { VHAGitHub: mockGitHub };
  const apiContext = vm.createContext({
    window: apiWindow,
    URL,
    crypto: { randomUUID: () => 'test-draft-id' }
  });
  vm.runInContext(source, apiContext);

  const draft = await apiWindow.VHACMSStore.createDraft({
    title: 'New Transmission',
    category: 'THE TRANSFORMATION'
  }, 'new');

  assert.equal(draft.record_id, 3013);
  assert.equal(draft.post_id, 'T-0010');
  assert.equal(draft.revision, 2);
  assert.equal(draft.base_public_commit, null);
  assert.equal(draft._repoCommitSha, 'private-head-after');

  const commits = calls.filter(call => call.operation === 'commit');
  assert.equal(commits.length, 1);
  assert.equal(commits[0].key, 'private');
  assert.equal(commits[0].options.expectedHeadSha, privateHead);
  assert.equal(commits[0].changes.length, 2);

  const sequenceChange = commits[0].changes.find(change => change.path.endsWith('/sequences.json'));
  const draftChange = commits[0].changes.find(change => change.path.endsWith('/test-draft-id.json'));
  assert.ok(sequenceChange);
  assert.ok(draftChange);
  assert.deepEqual(JSON.parse(sequenceChange.content), {
    transmission_number: 10,
    archive_record_id: 3013,
    updated_at: JSON.parse(sequenceChange.content).updated_at
  });
  assert.equal(JSON.parse(draftChange.content).post_id, 'T-0010');
  assert.equal(JSON.parse(draftChange.content).record_id, 3013);
  assert.equal(JSON.parse(draftChange.content).revision, 2);
  assert.equal(calls.some(call => call.operation === 'head' && call.key === 'public'), false);
});
