# Green Dream Google Drive receiver

This is a private, owner-operated Google Apps Script web app. GitHub Actions sends an already-encrypted archive in 4 MiB parts directly to the deploying owner's private Google Drive through resumable upload sessions. The receiver creates a completion manifest only after every part has been verified.

## Transfer architecture

- GitHub Actions creates and verifies the encrypted archive locally.
- The authenticated Apps Script receiver creates Google Drive resumable-upload sessions in one batch. It does not receive or relay archive bytes.
- GitHub Actions uploads the 4 MiB encrypted parts directly to Google Drive, with up to six concurrent transfers.
- Each part remains a separate immutable Drive file. The existing manifest format, part hashes, whole-archive SHA-256, resume behavior, and recovery download path are preserved.
- If a transfer response is lost, the uploader asks the receiver to check the immutable part name and checksum before opening a replacement session.
- The receiver creates the completion manifest only after every stored part has been re-read and verified.
- Upload progress reports completed parts, verified MB, percentage, average throughput, and elapsed time.

This removes Apps Script from the large-payload data path. Apps Script only authenticates the request and creates Drive upload sessions; the encrypted bytes travel directly from the GitHub runner to Google Drive.

The Apps Script project requires the Drive and external-request OAuth scopes declared in `appsscript.json`. The web app runs as its owner, so the owner must approve the updated scopes when deploying the new version.


## Non-destructive storage policy

- The receiver never trashes, deletes, renames, or overwrites Drive files.
- It does not apply automatic retention or orphan cleanup.
- Existing backup files and the configured folder ID are left untouched.
- Each new archive uses a unique content-derived backup ID and immutable part names.
- A completion manifest is created only after every part is present and its SHA-256 has been verified.

## Actions

- `ping`: authenticated connectivity check.
- `list_upload_parts`: returns the already stored part numbers and hashes for a resumable upload.
- `create_upload_sessions`: validates part metadata and creates direct-to-Drive resumable upload sessions; it never receives archive bytes.
- `upload_part`: retained for compatibility with earlier uploader versions.
- `finalize_backup`: verifies every stored part and writes the completion manifest.
- `list_backups`: lists completed backup metadata only.
- `download_part`: returns one encrypted part after checking it against the manifest.

The receiver accepts a maximum of 400 parts per backup, with each part limited to 4 MiB (up to approximately 1.56 GiB per archive). All requests require the high-entropy `INGEST_TOKEN`.

## Updating the existing Apps Script project

The repository source does not automatically update the deployed Apps Script project. Do not create a new deployment or change Script Properties. When the code has passed review and the owner authorizes deployment:

1. Open the existing **Green Dream Backup Receiver** project at https://script.google.com/home.
2. Replace the contents of `Code.gs` with this repository version.
3. In **Project Settings**, enable **Show "appsscript.json" manifest file in editor** if it is hidden.
4. Replace `appsscript.json` with this repository version. It adds the `script.external_request` scope needed to create Drive upload sessions.
5. Save the project. When prompted, approve the additional Google authorization scope for external requests.
6. Keep the existing `INGEST_TOKEN` and `BACKUP_FOLDER_ID` Script Properties unchanged.
7. Choose **Deploy → Manage deployments**.
8. Edit the existing web-app deployment, select **New version**, and deploy.
9. Keep the existing deployment URL unchanged.

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
