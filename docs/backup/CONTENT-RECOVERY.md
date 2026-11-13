# Green Dream content recovery website

## What the generated website does

Every successful run of **Green Dream content and media backup** now generates an offline, read-only recovery website inside the encrypted archive:

- `recovery-site/index.html` is the entry point.
- Published `vha_posts` records are included with their HTML content and publication metadata.
- Community submissions are included only when `status = 'published'` and `rights_confirmed = true`.
- Community transmissions are included only when `status = 'published'`, `rights_confirmed = true` and `publication_consent = true`.
- Supabase media players use backed-up files from public Storage buckets referenced by included published posts or approved submissions. The WordPress media library is listed as outbound links; its actual files are preserved in the encrypted archive.
- The viewer includes the full text of published WordPress posts and the original links to their media.
- Search and category filtering work locally in the browser.
- The text archive and locally backed-up Supabase media work offline; opening WordPress media links requires an internet connection.

The export deliberately excludes pending/failed submissions, unapproved transmissions, contact details, IP hashes, private Storage buckets, private bucket files, and unreferenced public-bucket objects. The encrypted archive also includes the live WordPress export: all 141 published posts and the 148-file media-library snapshot captured on 12 November 2026 (280,529,465 downloaded bytes). The recovery viewer displays WordPress post text and original media links; the actual WordPress media binaries remain inside the encrypted Drive archive and are not copied into the public GitHub artifact. The media inventory is a snapshot and should be refreshed when new unattached media is added to WordPress. The viewer sanitizes rich-text content before rendering it.

## Get a portable website from a successful backup

The content-backup workflow also packages the viewer and its public media as a ZIP and uploads it as a GitHub Actions artifact named `green-dream-recovery-site-<run-id>`. It is retained for 7 days. Previous recovery-site artifacts are not automatically deleted.

**Visibility:** the GitHub repository is public, so the recovery-site artifact must be treated as public too. It is intentionally limited to published posts, consent-approved published submissions, and files from public Storage buckets. Never add private backup archives, pending submissions, contact details, Auth data, Vault secrets, or private-bucket objects to this artifact.

1. Open the successful **Green Dream content and media backup** run in GitHub Actions.
2. Download the `green-dream-recovery-site-<run-id>` artifact.
3. Extract the ZIP without changing its folder structure.
4. Open `recovery-site/index.html` in a browser.

Keep the `storage/objects` folder beside `recovery-site`. The page loads backed-up images, audio and video from those relative paths. The package contains published text and public links only; it does not contain the private encrypted backup archive or the WordPress media binaries. You can also publish the extracted folder structure to a static web host; no server, database connection or API is required. Preserve the `recovery-site/` and `storage/objects/` sibling paths.

## Recover the website package later from Google Drive

The repository includes an authenticated receiver download action, a downloader that verifies every part against the receiver manifest, and a manual **Recover Green Dream from private Google Drive backup** workflow. The workflow downloads the encrypted archive, decrypts it using the existing GitHub secret, verifies the archive's SHA-256 manifest, and publishes the portable website ZIP as a time-limited artifact.

The existing deployed Apps Script receiver must first be updated to the current `google-apps-script/Code.gs` and redeployed as a new version. Keep the existing `INGEST_TOKEN`, `BACKUP_FOLDER_ID`, and deployment URL unchanged. After the recovery workflow is merged into the repository's default branch, it can be run from **Actions → Recover Green Dream from private Google Drive backup**. Leave the backup ID blank to recover the newest completed set, or provide a specific ID.

## What this is not

The recovery website is a content viewer, not a running copy of the original application. It does not restore the CMS, login, forms, moderation tools, analytics, Edge Functions, database writes or live Supabase integration.

The encrypted archive also preserves the complete Git repository history in `repository/landing-page.bundle`, plus the database schema/data and Storage objects. Rebuilding the original interactive site still requires provisioning a compatible Supabase project, restoring its database and Storage, redeploying Edge Functions, reconfiguring Auth and project settings, and supplying runtime secrets from their separate secure record. The current content archive is not a complete Supabase project image.

To reconstruct the checked-in website source from an extracted full archive, run this from the extracted archive's parent directory:

```bash
git clone repository/landing-page.bundle green-dream-source
```

That restores the repository history and files. It does not, by itself, reconnect the site to Supabase or restore runtime configuration; those are separate recovery steps described in the full backup guide.

No website is automatically published publicly by these workflows. The recovery package is an artifact for download and offline use.
