# Green Dream backup system

This workflow is designed to create an encrypted snapshot of the Green Dream Supabase project and store it in the user's private Google Drive. It is not operational until the Apps Script receiver and GitHub Actions secrets are configured and a real backup plus recovery test succeeds.

## What the backup captures

- Supabase database roles, application schema, and application data.
- The complete applied migration ledger, separately from the SQL dump. This preserves migration history; it does not recreate missing historical migration files.
- Supabase Auth users and identities, including password hashes. Active sessions, MFA factors, and Auth audit history are not restored.
- Supabase Vault secret values, re-encrypted under the destination project's Vault key during recovery.
- Storage bucket configuration, every bucket's objects, object metadata and ownership fields, custom Storage RLS policies, and a snapshot of managed Storage table security settings.
- A Git bundle containing repository history and checked-in Edge Function source.
- An inventory of Edge Function environment variable names. Runtime secret values are not exported.

The workflow creates a SHA-256 manifest, packages the snapshot, encrypts the archive with GPG AES-256, verifies that the encrypted archive can be decrypted and read, then uploads encrypted chunks to the Apps Script receiver.

## Security and operating boundaries

- GitHub Actions handles decrypted database, Auth, Vault, and media data temporarily on an ephemeral hosted runner so it can perform a full restore test before encryption. Treat GitHub Actions and the repository's secret store as part of the trusted security boundary.
- The receiver executes as the Google account that deploys it and stores files in that account's private Drive folder.
- The Apps Script web-app URL is publicly reachable, but each request must include a high-entropy shared token. The token is stored in Apps Script Script Properties and GitHub Actions repository secrets; it must never be committed or pasted into chat.
- Only encrypted archive chunks are uploaded to Drive. The receiver verifies each chunk's SHA-256 and creates a manifest after all parts are present. It retains the 30 newest completed backup sets.
- Apps Script and Google Drive quotas, account policies, and service availability apply. Google may restrict public web-app access or the receiver deployment. This is a deliberate no-OAuth-verification trade-off, not a guarantee of uninterrupted service.
- Keep the encryption passphrase in a password manager and maintain a separate secure recovery copy. Without it, the archive cannot be decrypted.
- The scheduled workflow remains disabled until the first live backup and recovery procedure have been verified.

## One-time setup

### 1. Create the Google Apps Script receiver

1. Open https://script.google.com/home and create a standalone project named **Green Dream Backup Receiver**.
2. Replace the project's `Code.gs` with the repository file `google-apps-script/Code.gs`.
3. In **Project Settings**, enable **Show "appsscript.json" manifest file in editor** and replace the manifest with `google-apps-script/appsscript.json`.
4. Select and run `authorizeDriveAccess`. Review and approve the Drive permission. This creates the private **Green Dream Backups** folder in the deploying account's Drive.
5. In **Project Settings → Script Properties**, create `INGEST_TOKEN` with a newly generated random secret of at least 40 characters. Generate it in a password manager; do not reuse a password.
6. Choose **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy and copy the URL ending in `/exec`.
7. If Google does not offer **Anyone** access for the account, stop here; do not weaken account security or make the Drive folder public.

The web-app endpoint must be reachable by GitHub Actions. The shared token protects write operations; the receiver does not provide a public file listing or download endpoint.

### 2. Add GitHub Actions secrets

In the repository, open **Settings → Secrets and variables → Actions**.

Add the repository variable:

- `BACKUP_ENABLED` = `false`. Keep it false until recovery is verified.

Add these repository secrets:

| Secret | Value |
|---|---|
| `SUPABASE_DB_URL` | PostgreSQL connection string from Supabase Dashboard → Connect. Use a compatible pooler connection if needed; URL-encode special characters in the password. |
| `SUPABASE_SECRET_KEY` | Current Supabase Secret API key from Settings → API Keys. Never publish it. |
| `GOOGLE_DRIVE_INGEST_URL` | The deployed Apps Script web-app URL ending in `/exec`. |
| `GOOGLE_DRIVE_INGEST_TOKEN` | The exact same random token stored as the Apps Script `INGEST_TOKEN` property. |
| `BACKUP_ENCRYPTION_PASSPHRASE` | A unique randomly generated passphrase of at least 32 characters. Store it in a password manager and keep a separate secure recovery copy. |

Do not paste any secret into ChatGPT, commit it, or include it in a public issue or pull request.

## First controlled run

The backup workflow supports manual dispatch from the `backup/` branch for the initial controlled test. This manual run does not require setting `BACKUP_ENABLED` to true. The scheduled run is restricted to `main` and requires `BACKUP_ENABLED=true`.

Before considering the system operational:

1. Configure the Apps Script receiver and all five GitHub Actions secrets.
2. Run **GitHub → Actions → Green Dream Google Drive backup → Run workflow**, selecting the backup branch.
3. Confirm that the workflow completes its disposable Supabase restore test and encrypted upload.
4. In the private Drive folder, confirm that the completed backup manifest and all referenced encrypted parts exist.
5. Perform a separate recovery drill: download the encrypted parts, reassemble the archive, decrypt it with the separately stored passphrase, verify the SHA-256 manifest, and restore into a fresh compatible Supabase project. Confirm the website, CMS, authentication, submissions, and media.
6. Only after successful recovery should the PR be considered for merge and the scheduled backup variable be enabled.

A passing CI test is not a substitute for the first live upload and independent recovery drill. Until those steps are complete, keep `BACKUP_ENABLED=false`.

## Known recovery limitations

- Auth users and identities are restored, but sessions, MFA factors, and audit history are not.
- Edge Function runtime secret values are not exported. The archive records variable names only; preserve the actual values separately in a password manager or secure configuration record.
- Supabase project-level settings such as Auth provider configuration, API keys, database credentials, domains, DNS, and other dashboard settings are not included. Reconfigure these separately during recovery.
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
