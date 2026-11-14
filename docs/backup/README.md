# Green Dream backup system

> **Canonical implementation:** [PR #20 — Green Dream encrypted Google Drive backup and recovery (resumable Apps Script)](https://github.com/iYakuza/landing-page/pull/20). Continue development in this PR and its `backup/apps-script-transfer-redesign` branch. Do not create another transfer architecture or parallel backup PR. The selected transfer is the existing Apps Script receiver using 4 MiB encrypted chunks; no new Google OAuth client, refresh token, or rclone configuration is required. Earlier alternatives are closed and retained only as history.

For the offline content-recovery website, portable ZIP artifact, and authenticated recovery workflow, see [CONTENT-RECOVERY.md](CONTENT-RECOVERY.md).

This workflow creates an encrypted snapshot of the Green Dream Supabase project and stores it in the user's private Google Drive. **A live hosted recovery drill succeeded on 14 November 2026** using backup `system-20261113T000000Z-428ddefb` and the separate destination project `green-dream-restore-drill-2` (`ioguymqdeuuursizifnn`). A separate Cloudflare Pages recovery preview is now deployed at https://green-dream-recovery-preview.pages.dev. This proves that the selected archive can be restored and the recovered frontend can be served in an isolated environment; it does not yet prove a fully independent production failover.

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
- Scheduled full backups remain disabled by design. Use manual dispatch only unless the owner explicitly chooses otherwise.

## One-time setup

### 1. Update the existing Google Apps Script receiver

The existing **Green Dream Backup Receiver** project and its private Drive folder are the destination. Do not create a second project, create a second folder, reset the token, or change the folder ID. The repository's `google-apps-script/README.md` contains the controlled update procedure. After the code passes validation and deployment is explicitly authorised, update the existing project and deploy a new version while preserving its existing web-app URL and Script Properties.

The web-app endpoint must be reachable by GitHub Actions. The shared token is required for upload, inventory, listing, and download operations; no backup metadata or file contents are returned without authentication.

### 2. Configure read-only direct Drive downloads (recommended)

The faster recovery path downloads encrypted part files directly from the Google Drive API, rather than relaying base64 through Apps Script. Use Workload Identity Federation so GitHub Actions receives short-lived credentials without storing a long-lived private key. Google recommends this over service-account keys for workloads running outside Google Cloud. <Cite refs={["turn668478search0","turn460889search1"]}/>

1. In Google Cloud Console, create or select a project and enable the **Google Drive API** and **IAM Service Account Credentials API**.
2. Create a dedicated service account with no project-level roles. Share only the existing **Green Dream Backups** Drive folder with its email address as **Viewer**.
3. Configure a Workload Identity Pool and GitHub provider using issuer `https://token.actions.githubusercontent.com`. Map `google.subject=assertion.sub` and `attribute.repository=assertion.repository`. Restrict the provider condition to repository `iYakuza/landing-page` and the `main` and `backup/apps-script-transfer-redesign` branches.
4. Grant that repository principal `roles/iam.workloadIdentityUser` on the dedicated service account. Do not grant the service account Drive-wide roles.
5. In GitHub **Settings → Secrets and variables → Actions → Variables**, add:
   - `GOOGLE_DRIVE_WIF_PROVIDER` = the full provider resource name, for example `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`.
   - `GOOGLE_DRIVE_READONLY_SERVICE_ACCOUNT_EMAIL` = the dedicated service account email.

The workflows request only the `drive.readonly` OAuth scope. The service account can read only files shared with it. The Apps Script inventory must also be updated and redeployed (step 1 above) so it returns the Drive file IDs used by direct downloads.

As an alternative only when Workload Identity Federation cannot be configured, create a JSON key for the same dedicated service account and save it as the optional secret `GOOGLE_DRIVE_READONLY_SERVICE_ACCOUNT_JSON`. It is a long-lived credential; store it only in GitHub Actions Secrets and rotate/delete it when no longer needed. Google recommends federation instead. <Cite refs={["turn460889search1","turn668478search0"]}/>

### 3. Add GitHub Actions secrets

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

## Operating the recovery system

The complete workflow is now proven end-to-end at the backup-download, decryption, Supabase restoration, and isolated frontend-preview level. Keep operations manual.

### Current verified recovery record

- Successful hosted restore: [GitHub Actions run #43597340381](https://github.com/iYakuza/landing-page/actions/runs/43597340381).
- Backup ID: `system-20261113T000000Z-428ddefb`.
- Destination: `green-dream-restore-drill-2`, project ref `ioguymqdeuuursizifnn`, region `eu-central-1`.
- Verified restore contents: 9 public application tables, 35 migration entries, 1 Auth user and identity, 4 Vault secrets, 3 Storage buckets, 10 Storage objects, and 7 Storage policies. Row counts, secret hashes, object checksums, and ownership metadata were checked.
- Recovery preview: https://green-dream-recovery-preview.pages.dev, deployed separately from production from branch `recovery-drill-preview`.
- Three drill-only Edge Functions are deployed: `poetry-submit`, `secure-your-soul-transmissions`, and `contact-about-role`. Their production-connected actions are disabled or guarded in the drill.
- The drill-only `poetry-submit` GET endpoint serves a bundled snapshot of the one published Poetry Archive item; it no longer calls the Webflow API or requires the Webflow token for archive reads. Non-GET write operations remain disabled on the drill.
- Restored media URLs in `vha_posts` and `poetry_submissions` now point to the drill project's own Storage buckets. The hosted restore workflow rewrites those absolute URLs after restoring the corresponding Storage objects, so future restores do not keep pointing to the source production project's hostname.
- The Human Archive still contains 140 catalogue entries whose original-record links point to WordPress. Its EGO portrait is also still hosted on WordPress until the one-time recovery asset import workflow is run. The recovery preview's posts page no longer accepts WordPress-hosted media URLs.
- The CMS Recovery Centre is a private launchpad to the manual workflows and runbook. It opens GitHub Actions; it does not dispatch a run or bypass GitHub confirmation.

### Manual operating sequence

1. **Create a full-system backup** using [Green Dream Google Drive backup](https://github.com/iYakuza/landing-page/actions/workflows/google-drive-backup.yml). Select `backup/apps-script-transfer-redesign` while PR #20 remains unmerged. Confirm that the run completes and the encrypted archive is recorded in the existing private Drive folder.
2. **Validate the archive** using [Validate Supabase backup restoration](https://github.com/iYakuza/landing-page/actions/workflows/validate-supabase-restore.yml). Select the completed `system-...` backup ID. This restores into a temporary local Supabase instance on the GitHub runner.
3. **Use content/media backup separately** when a fresh content and media snapshot is needed: [Green Dream content and media backup](https://github.com/iYakuza/landing-page/actions/workflows/google-drive-content-backup.yml).
4. **Restore only when required** using [Restore Green Dream into a fresh Supabase project](https://github.com/iYakuza/landing-page/actions/workflows/restore-supabase-backup.yml). Select `backup/apps-script-transfer-redesign`, provide the chosen backup ID, and confirm a NEW, EMPTY destination. Never rerun against `green-dream-restore-drill-2`: it already contains restored data and is not an empty target.
5. **Rebuild and test the website separately.** Use the isolated recovery preview as a reference. Check pages, archive data, media, authentication, and each integration. Do not connect the drill to live email delivery or public publishing.

### Branch and scheduling rules

- PR #20 remains open, draft, and unmerged. The current restore implementation is on `backup/apps-script-transfer-redesign`; the `main` copy of the restore workflow is a registration stub used to make the workflow visible in GitHub Actions.
- Restore is manual-only and always requires the fresh-target confirmation.
- Scheduled full backups remain disabled. Do not set `BACKUP_ENABLED=true` or enable a schedule unless the owner explicitly changes this preference.
- No Drive retention or automatic cleanup is configured. Preserve existing encrypted backups.

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
- The workflow is a separate-project restore, not a project clone: deployed Edge Function source is included in the encrypted archive, but functions are not automatically deployed to the destination. Project-level dashboard settings and Edge Function runtime secret values still need separate configuration. After restoring Storage objects, it also rewrites the absolute media URLs in `vha_posts` and `poetry_submissions` to the destination project's public Storage URLs, using the verified object paths.

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

A hosted restoration was completed successfully on 14 November 2026. The restore run and independently checked result are recorded in [HOSTED-RECOVERY-DRILL-2026-11-14.md](HOSTED-RECOVERY-DRILL-2026-11-14.md). A successful restore is a verified milestone, not a claim that every third-party integration or project-level setting is automatically recovered.

## Known recovery limitations

- Auth users and identities are restored, but sessions, MFA factors, and audit history are not.
- Checked-in Edge Function source is preserved in the Git bundle. The live deployed functions matched those files at the 13 November 2026 audit, but future dashboard-only edits will not be captured unless committed to the repository. The restore workflow does not deploy functions automatically. Edge Function runtime secret values are not exported; the archive records variable names only. Preserve the actual values separately in a password manager or secure configuration record.
- Supabase project-level settings such as Auth provider configuration, API keys, database credentials, domains, DNS, and other dashboard settings are not included. Reconfigure these separately during recovery.
- Backups created before type-prefixed IDs use the legacy untyped ID format. Select those explicitly by ID; automatic selection deliberately ignores them to avoid mixing content-only and full-system archives.
- Supabase-managed Storage ownership, built-in ACLs, and RLS flags are provisioned by the destination Supabase project. The restore process preserves custom Storage policies and verifies the managed settings rather than attempting to change Supabase-owned table privileges.
- The current live migration ledger has 33 entries, while the repository contains only two historical migration files. The backup preserves the live ledger and a current schema/data snapshot; it does not claim to reconstruct missing migration SQL.
- The current Edge Functions may depend on legacy platform-injected environment variables. This backup project does not migrate those functions or rotate their credentials.
- The recovery drill's read-only Poetry Archive response is a checked-in static snapshot of the single published Webflow item captured on 14 November 2026. Production publication still uses the existing Webflow integration; the drill's write path is blocked and cannot publish to Webflow.
- The WordPress Human Archive catalogue remains a navigational index to original WordPress records. The separate content/media backup exports published WordPress post bodies and media into the encrypted content archive and offline recovery-site artifact; that export is not yet wired into the live recovery preview's Human Archive navigation.

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
