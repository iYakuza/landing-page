const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const files = [];
let nextId = 1;
const properties = new Map([["INGEST_TOKEN", "test-token-".padEnd(48, "x")], ["BACKUP_FOLDER_ID", "folder-id"]]);
const sessionRequests = [];
const bytesOf = value => Buffer.from(value);
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

class MockFile {
  constructor(name, bytes, created = new Date()) {
    this.name = name; this.bytes = Buffer.from(bytes); this.created = created;
    this.id = String(nextId++); this.trashed = false;
  }
  getName() { return this.name; }
  getId() { return this.id; }
  getSize() { return this.bytes.length; }
  getBlob() {
    const b = Buffer.from(this.bytes);
    return { getBytes: () => Array.from(b), getDataAsString: () => b.toString("utf8") };
  }
  getDateCreated() { return this.created; }
  setTrashed(value) { this.trashed = value; }
}
class Iterator {
  constructor(items) { this.items = items; this.index = 0; }
  hasNext() { return this.index < this.items.length; }
  next() { return this.items[this.index++]; }
}
const folder = {
  getId: () => "folder-id",
  getName: () => "Green Dream Backups",
  getFiles: () => new Iterator(files.filter(f => !f.trashed)),
  getFilesByName: name => new Iterator(files.filter(f => !f.trashed && f.name === name)),
  createFile: (arg1, arg2) => {
    let name, bytes;
    if (typeof arg1 === "string") { name = arg1; bytes = bytesOf(arg2); }
    else { name = arg1.name; bytes = Buffer.from(arg1.bytes); }
    const file = new MockFile(name, bytes); files.push(file); return file;
  }
};
const context = {
  console, Logger: { log() {} }, MimeType: { PLAIN_TEXT: "text/plain" },
  ContentService: {
    MimeType: { JSON: "application/json" },
    createTextOutput: value => ({ value, setMimeType() { return this; }, getContent() { return this.value; } })
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: key => properties.get(key) || null,
      setProperty: (key, value) => properties.set(key, value),
      deleteProperty: key => properties.delete(key)
    })
  },
  DriveApp: {
    getFolderById: id => { if (id !== "folder-id") throw Error("missing"); return folder; },
    getFoldersByName: () => new Iterator([folder]), createFolder: () => folder,
    getFileById: id => files.find(f => f.id === id)
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ScriptApp: { getOAuthToken: () => "mock-google-oauth-token" },
  UrlFetchApp: {
    fetchAll: requests => {
      sessionRequests.push(...requests);
      return requests.map((request, index) => ({
        getResponseCode: () => 200,
        getAllHeaders: () => ({ Location: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=mock-session-" + (sessionRequests.length - requests.length + index + 1) })
      }));
    }
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: "sha256" },
    computeDigest: (_, bytes) => Array.from(crypto.createHash("sha256").update(Buffer.from(bytes)).digest()).map(x => x > 127 ? x - 256 : x),
    base64Decode: value => Array.from(Buffer.from(value, "base64")),
    base64Encode: value => Buffer.from(value).toString("base64"),
    newBlob: (bytes, mime, name) => ({ bytes, mime, name })
  },
  Date, JSON, Math, String, Number, Object, Array, RegExp
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("google-apps-script/Code.gs", "utf8"), context);

function send(payload, raw) {
  const response = context.doPost({ postData: { contents: raw === undefined ? JSON.stringify(payload) : raw } });
  return JSON.parse(response.getContent());
}
const token = properties.get("INGEST_TOKEN");
const id = "20261113T000000Z-a1b2c3d4";
const chunks = [bytesOf("encrypted-chunk-one"), bytesOf("encrypted-chunk-two")];
const totalSha = digest(Buffer.concat(chunks));
const part = (n, content) => ({
  action: "upload_part", token, backup_id: id, part_number: n, total_parts: 2,
  sha256: digest(content), content_base64: content.toString("base64")
});

assert.equal(send({ action: "ping", token: "wrong" }).ok, false);
assert.equal(send({ action: "ping", token }).ok, true);
assert.equal(send({}, "{not json").ok, false);
assert.equal(send({ ...part(1, chunks[0]), backup_id: "../bad" }).ok, false);

const first = send(part(1, chunks[0]));
assert.equal(first.ok, true);
assert.equal(first.already_present, false);
const retry = send(part(1, chunks[0]));
assert.equal(retry.ok, true);
assert.equal(retry.already_present, true);

const uploadState = send({ action: "list_upload_parts", token, backup_id: id, total_parts: 2 });
assert.equal(uploadState.ok, true);
assert.equal(uploadState.parts.length, 1);
assert.equal(uploadState.parts[0].part_number, 1);

const sessionState = send({
  action: "create_upload_sessions", token, backup_id: id, total_parts: 2,
  parts: [
    { part_number: 1, size: chunks[0].length, sha256: digest(chunks[0]) },
    { part_number: 2, size: chunks[1].length, sha256: digest(chunks[1]) }
  ]
});
assert.equal(sessionState.ok, true);
assert.equal(sessionState.sessions.length, 2);
assert.equal(sessionState.sessions[0].already_present, true);
assert.equal(sessionState.sessions[1].already_present, false);
assert.ok(sessionState.sessions[1].session_url.startsWith("https://www.googleapis.com/upload/drive/v3/files?"));
assert.equal(sessionRequests.length, 1, "only the missing part gets a Drive session");
assert.equal(sessionRequests[0].headers.Authorization, "Bearer mock-google-oauth-token");
assert.equal(sessionRequests[0].headers["X-Upload-Content-Length"], String(chunks[1].length));

const alreadyStored = send({
  action: "create_upload_sessions", token, backup_id: id, total_parts: 2,
  parts: [{ part_number: 1, size: chunks[0].length, sha256: digest(chunks[0]) }]
});
assert.equal(alreadyStored.ok, true);
assert.equal(alreadyStored.sessions[0].already_present, true);
assert.equal(sessionRequests.length, 1, "verified existing parts do not create new sessions");

assert.equal(send(part(2, chunks[1])).ok, true);

const incomplete = send({
  action: "finalize_backup", token, backup_id: id, total_parts: 3,
  total_bytes: 99, archive_sha256: totalSha
});
assert.equal(incomplete.ok, false, "reject finalization with missing parts");

const finalized = send({
  action: "finalize_backup", token, backup_id: id, total_parts: 2,
  total_bytes: Buffer.concat(chunks).length, archive_sha256: totalSha
});
assert.equal(finalized.ok, true);
assert.equal(finalized.finalized, true);

const manifestFile = files.find(f => f.name === "greendream-backup-" + id + ".manifest.json");
assert.ok(manifestFile);
const manifest = JSON.parse(manifestFile.getBlob().getDataAsString());
assert.equal(manifest.archive_sha256, totalSha);
assert.equal(manifest.parts.length, 2);

const completedRetry = send(part(2, chunks[1]));
assert.equal(completedRetry.ok, true, "identical retries remain safe after completion");
assert.equal(send(part(2, bytesOf("different-content"))).ok, false, "completed backups are immutable");

const listing = send({ action: "list_backups", token });
assert.equal(listing.ok, true);
assert.equal(listing.backups.length, 1);
assert.equal(listing.backups[0].total_bytes, Buffer.concat(chunks).length);
assert.equal(listing.backups[0].archive_sha256, totalSha);

const downloaded = send({ action: "download_part", token, backup_id: id, part_number: 1 });
assert.equal(downloaded.ok, true);
assert.equal(Buffer.from(downloaded.content_base64, "base64").toString(), chunks[0].toString());
assert.equal(downloaded.sha256, digest(chunks[0]));
assert.equal(send({ action: "download_part", token, backup_id: id, part_number: 3 }).ok, false);
assert.equal(send({ action: "list_backups", token: "wrong" }).ok, false);

const oldFiles = files.length;
assert.equal(files.some(f => f.trashed), false, "receiver never trashes existing files");
assert.equal(files.length, oldFiles, "receiver does not delete or rewrite existing files");

properties.set("INGEST_TOKEN", "short");
assert.equal(send({ action: "ping", token: "short" }).ok, false);
console.log("Optimized Apps Script receiver tests passed.");
