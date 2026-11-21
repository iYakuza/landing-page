'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'cms', 'github-store.js'), 'utf8');
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

