'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');
const clientSource = fs.readFileSync(path.join(root, 'shared/contact/contact.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'google-apps-script/Code.gs'), 'utf8');
const uploadSource = fs.readFileSync(path.join(root, 'google-apps-script/Upload.html'), 'utf8');
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
      },
      createHtmlOutputFromFile(name) {
        return {
          content: 'HTML_FILE:' + name,
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

function createAttachment(name, contentType, byteLength) {
  return {
    name,
    contentType,
    getName() { return this.name; },
    getContentType() { return this.contentType; },
    getBytes() { return { length: byteLength }; },
    setName(value) { this.name = value; return this; }
  };
}

test('Apps Script serves the attachment picker as a framed HTML Service page', () => {
  const harness = createServerHarness();
  const result = harness.context.doGet({ parameter: { mode: 'upload' } });
  assert.equal(result.title, 'Verse After Hours — Attachments');
  assert.equal(result.frameMode, 'ALLOWALL');
  assert.equal(result.content, 'HTML_FILE:Upload');
  assert.match(uploadSource, /google\\.script\\.run/);
  assert.match(uploadSource, /name="attachment5"/);
  assert.match(uploadSource, /multiple/);
  assert.match(uploadSource, /SITE_ORIGIN = "https:\\/\\/iyakuza\\.github\\.io"/);
});

test('Apps Script emails approved attachment Blobs without storing them', () => {
  const harness = createServerHarness();
  const attachment = createAttachment('CV.pdf', 'application/pdf', 2048);
  const result = harness.context.submitContactForm(validSubmission({
    contactContext: 'career',
    attachment1: attachment
  }));

  assert.equal(result.success, true);
  assert.equal(result.requestId, '00000000-0000-4000-8000-000000000001');
  assert.equal(harness.sent.length, 1);
  assert.equal(harness.sent[0].advanced.attachments.length, 1);
  assert.equal(harness.sent[0].advanced.attachments[0].getName(), 'CV.pdf');
  assert.match(harness.sent[0].body, /Attachments:\\nCV\\.pdf \\(2\\.0 KB\\)/);
  assert.equal(harness.cacheValues.size, 1);
});

test('Apps Script rejects unsupported and oversized attachments before sending', () => {
  const unsupported = createServerHarness();
  const unsupportedResult = unsupported.context.submitContactForm(validSubmission({
    attachment1: createAttachment('script.exe', 'application/octet-stream', 1024)
  }));
  assert.equal(unsupportedResult.success, false);
  assert.equal(unsupported.sent.length, 0);

  const oversized = createServerHarness();
  const oversizedResult = oversized.context.submitContactForm(validSubmission({
    attachment1: createAttachment('large.pdf', 'application/pdf', 5 * 1024 * 1024 + 1)
  }));
  assert.equal(oversizedResult.success, false);
  assert.equal(oversized.sent.length, 0);
});

test('Apps Script enforces the combined attachment size limit', () => {
  const harness = createServerHarness();
  const result = harness.context.submitContactForm(validSubmission({
    attachment1: createAttachment('one.pdf', 'application/pdf', 5 * 1024 * 1024),
    attachment2: createAttachment('two.pdf', 'application/pdf', 5 * 1024 * 1024 + 1)
  }));
  assert.equal(result.success, false);
  assert.equal(harness.sent.length, 0);
});

test('Google-hosted upload bridge exposes only the approved file type and size limits', () => {
  assert.match(uploadSource, /MAX_FILES = 5/);
  assert.match(uploadSource, /MAX_FILE_BYTES = 5 \\* 1024 \\* 1024/);
  assert.match(uploadSource, /MAX_TOTAL_BYTES = 10 \\* 1024 \\* 1024/);
  assert.match(serverSource, /MAX_ATTACHMENTS: 5/);
  assert.match(serverSource, /MAX_FILE_BYTES: 5 \\* 1024 \\* 1024/);
  assert.match(serverSource, /MAX_TOTAL_ATTACHMENT_BYTES: 10 \\* 1024 \\* 1024/);
});

test('contact form is enabled only with a valid Google Apps Script deployment URL', () => {
  assert.ok(clientSource.includes('endpointUrl: "https://script.google.com/macros/s/'));
  assert.ok(clientSource.includes('/exec",'));
  assert.ok(clientSource.includes('const endpointReady ='));
  assert.match(clientSource, /submitButton\.disabled = !endpointReady \\|\\| !uploadFrameReady/);
  assert.match(clientSource, /name="requestId"/);
  assert.match(clientSource, /name="startedAt"/);
  assert.match(clientSource, /name="website"/);
});

test('public contact code contains no mail-client handoff, direct network request, or recipient address', () => {
  assert.doesNotMatch(clientSource, /mailto:|XMLHttpRequest|fetch\s*\(/i);
  assert.match(clientSource, /uploadFrame\.src = endpointReady/);
  assert.ok(clientSource.includes("event.source !== responseFrame.contentWindow"));
  assert.ok(clientSource.includes("[a-z0-9-]+-script"));
  assert.match(uploadSource, /window\.top\.postMessage/);
});

test('homepage and CV both allow only the required Google Apps Script form and response origins', () => {
  for (const html of [homeSource, cvSource]) {
    assert.ok(html.includes("form-action 'self' https://script.google.com https://script.googleusercontent.com https://*.googleusercontent.com"));
    assert.ok(html.includes("frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://script.google.com https://script.googleusercontent.com https://*.googleusercontent.com"));
    assert.match(html, /shared\/contact\/contact\.js\?v=20261123-google-apps-script-attachments-1/);
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
  assert.match(serverSource, /getScriptProperties\(\)\.getProperty\("CONTACT_RECIPIENT"\)/);
  assert.match(serverSource, /MailApp\.sendEmail/);
  assert.doesNotMatch(serverSource, /\b(DriveApp|SpreadsheetApp|GmailApp)\b/);
  assert.doesNotMatch(serverSource, /Logger\.log|console\.log/);
});
