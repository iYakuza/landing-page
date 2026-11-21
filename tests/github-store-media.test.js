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
