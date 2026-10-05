# Development Journal

Preserve the personal companion scope and existing user data. Do not edit synced ChatGPT `sources/` reference files.

For every meaningful user-visible release or important fix, maintain `development-log.json`:

- Append a stable unique entry ID, date in Asia/Shanghai, chapter and accurate status.
- Describe the user's problem, concrete changes, reasoning/lesson, verification and remaining limits.
- Keep failures and corrections; do not rewrite an earlier attempt as if it was correct all along.
- Distinguish historical reconstruction, implemented work, published work and standalone previews.
- Do not claim a release or hardware test without evidence. Link a known commit when available; never invent a commit, date or test result.
- Updates to tests, cache versions or deployment for the same improvement may extend that entry instead of creating a cosmetic new level.
- Put ideas and unshipped previews in `branches`, not completed entries.
- The journal is public. Never include private courses, appointments, emails, access codes, API secrets or cloud snapshots.

Run `node build-development.cjs` to regenerate `DEVELOPMENT.md`. Maintain shared/app.html, not generated index.html/share.html. Generate local entries with build-experience.cjs and build-share.cjs; build-release.cjs produces independently publishable personal/share artifacts. Source main never directly publishes the personal site. Only publish-release.cjs with an explicit target updates that target. Verify independent worker scopes and cache cleanup with tests/verify-independent-apps.cjs; preserve existing personal keys and dusk-demo-v1: keys. See ARCHITECTURE.md.

Keep recovery source in `experience.js`. Both edition builders embed it into the entry so the primary recovery workflow cannot lose its required functions when a secondary script request fails. Do not edit the generated `experience-runtime` block manually. Share builds do not run the personal builder. Run `tests/verify-sync-runtime.cjs` for fresh unlock, manual sync, invalid remote, local offline recovery and blocked external runtime coverage; use synthetic data and never write the real personal cloud in tests.

The journal is a read-only development record, not a study score or a new gamification system. Do not add accounts, social ranking or background tracking for it.

Core inline recovery must execute before optional network dependencies. Icons are deferred; share identity/bootstrap is embedded by build-share.cjs, not downloaded separately. Run tests/verify-startup-order.cjs with an unresolved icon request and blocked share config. Do not wait for DOMContentLoaded before exercising the early startup case. Preserve share.html and its existing storage prefix. A desktop .url file is a launcher, not the public sharing payload. Never equate local fault-injection tests with a mainland mobile-network reachability test.
