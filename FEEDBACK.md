# F2 Feedback

The share app stores study records locally under the existing `dusk-demo-v1:` prefix. Only the feedback form explicitly sends feedback data. It never sends the user's timetable, plans, vocabulary progress or personal access code.

## Installation

Run `node build-feedback.cjs`. It copies only the public endpoint/key into `feedback-config.js`, and generates private setup files outside this repository in `../数据/反馈后台安装/`.

In the existing Supabase project, run the generated `一次性启用反馈.sql` in SQL Editor once. The operation creates independent feedback tables and RPC functions, never edits personal study tables. Re-running it preserves existing feedback and the original owner credential. Keep `收件箱管理凭证.txt` private; use it in `feedback-admin.html`, accessible from the personal app settings. The page retains it only in memory until closed or locked.

Generic `feedback-schema.sql` intentionally does not configure an owner key. It must not be deployed alone. Never commit the private setup files or owner key to GitHub Pages. To rotate a lost key, set the settings row's hash through the trusted SQL Editor, not the public API.

## Boundaries

Tables have RLS and no direct anonymous/authenticated grants. Public RPCs only accept bounded, whitelisted feedback fields. Owner list/update validates an independent random 256-bit key server-side. SHA-256 stores a verifier, not the key; this is suitable only for the generated high-entropy key, not a short human password. Function search paths are empty. Updates are explicit and retry IDs deduplicate submissions under a transaction lock.

Abuse controls are global 30/hour, 200/24 hours, capacity 5,000, and 3/10 minutes per device UUID. A device UUID is **not a verified identity** and can be spoofed; the global cap limits storage abuse but cannot prevent deliberate denial of service. This first release is for small-scale sharing. Before broad public promotion, add a verified CAPTCHA/Edge gateway with network-level rate limiting. No attachments; contact and device environment are optional. Service-side request logs may still contain network metadata. Owner can manage retention through the database; no automatic deletion is enabled in this release.

Before installation, submissions fail visibly and keep their drafts. Offline feedback is not reported as delivered and is never silently sent in the background. A receipt is shown only after the backend confirms. The inbox does not fall back to fabricated sample feedback.

## Backup

`dusk-share-backup`, schema 1, exports a whitelisted full study snapshot including courses, recurring plans, appointments, checks, English progress and study start/rewind history. Static vocabulary, wallpapers and device appearance preferences are not duplicated. Credentials and feedback drafts are excluded. Supported mobile browsers offer native file sharing (e.g. saving to Files); otherwise a normal download is requested. Cancelled sharing leaves the save unchanged. Downloads cannot prove a file was saved; the UI asks the user to confirm the download. Import checks the version, format, size and fields, previews the replacement, saves a safety copy before writing the authoritative snapshot, and offers undo. Local browser storage is not cloud storage and may disappear if cleared.

References: https://supabase.com/docs/guides/database/functions and https://supabase.com/docs/guides/database/postgres/row-level-security
