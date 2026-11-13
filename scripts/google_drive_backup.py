#!/usr/bin/env python3
"""Direct, dependency-free Google Drive backup transfer using the Drive v3 REST API.

Only Python's standard library is required. OAuth refresh-token credentials are
read from the process environment. Uploads use Drive resumable sessions.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_API = "https://www.googleapis.com/drive/v3"
UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files"
FOLDER_NAME = "Green Dream Backups"
PREFIX = "greendream-backup-"
MANIFEST_SUFFIX = ".json"
CHUNK_SIZE = 8 * 1024 * 1024  # Drive resumable chunks must be multiples of 256 KiB.
RETRIES = 6


class DriveError(RuntimeError):
    pass


def credentials():
    required = ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise DriveError("Missing GitHub Actions secrets: " + ", ".join(missing))
    return {name: os.environ[name] for name in required}


def access_token():
    values = urllib.parse.urlencode({
        **credentials(),
        "grant_type": "refresh_token",
    }).encode()
    request = urllib.request.Request(
        TOKEN_URL, data=values, method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as exc:
        # Do not print Google's response body; it can contain credential details.
        raise DriveError(f"Google OAuth refresh failed (HTTP {exc.code}); check the OAuth secrets and consent status.") from None
    token = payload.get("access_token")
    if not token:
        raise DriveError("Google OAuth did not return an access token.")
    return token


def request_json(url, token, method="GET", body=None, headers=None, timeout=60):
    merged = {"Authorization": "Bearer " + token, **(headers or {})}
    data = json.dumps(body).encode() if body is not None else None
    if body is not None:
        merged.setdefault("Content-Type", "application/json; charset=UTF-8")
    req = urllib.request.Request(url, data=data, method=method, headers=merged)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}, response.headers
    except urllib.error.HTTPError as exc:
        detail = exc.read(1200).decode("utf-8", "replace")
        raise DriveError(f"Google Drive API returned HTTP {exc.code}: {detail}") from None


def find_or_create_folder(token):
    query = (
        "name = '" + FOLDER_NAME.replace("'", "\\'") +
        "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    )
    params = urllib.parse.urlencode({
        "q": query, "spaces": "drive", "pageSize": "100",
        "fields": "files(id,name,mimeType)",
    })
    result, _ = request_json(DRIVE_API + "/files?" + params, token)
    matches = [item for item in result.get("files", []) if item.get("name") == FOLDER_NAME]
    if len(matches) > 1:
        raise DriveError("More than one matching backup folder exists. Resolve the duplicate folders before proceeding.")
    if matches:
        return matches[0]["id"]
    result, _ = request_json(
        DRIVE_API + "/files?fields=id,name", token, method="POST",
        body={"name": FOLDER_NAME, "mimeType": "application/vnd.google-apps.folder"},
    )
    if not result.get("id"):
        raise DriveError("Google Drive did not return the new backup folder ID.")
    return result["id"]


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def md5_file(path):
    digest = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def start_resumable_upload(token, metadata, size):
    req = urllib.request.Request(
        UPLOAD_API + "?uploadType=resumable&fields=id,name,size,md5Checksum,createdTime",
        data=json.dumps(metadata).encode(), method="POST",
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "application/octet-stream",
            "X-Upload-Content-Length": str(size),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            location = response.headers.get("Location")
    except urllib.error.HTTPError as exc:
        raise DriveError(f"Could not start Google Drive resumable upload (HTTP {exc.code}).") from None
    if not location or not location.startswith("https://www.googleapis.com/upload/drive/v3/"):
        raise DriveError("Google Drive returned an unexpected resumable upload URL.")
    return location


def query_upload_offset(session_url, token, total):
    req = urllib.request.Request(
        session_url, data=b"", method="PUT",
        headers={
            "Authorization": "Bearer " + token,
            "Content-Length": "0",
            "Content-Range": f"bytes */{total}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            payload = response.read()
            return total, json.loads(payload) if payload else None
    except urllib.error.HTTPError as exc:
        if exc.code == 308:
            received = exc.headers.get("Range", "")
            if received.startswith("bytes=0-"):
                return int(received.rsplit("-", 1)[1]) + 1, None
            return 0, None
        detail = exc.read(800).decode("utf-8", "replace")
        raise DriveError(f"Could not resume Drive upload (HTTP {exc.code}): {detail}") from None


def upload_resumable(token, folder_id, archive):
    total = archive.stat().st_size
    if total <= 0:
        raise DriveError("Refusing to upload an empty archive.")
    metadata = {
        "name": archive.name,
        "mimeType": "application/octet-stream",
        "parents": [folder_id],
    }
    expected_md5 = md5_file(archive)
    session = start_resumable_upload(token, metadata, total)
    offset = 0
    result = None
    with archive.open("rb") as stream:
        while offset < total:
            stream.seek(offset)
            chunk = stream.read(min(CHUNK_SIZE, total - offset))
            if not chunk:
                raise DriveError("Unexpected end of local archive while uploading.")
            end = offset + len(chunk) - 1
            req = urllib.request.Request(
                session, data=chunk, method="PUT",
                headers={
                    "Content-Type": "application/octet-stream",
                    "Content-Length": str(len(chunk)),
                    "Content-Range": f"bytes {offset}-{end}/{total}",
                },
            )
            for attempt in range(RETRIES):
                try:
                    with urllib.request.urlopen(req, timeout=180) as response:
                        result = json.loads(response.read())
                        offset = total
                    break
                except urllib.error.HTTPError as exc:
                    if exc.code == 308:
                        received = exc.headers.get("Range", "")
                        new_offset = int(received.rsplit("-", 1)[1]) + 1 if received.startswith("bytes=0-") else 0
                        if new_offset <= offset and attempt == RETRIES - 1:
                            raise DriveError("Drive resumable upload stopped making progress.") from None
                        offset = new_offset
                        break
                    if exc.code in (408, 429, 500, 502, 503, 504):
                        if attempt == RETRIES - 1:
                            raise DriveError(f"Drive upload failed after retries (HTTP {exc.code}).") from None
                        time.sleep(min(2 ** attempt, 20))
                        offset, result = query_upload_offset(session, token, total)
                        if result:
                            break
                        continue
                    detail = exc.read(1000).decode("utf-8", "replace")
                    raise DriveError(f"Drive upload failed (HTTP {exc.code}): {detail}") from None
                except (TimeoutError, OSError, urllib.error.URLError):
                    if attempt == RETRIES - 1:
                        raise DriveError("Drive upload connection failed after retries.") from None
                    time.sleep(min(2 ** attempt, 20))
                    offset, result = query_upload_offset(session, token, total)
                    if result:
                        break
            if result:
                break
            percent = min(100, int(offset * 100 / total))
            print(f"Drive upload: {percent}% ({offset:,}/{total:,} bytes)", flush=True)

    if not result or not result.get("id"):
        # A final status query handles the case where the last PUT response was lost.
        offset, result = query_upload_offset(session, token, total)
    if not result or not result.get("id"):
        raise DriveError("Drive did not confirm completion of the resumable upload.")
    if int(result.get("size", -1)) != total:
        raise DriveError("Google Drive uploaded size does not match the local archive.")
    remote_md5 = result.get("md5Checksum")
    if not remote_md5 or remote_md5.lower() != expected_md5:
        raise DriveError("Google Drive MD5 checksum does not match the local encrypted archive.")
    return result


def upload_file(token, folder_id, path):
    uploaded = upload_resumable(token, folder_id, path)
    print(f"Uploaded and verified: {uploaded['name']} ({int(uploaded['size']):,} bytes)")
    return uploaded


def list_files(token, folder_id):
    params = urllib.parse.urlencode({
        "q": f"'{folder_id}' in parents and trashed = false",
        "spaces": "drive", "pageSize": "1000",
        "orderBy": "createdTime desc",
        "fields": "nextPageToken,files(id,name,mimeType,size,md5Checksum,createdTime)",
    })
    files = []
    while True:
        result, _ = request_json(DRIVE_API + "/files?" + params, token)
        files.extend(result.get("files", []))
        next_token = result.get("nextPageToken")
        if not next_token:
            return files
        params = urllib.parse.urlencode({
            "q": f"'{folder_id}' in parents and trashed = false",
            "spaces": "drive", "pageSize": "1000", "orderBy": "createdTime desc",
            "pageToken": next_token,
            "fields": "nextPageToken,files(id,name,mimeType,size,md5Checksum,createdTime)",
        })


def download_file(token, file_id, destination):
    url = DRIVE_API + "/files/" + urllib.parse.quote(file_id, safe="") + "?alt=media"
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    temp = destination.with_name(destination.name + ".partial")
    temp.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(req, timeout=180) as response, temp.open("wb") as out:
            while True:
                block = response.read(4 * 1024 * 1024)
                if not block:
                    break
                out.write(block)
        if not temp.is_file() or temp.stat().st_size <= 0:
            raise DriveError("Google Drive returned an empty backup file.")
        temp.replace(destination)
    except Exception:
        temp.unlink(missing_ok=True)
        raise


def upload_command(args):
    archive = args.archive.resolve()
    if not archive.is_file():
        raise DriveError("Encrypted archive does not exist.")
    token = access_token()
    folder_id = find_or_create_folder(token)
    uploaded = upload_file(token, folder_id, archive)
    manifest = {
        "format": "green-dream-drive-backup-v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "archive_name": uploaded["name"],
        "drive_file_id": uploaded["id"],
        "bytes": int(uploaded["size"]),
        "md5": uploaded["md5Checksum"].lower(),
        "sha256": sha256_file(archive),
        "encrypted": True,
    }
    manifest_path = archive.with_suffix(archive.suffix + ".manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    upload_file(token, folder_id, manifest_path)
    manifest_path.unlink(missing_ok=True)
    print("Completion manifest published after remote checksum verification.")


def download_command(args):
    token = access_token()
    folder_id = find_or_create_folder(token)
    files = list_files(token, folder_id)
    manifests = [f for f in files if f.get("name", "").startswith(PREFIX) and f["name"].endswith(MANIFEST_SUFFIX)]
    selected = None
    for item in manifests:
        try:
            temp_manifest = pathlib.Path(args.output).with_suffix(".manifest.tmp")
            download_file(token, item["id"], temp_manifest)
            manifest = json.loads(temp_manifest.read_text(encoding="utf-8"))
            temp_manifest.unlink(missing_ok=True)
            archive = next((f for f in files if f.get("id") == manifest.get("drive_file_id")), None)
            if (manifest.get("format") == "green-dream-drive-backup-v1"
                    and manifest.get("encrypted") is True and archive
                    and archive.get("name") == manifest.get("archive_name")
                    and int(archive.get("size", -1)) == manifest.get("bytes")
                    and archive.get("md5Checksum", "").lower() == manifest.get("md5", "").lower()):
                selected = (manifest, archive)
                break
        except (OSError, ValueError, TypeError, DriveError):
            try:
                temp_manifest.unlink(missing_ok=True)
            except (UnboundLocalError, OSError):
                pass
            continue
    if not selected:
        raise DriveError("No valid completed encrypted backup manifest was found in Google Drive.")
    manifest, archive = selected
    destination = pathlib.Path(args.output).resolve()
    download_file(token, archive["id"], destination)
    if destination.stat().st_size != manifest["bytes"] or md5_file(destination) != manifest["md5"]:
        destination.unlink(missing_ok=True)
        raise DriveError("Downloaded backup failed size or MD5 verification.")
    if sha256_file(destination) != manifest["sha256"]:
        destination.unlink(missing_ok=True)
        raise DriveError("Downloaded backup failed SHA-256 verification.")
    print(f"Downloaded and verified {archive['name']} ({manifest['bytes']:,} bytes).")


def main():
    parser = argparse.ArgumentParser(description="Direct private Google Drive backup transfer (Python standard library only).")
    sub = parser.add_subparsers(dest="command", required=True)
    upload = sub.add_parser("upload", help="resumable upload of one encrypted archive")
    upload.add_argument("archive", type=pathlib.Path)
    upload.set_defaults(func=upload_command)
    download = sub.add_parser("download", help="download and verify the newest completed backup")
    download.add_argument("--output", required=True)
    download.set_defaults(func=download_command)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Google Drive backup failed: {exc}", file=sys.stderr)
        sys.exit(1)
