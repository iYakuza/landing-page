# CMS setup

The CMS is available at https://iyakuza.github.io/landing-page/cms/.

## One-time access setup

1. In GitHub, create a fine-grained personal access token.
2. Limit repository access to:
   - `iYakuza/landing-page`
   - `iYakuza/iyakuza-cms-private`
3. Grant **Contents: Read and write**. Keep other permissions disabled unless the CMS explicitly requires them.
4. Use an expiration date. Do not share the token or store it in files, commits, browser local storage, or URLs.
5. Open the CMS and enter the token. The CMS checks the GitHub account and repository permissions.
6. Sign out when finished. The token is held for the current browser session only.

## Publishing

- Save Draft stores unpublished work in the private companion repository.
- Publish writes the approved content and its public media to the website repository.
- Published media belongs under `media/`; canonical collection files live in `content/`.
- Do not upload credentials or private information to the public repository.

## Storage

- Public website, published content and media: `iYakuza/landing-page`.
- Private drafts, draft media and favourites: `iYakuza/iyakuza-cms-private`.
- Google Drive is reserved for a future secondary backup/recovery copy. No automated backup currently runs.
