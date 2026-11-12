# Green Dream content recovery website

## What the generated website does

Every successful run of **Green Dream content and media backup** now generates an offline, read-only recovery website inside the encrypted archive:

- `recovery-site/index.html` is the entry point.
- Published `vha_posts` records are included with their HTML content and publication metadata.
- Community submissions are included only when `status = 'published'` and `rights_confirmed = true`.
- Community transmissions are included only when `status = 'published'`, `rights_confirmed = true` and `publication_consent = true`.
- Media players and the media library use the backed-up files from public Supabase Storage buckets.
- Search and category filtering work locally in the browser.
- No connection to the original Supabase project or any third-party service is needed to browse the extracted copy.

The export deliberately excludes pending/failed submissions, unapproved transmissions, contact details, IP hashes, private Storage buckets and private bucket files. The viewer sanitizes rich-text content before rendering it.

## Get a portable website from a successful backup

The content-backup workflow also packages the viewer and its public media as a ZIP and uploads it as a GitHub Actions artifact named `green-dream-recovery-site-<run-id>`. It is retained for 30 days.

**Visibility:** the GitHub repository is public, so the recovery-site artifact must be treated as public too. It is intentionally limited to published posts, consent-approved published submissions, and files from public Storage buckets. Never add private backup archives, pending submissions, contact details, Auth data, Vault secrets, or private-bucket objects to this artifact.

1. Open the successful **Green Dream content and media backup** run in GitHub Actions.
2. Download the `green-dream-recovery-site-<run-id>` artifact.
3. Extract the ZIP without changing its folder structure.
4. Open `recovery-site/index.html` in a browser.

Keep the `storage/objects` folder beside `recovery-site`. The page loads backed-up images, audio and video from those relative paths. The package contains public media only; it does not contain the private encrypted backup archive.

## Recover the website package later from Google Drive

The repository includes an authenticated receiver download action, a downloader that verifies every part against the receiver manifest, and a manual **Recover Green Dream from private Google Drive backup** workflow. The workflow downloads the encrypted archive, decrypts it using the existing GitHub secret, verifies the archive's SHA-256 manifest, and publishes the portable website ZIP as a time-limited artifact.

The deployed Apps Script receiver must first be updated to the current `google-apps-script/Code.gs` and redeployed as a new version. Keep the existing Script Properties and deployment URL. After the recovery workflow is merged into the repository's default branch, it can be run from **Actions → Recover Green Dream from private Google Drive backup**. Leave the backup ID blank to recover the newest completed set, or provide a specific ID.

## What this is not

The recovery website is a content viewer, not a running copy of the original application. It does not restore the CMS, login, forms, moderation tools, analytics, Edge Functions, database writes or live Supabase integration.

The encrypted archive also preserves the complete Git repository history in `repository/landing-page.bundle`, plus the database schema/data and Storage objects. Rebuilding the original interactive site still requires provisioning a compatible Supabase project, restoring its database and Storage, redeploying Edge Functions, reconfiguring Auth and project settings, and supplying runtime secrets from their separate secure record. The current content archive is not a complete Supabase project image.

No website is automatically published publicly by these workflows. The recovery package is an artifact for download and offline use.
