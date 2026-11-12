/**
 * Green Dream private backup receiver.
 *
 * Deploy as a web app that executes as the owner and accepts requests from
 * anyone. Every request is authenticated with a high-entropy shared secret.
 * The receiver writes encrypted archive parts into a private Drive folder.
 */
const FOLDER_NAME = "Green Dream Backups";
const FILE_PREFIX = "greendream-backup-";
const TOKEN_PROPERTY = "INGEST_TOKEN";
const FOLDER_PROPERTY = "BACKUP_FOLDER_ID";
const MAX_PARTS = 100;
const MAX_PART_BYTES = 5 * 1024 * 1024;

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

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedToken = props.getProperty(TOKEN_PROPERTY) || "";
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 8 * 1024 * 1024) return json_({ ok: false, error: "Invalid request size." });

    const request = JSON.parse(raw);
    if (!constantTimeEqual_(request.token, expectedToken)) {
      return json_({ ok: false, error: "Unauthorized." });
    }

    if (request.action === "ping") {
      return json_({ ok: true, service: "Green Dream Drive receiver", folder: FOLDER_NAME });
    }

    if (request.action !== "upload_part" || !validateId_(request.backup_id)) {
      return json_({ ok: false, error: "Invalid upload request." });
    }

    const part = Number(request.part_number);
    const total = Number(request.total_parts);
    if (!Number.isInteger(part) || !Number.isInteger(total) ||
        total < 1 || total > MAX_PARTS || part < 1 || part > total) {
      return json_({ ok: false, error: "Invalid part numbering." });
    }

    const bytes = Utilities.base64Decode(request.content_base64 || "");
    if (!bytes.length || bytes.length > MAX_PART_BYTES) {
      return json_({ ok: false, error: "Invalid part size." });
    }
    const digest = sha256_(bytes);
    if (!constantTimeEqual_(digest, String(request.sha256 || "").toLowerCase())) {
      return json_({ ok: false, error: "Part checksum mismatch." });
    }

    const folder = getFolder_();
    const fileName = FILE_PREFIX + request.backup_id + "-part-" +
      String(part).padStart(4, "0") + "-of-" + String(total).padStart(4, "0") + ".gpgpart";
    const existing = folder.getFilesByName(fileName);
    if (existing.hasNext()) {
      const file = existing.next();
      if (file.getSize() !== bytes.length || sha256_(file.getBlob().getBytes()) !== digest) {
        return json_({ ok: false, error: "Conflicting part already exists." });
      }
    } else {
      const blob = Utilities.newBlob(bytes, "application/octet-stream", fileName);
      folder.createFile(blob);
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
      const manifestName = FILE_PREFIX + request.backup_id + ".manifest.json";
      const manifests = folder.getFilesByName(manifestName);
      if (!manifests.hasNext()) {
        const verifiedParts = parts.map(function (part) {
          const file = DriveApp.getFileById(part.file_id);
          return { name: part.name, size: part.size, sha256: sha256_(file.getBlob().getBytes()) };
        });
        const manifest = {
          backup_id: request.backup_id,
          created_at: new Date().toISOString(),
          encrypted: true,
          part_count: total,
          parts: verifiedParts
        };
        folder.createFile(manifestName, JSON.stringify(manifest, null, 2), MimeType.PLAIN_TEXT);
      }
      finalized = true;
      applyRetention_(folder);
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
