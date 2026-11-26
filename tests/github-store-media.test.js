'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'cms', 'github-store.js'), 'utf8');
const archiveSource = fs.readFileSync(path.join(__dirname, '..', 'human-archive', 'archive.js'), 'utf8');
const blockEditorSource = fs.readFileSync(path.join(__dirname, '..', 'editor-ui', 'block-editor.js'), 'utf8');
const blockEditorCssSource = fs.readFileSync(path.join(__dirname, '..', 'editor-ui', 'block-editor.css'), 'utf8');
const archiveHtml = fs.readFileSync(path.join(__dirname, '..', 'human-archive', 'index.html'), 'utf8');
const archiveCssSource = fs.readFileSync(path.join(__dirname, '..', 'human-archive', 'archive.css'), 'utf8');
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
    '<video src="https://legacy-media.example/storage/object/video.mp4"></video>',
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

test('recognizes unchanged publications despite site-prefix normalization and generated manifest IDs', () => {
  const asset = 'media/transmissions/T-0001/song.mp3';
  const originalPost = {
    id: 'T-0001', slug: 'song', title: 'Song', status: 'published',
    excerpt: '', category: 'THE TRANSFORMATION', media_width: 100,
    created_at: '2026-11-20T10:00:00.000Z', published_at: '2026-11-20T10:00:00.000Z',
    updated_at: '2026-11-20T11:00:00.000Z',
    content_html: '<audio src="' + asset + '" controls></audio>',
    media_items: [{ name: 'song.mp3', type: 'audio', mime_type: 'audio/mpeg', path: asset, src: asset, url: asset, storage: 'github-public', status: 'available' }]
  };
  const nextPost = {
    ...originalPost,
    updated_at: '2026-11-21T12:00:00.000Z',
    content_html: '<audio src="/landing-page-preview/' + asset + '" controls></audio>',
    media_url: '/landing-page-preview/' + asset,
    media_path: '/landing-page-preview/' + asset,
    media_type: 'audio',
    media_items: [{ id: 'generated-media-id', name: 'song.mp3', type: 'audio', mime_type: 'audio/mpeg', path: '/landing-page-preview/' + asset, src: '/landing-page-preview/' + asset, url: '/landing-page-preview/' + asset, storage: 'github-public', status: 'available' }]
  };
  originalPost.media_url = asset;
  originalPost.media_path = asset;
  originalPost.media_type = 'audio';
  const originalStructure = {
    record_id: 3008, transmission_body: '<audio src="' + asset + '" controls></audio>',
    blocks: [{ id: 'block-001', type: 'audio', html: '<audio src="' + asset + '" controls></audio>' }],
    output_media: { image: [], audio: [], video: [] }, updated_at: '2026-11-20T11:00:00.000Z'
  };
  const nextStructure = {
    ...originalStructure, updated_at: '2026-11-21T12:00:00.000Z',
    transmission_body: '<audio src="/landing-page-preview/' + asset + '" controls></audio>',
    blocks: [{ id: 'block-001', type: 'audio', html: '<audio src="/landing-page-preview/' + asset + '" controls></audio>' }]
  };

  assert.equal(context.window.VHACMSStore.isPublicationUnchanged(nextPost, originalPost, nextStructure, originalStructure), true);
  assert.equal(context.window.VHACMSStore.isPublicationUnchanged({ ...nextPost, title: 'Changed title' }, originalPost, nextStructure, originalStructure), false);
  assert.equal(context.window.VHACMSStore.isPublicationUnchanged({ ...nextPost, content_html: '<audio src="media/transmissions/T-0001/other.mp3"></audio>' }, originalPost, nextStructure, originalStructure), false);
});


test('published Transmission media replaces the live archive attachment index without disturbing other records', () => {
  const start = archiveSource.indexOf('function syncPublishedTransmissionMedia(record,post,makePublicUrl){');
  const end = archiveSource.indexOf('async function loadTransmissionRecords(){', start);
  assert.ok(start >= 0 && end > start, 'publish flow must expose a focused media-index reconciliation helper');
  const helper = archiveSource.slice(start, end).trim();
  const oldAttachment = {
    id: 'transmission-T-0001-0', storage: 'github-transmission', post_ids: [3008],
    url: '/landing-page-preview/media/transmissions/T-0001/removed.mp3',
    source_url: 'https://iyakuza.github.io/landing-page-preview/media/transmissions/T-0001/removed.mp3'
  };
  const otherRecordAttachment = {
    id: 'transmission-T-0002-0', storage: 'github-transmission', post_ids: [3009],
    url: '/landing-page-preview/media/transmissions/T-0002/keep.mp3'
  };
  const baseArchiveMedia = { id: 'archive-3008', storage: 'github-public', post_ids: [3008], url: '/landing-page-preview/media/human-archive/HA-3008/keep.png' };
  const mediaItems = [oldAttachment, otherRecordAttachment, baseArchiveMedia];
  const mediaMap = new Map([
    ['/removed.mp3', oldAttachment],
    ['/keep.mp3', otherRecordAttachment]
  ]);
  const mediaByPost = new Map([[3008, [oldAttachment, baseArchiveMedia]], [3009, [otherRecordAttachment]]]);
  const sandbox = vm.createContext({
    initialMediaItems: mediaItems, mediaMap, mediaByPost,
    archiveMediaMimeType: item => item.mime_type || 'audio/mpeg',
    urlKey: raw => { try { return new URL(String(raw || ''), 'https://iyakuza.github.io').pathname; } catch { return ''; } }
  });
  vm.runInContext('let mediaItems = initialMediaItems; ' + helper + '; this.syncPublishedTransmissionMedia = syncPublishedTransmissionMedia; this.getMediaItems = () => mediaItems;', sandbox);

  const record = { id: 3008, media_items: [] };
  const bodyAsset = 'media/transmissions/T-0001/body-audio.mp3';
  const post = {
    id: 'T-0001', title: 'Updated Transmission',
    content_html: '<audio src="' + bodyAsset + '" controls></audio>',
    media_items: [{ name: 'body-audio.mp3', type: 'audio', mime_type: 'audio/mpeg', path: bodyAsset, src: bodyAsset, url: bodyAsset, status: 'available' }]
  };
  sandbox.syncPublishedTransmissionMedia(record, post, value => '/landing-page-preview/' + String(value).replace(/^\/+/, ''));

  assert.equal(sandbox.getMediaItems().some(item => item.url === oldAttachment.url), false, 'removed attachment URL must disappear immediately even when the replacement reuses its manifest index');
  assert.equal(sandbox.getMediaItems().includes(otherRecordAttachment), true, 'another Transmission attachment must remain untouched');
  assert.equal(sandbox.getMediaItems().includes(baseArchiveMedia), true, 'non-Transmission archive media for this record must remain untouched');
  assert.equal(sandbox.getMediaItems().some(item => item.path === bodyAsset), true, 'media still referenced by the published body must remain indexed');
  assert.equal(sandbox.mediaMap.has('/removed.mp3'), false, 'removed media URL aliases must be cleared');
  assert.equal(sandbox.mediaMap.has('/keep.mp3'), true, 'other-record URL aliases must remain');
  assert.equal(sandbox.mediaMap.has('/landing-page-preview/' + bodyAsset), true, 'newly published body media must be indexed');
  assert.deepEqual(Array.from(sandbox.mediaByPost.get(3009), item => item.id), [otherRecordAttachment.id]);
  assert.equal(record.media_items.length, 1);
  assert.equal(record.media_items[0].storage, 'github-public');
  assert.match(post.content_html, /body-audio\.mp3/, 'publication must not rewrite or discard body media');
});

test('Transmission editor exposes explicit removal for loose attachment manifest entries', () => {
  assert.match(archiveSource, /01 \/\/ ATTACHED MEDIA/);
  assert.match(archiveSource, /const renderAttachedPostMedia/);
  assert.match(archiveSource, /attachedPostMedia=attachedPostMedia\.filter/);
  assert.match(archiveSource, /scheduleDraftAutosave\(\)/);
  assert.match(archiveSource, /media still used in the body will remain published/);
});

test('Human Archive sanitizes stored HTML before parsing it into DOM nodes', () => {
  assert.match(archiveSource, /function parseSanitizedHTML\(source\)/);
  assert.match(archiveSource, /purifier\.sanitize\(String\(source\?\?''\)/);
  assert.match(archiveSource, /RETURN_DOM_FRAGMENT:true/);
  assert.match(archiveSource, /ADD_TAGS:\['iframe'\]/);
  assert.match(archiveSource, /Human Archive HTML sanitizer is unavailable; refusing to render untrusted markup/);
  assert.equal((archiveSource.match(/new DOMParser\(\)\.parseFromString/g) || []).length, 1);
  assert.match(archiveHtml, /vendor\/dompurify-3\.4\.18\.min\.js\?v=3\.4\.18/);
  assert.match(archiveHtml, /dompurify-3\.4\.18\.min\.js[\s\S]*archive\.js/);
});

test('Transmissions uses the shared DOMPurify sanitizer before parsing stored post HTML', () => {
  const postsHtml = fs.readFileSync(path.join(__dirname, '..', 'transmissions', 'index.html'), 'utf8');
  const postsSource = fs.readFileSync(path.join(__dirname, '..', 'transmissions', 'posts.js'), 'utf8');
  assert.ok(postsSource.includes("purifier.sanitize(String(html||''),{"));
  assert.ok(postsSource.includes("const cleanSection=html=>cleanHtml(String(html||''),attachedMediaUrls(post));"));
  assert.match(postsSource, /ALLOWED_TAGS:/);
  assert.match(postsSource, /ALLOWED_ATTR:\['href','src','alt','class'\]/);
  assert.match(postsHtml, /shared\/vendor\/dompurify-3\.4\.18\.min\.js[\s\S]*posts\.js/);
});

test('homepage and CV share one Google Apps Script contact form without exposing the recipient or using unsafe browser requests', () => {
  const contactSource = fs.readFileSync(path.join(__dirname, '..', 'shared', 'contact', 'contact.js'), 'utf8');
  const homeHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const contactHtml = fs.readFileSync(path.join(__dirname, '..', 'cv', 'index.html'), 'utf8');
  const homeSource = fs.readFileSync(path.join(__dirname, '..', 'home.js'), 'utf8');
  const navigationSource = fs.readFileSync(path.join(__dirname, '..', 'cv', 'navigation.js'), 'utf8');
  const signalsSource = fs.readFileSync(path.join(__dirname, '..', 'transmissions', 'posts.js'), 'utf8');

  assert.doesNotMatch(contactSource, /mailto:|fetch\s*\(|XMLHttpRequest/,
    'the static contact component must not open a mail client or post to an untrusted endpoint');
  assert.equal(contactSource.includes("emanuel.stefancu@gmail.com"), false,
    'the destination address must not be embedded in a browser-only sender');
  assert.ok(contactSource.includes('endpointUrl: "https://script.google.com/macros/s/'),
    'the contact form must use the deployed Google Apps Script endpoint');
  assert.ok(contactSource.includes('submitButton.disabled = !endpointReady || !uploadFrameReady'),
    'the submit action must be gated by strict endpoint URL validation');
  assert.match(contactSource, /No information is sent or stored/,
    'the visitor must be told that messages are not published or stored by the website');
  assert.match(contactSource, /uploadFrame\.id = "cv-contact-upload-frame"/,
    'the form must use the isolated Google response frame');

  assert.ok(homeHtml.includes('/landing-page/shared/contact/contact.js?v=20261123-contact-nested-iframe-1'));
  assert.ok(contactHtml.includes('/landing-page/shared/contact/contact.js?v=20261123-contact-nested-iframe-1'));
  assert.ok(homeHtml.includes('data-contact-context="website"'));
  assert.ok(contactHtml.includes('data-contact-context="career"'));
  assert.ok(homeSource.includes("new CustomEvent('vha-contact-open',{detail:{context:'subscription'}})"),
    'the homepage subscription flow must use the shared dialog event');
  assert.doesNotMatch(homeHtml + contactHtml, /id="cv-contact-dialog"|CONTACT FORM TEMPORARILY DISCONNECTED/,
    'page-local disabled contact dialogs must not return');

  assert.ok(contactHtml.includes('id="cv-floating-nav"'));
  assert.ok(navigationSource.includes('cv-floating-nav'),
    'the CV floating navigation must remain functional outside the contact component');

  assert.ok(signalsSource.includes('COMMUNITY SUBMISSIONS ARE CURRENTLY PAUSED'));
  assert.ok(signalsSource.includes('submissionButton.disabled=true'));
  assert.ok(signalsSource.includes("submissionForm.querySelectorAll('input,textarea,select').forEach(control=>{control.disabled=true;});"));
});

test('pending legacy Transmission media is suppressed instead of using its stale fallback URL', () => {
  const postsSource = fs.readFileSync(path.join(__dirname, '..', 'transmissions', 'posts.js'), 'utf8');
  const helperStart = postsSource.indexOf('function normalizePublicTransmissionMedia(item) {');
  const helperEnd = postsSource.indexOf('function renderPostMedia(post)', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, 'the public media normalizer must exist');

  const sandbox = vm.createContext({});
  vm.runInContext(postsSource.slice(helperStart, helperEnd) + '; this.normalize = normalizePublicTransmissionMedia;', sandbox);

  const pending = plain(sandbox.normalize({
    media_url: 'media/transmissions/T-0002/featured.jpeg',
    media_path: 'media/transmissions/T-0002/featured.jpeg',
    media_items: [{ type: 'image', src: 'media/transmissions/T-0002/featured.jpeg', status: 'pending_recovery' }]
  }));
  assert.equal(pending.media_url, '');
  assert.equal(pending.media_path, '');
  assert.deepEqual(pending.media_items, []);

  const available = plain(sandbox.normalize({
    media_url: 'legacy-stale-url',
    media_items: [{ type: 'video', src: 'media/transmissions/T-0001/video.mp4', path: 'media/transmissions/T-0001/video.mp4', status: 'available' }]
  }));
  assert.equal(available.media_url, 'media/transmissions/T-0001/video.mp4');
  assert.equal(available.media_path, 'media/transmissions/T-0001/video.mp4');
  assert.equal(available.media_items.length, 1);

  const legacyWithoutManifest = plain(sandbox.normalize({ media_url: 'media/transmissions/legacy/audio.mp3' }));
  assert.equal(legacyWithoutManifest.media_url, 'media/transmissions/legacy/audio.mp3',
    'records with no media_items array retain their legacy fallback');
});

test('Transmission reflection labels are escaped and embed providers use exact hostnames', () => {
  const postsSource = fs.readFileSync(path.join(__dirname, '..', 'transmissions', 'posts.js'), 'utf8');
  assert.match(postsSource, /const title=label\?\.textContent\?\.trim\(\)\|\|fallback/);
  assert.match(postsSource, /safe\(String\(label\|\|'SECTION'\)\)/);
  assert.match(blockEditorSource, /new URL\(src, window\.location\.href\)\.hostname\.toLowerCase\(\)/);
  assert.match(blockEditorSource, /host === 'open\.spotify\.com'/);
  assert.match(blockEditorSource, /\['soundcloud\.com','www\.soundcloud\.com','w\.soundcloud\.com'\]\.includes\(host\)/);
  assert.match(blockEditorSource, /\['youtube\.com','www\.youtube\.com','youtube-nocookie\.com','www\.youtube-nocookie\.com','youtu\.be'\]\.includes\(host\)/);
  assert.doesNotMatch(blockEditorSource, /if \(\/spotify\\\\\.com\/i\.test\(src\)\)/);
  assert.doesNotMatch(blockEditorSource, /if \(\/soundcloud\\\\\.com\/i\.test\(src\)\)/);
  assert.doesNotMatch(blockEditorSource, /if \(\/youtube\(\?-nocookie\)\?\\\\\.com\|youtu\\\\\.be\/i\.test\(src\)\)/);
});

test('newly promoted media is verified at its public URL before the normal published status', () => {
  assert.match(archiveSource, /async function waitForPublishedMedia/);
  assert.match(archiveSource, /method:'HEAD',cache:'no-store'/);
  assert.match(archiveSource, /WAITING FOR NEW MEDIA TO DEPLOY/);
  assert.match(archiveSource, /NEW MEDIA IS STILL DEPLOYING/);
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
  assert.ok(mediaBranch.includes('const privateDraftUrl=resolvePrivateDraftMediaUrl(raw);'));
  assert.ok(mediaBranch.includes('Boolean(privateDraftUrl)'),
    'audio/video elements must accept a repository path only when it maps to this editor session');
  assert.ok(sourceBranch.includes('const privateDraftUrl=resolvePrivateDraftMediaUrl(raw);'));
  assert.ok(sourceBranch.includes('source.src=privateDraftUrl||localMediaUrl(item)'),
    'source elements must use the verified session Blob URL');
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


test('Human Archive CSP permits private draft image and media Blob URLs', () => {
  const meta = archiveHtml.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i)?.[0] || '';
  const attribute = 'content="';
  const contentStart = meta.indexOf(attribute);
  const contentEnd = contentStart < 0 ? -1 : meta.indexOf('"', contentStart + attribute.length);
  const policy = contentStart < 0 || contentEnd < 0 ? '' : meta.slice(contentStart + attribute.length, contentEnd);
  assert.ok(policy, 'Human Archive must define its content security policy');
  const directives = new Map(policy.split(';').map(item => item.trim()).filter(Boolean).map(item => {
    const space = item.indexOf(' ');
    return [item.slice(0, space), item.slice(space + 1)];
  }));
  assert.match(directives.get('img-src') || '', /blob:/, 'img-src must allow mapped private image Blob URLs');
  assert.match(directives.get('media-src') || '', /blob:/, 'media-src must allow mapped private audio/video Blob URLs');
});


test('direct archive record URLs hydrate only matching private draft media', () => {
  const start = archiveSource.indexOf('function shouldHydratePrivateDraftMedia(draft){');
  const end = archiveSource.indexOf('async function loadTransmissionRecords(){', start);
  assert.ok(start >= 0 && end > start, 'archive route-aware private-media selector must exist');
  const helper = archiveSource.slice(start, end);
  const makeContext = search => {
    const sandbox = vm.createContext({ URLSearchParams, window: { location: { search } } });
    vm.runInContext(helper + '; this.shouldHydratePrivateDraftMedia = shouldHydratePrivateDraftMedia;', sandbox);
    return sandbox.shouldHydratePrivateDraftMedia;
  };
  const publicRecord = { record_id: 3008, metadata: { slug: 'purtata-corporatristilor' } };
  const privateRecord = { record_id: 3012, metadata: { slug: 'test' } };

  assert.equal(makeContext('?record=3008')(privateRecord), false);
  assert.equal(makeContext('?record=3008')(publicRecord), true);
  assert.equal(makeContext('?record=3012')(privateRecord), true);
  assert.equal(makeContext('?slug=purtata-corporatristilor')(publicRecord), true);
  assert.equal(makeContext('')(privateRecord), false, 'the archive index must not hydrate private draft media');
});

test('private draft media reads reuse the supplied commit and run concurrently', async () => {
  const paths = [
    'cms-data/v1/media/drafts/test-draft/blocks-image/cover.jpg',
    'cms-data/v1/media/drafts/test-draft/blocks-audio/song.mp3'
  ];
  let branchHeadReads = 0;
  let activeReads = 0;
  let maxConcurrentReads = 0;
  let readCommit;
  const mockGithub = {
    getBranchHead: async () => {
      branchHeadReads += 1;
      return 'unexpected-head';
    },
    listFiles: async (_repo, _prefix, options) => {
      readCommit = options.atCommit;
      return paths.map(path => ({ path }));
    },
    readFile: async (_repo, path, options) => {
      assert.equal(options.atCommit, 'pinned-private-head');
      activeReads += 1;
      maxConcurrentReads = Math.max(maxConcurrentReads, activeReads);
      await new Promise(resolve => setTimeout(resolve, 5));
      activeReads -= 1;
      return { path, bytes: new Uint8Array([1, 2, 3]) };
    }
  };
  let objectUrlId = 0;
  const mockURL = { createObjectURL: () => 'blob:private-test-' + (++objectUrlId) };
  const sandbox = vm.createContext({
    window: { VHAGitHub: mockGithub },
    URL: mockURL,
    Blob,
    crypto: { randomUUID: () => 'unused' }
  });
  vm.runInContext(source, sandbox);

  const assets = await sandbox.window.VHACMSStore.getDraftMediaFiles('test-draft', 'pinned-private-head');
  assert.equal(branchHeadReads, 0, 'the caller-provided commit should avoid another branch-head request');
  assert.equal(readCommit, 'pinned-private-head');
  assert.equal(assets.length, 2);
  assert.equal(maxConcurrentReads, 2, 'independent private media blobs should be read concurrently');
  assert.deepEqual(Array.from(assets, asset => asset.mime_type).sort(), ['audio/mpeg', 'image/jpeg']);
});


test('Human Archive record cards defer body and attachment creation until expanded', () => {
  const entryStart = archiveSource.indexOf('function makeEntry(record,index){');
  const renderStart = archiveSource.indexOf('function render(){', entryStart);
  assert.ok(entryStart >= 0 && renderStart > entryStart, 'record card renderer must exist');
  const entry = archiveSource.slice(entryStart, renderStart);
  assert.doesNotMatch(entry, /appendSafeContent\(/, 'initial card creation must not parse or attach media sources');
  assert.doesNotMatch(entry, /makeAttachmentGallery\(/, 'initial card creation must not build attachment media nodes');
  assert.match(entry, /await hydrateArchiveCardContent\(record,content\)/, 'opening a card must trigger its one-time content hydration');
  const relatedStart = archiveSource.indexOf('function openRelatedRecord(record){');
  const relatedEnd = archiveSource.indexOf('function makeRelatedRecordButton', relatedStart);
  const related = archiveSource.slice(relatedStart, relatedEnd);
  assert.ok(related.includes('control.click();'), 'related records must use the same lazy card-open path');

  const hydratorStart = archiveSource.indexOf('async function hydrateArchiveCardContent(record,content){');
  const hydratorEnd = archiveSource.indexOf('async function loadTransmissionRecords(){', hydratorStart);
  assert.ok(hydratorStart >= 0 && hydratorEnd > hydratorStart, 'deferred card hydrator must exist');
  const hydrator = archiveSource.slice(hydratorStart, hydratorEnd);
  assert.match(hydrator, /await hydratePrivateDraftMediaForRecord\(record\)/, 'only the opened private draft may hydrate its assets');
  assert.match(hydrator, /appendSafeContent\(/, 'record HTML should be parsed after opening');
  assert.match(hydrator, /makeAttachmentGallery\(/, 'record attachments should be created after opening');
});

test('private draft media is not fetched while building the general archive index', () => {
  const loaderStart = archiveSource.indexOf('function shouldHydratePrivateDraftMedia(draft){');
  const loaderEnd = archiveSource.indexOf('async function ensureStandaloneTransmissionRecords(){', loaderStart);
  assert.ok(loaderStart >= 0 && loaderEnd > loaderStart, 'lazy private draft loader must exist');
  const loader = archiveSource.slice(loaderStart, loaderEnd);
  assert.match(loader, /if\(!requestedRecordId&&!requestedSlug\)return false;/, 'the archive index must not fetch all private draft blobs');
  assert.match(loader, /if\(shouldHydratePrivateDraftMedia\(draft\)\)await hydratePrivateDraftMediaForRecord\(record\)/, 'direct record URLs may hydrate their matching draft only');
});


test('Human Archive media elements keep browser preloading disabled', () => {
  const image = archiveSource.slice(archiveSource.indexOf('function appendLocalImage'), archiveSource.indexOf('function appendLocalAudio'));
  const audio = archiveSource.slice(archiveSource.indexOf('function appendLocalAudio'), archiveSource.indexOf('function appendLocalVideo'));
  const video = archiveSource.slice(archiveSource.indexOf('function appendLocalVideo'), archiveSource.indexOf('function appendMediaLink'));
  assert.ok(image.includes("img.loading='lazy'"), 'images should be lazy-loaded after their card opens');
  assert.ok(audio.includes("audio.preload='none'"), 'audio should not preload before playback');
  assert.ok(video.includes("video.preload='none'"), 'video should not preload before playback');
});


test('standalone Transmission opens hydrate only the selected private draft', () => {
  const start = archiveSource.indexOf("window.addEventListener('VHA_OPEN_EXISTING_TRANSMISSION'");
  const end = archiveSource.indexOf("if(hasArchiveIndex){", start);
  assert.ok(start >= 0 && end > start, 'standalone Transmission event handler must exist');
  const handler = archiveSource.slice(start, end);
  assert.ok(handler.includes('await hydratePrivateDraftMediaForRecord(record);'), 'opening one Transmission must hydrate only that record before rendering');
});



test('Transmission chamber HTML resolves attachment aliases to verified public Transmission paths', () => {
  const start = archiveSource.indexOf('function rewriteTransmissionMediaReferences(');
  const end = archiveSource.indexOf('function getRecordStructure(record){', start);
  assert.ok(start >= 0 && end > start, 'Transmission media-reference normalizer must exist');
  const helper = archiveSource.slice(start, end).trim();
  const sandbox = vm.createContext({
    URL,
    archiveSiteBasePath: '/landing-page-preview',
    window: { location: { origin: 'https://iyakuza.github.io', href: 'https://iyakuza.github.io/landing-page-preview/human-archive/' } }
  });
  vm.runInContext(helper + '; this.rewriteTransmissionMediaReferences = rewriteTransmissionMediaReferences;', sandbox);
  const items = [
    { path: 'media/transmissions/T-0001/video-asset.mp4', url: 'https://iyakuza.github.io/landing-page-preview/media/transmissions/T-0001/video-asset.mp4', type: 'video', status: 'available' },
    { path: 'media/transmissions/T-0001/lyrics-asset.png', url: 'https://iyakuza.github.io/landing-page-preview/media/transmissions/T-0001/lyrics-asset.png', type: 'image', status: 'available' }
  ];
  const html = [
    '<video src="https://iyakuza.github.io/landing-page-preview/media/human-archive/HA-3008/video-asset.mp4"></video>',
    '<img src="/landing-page-preview/media/human-archive/HA-3008/lyrics-asset.png">',
    '<source src="https://legacy.example/video-asset.mp4">'
  ].join('');
  const result = sandbox.rewriteTransmissionMediaReferences(html, 'T-0001', items);
  assert.match(result, /src="\/landing-page-preview\/media\/transmissions\/T-0001\/video-asset\.mp4"/);
  assert.match(result, /src="\/landing-page-preview\/media\/transmissions\/T-0001\/lyrics-asset\.png"/);
  assert.doesNotMatch(result, /media\/human-archive\/HA-3008/);
  assert.match(result, /src="https:\/\/legacy\.example\/video-asset\.mp4"/,
    'unknown references must remain untouched rather than be guessed');
});

test('Transmission chamber media normalizer refuses pending-recovery and cross-Transmission files', () => {
  const start = archiveSource.indexOf('function rewriteTransmissionMediaReferences(');
  const end = archiveSource.indexOf('function getRecordStructure(record){', start);
  const helper = archiveSource.slice(start, end).trim();
  const sandbox = vm.createContext({
    URL,
    archiveSiteBasePath: '/landing-page-preview',
    window: { location: { origin: 'https://iyakuza.github.io', href: 'https://iyakuza.github.io/landing-page-preview/human-archive/' } }
  });
  vm.runInContext(helper + '; this.rewriteTransmissionMediaReferences = rewriteTransmissionMediaReferences;', sandbox);
  const html = '<img src="https://legacy.example/featured.jpg"><video src="https://legacy.example/clip.mp4"></video>';
  const items = [
    { path: 'media/transmissions/T-0006/featured.jpg', status: 'pending_recovery' },
    { path: 'media/transmissions/T-0002/clip.mp4', status: 'available' }
  ];
  assert.equal(sandbox.rewriteTransmissionMediaReferences(html, 'T-0001', items), html);
});


test('published Transmissions disable private draft autosave before the Chamber closes', () => {
  const start = archiveSource.indexOf('function shouldRunTransmissionDraftAutosave(');
  const end = archiveSource.indexOf('function chamberUploadToken(', start);
  assert.ok(start >= 0 && end > start, 'draft autosave lifecycle guard must exist');
  const helper = archiveSource.slice(start, end).trim();
  const sandbox = vm.createContext({});
  vm.runInContext(helper + '; this.shouldRunTransmissionDraftAutosave = shouldRunTransmissionDraftAutosave;', sandbox);
  const canAutosave = sandbox.shouldRunTransmissionDraftAutosave;

  assert.equal(canAutosave({ source_type: 'transmission', draft_id: 'preview-draft-123' }, true, false), true);
  assert.equal(canAutosave({ source_type: 'transmission', draft_id: null }, true, false), false,
    'publication removes the private draft ID while the editor instance may still be mounted');
  assert.equal(canAutosave({ source_type: 'transmission', draft_id: 'preview-draft-123' }, true, true), false);
  assert.equal(canAutosave({ source_type: 'transmission', draft_id: 'preview-draft-123' }, false, false), false);
});

test('Transmission private autosave flush and scheduling both re-check the live draft ID', () => {
  const runStart = archiveSource.indexOf('const runDraftAutosave=async()=>{');
  const scheduleStart = archiveSource.indexOf('const scheduleDraftAutosave=', runStart);
  const flushStart = archiveSource.indexOf('const flushDraftAutosave=async()=>{', scheduleStart);
  const flushEnd = archiveSource.indexOf('if(draftAutosaveEnabled)flushActiveChamberAutosave', flushStart);
  assert.ok(runStart >= 0 && scheduleStart > runStart && flushStart > scheduleStart && flushEnd > flushStart);
  const run = archiveSource.slice(runStart, scheduleStart);
  const schedule = archiveSource.slice(scheduleStart, flushStart);
  const flush = archiveSource.slice(flushStart, flushEnd);
  assert.ok(run.includes('shouldRunTransmissionDraftAutosave(record,draftAutosaveEnabled,draftAutosaveStopped)'));
  assert.ok(schedule.includes('shouldRunTransmissionDraftAutosave(record,draftAutosaveEnabled,draftAutosaveStopped)'));
  assert.ok(flush.includes('shouldRunTransmissionDraftAutosave(record,draftAutosaveEnabled,draftAutosaveStopped)'));
  assert.match(archiveSource, /draftAutosaveStopped=true;draftAutosaveQueued=false;/,
    'successful publication must stop the private draft autosave lifecycle');
});

test('legacy and incomplete MIME values are inferred from the original media filename', () => {
  const start = archiveSource.indexOf('function archiveMediaMimeType(');
  const end = archiveSource.indexOf('function appendMissing(', start);
  assert.ok(start >= 0 && end > start, 'archive MIME resolver must exist');
  const helper = archiveSource.slice(start, end).trim();
  const sandbox = vm.createContext({});
  vm.runInContext(helper + '; this.archiveMediaMimeType = archiveMediaMimeType;', sandbox);
  const infer = sandbox.archiveMediaMimeType;

  assert.equal(infer({ mime_type: 'video/unknown', path: 'media/transmissions/T-0001/video.mp4' }, 'video'), 'video/mp4');
  assert.equal(infer({ mime_type: 'image/unknown', name: 'lyrics.png' }, 'image'), 'image/png');
  assert.equal(infer({ mime_type: 'audio/unknown', source_url: 'https://legacy.example/audio.mp3' }, 'audio'), 'audio/mpeg');
  assert.equal(infer({ mime_type: 'image/webp', name: 'cover.jpg' }, 'image'), 'image/webp');
});

test('the current-record media library exposes only verified local media', () => {
  const start = archiveSource.indexOf('const getBlockMediaLibrary=type=>{');
  const end = archiveSource.indexOf('const cleanupBlockMediaUploads=', start);
  assert.ok(start >= 0 && end > start, 'current-record media library builder must exist');
  const library = archiveSource.slice(start, end);
  assert.ok(library.includes('getRecordOutputMedia(record,archiveStructure,kind)'));
  assert.equal(library.includes('records.flatMap('), false,
    'the library labelled THIS RECORD’S MEDIA LIBRARY must not mix unrelated records');
  assert.ok(library.includes('available'));
  assert.ok(library.includes('(mediaReady&&resolvedLocal)'),
    'public items must resolve to a verified local GitHub media path');
  assert.equal(library.includes('legacyRemote'), false,
    'the media library must not make remote legacy storage available');
  assert.ok(blockEditorSource.includes('option.disabled=item.available===false'));
  assert.ok(blockEditorSource.includes('NOT RECOVERED'));
});



test('private draft blob media references are converted to verified repository paths before sanitization', () => {
  const start = archiveSource.indexOf('function isKnownPrivateDraftMediaPath(');
  const end = archiveSource.indexOf('function markUsed(', start);
  assert.ok(start >= 0 && end > start, 'private draft path validation and serialization helpers must exist');
  const helper = archiveSource.slice(start, end).trim();
  const blobUrl = 'blob:https://iyakuza.github.io/preview-audio-blob';
  const privatePath = 'cms-data/v1/media/drafts/draft-3010/blocks-audio/audio.mp3';
  const privateMediaUrlToPath = new Map([[blobUrl, privatePath]]);
  const sandbox = vm.createContext({
    privateMediaUrlToPath,
    isPrivateDraftBlobUrl: raw => String(raw || '').startsWith('blob:') && privateMediaUrlToPath.has(raw)
  });
  vm.runInContext(helper + '; this.serialize = serializePrivateDraftMediaReferences; this.isKnown = isKnownPrivateDraftMediaPath; this.resolvePath = privateDraftBlobUrlForPath; this.resolveMediaUrl = resolvePrivateDraftMediaUrl;', sandbox);

  const html = '<div class="ha-audio-block"><figure><audio controls src="' + blobUrl + '"></audio><figcaption>audio.mp3</figcaption></figure></div>';
  const serialized = sandbox.serialize(html);
  assert.ok(serialized.includes(privatePath), 'the uploaded private path must replace the transient blob URL');
  assert.doesNotMatch(serialized, /blob:/, 'DOMPurify must never receive the transient blob URL');
  assert.equal(sandbox.isKnown(privatePath), true, 'only a path mapped from an uploaded blob is trusted');
  assert.equal(sandbox.resolvePath(privatePath), blobUrl, 'verified paths must resolve back to their live blob URL for rendering');
  assert.equal(sandbox.resolvePath('cms-data/v1/media/drafts/other-draft/blocks-audio/audio.mp3'), '', 'unmapped private paths must not resolve to a playable URL');
  assert.equal(sandbox.resolveMediaUrl(privatePath), blobUrl, 'a verified repository path must resolve to its session Blob URL');
  assert.equal(sandbox.resolveMediaUrl(blobUrl), blobUrl, 'a currently mapped Blob URL must remain usable in the current session');
  assert.equal(sandbox.resolveMediaUrl('blob:https://iyakuza.github.io/unmapped'), '', 'an arbitrary Blob URL must never be accepted');
  assert.equal(sandbox.resolveMediaUrl('cms-data/v1/media/drafts/other-draft/blocks-audio/audio.mp3'), '', 'an unmapped repository path must never be accepted');
  assert.equal(sandbox.isKnown('cms-data/v1/media/drafts/other-draft/blocks-audio/audio.mp3'), false,
    'a guessed path from another draft must not be trusted');

  const sanitizerStart = archiveSource.indexOf('function sanitizeTransmissionBody(source){');
  const sanitizerEnd = archiveSource.indexOf('function clearChamberFormattingToolbar()', sanitizerStart);
  const sanitizer = archiveSource.slice(sanitizerStart, sanitizerEnd);
  assert.ok(sanitizer.indexOf("serializePrivateDraftMediaReferences(String(source??''))") <
    sanitizer.indexOf('parseSanitizedHTML(raw)'), 'private references must be serialized before DOMPurify sanitization');
  assert.ok(sanitizer.includes('isKnownPrivateDraftMediaPath(rawSrc)'),
    'sanitizer URL validation must accept only verified private draft paths');
  const cleanupStart = archiveSource.indexOf('const cleanupBlockMediaUploads=');
  const cleanupEnd = archiveSource.indexOf('if(!readOnly&&typeof window.VHABlockEditor', cleanupStart);
  const cleanup = archiveSource.slice(cleanupStart, cleanupEnd);
  assert.ok(cleanup.includes("String(keepContent||'').includes(item.path)"),
    'a path preserved in sanitized draft content must protect its uploaded file from cleanup');
});


test('archive card rendering preserves verified private draft audio and image sources through DOMPurify', () => {
  const rendererStart = archiveSource.indexOf('function appendSafeContent(container,source,record,used){');
  const rendererEnd = archiveSource.indexOf('\nfunction ', rendererStart + 1);
  assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, 'archive card media renderer must exist');
  const renderer = archiveSource.slice(rendererStart, rendererEnd);
  assert.ok(
    renderer.includes("parseSanitizedHTML(serializePrivateDraftMediaReferences(String(source??'')))"),
    'verified session Blob URLs must be converted to private paths before DOMPurify sanitizes the card body'
  );
  assert.equal(
    (renderer.match(/resolvePrivateDraftMediaUrl\(raw\)/g) || []).length,
    3,
    'image, audio/video, and source elements must resolve only mapped private draft media'
  );
  assert.ok(renderer.includes('if(privateDraftUrl)valid=true'), 'mapped private image media must pass validation');
  assert.ok(renderer.includes('Boolean(privateDraftUrl)'), 'mapped private audio/video media must pass validation');
  assert.ok(renderer.includes('source.src=privateDraftUrl||localMediaUrl(item)'),
    'a verified private source element must be restored as its session Blob URL');
});

test('cancelling a nested media picker cannot close the Human Archive Chamber', () => {
  const cancelStart = archiveSource.indexOf("recordChamber.addEventListener('cancel'");
  const cancelEnd = archiveSource.indexOf('let backdropPointerStart', cancelStart);
  assert.ok(cancelStart >= 0 && cancelEnd > cancelStart, 'Chamber cancel handling must exist');
  const handler = archiveSource.slice(cancelStart, cancelEnd);
  assert.ok(handler.includes("recordChamber.querySelector('.ha-media-picker')"),
    'the Chamber must detect an open nested media picker');
  assert.ok(handler.includes('mediaPicker.remove();return;'),
    'Escape/cancel must dismiss the media picker before the Chamber');
  assert.match(blockEditorSource, /input\.addEventListener\('cancel'/,
    'the file input must handle native file-picker cancellation without losing the editor');
});

test('explicit draft saves become the autosave baseline and do not save again on close', () => {
  const start = archiveSource.indexOf('function transmissionDraftAutosaveSignature(state){');
  const end = archiveSource.indexOf('\nfunction chamberUploadToken()', start);
  assert.ok(start >= 0 && end > start, 'shared draft autosave signature helper must exist');
  const helper = archiveSource.slice(start, end);
  const sandbox = vm.createContext({});
  vm.runInContext(helper + '; this.signature = transmissionDraftAutosaveSignature;', sandbox);
  const state = {
    metadata: { title: 'Test', category: 'THE TRANSFORMATION' },
    row: { transmission_body: '<audio src="private.mp3"></audio>', updated_at: 'now' },
    mediaItems: [{ path: 'private.mp3' }],
    blocks: [{ id: 'block-001', html: '<audio src="private.mp3"></audio>' }]
  };
  assert.equal(sandbox.signature(state), sandbox.signature({ ...state, row: { ...state.row, updated_at: 'later' } }),
    'server timestamps must not cause a duplicate autosave');
  assert.notEqual(sandbox.signature(state), sandbox.signature({ ...state, blocks: [] }),
    'a real content change must still produce a different signature');

  const autosaveStart = archiveSource.indexOf('const runDraftAutosave=async()=>{');
  const autosaveEnd = archiveSource.indexOf('const scheduleDraftAutosave=', autosaveStart);
  assert.ok(autosaveStart >= 0 && autosaveEnd > autosaveStart);
  assert.ok(archiveSource.slice(autosaveStart, autosaveEnd).includes('signature=transmissionDraftAutosaveSignature(state)'),
    'automatic saves must use the shared signature');
  const manualSave = archiveSource.indexOf('const draftUnchanged=isTransmissionDraftSnapshotUnchanged(current,draftToSave.metadata,draftToSave.content);');
  assert.ok(manualSave >= 0);
  assert.ok(archiveSource.slice(manualSave, manualSave + 900).includes('draftAutosaveLastSignature=transmissionDraftAutosaveSignature(state)'),
    'the explicit Save Chamber path must update the baseline before the Chamber closes');
});


test('explicit draft Save stops the obsolete autosave lifecycle before read-only rendering', () => {
  const saved = archiveSource.indexOf("status.textContent='DRAFT SAVED PRIVATELY';");
  const categoryUpdate = archiveSource.indexOf('if(!categoryOrder.includes(metadata.category))', saved);
  assert.ok(saved >= 0 && categoryUpdate > saved, 'explicit draft save success path must exist');
  const stop = archiveSource.indexOf('draftAutosaveStopped=true;draftAutosaveQueued=false;', saved);
  const clearTimer = archiveSource.indexOf('if(draftAutosaveTimer){clearTimeout(draftAutosaveTimer);draftAutosaveTimer=null;}', stop);
  assert.ok(stop > saved && stop < categoryUpdate,
    'after a successful private draft save, the editor instance must stop autosave before returning to read-only view');
  assert.ok(clearTimer > stop && clearTimer < categoryUpdate,
    'any queued autosave timer must be cleared before the saved Chamber becomes read-only');
  assert.match(archiveSource, /if\(!shouldRunTransmissionDraftAutosave\(record,draftAutosaveEnabled,draftAutosaveStopped\)\)/,
    'close-time autosave must honour the stopped lifecycle flag');
});

test('the public Chamber renders Markdown and mirrors the selected block type styles', () => {
  assert.match(archiveSource, /function appendMarkdownBlock\(parent,source,copySafeNode\)/);
  assert.match(archiveSource, /node\.classList\?\.contains\('ha-markdown-source'\)/);
  assert.match(archiveSource, /appendMarkdownBlock\(parent,node\.textContent\|\|'',copy\)/);
  for (const blockClass of [
    'ha-pullquote','ha-grid','ha-row','ha-stack','ha-tabs','ha-callout',
    'ha-timeline','ha-media-text','ha-image-compare','ha-gallery',
    'ha-cover','ha-audio-block','ha-playlist','ha-podcast','ha-page-break'
  ]) {
    assert.ok(archiveCssSource.includes('.ha-chamber-blocks-view .'+blockClass),
      'public Chamber must style '+blockClass);
  }
  assert.match(archiveCssSource, /\.ha-block-editor-shell \.ha-editor-block-content pre\.ha-markdown-source/);
  assert.match(archiveCssSource, /\.ha-chamber-blocks-view \.ha-markdown-rendered/);
});

test('inline videos in Human Archive cards are constrained to the card content width', () => {
  const rule = archiveCssSource.match(/\.ha-entry-body video\{([^}]*)\}/);
  assert.ok(rule, 'archive card video rule must exist');
  assert.match(rule[1], /display:block/);
  assert.match(rule[1], /width:100%/);
  assert.match(rule[1], /max-width:100%/);
  assert.match(rule[1], /height:auto/);
  assert.match(rule[1], /object-fit:contain/);
});

test('archive editor sanitizer resolves local media URLs against the document base', () => {
  const start = archiveSource.indexOf('function sanitizeTransmissionBody(source){');
  const end = archiveSource.indexOf('function clearChamberFormattingToolbar()', start);
  assert.ok(start >= 0 && end > start, 'Transmission body sanitizer must exist');
  const sanitizer = archiveSource.slice(start, end);
  assert.equal(sanitizer.split('new URL(src,document.baseURI)').length - 1, 4,
    'image, audio/video, source, and iframe URL checks must resolve against the document');
  assert.equal(sanitizer.split('new URL(src)').length - 1, 0,
    'no media URL should be parsed without a base');
  for (const path of [
    '/landing-page-preview/media/transmissions/T-0001/video.mp4',
    '/landing-page-preview/media/transmissions/T-0001/lyrics.png',
    '/landing-page-preview/media/transmissions/T-0001/audio.mp3'
  ]) {
    assert.equal(new URL(path, 'https://iyakuza.github.io/landing-page-preview/human-archive/').origin,
      'https://iyakuza.github.io');
  }
});


test('unchanged private Transmission snapshots skip redundant draft commits', () => {
  const start = archiveSource.indexOf('function isTransmissionDraftSnapshotUnchanged(');
  const end = archiveSource.indexOf('function chamberUploadToken()', start);
  assert.ok(start >= 0 && end > start, 'private draft snapshot comparison helper must exist');
  const helper = archiveSource.slice(start, end);
  const sandbox = vm.createContext({});
  vm.runInContext(helper + '; this.isUnchanged = isTransmissionDraftSnapshotUnchanged;', sandbox);

  const metadata = {
    title: 'Test', slug: 'test', category: 'THE TRANSFORMATION',
    excerpt: '', status: 'draft', media_width: 100
  };
  const content = {
    transmission_body: '<p>Saved</p>', prompt_style: '', lyrics_style: '', output_text: '',
    output_media: { image: [], audio: [], video: [] }, blocks: [], media_items: []
  };
  const current = { metadata, content, revision: 12, updated_at: '2026-11-22T14:00:00.000Z' };

  assert.equal(sandbox.isUnchanged(current, metadata, content), true,
    'revision and timestamps must not make identical payloads look changed');
  assert.equal(sandbox.isUnchanged(current, { ...metadata, status: 'published' }, content), false,
    'a publication-status change must still be saved');
  assert.equal(sandbox.isUnchanged(current, metadata, { ...content, transmission_body: '<p>Changed</p>' }), false,
    'a real content change must still be saved');

  const staleHeadGuard = archiveSource.indexOf('if(record._repoCommitSha&&current._repoCommitSha!==record._repoCommitSha)');
  const manualSave = archiveSource.indexOf('const draftUnchanged=isTransmissionDraftSnapshotUnchanged(current,draftToSave.metadata,draftToSave.content);');
  const conditionalWrite = archiveSource.indexOf(':await window.VHACMSStore.saveDraft(draftToSave,expectedDraftHead);', manualSave);
  assert.ok(staleHeadGuard >= 0 && manualSave > staleHeadGuard && conditionalWrite > manualSave,
    'manual Save must preserve branch conflict detection and write only when the draft payload changed');
});

test('opening Redesign initializes the private autosave baseline without changing draft data', () => {
  const baseline = archiveSource.indexOf('draftAutosaveLastSignature=transmissionDraftAutosaveSignature(buildDraftAutosaveState())');
  const listeners = archiveSource.indexOf("grid.addEventListener('change',()=>{updateSaveLabel();scheduleDraftAutosave();});");
  const flush = archiveSource.indexOf('const flushDraftAutosave=async()=>{', listeners);
  const metadataStart = archiveSource.indexOf('const metadata={', archiveSource.indexOf('const buildDraftAutosaveState=()=>{'));
  const metadataEnd = archiveSource.indexOf('};', metadataStart);
  assert.ok(listeners >= 0 && baseline > listeners && flush > baseline,
    'the initial editor state must be captured after editor listeners are wired and before autosave can flush');
  assert.match(archiveSource.slice(metadataStart, metadataEnd), /status:String\(recordMetadataInputs\.status\.value\|\|'draft'\)/,
    'publication status must be part of the autosave baseline and persisted draft metadata');
});


test('Markdown blocks provide syntax-coloured live editing while saving plain Markdown source', () => {
  assert.match(blockEditorSource, /function highlightMarkdown\(source\)/);
  assert.match(blockEditorSource, /function createMarkdownEditor\(source = ''\)/);
  assert.match(blockEditorSource, /ha-markdown-input/);
  assert.match(blockEditorSource, /ha-markdown-source/);
  assert.match(blockEditorSource, /source\.textContent=markdownInput\.value/);
  assert.match(blockEditorSource, /isMarkdownSectionLabel/);
  assert.match(blockEditorSource, /'stage-direction'/);
  assert.match(blockEditorCssSource, /\.ha-markdown-highlight/);
  assert.match(blockEditorCssSource, /\.ha-editor-block-content \.ha-markdown-highlight/);
  assert.match(blockEditorCssSource, /\.ha-markdown-input/);
  assert.match(blockEditorCssSource, /\.ha-md-bracket/);
  assert.match(blockEditorCssSource, /\.ha-md-section-label/);
  assert.match(blockEditorCssSource, /\.ha-md-stage-direction/);
  assert.match(blockEditorCssSource, /\.ha-md-code-keyword/);
});
