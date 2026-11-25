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
const archiveSource = read('human-archive/archive.js');
const chamberSource = read('human-archive/chamber.css');
const creatorSource = read('creator-posting.js');
const standardCss = read('transmissions/archive-standard.css');
const pages = [
  'index.html',
  'human-archive/index.html',
  'green-dream/index.html',
  'signals/index.html',
  'cv/index.html',
  '404.html',
  'transmissions/index.html',
  'transmissions/the-awakening/index.html',
  'transmissions/the-descent/index.html',
  'transmissions/the-reconnection/index.html',
  'transmissions/the-transformation/index.html',
  'transmissions/the-return/index.html'
];
const movementPages = pages.filter(page => /^transmissions\//.test(page));

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

test('Transmission audio and video never preload metadata or duplicate attached media', () => {
  assert.match(postsSource, /setAttribute\('preload','none'\)/);
  assert.doesNotMatch(postsSource, /setAttribute\('preload','metadata'\)/);
  assert.match(postsSource, /excludedMedia\.has\(originalSrc\)/);
});

test('Transmission cards use the Human Archive entry, quick-actions and content components', () => {
  const start = postsSource.indexOf('function renderTransmissionRecordCard(post){');
  const end = postsSource.indexOf('function renderPostRecordCard(post){', start);
  assert.ok(start >= 0 && end > start, 'Transmission card renderer must exist');
  const renderer = postsSource.slice(start, end);
  assert.match(renderer, /class="ha-entry"/);
  assert.match(renderer, /class="ha-entry-quick-actions"/);
  assert.match(renderer, /class="ha-entry-content"/);
  assert.match(renderer, /class="ha-record-card"/);
  assert.doesNotMatch(renderer, /post-record-entry|post-record-quick-actions|post-record-content|post-collapsible/);
});

test('Transmission chamber actions use the shared Human Archive dialog and numeric record routes', () => {
  assert.match(postsSource, /VHA_REQUEST_OPEN_TRANSMISSION/);
  assert.match(postsSource, /searchParams\.set\('record',String\(post\.archive_record_id\)\)/);
  assert.match(creatorSource, /VHA_TRANSMISSIONS_READY/);
  assert.match(creatorSource, /openAddressedTransmission/);
  assert.match(archiveSource, /url\.searchParams\.set\('record',String\(record\.id\)\)/);
  assert.match(archiveSource, /record\.source_type==='transmission'/);
  assert.doesNotMatch(postsSource, /function openTransmissionPermalink/);
});

test('Suno sections are rendered as a vertical reading flow', () => {
  assert.match(postsSource, /suno-reading-stack/);
  assert.match(postsSource, /suno-reading-section/);
  assert.match(standardCss, /grid-template-columns:minmax\(0,1fr\)/);
  const start = postsSource.indexOf('function renderTransmissionRecordCard(post){');
  const end = postsSource.indexOf('function renderPostRecordCard(post){', start);
  const transmissionRenderer = postsSource.slice(start, end);
  assert.ok(start >= 0 && end > start, 'Transmission renderer must exist');
  assert.doesNotMatch(transmissionRenderer, /suno-three-column/);
  assert.ok(postsSource.includes("safe(String(label||'SECTION'))"));
});

test('the shared Chamber grid is full-width and saved columns collapse responsively', () => {
  assert.match(chamberSource, /\.ha-chamber-grid\{\s*display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(standardCss, /repeat\(auto-fit,minmax\(min\(100%,340px\),1fr\)\)/);
  assert.match(standardCss, /grid-template-columns:minmax\(0,1fr\)!important/);
});

test('all Transmission routes use the same archive card stylesheet and renderer versions', () => {
  for (const page of movementPages) {
    const html = read(page);
    assert.match(html, /human-archive\/archive\.css\?v=20261122-responsive-card-video-1/, page + ' shared Human Archive styles');
    assert.match(html, /archive-standard\.css\?v=20261125-ha-standard-2/, page + ' standard archive layer');
    assert.match(html, /posts\.js\?v=20261125-ha-standard-2/, page + ' common renderer');
    assert.match(html, /creator-posting\.js\?v=20261125-ha-standard-2/, page + ' shared Chamber bridge');
  }
});

test('primary site routes use the actual Green Dream V/A favicon', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/landing-page\/assets\/va-logo-green-dream\.svg\?v=20261105-live-1"/, page + ' favicon');
  }
});

test('fallback page also declares the Green Dream V/A favicon', () => {
  assert.match(read('404.html'), /va-logo-green-dream\.svg\?v=20261105-live-1/);
});
