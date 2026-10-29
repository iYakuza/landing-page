# Security headers and hosting

## Important hosting note

This repository is currently published on GitHub Pages. GitHub Pages does not apply the `_headers` file, so adding this file alone will **not** change GitHub Pages HTTP response headers.

The `_headers` file is prepared for a static host that supports this format (for example, Cloudflare Pages). Deploy and test on that host before switching DNS or publishing it as the production site.

## Before production enforcement

1. Verify the site's YouTube embeds, Supabase requests, media, creator sign-in, and contact form.
2. Confirm the response headers using browser developer tools or a response-header scanner.
3. Confirm the Content Security Policy does not block required requests; check the browser console.
4. Configure HSTS only after HTTPS and all intended subdomains have been assessed. Do not add `includeSubDomains` unless every subdomain is HTTPS-ready.
5. The static-host response policy is intended to prevent cross-origin framing while permitting same-origin framing with `frame-ancestors 'self'`. The site embeds its CV content on the same origin, so `SAMEORIGIN` is required; do not change this to `DENY` without removing that embedding.

The current CSP is deliberately aligned with the existing homepage CSP and includes `frame-ancestors 'none'`, which cannot be enforced by a CSP meta element.
