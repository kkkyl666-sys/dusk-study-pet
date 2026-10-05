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

Run `node build-development.cjs` to regenerate `DEVELOPMENT.md` from the single structured source. After changing `index.html`, run `node build-share.cjs` too. Commit the generated documents/entry together with the feature. Ensure the journal's HTML/JSON/script/cache updates stay in sync, and verify personal/demo storage isolation is unaffected.

Keep recovery source in `experience.js`. `build-experience.cjs` embeds it into `index.html` so the primary cloud/unlock workflow cannot lose its required functions when a secondary script request fails. Do not edit the generated `experience-runtime` block manually. `build-share.cjs` runs this step before generating the isolated share entry. Run `tests/verify-sync-runtime.cjs` for fresh unlock, manual sync, invalid remote, local offline recovery and blocked external runtime coverage; use synthetic data and never write the real personal cloud in tests.

The journal is a read-only development record, not a study score or a new gamification system. Do not add accounts, social ranking or background tracking for it.
