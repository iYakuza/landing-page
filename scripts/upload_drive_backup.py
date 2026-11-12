#!/usr/bin/env python3
"""Upload one encrypted archive to the app-managed Google Drive backup folder."""
import hashlib
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_API = "https://www.googleapis.com/drive/v3"
UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files"
FOLDER_NAME = "Green Dream Backups"
PREFIX = "greendream-backup-"

def http_json(url, method="GET", headers=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}, response.headers
    except urllib.error.HTTPError as exc:
        detail = exc.read(1000).decode("utf-8", "replace")
        raise RuntimeError(f"Google API returned HTTP {exc.code}: {detail}") from None

def access_token():
    values = urllib.parse.urlencode({
        "client_id": os.environ["GOOGLE_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
        "refresh_token": os.environ["GOOGLE_REFRESH_TOKEN"],
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=values, headers={
        "Content-Type": "application/x-www-form-urlencoded",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Google token refresh failed (HTTP {exc.code}); reauthorization may be required.") from None
    token = result.get("access_token")
    if not token:
        raise RuntimeError("Google did not return an access token.")
    return token

def find_or_create_folder(token):
    headers = {"Authorization": "Bearer " + token}
    q = "name = '" + FOLDER_NAME.replace("'", "\\'") + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    url = DRIVE_API + "/files?" + urllib.parse.urlencode({
        "q": q, "spaces": "drive", "pageSize": "100", "fields": "files(id,name)",
    })
    result, _ = http_json(url, headers=headers)
    folders = result.get("files", [])
    if folders:
        return folders[0]["id"]
    result, _ = http_json(DRIVE_API + "/files?fields=id,name", method="POST",
        headers={**headers, "Content-Type": "application/json"},
        body={"name": FOLDER_NAME, "mimeType": "application/vnd.google-apps.folder"})
    if not result.get("id"):
        raise RuntimeError("Google Drive did not return the backup folder ID.")
    return result["id"]

def upload_resumable(token, folder_id, archive):
    size = archive.stat().st_size
    digest = hashlib.md5()
    with archive.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    metadata = {"name": archive.name, "mimeType": "application/octet-stream", "parents": [folder_id]}
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
        with urllib.request.urlopen(req, timeout=60) as response:
            session_url = response.headers.get("Location")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Could not start Drive upload (HTTP {exc.code}).") from None
    if not session_url:
        raise RuntimeError("Google Drive did not provide a resumable upload URL.")
    offset = 0
    chunk_size = 8 * 1024 * 1024
    result = None
    with archive.open("rb") as stream:
        while offset < size:
            chunk = stream.read(min(chunk_size, size - offset))
            end = offset + len(chunk) - 1
            put = urllib.request.Request(session_url, data=chunk, method="PUT", headers={
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(chunk)),
                "Content-Range": f"bytes {offset}-{end}/{size}",
            })
            try:
                with urllib.request.urlopen(put, timeout=180) as response:
                    result = json.loads(response.read())
                    offset = size
            except urllib.error.HTTPError as exc:
                if exc.code != 308:
                    detail = exc.read(1000).decode("utf-8", "replace")
                    raise RuntimeError(f"Drive upload failed (HTTP {exc.code}): {detail}") from None
                received = exc.headers.get("Range", "")
                if received.startswith("bytes=0-"):
                    offset = int(received.rsplit("-", 1)[1]) + 1
                else:
                    offset = 0
                    stream.seek(0)
    if not result or not result.get("id"):
        raise RuntimeError("Drive upload finished without a file ID.")
    if int(result.get("size", -1)) != size:
        raise RuntimeError("Drive upload size verification failed.")
    if result.get("md5Checksum") and result["md5Checksum"].lower() != digest.hexdigest():
        raise RuntimeError("Drive upload checksum verification failed.")
    return result

def list_backups(token, folder_id):
    headers = {"Authorization": "Bearer " + token}
    q = f"'{folder_id}' in parents and name contains '{PREFIX}' and trashed = false"
    page_token = None
    files = []
    while True:
        params = {"q": q, "pageSize": "100", "orderBy": "createdTime desc",
                  "fields": "nextPageToken,files(id,name,createdTime,size)"}
        if page_token:
            params["pageToken"] = page_token
        result, _ = http_json(DRIVE_API + "/files?" + urllib.parse.urlencode(params), headers=headers)
        files.extend(result.get("files", []))
        page_token = result.get("nextPageToken")
        if not page_token:
            return files

def main():
    archive = pathlib.Path(sys.argv[1])
    if not archive.is_file():
        raise RuntimeError("Encrypted backup archive does not exist.")
    token = access_token()
    folder_id = find_or_create_folder(token)
    uploaded = upload_resumable(token, folder_id, archive)
    print(f"Verified Drive upload: {uploaded['name']} ({uploaded['size']} bytes)")
    backups = list_backups(token, folder_id)
    backups.sort(key=lambda item: item.get("createdTime", ""), reverse=True)
    for old in backups[30:]:
        http_json(DRIVE_API + "/files/" + urllib.parse.quote(old["id"], safe=""),
                  method="DELETE", headers={"Authorization": "Bearer " + token})
        print(f"Retention removed: {old.get('name', old['id'])}")
    print(f"Retention check complete: {min(len(backups), 30)} backups retained.")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Google Drive backup failed: {exc}", file=sys.stderr)
        sys.exit(1)
