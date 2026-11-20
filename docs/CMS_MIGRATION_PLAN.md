# Supabase- and Cloudflare-independent CMS migration

## Non-negotiable constraints

- No Supabase services, SDKs, authentication, database, or storage.
- No Cloudflare services, including Workers, D1, R2, Pages, or tunnels.
- No additional paid hosting or storage provider.
- Keep the existing GitHub Pages website, public URLs, editor interface, block model, keyboard behavior, and publishing features.
- All implementation work stays on \`recovery/supabase-content-export-20261119\`. Do not change \`main\` or deploy until cutover is explicitly approved.

## Target architecture

GitHub is both the public publishing platform and the private CMS data store.

### Public repository: \`iYakuza/landing-page\`

- GitHub Pages serves the existing public website.
- \`content/transmissions.json\`, \`content/human-archive.json\`, and \`content/signals.json\` are the canonical public collections.
- Published media lives in the existing \`media/\` hierarchy.
- A publish/edit/unpublish operation creates one Git commit containing all related JSON and media changes. The commit is the publication transaction and audit reference.

### Private companion repository

A separate private repository (to be created by the owner) stores:
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

## Owner setup required before live authentication can be tested

- Create a new **private** GitHub repository for CMS data (suggested name: \`iyakuza-cms-private\`).
- Create a **fine-grained personal access token** limited to \`iYakuza/landing-page\` and that private repository, with Metadata read and Contents read/write only. Set an expiry and do not paste the token into chat or commit it.
- Enter the token directly into the CMS login field once that interface is implemented.

No Cloudflare setup, Supabase setup, OAuth app, worker, external database, or third-party storage is required.


## Implementation progress — GitHub storage foundation

The recovery branch now contains the first GitHub persistence layer:

- `cms/github-client.js` authenticates a fine-grained GitHub token for the owner account, verifies both repositories and their visibility, keeps the token in browser session storage, reads Git trees/blobs, uploads binary blobs, and creates non-force commits on the recovery branch.
- `cms/github-store.js` provides the first storage adapter for canonical public collections, private Transmission drafts, private draft media, favourites, private overrides, and identifier sequences.
- `listFiles()` was added to the GitHub client so the adapter can enumerate draft records and media paths.
- Identifier allocation deliberately refuses to run until the sequence file is initialized from a verified complete export. It does not guess the next archive or post ID.

### Important integration boundary

This is persistence infrastructure, not yet a working replacement CMS. The existing Shared Chamber still calls Supabase directly for authentication, draft autosave, record creation, structure/block saves, media upload and cleanup. The existing CMS console also uses Supabase for community moderation. Those UI flows have not been switched over, and the new GitHub token login has not been exposed to visitors or administrators.

The next integration stage must replace those calls as one coordinated change while preserving the current editor UI and behavior. It must also preserve the current public archive/Transmissions JSON contracts, media URL behavior, autosave conflict protection, explicit Save/Discard, publish/unpublish, and all existing IDs. Community submission moderation is a separate deferred workflow and must not be represented as migrated until its storage and moderation UI are implemented.

### Safety and deployment state

All work remains on `recovery/supabase-content-export-20261119`. The public `main` branch has not been changed and nothing has been deployed. The private repository remains the intended location for unpublished drafts and private media. No Supabase or Cloudflare service is part of the target architecture.
