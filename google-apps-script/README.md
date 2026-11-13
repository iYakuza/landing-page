# Green Dream Google Drive receiver

This is a private, owner-operated Google Apps Script web app. GitHub Actions sends an already-encrypted archive in 4 MiB chunks. The receiver stores the chunks in the deploying owner's private Google Drive and creates a completion manifest only after every part has been verified.

## Why this version is faster

- The previous sender used 1 MiB chunks.
- The previous receiver rescanned the backup folder and checked earlier parts after every upload request.
- This version uses 4 MiB chunks, checks only the exact requested filename during each upload, and verifies all parts once in a separate finalization request.
- A stable backup ID and authenticated part inventory let a rerun skip chunks that are already stored.
- Transient network errors are retried with backoff.

## Non-destructive storage policy

- The receiver never trashes, deletes, renames, or overwrites Drive files.
- It does not apply automatic retention or orphan cleanup.
- Existing backup files and the configured folder ID are left untouched.
- Each new archive uses a unique content-derived backup ID and immutable part names.
- A completion manifest is created only after every part is present and its SHA-256 has been verified.

## Actions

- `ping`: authenticated connectivity check.
- `list_upload_parts`: returns the already stored part numbers and hashes for a resumable upload.
- `upload_part`: stores one encrypted part or confirms an identical retry.
- `finalize_backup`: verifies every stored part and writes the completion manifest.
- `list_backups`: lists completed backup metadata only.
- `download_part`: returns one encrypted part after checking it against the manifest.

The receiver accepts a maximum of 400 parts per backup, with each part limited to 4 MiB (up to approximately 1.56 GiB per archive). All requests require the high-entropy `INGEST_TOKEN`.

## Updating the existing Apps Script project

The repository source does not automatically update the deployed Apps Script project. Do not create a new deployment or change Script Properties. When the code has passed review and the owner authorizes deployment:

1. Open the existing **Green Dream Backup Receiver** project at https://script.google.com/home.
2. Replace the contents of `Code.gs` with this repository version.
3. Keep the existing `INGEST_TOKEN` and `BACKUP_FOLDER_ID` Script Properties unchanged.
4. Choose **Deploy → Manage deployments**.
5. Edit the existing web-app deployment, select **New version**, and deploy.
6. Keep the existing deployment URL unchanged.

The app runs as its owner. The web-app endpoint may be reachable publicly, but every operation requires the secret token. Never paste that token into chat or commit it.

## Validation

Run:

```bash
node --check < google-apps-script/Code.gs
node google-apps-script/test_receiver.js
python3 scripts/test_upload_apps_script_backup.py
python3 scripts/test_download_apps_script_backup.py
```

Local tests use mocks and do not access the owner's Google Drive. A real authenticated upload and independent recovery drill are still required before scheduled backups are enabled.
