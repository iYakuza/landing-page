/**
 * Green Dream private backup receiver.
 * Accepts authenticated, already-encrypted chunks and stores them in Drive.
 * Upload requests are idempotent; completion is a separate verification step.
 * This version never deletes or trashes existing Drive files.
 */
const FOLDER_NAME = "Green Dream Backups";
const FILE_PREFIX = "greendream-backup-";
const TOKEN_PROPERTY = "INGEST_TOKEN";
const FOLDER_PROPERTY = "BACKUP_FOLDER_ID";
const MAX_PARTS = 400;
const PART_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_CHARS = 6 * 1024 * 1024;

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function constantTimeEqual_(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function getFolder_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty(FOLDER_PROPERTY);
  if (savedId) {
    try {
      return DriveApp.getFolderById(savedId);
    } catch (_) {
      throw new Error("The configured backup folder is unavailable; the saved folder setting was left unchanged.");
    }
  }
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty(FOLDER_PROPERTY, folder.getId());
  return folder;
}

function sha256_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map(function (b) { return (b + 256).toString(16).slice(-2); }).join("");
}

function validateId_(id) {
  return typeof id === "string" && /^(?:(?:system|content)-)?[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$/.test(id);
}

function isValidBase64_(value) {
  if (typeof value !== "string" || value.length < 4 ||
      value.length > Math.ceil(PART_BYTES / 3) * 4 + 8 ||
      value.length % 4 !== 0) return false;

  const length = value.length;
  const last = value.charCodeAt(length - 1);
  const secondLast = value.charCodeAt(length - 2);
  const padding = last === 61 ? (secondLast === 61 ? 2 : 1) : 0;
  const dataLength = length - padding;

  // Validate iteratively without regexes or per-character helper calls on large payloads.
  for (let i = 0; i < dataLength; i++) {
    const code = value.charCodeAt(i);
    if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
          (code >= 48 && code <= 57) || code === 43 || code === 47)) return false;
  }
  for (let i = dataLength; i < length; i++) {
    if (value.charCodeAt(i) !== 61) return false;
  }
  if (padding === 2 && dataLength % 4 !== 2) return false;
  if (padding === 1 && dataLength % 4 !== 3) return false;
  return true;
}

function uniqueFile_(folder, name) {
  const files = folder.getFilesByName(name);
  if (!files.hasNext()) return null;
  const file = files.next();
  if (files.hasNext()) throw new Error("A backup filename is duplicated; refusing to choose an ambiguous file.");
  return file;
}

function partName_(backupId, number, total) {
  return FILE_PREFIX + backupId + "-part-" + String(number).padStart(4, "0") +
    "-of-" + String(total).padStart(4, "0") + ".gpgpart";
}

function readManifest_(folder, backupId) {
  const file = uniqueFile_(folder, FILE_PREFIX + backupId + ".manifest.json");
  if (!file) return null;
  let manifest;
  try { manifest = JSON.parse(file.getBlob().getDataAsString()); }
  catch (_) { throw new Error("The existing completion manifest is malformed."); }
  if (!manifest || manifest.backup_id !== backupId || manifest.encrypted !== true ||
      !Number.isInteger(manifest.part_count) || manifest.part_count < 1 ||
      manifest.part_count > MAX_PARTS || !Array.isArray(manifest.parts) ||
      manifest.parts.length !== manifest.part_count) {
    throw new Error("The existing completion manifest is invalid.");
  }
  return manifest;
}

function listUploadParts_(folder, backupId, total) {
  const manifest = readManifest_(folder, backupId);
  if (manifest && manifest.part_count !== total) throw new Error("Completed backup has a different part count.");
  const existing = [];
  for (let number = 1; number <= total; number++) {
    const name = partName_(backupId, number, total);
    const file = uniqueFile_(folder, name);
    if (!file) continue;
    const bytes = file.getBlob().getBytes();
    existing.push({ part_number: number, size: bytes.length, sha256: sha256_(bytes) });
  }
  return { completed: !!manifest, parts: existing };
}

function listCompletedBackups_(folder) {
  const results = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (!file.getName().startsWith(FILE_PREFIX) || !file.getName().endsWith(".manifest.json")) continue;
    try {
      const manifest = JSON.parse(file.getBlob().getDataAsString());
      if (!manifest || !validateId_(manifest.backup_id) || manifest.encrypted !== true ||
          !Number.isInteger(manifest.part_count) || manifest.part_count < 1 ||
          manifest.part_count > MAX_PARTS || !Array.isArray(manifest.parts) ||
          manifest.parts.length !== manifest.part_count) continue;
      const parts = [];
      let totalBytes = 0;
      let valid = true;
      manifest.parts.forEach(function (part) {
        const match = typeof part.name === "string" &&
          part.name.match(/-part-([0-9]{4})-of-([0-9]{4})\.gpgpart$/);
        if (!match || Number(match[2]) !== manifest.part_count ||
            !Number.isInteger(part.size) || part.size < 1 ||
            !/^[a-f0-9]{64}$/.test(part.sha256 || "")) { valid = false; return; }
        parts.push({ part_number: Number(match[1]), size: part.size, sha256: part.sha256 });
        totalBytes += part.size;
      });
      if (!valid || parts.length !== manifest.part_count) continue;
      parts.sort(function (a, b) { return a.part_number - b.part_number; });
      for (let i = 0; i < parts.length; i++) if (parts[i].part_number !== i + 1) valid = false;
      if (!valid || (Number.isInteger(manifest.total_bytes) && manifest.total_bytes !== totalBytes)) continue;
      results.push({
        backup_id: manifest.backup_id,
        created_at: manifest.created_at || file.getDateCreated().toISOString(),
        encrypted: true,
        part_count: manifest.part_count,
        total_bytes: totalBytes,
        archive_sha256: manifest.archive_sha256 || null,
        parts: parts
      });
    } catch (_) {
      // Malformed manifests are ignored; they are never treated as download instructions.
    }
  }
  results.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
  return results;
}

function downloadBackupPart_(folder, backupId, partNumber) {
  const manifest = readManifest_(folder, backupId);
  if (!manifest || partNumber < 1 || partNumber > manifest.part_count) {
    return { ok: false, error: "Completed backup or requested part not found." };
  }
  const record = manifest.parts.find(function (item) {
    const match = typeof item.name === "string" && item.name.match(/-part-([0-9]{4})-of-([0-9]{4})\.gpgpart$/);
    return match && Number(match[1]) === partNumber && Number(match[2]) === manifest.part_count;
  });
  if (!record) return { ok: false, error: "Backup part is not listed in the completion manifest." };
  const file = uniqueFile_(folder, record.name);
  if (!file) return { ok: false, error: "Backup part is missing from Drive." };
  const bytes = file.getBlob().getBytes();
  const digest = sha256_(bytes);
  if (bytes.length !== record.size || digest !== record.sha256) {
    return { ok: false, error: "Stored backup part failed integrity verification." };
  }
  return {
    ok: true, backup_id: backupId, part_number: partNumber,
    total_parts: manifest.part_count, size: bytes.length,
    sha256: digest, content_base64: Utilities.base64Encode(bytes)
  };
}


function createDriveUploadSessions_(folder, backupId, total, requestedParts) {
  if (!Array.isArray(requestedParts) || requestedParts.length < 1 || requestedParts.length > MAX_PARTS) {
    throw new Error("Invalid upload session part list.");
  }
  const manifest = readManifest_(folder, backupId);
  if (manifest && manifest.part_count !== total) throw new Error("Completed backup part count conflicts.");
  const seen = {};
  const pending = [];
  const results = [];
  requestedParts.forEach(function (part) {
    if (!part || !Number.isInteger(part.part_number) || part.part_number < 1 ||
        part.part_number > total || !Number.isInteger(part.size) || part.size < 1 ||
        part.size > PART_BYTES || typeof part.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(part.sha256) || seen[part.part_number]) {
      throw new Error("Invalid upload session part metadata.");
    }
    seen[part.part_number] = true;
    const name = partName_(backupId, part.part_number, total);
    if (manifest) {
      const record = manifest.parts.find(function (item) { return item.name === name; });
      if (!record || record.size !== part.size || record.sha256 !== part.sha256) {
        throw new Error("Completed backup is immutable; requested part conflicts with its manifest.");
      }
      results.push({ part_number: part.part_number, already_present: true });
      return;
    }
    const existing = uniqueFile_(folder, name);
    if (existing) {
      const bytes = existing.getBlob().getBytes();
      if (bytes.length !== part.size || sha256_(bytes) !== part.sha256) {
        throw new Error("A conflicting part already exists; refusing to overwrite it.");
      }
      results.push({ part_number: part.part_number, already_present: true });
      return;
    }
    pending.push({ part_number: part.part_number, size: part.size, sha256: part.sha256, name: name });
  });

  if (pending.length) {
    const accessToken = ScriptApp.getOAuthToken();
    const requests = pending.map(function (part) {
      return {
        url: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,appProperties",
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          name: part.name,
          mimeType: "application/octet-stream",
          parents: [folder.getId()],
          appProperties: {
            backup_id: backupId,
            part_number: String(part.part_number),
            sha256: part.sha256
          }
        }),
        headers: {
          Authorization: "Bearer " + accessToken,
          "X-Upload-Content-Type": "application/octet-stream",
          "X-Upload-Content-Length": String(part.size)
        },
        muteHttpExceptions: true
      };
    });
    const responses = UrlFetchApp.fetchAll(requests);
    responses.forEach(function (response, index) {
      const part = pending[index];
      const status = response.getResponseCode();
      if (status !== 200 && status !== 201) {
        throw new Error("Google Drive could not initialise a resumable upload session (HTTP " + status + ").");
      }
      const headers = response.getAllHeaders();
      let sessionUrl = "";
      Object.keys(headers).some(function (key) {
        if (key.toLowerCase() === "location") {
          sessionUrl = String(headers[key]);
          return true;
        }
        return false;
      });
      if (sessionUrl.indexOf("https://www.googleapis.com/upload/drive/v3/files?") !== 0) {
        throw new Error("Google Drive returned an invalid resumable upload session.");
      }
      results.push({ part_number: part.part_number, already_present: false, session_url: sessionUrl });
    });
  }
  results.sort(function (a, b) { return a.part_number - b.part_number; });
  return results;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  let diagnosticStage = "read_request";
  try {
    const expectedToken = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY) || "";
    if (expectedToken.length < 40) return json_({ ok: false, error: "Receiver is not configured." });
    const raw = e && e.postData && e.postData.contents;
    if (typeof raw !== "string" || !raw || raw.length > MAX_REQUEST_CHARS) {
      return json_({ ok: false, error: "Invalid request size." });
    }
    let request;
    try { request = JSON.parse(raw); } catch (_) { return json_({ ok: false, error: "Invalid JSON request." }); }
    if (!request || typeof request !== "object" || Array.isArray(request) ||
        !constantTimeEqual_(request.token, expectedToken)) return json_({ ok: false, error: "Unauthorized." });

    diagnosticStage = "action:" + String(request.action || "missing");
    if (request.action === "ping") return json_({ ok: true, service: "Green Dream Drive receiver", folder: FOLDER_NAME });
    diagnosticStage = "resolve_drive_folder";
    const folder = getFolder_();
    diagnosticStage = "action:" + String(request.action || "missing") + ":folder_ready";

    // The active uploader transfers parts directly to Drive and GitHub Actions
    // serializes backup workflows. Finalization is idempotent (an existing matching
    // manifest is returned as success), so it must not wait on the Apps Script-wide
    // lock, which may be held by an unrelated execution.
    // Keep the lock only for the legacy upload_part endpoint, which writes via DriveApp.
    if (request.action === "upload_part") {
      diagnosticStage = "upload_part:acquire_write_lock";
      lock.waitLock(30000);
      lockAcquired = true;
    }

    if (request.action === "list_backups") {
      return json_({ ok: true, backups: listCompletedBackups_(folder) });
    }
    if (!validateId_(request.backup_id)) return json_({ ok: false, error: "Invalid backup ID." });

    if (request.action === "list_upload_parts") {
      diagnosticStage = "list_upload_parts:scan_existing_files";
      const total = request.total_parts;
      if (!Number.isInteger(total) || total < 1 || total > MAX_PARTS) return json_({ ok: false, error: "Invalid part count." });
      const state = listUploadParts_(folder, request.backup_id, total);
      return json_({ ok: true, backup_id: request.backup_id, total_parts: total, completed: state.completed, parts: state.parts });
    }

    if (request.action === "create_upload_sessions") {
      diagnosticStage = "create_upload_sessions:validate_metadata";
      const total = request.total_parts;
      if (!Number.isInteger(total) || total < 1 || total > MAX_PARTS) {
        return json_({ ok: false, error: "Invalid part count." });
      }
      diagnosticStage = "create_upload_sessions:create_google_drive_sessions";
      const sessions = createDriveUploadSessions_(folder, request.backup_id, total, request.parts);
      return json_({ ok: true, backup_id: request.backup_id, total_parts: total, sessions: sessions });
    }

    if (request.action === "upload_part") {
      diagnosticStage = "upload_part:validate_payload";
      const number = request.part_number, total = request.total_parts;
      if (!Number.isInteger(number) || !Number.isInteger(total) || total < 1 ||
          total > MAX_PARTS || number < 1 || number > total) return json_({ ok: false, error: "Invalid part numbering." });
      if (typeof request.content_base64 !== "string" ||
          request.content_base64.length > Math.ceil(PART_BYTES / 3) * 4 + 8 ||
          !isValidBase64_(request.content_base64)) {
        return json_({ ok: false, error: "Invalid part encoding." });
      }
      diagnosticStage = "upload_part:decode_payload";
      const bytes = Utilities.base64Decode(request.content_base64);
      if (!bytes.length || bytes.length > PART_BYTES) return json_({ ok: false, error: "Invalid part size." });
      diagnosticStage = "upload_part:calculate_checksum";
      const digest = sha256_(bytes);
      if (typeof request.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(request.sha256) ||
          !constantTimeEqual_(digest, request.sha256.toLowerCase())) return json_({ ok: false, error: "Part checksum mismatch." });

      const manifest = readManifest_(folder, request.backup_id);
      const name = partName_(request.backup_id, number, total);
      if (manifest) {
        if (manifest.part_count !== total) return json_({ ok: false, error: "Completed backup part count conflicts." });
        const record = manifest.parts.find(function (item) { return item.name === name; });
        if (!record || record.size !== bytes.length || record.sha256 !== digest) {
          return json_({ ok: false, error: "Completed backup is immutable; this part conflicts with its manifest." });
        }
        return json_({ ok: true, backup_id: request.backup_id, received_part: number, already_present: true });
      }
      const existing = uniqueFile_(folder, name);
      if (existing) {
        const stored = existing.getBlob().getBytes();
        if (stored.length !== bytes.length || sha256_(stored) !== digest) {
          return json_({ ok: false, error: "A conflicting part already exists." });
        }
        return json_({ ok: true, backup_id: request.backup_id, received_part: number, already_present: true });
      }
      diagnosticStage = "upload_part:write_drive_file";
      folder.createFile(Utilities.newBlob(bytes, "application/octet-stream", name));
      return json_({ ok: true, backup_id: request.backup_id, received_part: number, already_present: false });
    }

    if (request.action === "finalize_backup") {
      diagnosticStage = "finalize_backup:validate_metadata";
      const total = request.total_parts, expectedBytes = request.total_bytes;
      const archiveSha = request.archive_sha256;
      if (!Number.isInteger(total) || total < 1 || total > MAX_PARTS ||
          !Number.isInteger(expectedBytes) || expectedBytes < 1 ||
          typeof archiveSha !== "string" || !/^[a-f0-9]{64}$/.test(archiveSha)) {
        return json_({ ok: false, error: "Invalid finalization metadata." });
      }
      const existingManifest = readManifest_(folder, request.backup_id);
      if (existingManifest) {
        if (existingManifest.part_count !== total || existingManifest.total_bytes !== expectedBytes ||
            existingManifest.archive_sha256 !== archiveSha) return json_({ ok: false, error: "Completed backup metadata conflicts." });
        return json_({ ok: true, backup_id: request.backup_id, finalized: true, part_count: total, total_bytes: expectedBytes });
      }
      const parts = [];
      let actualBytes = 0;
      for (let number = 1; number <= total; number++) {
        const name = partName_(request.backup_id, number, total);
        const file = uniqueFile_(folder, name);
        if (!file) return json_({ ok: false, error: "Upload is incomplete; a backup part is missing." });
        const bytes = file.getBlob().getBytes();
        if (!bytes.length || bytes.length > PART_BYTES) return json_({ ok: false, error: "A stored backup part has an invalid size." });
        parts.push({ name: name, size: bytes.length, sha256: sha256_(bytes) });
        actualBytes += bytes.length;
      }
      if (actualBytes !== expectedBytes) return json_({ ok: false, error: "Uploaded backup size does not match the expected archive size." });
      diagnosticStage = "finalize_backup:write_manifest";
      const manifest = {
        backup_id: request.backup_id, created_at: new Date().toISOString(),
        encrypted: true, part_count: total, total_bytes: actualBytes,
        archive_sha256: archiveSha, parts: parts
      };
      folder.createFile(FILE_PREFIX + request.backup_id + ".manifest.json",
        JSON.stringify(manifest, null, 2), MimeType.PLAIN_TEXT);
      return json_({ ok: true, backup_id: request.backup_id, finalized: true, part_count: total, total_bytes: actualBytes });
    }

    if (request.action === "download_part") {
      if (!Number.isInteger(request.part_number) || request.part_number < 1 || request.part_number > MAX_PARTS) {
        return json_({ ok: false, error: "Invalid download request." });
      }
      return json_(downloadBackupPart_(folder, request.backup_id, request.part_number));
    }
    return json_({ ok: false, error: "Unknown action." });
  } catch (err) {
    const detail = String(err && err.message || err);
    const stack = String(err && err.stack || "");
    // Diagnostic only: never log request bodies, tokens, archive data, or file contents.
    Logger.log("Backup receiver failure at stage [" + diagnosticStage + "]: " + detail);
    if (stack) Logger.log(stack);
    console.error("Backup receiver failure at stage [" + diagnosticStage + "]: " + detail);
    // Return a bounded diagnostic to the authenticated uploader. Never expose request data,
    // tokens, stack traces, or Drive file identifiers in the HTTP response.
    const safeDetail = detail
      .replace(/[A-Za-z0-9_-]{25,}/g, "[redacted]")
      .slice(0, 240);
    return json_({
      ok: false,
      error: "The receiver could not complete the request.",
      diagnostic: {
        stage: diagnosticStage,
        type: String(err && err.name || "Error").slice(0, 60),
        detail: safeDetail
      }
    });
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}

function authorizeDriveAccess() {
  const folder = getFolder_();
  Logger.log("Drive access is authorized. Backup folder is ready: " + folder.getName());
}

/**
 * Run manually once after deploying the direct-upload receiver.
 * This deliberately exercises UrlFetchApp so Google can request and grant
 * the script.external_request OAuth scope before a backup workflow runs.
 */
function authorizeDriveUploadAccess() {
  const response = UrlFetchApp.fetch(
    "https://www.googleapis.com/drive/v3/about?fields=user",
    {
      method: "get",
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }
  );
  const status = response.getResponseCode();
  if (status !== 200) {
    throw new Error("Google Drive upload authorisation check failed (HTTP " + status + ").");
  }
  Logger.log("Google Drive external-request access is authorised.");
}
