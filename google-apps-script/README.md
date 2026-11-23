# Google Apps Script contact endpoint

This Google Apps Script web app receives the shared website contact form and emails the message, with optional attachments, to the address stored in the project's Script Properties. It does not save messages or uploaded files to Google Drive, Sheets, GitHub, or a database.

## Files in this folder

- `Code.gs`: server-side validation and email delivery.
- `Upload.html`: Google-hosted attachment picker and secure bridge to the website contact form. It is required for file attachments.

## Update the existing project

The production web app is already deployed and its Script Property `CONTACT_RECIPIENT` is already configured. Do not create a new deployment or change the property.

1. Open the existing **Verse After Hours Contact** Apps Script project.
2. Replace all contents of `Code.gs` with this folder's updated `Code.gs`.
3. In the Apps Script editor, click **Add a file → HTML**. Name the file **Upload** (Apps Script creates `Upload.html`) and paste the contents of this folder's `Upload.html`.
4. Save both files.
5. Open **Deploy → Manage deployments**.
6. Edit the existing Web app deployment using the pencil icon.
7. Under Version, choose **New version**, then click **Deploy**.
8. Keep **Execute as: Me** and **Who has access: Anyone** unchanged.

Editing the existing deployment preserves the current `/exec` URL already configured on the website. No Script Property changes are needed.

## Attachment limits

- Up to 5 files per message.
- Maximum 5 MB per file and 10 MB combined.
- Accepted formats: PDF, TXT, CSV, DOC, DOCX, XLS, XLSX, PPT, PPTX, PNG, JPG/JPEG, GIF and WEBP.
- Other formats are rejected, even if the browser's file picker allows them.
- Files are attached directly to the email. They are not written to Drive or otherwise persisted by this script.

## Privacy and safeguards

- The script uses `MailApp`, which can send email but cannot read the Gmail inbox.
- Visitor messages and file contents are not logged or archived by this code.
- Uploaded file bytes exist only during the Apps Script execution needed to validate and send the email.
- A temporary 20-second global cache entry limits bursts; it contains no visitor details and expires automatically.
- A hidden honeypot and minimum form-completion time reject basic automated submissions. These are modest protections, not a guarantee against all spam.
- Google Apps Script email quotas and service limits apply and may change.
- The endpoint must remain anonymously accessible so visitors do not need a Google account to send a message.

The attachment flow uses Google's documented HTML Service behavior, which converts file input fields to Blob objects when a form element is passed to `google.script.run`. MailApp accepts BlobSource attachments for email delivery.
