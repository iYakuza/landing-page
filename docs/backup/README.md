# Green Dream backup system

> **Canonical implementation:** [PR #20 — Green Dream encrypted Google Drive backup and recovery (resumable Apps Script)](https://github.com/iYakuza/landing-page/pull/20). Continue development in this PR and its `backup/apps-script-transfer-redesign` branch. Do not create another transfer architecture or parallel backup PR. The selected transfer is the existing Apps Script receiver using 4 MiB encrypted chunks; no new Google OAuth client, refresh token, or rclone configuration is required. Earlier alternatives are closed and retained only as history.

For the offline content-recovery website, portable ZIP artifact, and authenticated recovery workflow, see [CONTENT-RECOVERY.md](CONTENT-RECOVERY.md).

This workflow is designed to create an encrypted snapshot of the Green Dream Supabase project and store it in the user's private Google Drive. It is not operational until the Apps Script receiver and GitHub Actions secrets are configured and a real backup plus recovery test succeeds.

## What the backup captures

- Supabase database roles, application schema, and application data.
- The complete applied migration ledger, separately from the SQL dump. This preserves migration history; it does not recreate missing historical migration files.
- Supabase Auth users and identities, including password hashes. Active sessions, MFA factors, and Auth audit history are not restored.
- Supabase Vault secret values, re-encrypted under the destination project's Vault key during recovery.
- Storage bucket configuration, every bucket's objects, object metadata and ownership fields, custom Storage RLS policies, and a snapshot of managed Storage table security settings.
- A Git bundle containing repository history and checked-in Edge Function source. On 13 November 2026, all five deployed Edge Functions were compared with their checked-in `index.ts` files and matched byte-for-byte.
- An inventory of Edge Function environment variable names. Runtime secret values are not exported.

The full-system workflow creates a SHA-256 manifest, packages the snapshot, encrypts the archive with GPG AES-256, verifies that the encrypted archive can be decrypted and read, then uploads encrypted chunks to the Apps Script receiver. Full-system backups use `system-...` IDs; the separate content/media workflow uses `content-...` IDs. Restore tools filter by type so a content-only archive cannot be mistaken for a full Supabase snapshot.

## Security and operating boundaries

- GitHub Actions handles decrypted database, Auth, Vault, and media data temporarily on an ephemeral hosted runner so it can perform a full restore test before encryption. Treat GitHub Actions and the repository's secret store as part of the trusted security boundary.
- The receiver executes as the Google account that deploys it and stores files in that account's private Drive folder.
- The Apps Script web-app URL is publicly reachable, but each request must include a high-entropy shared token. The token is stored in Apps Script Script Properties and GitHub Actions repository secrets; it must never be committed or pasted into chat.
- Only encrypted archive chunks are uploaded to Drive. The receiver verifies each chunk's SHA-256 and creates a manifest after all parts are present. It does not apply retention or cleanup: existing Drive backup files are never automatically deleted.
- Apps Script and Google Drive quotas, account policies, and service availability apply. Google may restrict public web-app access or the receiver deployment. This is a deliberate no-OAuth-verification trade-off, not a guarantee of uninterrupted service.
- Keep the encryption passphrase in a password manager and maintain a separate secure recovery copy. Without it, the archive cannot be decrypted.
- Preferred recovery downloads use a dedicated Google service account with read-only access to only the existing backup folder. GitHub Actions requests the `drive.readonly` scope and downloads encrypted part files directly from the Drive API; the Apps Script relay remains as a fallback.
- The scheduled workflow remains disabled until the first live backup and recovery procedure have been verified.

## One-time setup

### 1. Update the existing Google Apps Script receiver

The existing **Green Dream Backup Receiver** project and its private Drive folder are the destination. Do not create a second project, create a second folder, reset the token, or change the folder ID. The repository's `google-apps-script/README.md` contains the controlled update procedure. After the code passes validation and deployment is explicitly authorised, update the existing project and deploy a new version while preserving its existing web-app URL and Script Properties.

The web-app endpoint must be reachable by GitHub Actions. The shared token is required for upload, inventory, listing, and download operations; no backup metadata or file contents are returned without authentication.

### 2. Add GitHub Actions secrets

In the repository, open **Settings → Secrets and variables → Actions**.

Add the repository variable:

- `BACKUP_ENABLED` = `false`. Keep it false until recovery is verified.

Add these repository secrets:

| Secret | Value |
|---|---|
| `SUPABASE_DB_URL` | PostgreSQL connection string from Supabase Dashboard → Connect. Use a compatible pooler connection if needed; URL-encode special characters in the password. |
| `SUPABASE_SECRET_KEY` | Current Supabase Secret API key from Settings → API Keys. Never publish it. |
| `GOOGLE_DRIVE_INGEST_URL` | The existing deployed Apps Script web-app URL ending in `/exec`. |
| `GOOGLE_DRIVE_INGEST_TOKEN` | The existing token stored as the Apps Script `INGEST_TOKEN` property. Do not rotate it as part of this update. |
| `GOOGLE_DRIVE_READONLY_SERVICE_ACCOUNT_JSON` | Optional: the complete JSON key for a dedicated Google service account shared as **Viewer** on only the **Green Dream Backups** folder. Enables direct binary Drive downloads. Never paste or commit the key. |
| `BACKUP_ENCRYPTION_PASSPHRASE` | A unique randomly generated passphrase of at least 32 characters. Store it in a password manager and keep a separate secure recovery copy. |

Do not paste any secret into ChatGPT, commit it, or include it in a public issue or pull request.

## First controlled run

The backup workflow supports manual dispatch from the `backup/` branch for the initial controlled test. This manual run does not require setting `BACKUP_ENABLED` to true. The scheduled run is restricted to `main` and requires `BACKUP_ENABLED=true`.

Before considering the system operational:

1. Confirm that the existing Apps Script receiver has been updated to the validated code while preserving its URL and Script Properties; confirm all listed GitHub Actions secrets are present. No new Google OAuth credentials are required.
2. Run **GitHub → Actions → Green Dream Google Drive backup → Run workflow**, selecting `main` after the PR is merged (or the consolidated backup branch before merge).
3. Confirm that the workflow completes the encrypted upload. Backup creation no longer depends on a Supabase restore test.
4. In the private Drive folder, confirm that the completed backup manifest and all referenced encrypted parts exist.
5. Run **Validate Supabase backup restoration** with the new `system-...` backup ID. This downloads the archive and performs a full restore into a disposable local Supabase instance. After the workflow is merged to `main`, this validation also runs automatically after successful scheduled or manual backups.
6. When a separate fresh hosted Supabase project is available, use **Restore Green Dream into a fresh Supabase project** for the hosted recovery drill. Confirm the website, CMS, authentication, submissions, and media.
7. Only after successful backup, local restore validation, and hosted recovery should the PR be considered for merge and the scheduled backup variable be enabled.

A passing CI test is not a substitute for the first live upload and independent recovery drill. Until those steps are complete, keep `BACKUP_ENABLED=false`.

## Dedicated Supabase restoration

Supabase restoration is deliberately separate from the Google Drive backup workflow. Creating and uploading a backup no longer depends on successfully restoring it into a local or hosted Supabase instance. This prevents a destination-specific PostgreSQL/Supabase compatibility problem from blocking creation of a valid encrypted backup.

The separate **Restore Green Dream into a fresh Supabase project** workflow (\`.github/workflows/restore-supabase-backup.yml\`) downloads and verifies a selected encrypted Drive backup, decrypts it only on an ephemeral GitHub Actions runner, checks that the destination is empty, and restores database roles/schema/data, migration history, Auth users and identities, Vault secrets, Storage policies, buckets, object bytes, and object ownership. It then runs the existing restore verification scripts.

### Safety rules

- Restore is manual only. It never runs on a schedule.
- It requires an explicit confirmation that the destination is a new, empty Supabase project.
- It refuses the known production project URL and checks the database hostname and username for the production project reference.
- It checks that application tables, Auth users/identities, Storage buckets/objects, and Vault secrets are empty before making changes.
- It never targets or modifies the production project intentionally. Never configure the restore secrets with production credentials.
- Decrypted data is removed from the ephemeral runner at the end of the job.
- The workflow is a separate-project restore, not a project clone: deployed Edge Function source is included in the encrypted archive, but functions are not automatically deployed to the destination. Project-level dashboard settings and Edge Function runtime secret values still need separate configuration.

The **Validate Supabase backup restoration** workflow is independent of backup creation. It can be dispatched manually against a completed `system-...` backup ID, or it runs automatically after a successful Google Drive backup on `main`. If the backup ID is omitted, it selects the newest completed `system-...` backup only; it will never select a `content-...` archive. It restores into a disposable local Supabase instance on the GitHub runner, checks the restored data, and then destroys only that temporary local instance. It does not modify production or require a second hosted project.

### Restore workflow credentials

The workflow reuses the existing Google Drive receiver and encryption secrets. It requires three destination-only GitHub Actions secrets:

| Secret | Purpose |
|---|---|
| \`SUPABASE_RESTORE_DB_URL\` | PostgreSQL connection string for the fresh destination project |
| \`SUPABASE_RESTORE_URL\` | URL of that same destination project |
| \`SUPABASE_RESTORE_SECRET_KEY\` | Destination project's secret/service key, used only to upload Storage objects |

These destination credentials are intentionally separate from \`SUPABASE_DB_URL\` and \`SUPABASE_SECRET_KEY\`, which belong to the production source and backup export. Do not reuse production credentials as restore credentials.

The workflow itself adds no paid service: it uses the existing GitHub Actions workflow, existing private Google Drive receiver, and a separate Supabase project. The destination project must remain within the available Supabase plan allowance; paid database backup/PITR features are not required by this workflow. GitHub Actions and Google/Supabase free-tier quotas and limits still apply.

A hosted restoration cannot be declared operational until a real backup has been restored successfully into a separate fresh project. The workflow file and passing automated tests alone do not prove that live restoration has succeeded.

## Known recovery limitations

- Auth users and identities are restored, but sessions, MFA factors, and audit history are not.
- Checked-in Edge Function source is preserved in the Git bundle. The live deployed functions matched those files at the 13 November 2026 audit, but future dashboard-only edits will not be captured unless committed to the repository. The restore workflow does not deploy functions automatically. Edge Function runtime secret values are not exported; the archive records variable names only. Preserve the actual values separately in a password manager or secure configuration record.
- Supabase project-level settings such as Auth provider configuration, API keys, database credentials, domains, DNS, and other dashboard settings are not included. Reconfigure these separately during recovery.
- Backups created before type-prefixed IDs use the legacy untyped ID format. Select those explicitly by ID; automatic selection deliberately ignores them to avoid mixing content-only and full-system archives.
- Supabase-managed Storage ownership, built-in ACLs, and RLS flags are provisioned by the destination Supabase project. The restore process preserves custom Storage policies and verifies the managed settings rather than attempting to change Supabase-owned table privileges.
- The current live migration ledger has 33 entries, while the repository contains only two historical migration files. The backup preserves the live ledger and a current schema/data snapshot; it does not claim to reconstruct missing migration SQL.
- The current Edge Functions may depend on legacy platform-injected environment variables. This backup project does not migrate those functions or rotate their credentials.

## Recovery outline

1. Download every encrypted part referenced by the Drive manifest and concatenate them in numeric part order.
2. Decrypt the archive using the separately stored passphrase.
3. Verify extracted files against `backup-manifest.json`.
4. Provision a compatible Supabase project and restore roles and schema.
5. Restore and verify the applied migration ledger.
6. Restore Auth users and identities into a fresh compatible Auth schema.
7. Enable Supabase Vault, restore secrets, and verify secret names and values.
8. Restore application data and custom Storage policies.
9. Recreate Storage buckets, upload objects, restore ownership metadata, and verify object checksums.
10. Deploy the checked-in Edge Functions and restore their runtime secrets from the separate secure record.
11. Reconfigure Auth providers, keys, domains, and other project-level settings.
12. Verify the website, CMS, authentication, submissions, and media before switching traffic.
