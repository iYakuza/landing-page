# Human Archive media migration

This one-time GitHub Actions workflow copies the 111 files listed in `human-archive/media-manifest.json` from their existing public source URLs into the production Supabase bucket `human-archive-media`.

## One-time setup

1. In Supabase, open the production project **verse-after-hours**.
2. Open **Project Settings → API Keys** and copy the **service_role / secret** key. Do not use the publishable/anon key.
3. In GitHub, open **iYakuza/landing-page → Settings → Secrets and variables → Actions → New repository secret**.
4. Name the secret exactly `TARGET_SUPABASE_SERVICE_ROLE_KEY` and paste the service-role key as its value. Never commit this key or put it in website code.
5. Open **Actions → Migrate Human Archive media to production → Run workflow**.

The workflow creates/configures the public media bucket, copies each source file, downloads each uploaded file again, and compares SHA-256 hashes. It commits the updated manifest and verification report. If any file fails, the report records the failure and the workflow fails; the old restore project must remain active.

After a complete run, the website code and archive database references still need their final production-project switch and live-page verification. Do not delete or pause either restore project until those checks are complete.
