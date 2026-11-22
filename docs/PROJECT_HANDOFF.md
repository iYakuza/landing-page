# Project handoff

**Last updated:** 22 November 2026

## One live website

- Website: https://iyakuza.github.io/landing-page/
- Public source and published content: [iYakuza/landing-page](https://github.com/iYakuza/landing-page), branch `main`.
- Private CMS data: [iYakuza/iyakuza-cms-private](https://github.com/iYakuza/iyakuza-cms-private), branch `main`.
- The former Preview environment is retired. It is not used for development, testing or publishing.

## How the site works

- GitHub Pages serves the static website.
- Published content and public media live in this repository.
- The browser CMS uses the GitHub API for owner-only editing and publishing.
- Unpublished drafts, private media and favourites live in the private companion repository.
- Publishing writes approved content and media to the public repository.
- No separate hosted database or analytics service is used.

## Publishing rules

- Work directly against the live website.
- Save keeps unpublished work in the private repository.
- Publish updates the public website.
- Do not create a second website or a separate test content repository.
- Keep public media files in the repository's `media/` directory.
- Preserve record IDs and existing content unless an explicit content change is requested.

## Deferred items

- CV contact form: UI retained, submission disabled.
- Public Signal submission form: paused; published Signals remain visible.
- Backup/recovery: not automated. GitHub remains primary; Google Drive may be added later as a secondary copy.

## Validation

Before completing a production change, run the repository's JavaScript regression tests, static-site safety checks, security checks and GitHub Pages deployment. Verify the live result where browser testing is available.

## Purpose

Keep the site simple and live. Make human and AI conversations visible as evolving ideas, with transparency, attribution and real-time publication.
