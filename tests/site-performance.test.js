'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const radioSource = read('shared/crystal/tools/radio.js');
const crystalSource = read('shared/crystal/crystal.js');
const postsSource = read('transmissions/posts.js');
const pages = [
  'index.html',
  'transmissions/index.html',
  'signals/index.html',
  'transmissions/the-awakening/index.html',
  'transmissions/the-descent/index.html',
  'transmissions/the-reconnection/index.html',
  'transmissions/the-transformation/index.html',
  'transmissions/the-return/index.html',
  'green-dream/index.html',
  'human-archive/index.html',
  'cv/index.html',
  'secure-your-soul/index.html',
  'cms/index.html'
];

test('shared radio does not initialize YouTube or fetch playlist metadata on page load', () => {
  assert.match(radioSource, /Radio is idle\. Press PLAY or choose a track to connect\./);
  assert.doesNotMatch(radioSource, /status\('Preparing the Green Dream playlist…'\);\s*start\(false\);/);
  assert.match(radioSource, /select\.addEventListener\('focus',\(\)=>\{if\(!player&&!playerPromise\)start\(false\)\}\)/);
  assert.match(radioSource, /play\.addEventListener\('click',\(\)=>/);
});

test('radio can retry after an initial YouTube API failure', () => {
  assert.match(radioSource, /if\(!player\)playerPromise=null;/);
});

test('Signals SVG uses a valid, closed circular arc path', () => {
  assert.match(crystalSource, /M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z/);
  assert.doesNotMatch(crystalSource, /0 8 4 4 0 0 0-8Z/);
});

test('Transmission audio and video are never preloaded for metadata', () => {
  assert.match(postsSource, /setAttribute\('preload','none'\)/);
  assert.doesNotMatch(postsSource, /setAttribute\('preload','metadata'\)/);
});

test('attached media is not duplicated when it also appears in saved post HTML', () => {
  assert.match(postsSource, /function cleanHtml\(html, excludedMediaUrls = \[\]\)/);
  assert.match(postsSource, /excludedMedia\.has\(originalSrc\)/);
  assert.match(postsSource, /function attachedMediaUrls\(post\)/);
  assert.match(postsSource, /cleanHtml\(post\.content_html,attachedMediaUrls\(post\)\)/);
});

test('Enter the Chamber opens a stable post permalink and browser back restores the archive', () => {
  assert.match(postsSource, /function openTransmissionPermalink\(slug\)/);
  assert.match(postsSource, /url\.searchParams\.set\('post',post\.slug\)/);
  assert.match(postsSource, /history\.pushState\(/);
  assert.match(postsSource, /window\.addEventListener\('popstate'/);
  assert.match(postsSource, /openTransmissionPermalink\(chamberButton\.dataset\.vhaOpenTransmission\)/);
});

test('all shared-radio pages allow YouTube only for deliberate player use', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /script-src[^;]*https:\/\/www\.youtube\.com/, page + ' script-src');
    assert.match(html, /connect-src[^;]*https:\/\/www\.youtube\.com/, page + ' connect-src');
    assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/landing-page\/assets\/va-logo\.svg"/, page + ' favicon');
  }
});

test('fallback page also declares the scoped site favicon', () => {
  assert.match(read('404.html'), /rel="icon" type="image\/svg\+xml" href="\/landing-page\/assets\/va-logo\.svg"/);
});
