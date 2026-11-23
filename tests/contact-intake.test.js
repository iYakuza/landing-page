'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');
const clientSource = fs.readFileSync(path.join(root, 'shared/contact/contact.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'google-apps-script/Code.gs'), 'utf8');
const homeSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cvSource = fs.readFileSync(path.join(root, 'cv/index.html'), 'utf8');

function createServerHarness(options = {}) {
  const sent = [];
  const cacheValues = new Map();
  const recipient = options.recipient || 'owner@example.com';
  const quota = options.quota === undefined ? 100 : options.quota;

  const context = vm.createContext({
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createHtmlOutput(content) {
        return {
          content,
          title: '',
          frameMode: '',
          setTitle(value) { this.title = value; return this; },
          setXFrameOptionsMode(value) { this.frameMode = value; return this; }
        };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return { getProperty(key) { return key === 'CONTACT_RECIPIENT' ? recipient : null; } };
      }
    },
    CacheService: {
      getScriptCache() {
        return {
          get(key) { return cacheValues.has(key) ? cacheValues.get(key) : null; },
          put(key, value) { cacheValues.set(key, value); }
        };
      }
    },
    LockService: {
      getScriptLock() {
        return { tryLock() { return true; }, releaseLock() {} };
      }
    },
    MailApp: {
      getRemainingDailyQuota() { return quota; },
      sendEmail(to, subject, body, advanced) {
        sent.push({ to, subject, body, advanced });
      }
    }
  });

  vm.runInContext(serverSource, context, { filename: 'google-apps-script/Code.gs' });
  return { context, sent, cacheValues };
}

function validSubmission(overrides = {}) {
  return {
    requestId: '00000000-0000-4000-8000-000000000001',
    startedAt: String(Date.now() - 5000),
    contactContext: 'career',
    name: 'Alex Example',
    email: 'alex@example.com',
    subject: 'Business Analyst opportunity',
    url: 'https://example.com/role',
    message: 'I would like to discuss a role.',
    website: '',
    ...overrides
  };
}

test('contact form stays safely disabled until a valid Google Apps Script URL is configured', () => {
  assert.match(clientSource, /endpointUrl:\s*""/);
  assert.match(clientSource, /GOOGLE SETUP REQUIRED/);
  assert.ok(clientSource.includes('const endpointReady ='));
  assert.match(clientSource, /submitButton\.disabled = !endpointReady/);
  assert.match(clientSource, /name="requestId"/);
  assert.match(clientSource, /name="startedAt"/);
  assert.match(clientSource, /name="website"/);
});

test('public contact code contains no mail-client handoff, direct network request, or recipient address', () => {
  assert.doesNotMatch(clientSource, /mailto:|XMLHttpRequest|fetch\s*\(/i);
  assert.doesNotMatch(clientSource, /stefancu\.emanuel@gmail\.com/i);
  assert.match(clientSource, /responseFrame\.name = "vha-contact-response-frame"/);
  assert.ok(clientSource.includes("event.source !== responseFrame.contentWindow"));
  assert.ok(clientSource.includes('event.origin !== "https://script.google.com"'));
  assert.ok(clientSource.includes('event.origin !== "https://script.googleusercontent.com"'));
  assert.match(serverSource, /window\.top\.postMessage/);
  assert.ok(clientSource.includes("script.googleusercontent.com"));
});

test('homepage and CV both allow only the required Google Apps Script form and response origins', () => {
  for (const html of [homeSource, cvSource]) {
    assert.ok(html.includes("form-action 'self' https://script.google.com https://script.googleusercontent.com"));
    assert.ok(html.includes("frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://script.google.com https://script.googleusercontent.com"));
    assert.match(html, /shared\/contact\/contact\.js\?v=20261123-google-apps-script-1/);
  }
});

test('Apps Script sends one private email to the Script Property recipient and sets visitor Reply-To', () => {
  const harness = createServerHarness();
  const result = harness.context.doPost({ parameter: validSubmission() });

  assert.equal(harness.sent.length, 1);
  assert.equal(harness.sent[0].to, 'owner@example.com');
  assert.equal(harness.sent[0].advanced.replyTo, 'alex@example.com');
  assert.match(harness.sent[0].subject, /CV \/ career enquiry/);
  assert.match(harness.sent[0].body, /Alex Example/);
  assert.match(harness.sent[0].body, /I would like to discuss a role\./);
  assert.equal(result.frameMode, 'ALLOWALL');
  assert.match(result.content, /"success":true/);
  assert.match(result.content, /"requestId":"00000000-0000-4000-8000-000000000001"/);
});

test('Apps Script honeypot drops the submission without sending or retaining message content', () => {
  const harness = createServerHarness();
  const result = harness.context.doPost({
    parameter: validSubmission({ website: 'bot-filled-this', message: 'should not be delivered' })
  });

  assert.equal(harness.sent.length, 0);
  assert.equal(harness.cacheValues.size, 0);
  assert.match(result.content, /"success":true/);
});

test('Apps Script rejects invalid addresses and invalid form timing without sending email', () => {
  const invalidEmail = createServerHarness();
  const emailResult = invalidEmail.context.doPost({
    parameter: validSubmission({ email: 'not-an-email' })
  });
  assert.equal(invalidEmail.sent.length, 0);
  assert.match(emailResult.content, /"success":false/);

  const tooFast = createServerHarness();
  const timingResult = tooFast.context.doPost({
    parameter: validSubmission({ startedAt: String(Date.now() - 100) })
  });
  assert.equal(tooFast.sent.length, 0);
  assert.match(timingResult.content, /"success":false/);
});

test('Apps Script enforces a short global burst limit and checks the Google email quota', () => {
  const rateLimited = createServerHarness();
  rateLimited.context.doPost({ parameter: validSubmission() });
  const second = rateLimited.context.doPost({
    parameter: validSubmission({ requestId: '00000000-0000-4000-8000-000000000002', email: 'other@example.com' })
  });
  assert.equal(rateLimited.sent.length, 1);
  assert.match(second.content, /"success":false/);

  const noQuota = createServerHarness({ quota: 0 });
  const quotaResult = noQuota.context.doPost({ parameter: validSubmission() });
  assert.equal(noQuota.sent.length, 0);
  assert.match(quotaResult.content, /"success":false/);
});

test('Apps Script source does not hard-code the recipient or use message storage services', () => {
  assert.doesNotMatch(serverSource, /stefancu\.emanuel@gmail\.com/i);
  assert.match(serverSource, /getScriptProperties\(\)\.getProperty\("CONTACT_RECIPIENT"\)/);
  assert.match(serverSource, /MailApp\.sendEmail/);
  assert.doesNotMatch(serverSource, /\b(DriveApp|SpreadsheetApp|GmailApp)\b/);
  assert.doesNotMatch(serverSource, /Logger\.log|console\.log/);
});
