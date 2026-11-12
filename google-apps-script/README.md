# Green Dream Google Drive receiver

This project is a private, owner-operated Google Apps Script web app. GitHub Actions sends it already-encrypted backup chunks. The script stores those chunks in a private Google Drive folder and keeps the 30 newest completed backup sets.

It replaces the separate Google OAuth client/refresh-token flow. The script owner authorizes Drive access once in Apps Script; GitHub Actions does not receive Google OAuth credentials or a Drive access token. Authenticated recovery requests can list completed backup metadata and download individual encrypted parts; the endpoint never exposes Drive file IDs or accepts unauthenticated reads.

## One-time browser setup

1. Open https://script.google.com/home and create a new standalone project named **Green Dream Backup Receiver**.
2. Replace the contents of `Code.gs` with this repository's `google-apps-script/Code.gs`.
3. Open **Project Settings** and enable **Show "appsscript.json" manifest file in editor**. Replace its contents with this repository's `google-apps-script/appsscript.json`.
4. In the editor, select and run `authorizeDriveAccess`. Approve the Google Drive access requested by your own script. This creates the private **Green Dream Backups** folder.
5. In **Project Settings → Script Properties**, add:
   - Property: `INGEST_TOKEN`
   - Value: a newly generated random secret of at least 40 characters. Generate it in a password manager; do not reuse a password.
6. Choose **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy and copy the URL ending in `/exec`.
7. Add two GitHub Actions repository secrets in `iYakuza/landing-page`:
   - `GOOGLE_DRIVE_INGEST_URL`: the deployed web app URL
   - `GOOGLE_DRIVE_INGEST_TOKEN`: the exact same random secret entered in Script Properties

Do not paste the token into chat, commit it, or put it in the script source. The receiver checks the token on every request. Uploaded files remain private in the deploying account's Drive.

## Local receiver tests

The repository includes `test_receiver.js`, an isolated Node.js test harness for authentication, weak-token configuration rejection, malformed input, checksum validation, duplicate retries, conflicting part counts, chunk completion, manifest checksums, authenticated backup listing, and integrity-checked part downloads. The validation workflow runs these tests without accessing the user's Google account or Drive.

## Safety and operating notes

- Only encrypted `.gpg` backup parts are uploaded.
- Each part is limited to 5 MiB and verified with SHA-256 before being stored.
- A manifest is created only after all parts of a backup set are present.
- The receiver retains the 30 newest completed backup sets.
- The receiver exposes only authenticated `list_backups` and `download_part` POST actions. Both require the same high-entropy token as uploads; downloads are checked against the completed manifest and each part's SHA-256 before bytes are returned.
- The recovery workflow can reassemble and decrypt an archive using existing GitHub Actions secrets, verify the file manifest, and publish a time-limited recovery-site artifact containing only the offline viewer and public media.
- Anyone can reach the web-app URL, but cannot write without the secret token. Treat the URL and token as credentials.
- Apps Script quotas and Google account policies still apply. This receiver is not yet production-validated until a real test upload and restore have succeeded.
