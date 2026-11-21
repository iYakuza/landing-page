# Supabase- and Cloudflare-independent CMS migration

## Non-negotiable constraints

- No Supabase services, SDKs, authentication, database, or storage.
- No Cloudflare services, including Workers, D1, R2, Pages, or tunnels.
- No additional paid hosting or storage provider.
- Keep the existing GitHub Pages website, public URLs, editor interface, block model, keyboard behavior, and publishing features.
- All production implementation work stays on \`recovery/supabase-content-export-20261119\`. Preview deployments may be used for acceptance testing; do not merge into \`main\` or deploy production until cutover is explicitly approved.

## Target architecture

GitHub is both the public publishing platform and the private CMS data store.

### Public repository: \`iYakuza/landing-page\`

- GitHub Pages serves the existing public website.
- \`content/transmissions.json\`, \`content/human-archive.json\`, and \`content/signals.json\` are the canonical public collections.
- Published media lives in the existing \`media/\` hierarchy.
- A publish/edit/unpublish operation creates one Git commit containing all related JSON and media changes. The commit is the publication transaction and audit reference.

### Private companion repository

The private companion repository iYakuza/iyakuza-cms-private has been created. It stores:
- unpublished Transmission drafts and their revision history;
- draft media before publication;
- private Human Archive favourites;
- private editor preferences and any non-public overrides;
- a CMS audit log and recovery snapshots.

The private repository must never be made public. Published records and media are copied into the public repository only on an explicit Publish action. A draft save must never write unpublished content to the public repository.

### Browser-side administrator access

There is no application server in this design. The existing CMS login will be replaced with an owner-entered GitHub fine-grained personal access token (PAT):
- The PAT must be restricted to the two explicitly selected repositories (public website and private companion repository).
- Required permissions are repository Metadata (read) and Contents (read/write); no Actions, Administration, Issues, Packages, or organization permissions are needed for the core CMS.
- The CMS verifies the token by calling GitHub's authenticated \`/user\` endpoint and checks the returned login against a fixed owner allowlist.
- The token is held in \`sessionStorage\` only, never in source files, canonical JSON, localStorage, URLs, logs, or commits. Signing out clears it.
- The owner creates, scopes, expires, and revokes the PAT in GitHub settings. The CMS must explain the risk of entering a repository-write token into a browser and must not request a classic PAT.
- If token verification fails, editor controls remain unavailable. Browser-side flags alone are never authorization; GitHub enforces the token's repository permissions on every write.

This avoids an OAuth client secret or private key in browser code. GitHub's device flow is not suitable for this browser-only design: GitHub documents it for headless clients, and the device-code endpoints do not support cross-origin browser requests. A GitHub App web flow would require a client secret exchange that must not be exposed in static browser code.

## Data mapping

| Existing Supabase responsibility | GitHub-only replacement |
|---|---|
| Admin sign-in and allowlist | Owner-scoped fine-grained PAT; verify \`/user\` login |
| Transmission drafts and autosave | Private JSON records in companion repo; revision/ETag checks |
| Create, edit, publish, unpublish | Validate and commit canonical JSON to public repo |
| Delete draft | Delete private draft and its private media; keep published records untouched |
| Media uploads | Commit draft assets to private repo; copy to public media paths only when publishing |
| Media cleanup | Git tree/blob references and explicit removal commits after reference checks |
| Human Archive block structures and output overrides | Canonical Human Archive JSON for public display structures; private repo only for unpublished/private overrides |
| Favourites | Private JSON in companion repo |
| Audit history | Append-only private JSONL or dated audit records, with public commit SHA for publication events |
| Community/Signals moderation | Deferred; no replacement is to be implemented in this Chamber phase |

## Editor behavior to preserve

- Existing Shared Chamber UI, opening/closing, discard/save controls and keyboard behavior.
- Existing Human Archive block editor, rich-text editor, block types, ordering, naming, columns, media library and media insertion.
- Existing Transmission metadata, category/movement hierarchy, slug validation and permalinks.
- Draft autosave, explicit publish/unpublish, edit existing post, delete draft, conflict detection and recovery.
- Existing Human Archive structure overrides, output text, image/audio/video arrangements, media width and favourites.
- Existing public page rendering and canonical JSON schema.

The data adapter is to be replaced beneath the existing UI. Do not redesign the editor as part of this migration.

## Important limitations and safeguards

- A static GitHub Pages site has no private server-side secret store. A browser-held PAT is a deliberate security trade-off: XSS or a compromised browser extension could access it while the CMS session is active. Keep the token session-only, restrict it to the two repositories, use an expiry, and revoke it immediately if exposure is suspected.
- Drafts are private because they live in a private repository. This requires the owner to create that companion repository and grant the fine-grained PAT access to it.
- GitHub is not object storage. Keep the existing per-file upload limit, reject oversized assets before upload, and validate file type, size, path and references. Do not use Git LFS unless separately evaluated.
- Multi-file publication must use the Git database API (blobs, tree, commit, ref) so the canonical JSON and all referenced media enter the public repository in one commit. Check the expected branch SHA before updating the ref to prevent overwriting concurrent edits.
- GitHub API rate limits and repository size limits apply. Cache reads during an editing session and avoid unnecessary polling.
- Never place a PAT, OAuth secret, private key, or any other credential in the repository.

## Migration sequence

1. **Inventory and adapter design:** map every current Supabase call to a GitHub operation; preserve UI contracts and define JSON schemas for private drafts, favourites, overrides and audit records.
2. **Authentication:** replace Supabase login with owner-scoped fine-grained PAT entry, \`/user\` verification, session-only storage and sign-out.
3. **Private draft store:** add companion-repository read/write, autosave, version checks, conflict handling, delete and restore.
4. **Media pipeline:** private draft upload, media library integration, publish-time copy to public media, reference validation and cleanup.
5. **Publishing transaction:** atomically update canonical JSON and media in one public Git commit; support edit, publish, unpublish and rollback.
6. **Human Archive extras:** migrate favourites and remaining editor overrides without losing existing canonical structures.
7. **CMS console:** retain the current visual console where practical, remove Supabase recovery/login dependencies, and keep Signals moderation explicitly deferred.
8. **Validation:** test draft privacy, every editor block type, uploads, autosave, concurrent edits, publish/unpublish, delete, media integrity, favourites, rollback and a clean sign-out.
9. **Cutover:** only after owner review and explicit approval; keep \`main\` untouched until then.


## Current implementation status — 21 November 2026

The GitHub-only CMS implementation is integrated on the recovery branch. Production main has not been changed.

### Repositories and branches

- Public source: iYakuza/landing-page, branch recovery/supabase-content-export-20261119.
- Private companion: iYakuza/iyakuza-cms-private. Its production main branch still needs the one-time sequence seed.
- Preview: iYakuza/landing-page-preview, with a separate private CMS preview branch. The preview private branch contains test drafts T-0007 and T-0008; do not copy those drafts or its sequence state into production.
- Pull request #135 remains Draft. It currently contains 171 changed files and 227 commits. The branch is GitHub-mergeable, but the merge state is still unstable while CodeQL is running.

### Implemented GitHub-only paths

- CMS authentication uses an owner-scoped fine-grained GitHub PAT, verifies owner identity and repository access, and keeps the token in session storage.
- Shared Chamber draft creation, autosave, private media, favourites and private state use the private repository.
- Publish/edit/unpublish operations use version-checked Git commits to update the public Transmissions JSON, Human Archive structures and promoted media.
- Existing post metadata is preserved during edit and republish, including original created_at, published_at, legacy identifiers and unknown metadata.
- Existing Human Archive structure metadata is preserved, including public_record_id and unknown fields.
- The homepage and Green Dream archive now read content/transmissions.json; the Transmissions and Signals readers use their canonical JSON collections.
- Human Archive media resolution is local-only. Historical storage URLs are mapped through manifest aliases to local GitHub media rather than fetched remotely.
- The Secure Your Soul page's obsolete Supabase and Cloudflare Worker CSP allowances have been removed.

### Media recovery and data integrity

- The canonical Human Archive contains 140 records and 197 editor structures.
- Its media manifest contains 111 verified assets. All 111 local files are present in the recovery branch.
- The three external inline-reference assets that were present only in Preview have been reconciled into the recovery branch.
- The 86 historical Supabase media URLs that correspond to recovered Human Archive assets are now included as aliases to local files.
- Eight other media items remain pending local recovery: seven Transmission attachments and one Signals audio attachment. The public runtime no longer fetches these from legacy storage. The seven Transmission files are expected to be re-uploaded locally; the Signals audio still needs a recovery decision.
- Preview and source data were not copied wholesale. Media metadata was reconciled while the source branch's editor structures were preserved.

### Remaining external-service boundary

The CV contact form in cv/contact.js still calls the Supabase Edge Function contact-about-role. That function uses Resend for delivery and Supabase-backed rate limiting, including the Cloudflare-provided client IP header. The form currently supports file attachments.

A completely static, dependency-free replacement is a mailto flow. That preserves message fields but cannot attach files automatically; visitors must attach files in their own email client. A hosted form/email backend would preserve uploads but would reintroduce an external service. This choice must be resolved before claiming the entire website is Supabase/Cloudflare-independent.

The legacy Google Drive backup and Supabase migration/restore workflows remain in the repository as recovery tooling. They are not part of the public website runtime, but the scheduled Drive backup is conditional on BACKUP_ENABLED and still uses Supabase as its source. Retire or replace those workflows before shutting down the old Supabase project. The separate /community/ page retains its Slack call-to-action; it is a link, not a Slack API integration, and remains untouched.

### Automated checks

Latest recovery-branch checks:
- Static-site safety: passed, including JavaScript syntax checks and 13 Node regression tests.
- Static security posture: passed, including runtime dependency scanning and verification of all 111 Human Archive media files. It reports one warning for the eight pending media items.
- Secret scanning: passed.
- CodeQL: still in progress at the time of this update.

These checks validate source and data integrity; they do not replace a browser-based acceptance test of the deployed Preview site.

## Required acceptance tests before merge

The available live-token testing covers draft operations, media upload/deletion, favourites and recovery of the HA-3008 editor state. The following still need an explicit end-to-end pass on Preview:

1. Sign in and sign out; verify the token is cleared.
2. Create a new Transmission, save a draft, reload, and reopen it.
3. Edit an existing Transmission and verify original dates, legacy metadata and Human Archive structure metadata survive.
4. Upload, replace and delete media; verify no orphaned files or broken references.
5. Publish, reload the public page as a visitor, and verify the published content and media.
6. Unpublish, reload the public page, and republish from the preserved private draft.
7. Trigger a real concurrent-change conflict and verify the editor refuses to overwrite newer public data.
8. Verify all existing block types, ordering, media output, favourites and the Signals read-only archive.

The latest Preview deployment has not yet been independently verified against the newest recovery-branch commits.

## Production cutover checklist

1. Resolve the CV contact-form decision and remove the remaining active Supabase endpoint if the zero-backend requirement is retained.
2. Restore the seven Transmission attachments and the one Signals audio item locally, or explicitly accept that those items remain unavailable.
3. Complete the Preview acceptance tests above and wait for CodeQL to pass.
4. Confirm the production private repository and initialize its sequence with the verified last-used values: transmission_number 6 and archive_record_id 3008. Do not copy Preview's test sequence.
5. Review and retire legacy Supabase/Google Drive recovery workflows according to the agreed backup policy.
6. Review the complete PR diff and merge only after explicit owner approval. A squash merge is preferable given the branch's 227-commit history.
7. Verify the production deployment and public read paths after merge.

**Merge recommendation: not ready yet.** The core CMS migration and Human Archive media recovery are materially advanced, and automated checks are green apart from CodeQL still running. The remaining contact-form dependency, eight pending media items, and incomplete end-to-end acceptance tests are release blockers.
