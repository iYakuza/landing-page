const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const files = [];
let nextId = 1;
const properties = new Map([["INGEST_TOKEN", "test-token-".padEnd(48, "x")]]);
const bytesOf = value => Buffer.from(value);
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

class MockFile {
  constructor(name, bytes, created = new Date()) {
    this.name = name;
    this.bytes = Buffer.from(bytes);
    this.created = created;
    this.id = String(nextId++);
    this.trashed = false;
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
    const file = new MockFile(name, bytes);
    files.push(file);
    return file;
  }
};
const context = {
  console,
  Logger: { log() {} },
  MimeType: { PLAIN_TEXT: "text/plain" },
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
    getFoldersByName: () => new Iterator([folder]),
    createFolder: () => folder,
    getFileById: id => files.find(f => f.id === id)
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: {
    DigestAlgorithm: { SHA_256: "sha256" },
    computeDigest: (_, bytes) => Array.from(crypto.createHash("sha256").update(Buffer.from(bytes)).digest()).map(x => x > 127 ? x - 256 : x),
    base64Decode: value => Array.from(Buffer.from(value, "base64")),
    newBlob: (bytes, mime, name) => ({ bytes, mime, name })
  },
  Date,
  JSON,
  Math,
  String,
  Number,
  Object,
  Array,
  RegExp
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("google-apps-script/Code.gs", "utf8"), context);

function send(payload, raw) {
  const response = context.doPost({ postData: { contents: raw === undefined ? JSON.stringify(payload) : raw } });
  return JSON.parse(response.getContent());
}
const token = properties.get("INGEST_TOKEN");
const id = "20261112T120000Z-a1b2c3d4";
const part = (n, total, content) => {
  const b = bytesOf(content);
  return { action: "upload_part", token, backup_id: id, part_number: n, total_parts: total,
    sha256: digest(b), content_base64: b.toString("base64") };
};

assert.equal(send({ action: "ping", token: "wrong" }).ok, false, "reject wrong token");
assert.equal(send({ action: "ping", token }).ok, true, "accept authenticated ping");
assert.equal(send({}, "{not json").ok, false, "reject malformed JSON");
assert.equal(send({ action: "upload_part", token, backup_id: "../bad", part_number: 1, total_parts: 1 }).ok, false, "reject invalid backup ID");
assert.equal(send({ ...part(1, 1, "x"), content_base64: "!!!!" }).ok, false, "reject invalid base64");
assert.equal(send({ ...part(1, 1, "x"), sha256: "0".repeat(64) }).ok, false, "reject bad checksum");

const first = send(part(1, 2, "encrypted-chunk-one"));
assert.equal(first.ok, true);
assert.equal(first.finalized, false);
assert.equal(first.received_parts, 1);
const retry = send(part(1, 2, "encrypted-chunk-one"));
assert.equal(retry.ok, true, "identical retry is idempotent");
assert.equal(send(part(2, 3, "conflicting-total")).ok, false, "reject changed total_parts");
const second = send(part(2, 2, "encrypted-chunk-two"));
assert.equal(second.ok, true);
assert.equal(second.finalized, true, "final part creates completed backup");
const manifestFile = files.find(f => f.name === "greendream-backup-" + id + ".manifest.json");
assert.ok(manifestFile, "manifest exists");
const manifest = JSON.parse(manifestFile.getBlob().getDataAsString());
assert.equal(manifest.encrypted, true);
assert.equal(manifest.part_count, 2);
assert.deepEqual(manifest.parts.map(p => p.sha256), [digest(bytesOf("encrypted-chunk-one")), digest(bytesOf("encrypted-chunk-two"))]);
assert.equal(send(part(2, 2, "different-content")).ok, false, "reject conflicting duplicate part");

properties.set("INGEST_TOKEN", "short");
assert.equal(send({ action: "ping", token: "short" }).ok, false, "reject weak receiver configuration");
console.log("Apps Script receiver tests passed.");
