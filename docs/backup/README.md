# Backup and recovery

Backup and recovery are currently **not automated**.

- GitHub is the live source of truth for the website, published content and public media.
- The private GitHub companion repository stores unpublished drafts, private draft media and CMS metadata.
- Google Drive is a secondary destination for a future backup/recovery process.
- No backup job is currently running. Do not treat old scripts or old workflow runs as a recovery procedure.

When backup and recovery are implemented, keep GitHub primary and use Google Drive for a separate copy. Do not introduce another database, hosting provider or storage service.
