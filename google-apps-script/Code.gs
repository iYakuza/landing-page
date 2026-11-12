/**
 * Green Dream private backup receiver.
 * Accepts authenticated, already-encrypted archive parts and stores them in a
 * private Drive folder. No listing or download endpoint is exposed.
 */
const FOLDER_NAME = "Green Dream Backups";
const FILE_PREFIX = "greendream-backup-";
const TOKEN_PROPERTY = "INGEST_TOKEN";
const FOLDER_PROPERTY = "BACKUP_FOLDER_ID";
const MAX_PARTS = 100;
const MAX_PART_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_CHARS = 8 * 1024 * 1024;
const ORPHAN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function constantTimeEqual_(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function getFolder_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty(FOLDER_PROPERTY);
  if (savedId) {
    try {
      return DriveApp.getFolderById(savedId);
    } catch (_) {
      props.deleteProperty(FOLDER_PROPERTY);
    }
  }
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty(FOLDER_PROPERTY, folder.getId());
  return folder;
}

function sha256_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map(function (b) { return (b + 256).toString(16).slice(-2); })
    .join("");
}

function validateId_(id) {
  return typeof id === "string" &&
    /^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$/.test(id);
}

function authorizeDriveAccess() {
  const folder = getFolder_();
  Logger.log("Drive access is authorized. Backup folder is ready: " + folder.getName());
}

function findBackupFiles_(folder, backupId) {
  const found = [];
  const iterator = folder.getFiles();
  const prefix = FILE_PREFIX + backupId + "-part-";
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (file.getName().startsWith(prefix) && file.getName().endsWith(".gpgpart")) {
      found.push(file);
    }
  }
  return found;
}

function cleanupOrphans_(folder) {
  const referenced = {};
  const manifests = folder.getFiles();
  while (manifests.hasNext()) {
    const file = manifests.next();
    if (!file.getName().startsWith(FILE_PREFIX) || !file.getName().endsWith(".manifest.json")) continue;
    try {
      const manifest = JSON.parse(file.getBlob().getDataAsString());
      (manifest.parts || []).forEach(function (part) { referenced[part.name] = true; });
    } catch (_) {
      // A malformed manifest is retained for investigation; it is not used as a deletion list.
    }
  }
  const cutoff = Date.now() - ORPHAN_MAX_AGE_MS;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().startsWith(FILE_PREFIX) && file.getName().endsWith(".gpgpart") &&
        !referenced[file.getName()] && file.getDateCreated().getTime() < cutoff) {
      file.setTrashed(true);
    }
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const props = PropertiesService.getScriptProperties();
    const expectedToken = props.getProperty(TOKEN_PROPERTY) || "";
    if (expectedToken.length < 40) return json_({ ok: false, error: "Receiver is not configured." });

    const raw = e && e.postData && e.postData.contents;
    if (typeof raw !== "string" || !raw || raw.length > MAX_REQUEST_CHARS) {
      return json_({ ok: false, error: "Invalid request size." });
    }

    let request;
    try { request = JSON.parse(raw); } catch (_) {
      return json_({ ok: false, error: "Invalid JSON request." });
    }
    if (!request || typeof request !== "object" || Array.isArray(request) ||
        !constantTimeEqual_(request.token, expectedToken)) {
      return json_({ ok: false, error: "Unauthorized." });
    }

    if (request.action === "ping") {
      return json_({ ok: true, service: "Green Dream Drive receiver", folder: FOLDER_NAME });
    }
    if (request.action !== "upload_part" || !validateId_(request.backup_id)) {
      return json_({ ok: false, error: "Invalid upload request." });
    }

    const part = request.part_number;
    const total = request.total_parts;
    if (!Number.isInteger(part) || !Number.isInteger(total) ||
        total < 1 || total > MAX_PARTS || part < 1 || part > total) {
      return json_({ ok: false, error: "Invalid part numbering." });
    }
    if (typeof request.content_base64 !== "string" ||
        request.content_base64.length < 4 ||
        request.content_base64.length > Math.ceil(MAX_PART_BYTES / 3) * 4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(request.content_base64)) {
      return json_({ ok: false, error: "Invalid part encoding." });
    }

    const bytes = Utilities.base64Decode(request.content_base64);
    if (!bytes.length || bytes.length > MAX_PART_BYTES) {
      return json_({ ok: false, error: "Invalid part size." });
    }
    const digest = sha256_(bytes);
    if (typeof request.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/i.test(request.sha256) ||
        !constantTimeEqual_(digest, request.sha256.toLowerCase())) {
      return json_({ ok: false, error: "Part checksum mismatch." });
    }

    const folder = getFolder_();
    const existingParts = findBackupFiles_(folder, request.backup_id);
    for (let i = 0; i < existingParts.length; i++) {
      const match = existingParts[i].getName().match(/-of-([0-9]{4})\.gpgpart$/);
      if (!match || Number(match[1]) !== total) {
        return json_({ ok: false, error: "Backup part count conflicts with an existing upload." });
      }
    }
    const manifestName = FILE_PREFIX + request.backup_id + ".manifest.json";
    const fileName = FILE_PREFIX + request.backup_id + "-part-" +
      String(part).padStart(4, "0") + "-of-" + String(total).padStart(4, "0") + ".gpgpart";
    const manifests = folder.getFilesByName(manifestName);
    if (manifests.hasNext()) {
      const manifest = JSON.parse(manifests.next().getBlob().getDataAsString());
      const recordedPart = (manifest.parts || []).find(function (item) { return item.name === fileName; });
      if (manifest.backup_id !== request.backup_id || manifest.encrypted !== true ||
          manifest.part_count !== total || !recordedPart ||
          recordedPart.size !== bytes.length || recordedPart.sha256 !== digest) {
        return json_({ ok: false, error: "Completed backup is immutable; this part conflicts with its manifest." });
      }
    }
    const existing = folder.getFilesByName(fileName);
    if (existing.hasNext()) {
      const file = existing.next();
      if (file.getSize() !== bytes.length || sha256_(file.getBlob().getBytes()) !== digest) {
        return json_({ ok: false, error: "Conflicting part already exists." });
      }
    } else {
      folder.createFile(Utilities.newBlob(bytes, "application/octet-stream", fileName));
    }

    const parts = [];
    for (let index = 1; index <= total; index++) {
      const name = FILE_PREFIX + request.backup_id + "-part-" +
        String(index).padStart(4, "0") + "-of-" + String(total).padStart(4, "0") + ".gpgpart";
      const files = folder.getFilesByName(name);
      if (!files.hasNext()) break;
      const file = files.next();
      parts.push({ name: name, size: file.getSize(), file_id: file.getId() });
    }

    let finalized = false;
    if (parts.length === total) {
      const verifiedParts = parts.map(function (item) {
        const file = DriveApp.getFileById(item.file_id);
        return { name: item.name, size: item.size, sha256: sha256_(file.getBlob().getBytes()) };
      });
      const manifest = {
        backup_id: request.backup_id,
        created_at: new Date().toISOString(),
        encrypted: true,
        part_count: total,
        parts: verifiedParts
      };
      const currentManifests = folder.getFilesByName(manifestName);
      if (!currentManifests.hasNext()) {
        folder.createFile(manifestName, JSON.stringify(manifest, null, 2), MimeType.PLAIN_TEXT);
      }
      finalized = true;
      applyRetention_(folder);
      cleanupOrphans_(folder);
    }

    return json_({
      ok: true,
      backup_id: request.backup_id,
      received_part: part,
      received_parts: parts.length,
      total_parts: total,
      finalized: finalized
    });
  } catch (err) {
    console.error("Backup receiver error: " + String(err && err.message || err));
    return json_({ ok: false, error: "The receiver could not complete the request." });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function applyRetention_(folder) {
  const manifests = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (file.getName().startsWith(FILE_PREFIX) && file.getName().endsWith(".manifest.json")) {
      manifests.push(file);
    }
  }
  manifests.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  manifests.slice(30).forEach(function (manifestFile) {
    const manifest = JSON.parse(manifestFile.getBlob().getDataAsString());
    (manifest.parts || []).forEach(function (part) {
      const matches = folder.getFilesByName(part.name);
      while (matches.hasNext()) matches.next().setTrashed(true);
    });
    manifestFile.setTrashed(true);
  });
}
