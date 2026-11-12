# Green Dream backup system

This workflow creates a daily encrypted snapshot and uploads it to the app-managed **Green Dream Backups** folder in Google Drive. Backup payloads are never committed to this public repository.

## What is captured

- Supabase roles, application schema, and application data using the Supabase CLI.
- The Supabase migration ledger, separately from the SQL dump.
- Supabase Auth user and identity rows, exported separately because managed Auth schemas are excluded from the standard CLI schema dump. These files contain sensitive personal data and password hashes.
- Supabase Vault secret values, exported from the decrypted Vault view into the encrypted archive.
- Edge Function environment variable names (not their values), to provide a recovery inventory.
- All objects from the three current Storage buckets, plus bucket configuration, object metadata, custom Storage RLS policies, and the bucket/object RLS and ACL settings.
- A Git bundle containing the repository history and the checked-in Edge Function source.
- A SHA-256 manifest for the files in each archive.

The complete archive is encrypted with GPG AES-256 before it is uploaded. The uploader verifies the uploaded file size and, when Drive returns it, the MD5 checksum. It retains the 30 newest backup archives in the app-created Drive folder.

## Important security properties

- The workflow runs only on a schedule or manual dispatch; it does not run for pull requests from untrusted code.
- GitHub Actions permissions are read-only for repository contents.
- No backup data is written to the public GitHub repository or retained as a workflow artifact.
- Secrets are read from GitHub Actions repository secrets.
- The Google OAuth app requests only the drive.file scope; it creates and manages its own backup folder and files.
- Backup archives contain private user data. Keep the encryption passphrase in a password manager and maintain a separate secure recovery copy. Without it, the archives cannot be decrypted.

## One-time setup still required

### 1. Google OAuth app

The Google Cloud OAuth app must be switched from **Testing** to **Production** before the final authorization. Google documents that test-user authorizations expire after seven days, including refresh tokens. The existing drive.file scope is non-sensitive, but Google may still show an unverified-app warning until basic verification is completed.

The registered redirect URI must remain exactly:

https://oeyxsqocldlovhsmzcjw.supabase.co/functions/v1/google-drive-oauth-callback

### 2. Supabase Edge Function secrets

After the OAuth callback function is deployed, set these two Edge Function secrets in Supabase:

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET

Do not put either value in this repository or in ChatGPT.

### 3. GitHub Actions repository secrets

First, add a repository variable under **Settings → Secrets and variables → Actions → Variables**:

- BACKUP_ENABLED = false (keep disabled until every secret below is configured and verified; set it to true only when ready to activate scheduled backups).

Then add these repository secrets under **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Value |
|---|---|
| SUPABASE_DB_URL | PostgreSQL connection string from Supabase Dashboard → Connect. Use the session pooler if direct IPv6 connectivity is unavailable. URL-encode special characters in the password. |
| SUPABASE_SERVICE_ROLE_KEY | Legacy service-role key from Supabase API keys. Never publish it. |
| GOOGLE_CLIENT_ID | Client ID of the new Google Web application OAuth client. |
| GOOGLE_CLIENT_SECRET | Client secret of that same Web application client. |
| GOOGLE_REFRESH_TOKEN | Token returned by the one-time browser authorization flow. |
| BACKUP_ENCRYPTION_PASSPHRASE | A unique, strong passphrase (at least 20 characters) stored separately in a password manager. |

### 4. Authorize Google Drive

After the callback function is deployed and its two Supabase secrets are set, open:

https://oeyxsqocldlovhsmzcjw.supabase.co/functions/v1/google-drive-oauth-callback?action=start

Sign in to the Google account that should own the backups and approve the drive.file permission. Copy the one-time refresh token shown on the callback page directly into the GitHub Actions secret GOOGLE_REFRESH_TOKEN. Never paste it into ChatGPT.

### 5. Run the first backup

Open **GitHub → Actions → Green Dream Google Drive backup → Run workflow**. Confirm that the workflow succeeds and that the encrypted archive appears in the Google Drive folder.

## Backup contents and limitations

The CLI dump excludes Supabase-managed schemas. Auth users and identities are therefore exported as JSON alongside the database dump, with generated SQL restore statements in the restore folder. Supabase Vault values are exported from the decrypted view and included only inside the encrypted archive; generated SQL recreates them with vault.create_secret(), encrypting them under the destination project's own Vault key. The restore script restores users and identities, not sessions, MFA factors, or audit history. However, Edge Function runtime environment secret values (for example, Resend, Turnstile, and service credentials) are not readable through the available project connection and are not included; the archive records their names only. Auth provider settings, project API keys, database connection credentials, DNS/custom-domain configuration, and other dashboard-level settings are also not included. Preserve these separately in a password manager or another secure configuration record. Edge Function source is versioned in this repository, but runtime secrets must be re-entered during recovery.

Before each upload, the workflow also attempts a full restore into a disposable local Supabase stack on the GitHub runner. It verifies database table counts, Auth user IDs and password hashes, Vault secret digests, Storage policies/ACLs, and each restored Storage object SHA-256 digest. This isolated test environment does not touch the live project. The first real run must still succeed before the backup system is considered operational.

## Restore outline

1. Decrypt the .gpg archive with the separately stored passphrase.
2. Verify all extracted files against backup-manifest.json.
3. Provision a compatible Supabase project and restore roles.sql and schema.sql.
4. Restore Auth users and identities with restore/auth-restore.sql only into a fresh, compatible Auth schema. It does not restore active sessions or MFA factors.
5. Enable Supabase Vault, then run restore/vault-restore.sql. The values are re-encrypted under the target project's Vault key.
6. Run restore/storage-policies.sql after the Storage schema and application tables exist, then restore data.sql.
7. Recreate Storage buckets with the captured configuration and upload their objects, preserving content type, cache control, and user metadata.
8. Deploy the checked-in Edge Functions and restore their runtime secrets from the separate secure configuration record.
9. Reconfigure Auth providers, keys, domains, and other project-level settings.
10. Verify the website, CMS, authentication, submissions, and media before switching traffic.

The current live migration ledger has 33 entries, while the repository originally contained only two migration files with timestamps that do not match the live ledger. The first backup preserves the live ledger and current schema/data snapshot; it does not pretend that missing historical migration SQL has been reconstructed.
