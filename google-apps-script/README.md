# Google Apps Script contact endpoint

This small endpoint receives the shared website contact form and emails the
message to the address stored in the Apps Script project's Script Properties.
It does not save messages to Google Drive, Sheets, GitHub, or a database.

## One-time setup

1. Sign in to the Google account that should send the notifications.
2. Open Google Apps Script at https://script.google.com/ and create a new standalone project named **Verse After Hours Contact**.
3. Replace the starter contents of the Code.gs file with the contents of this folder's Code.gs, then save.
4. Open **Project Settings** (gear icon), find **Script Properties**, and add:
   - Property: CONTACT_RECIPIENT
   - Value: the destination inbox address you want to receive messages.
5. Select **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Deploy, complete Google's authorization prompt, and copy the web app URL ending in /exec.

Do not paste the deployment URL into the website until the deployment has
been tested. Share only the URL with the site maintainer; never share your
Google password or authorization codes.

## Important limits and safeguards

- The script uses MailApp, which can send email but cannot read the Gmail inbox.
- The script does not log or archive visitor messages.
- A temporary 20-second global cache entry limits bursts; it contains no
  visitor details and expires automatically.
- A hidden honeypot and minimum form-completion time reject basic automated
  submissions. These are modest protections, not a guarantee against all spam.
- Consumer Google accounts currently have a daily Apps Script email quota.
  Google can change quotas and access settings.
- The web app must permit anonymous access for visitors who are not signed in
  to Google. If the Anyone option is unavailable or blocked by the account,
  stop and tell the site maintainer; do not change account security settings
  to work around it.

The website will remain disabled until the deployment URL is deliberately
configured in shared/contact/contact.js.
