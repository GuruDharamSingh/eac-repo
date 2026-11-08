# Pending migrations (hub cards)

Written 2026-11-08 and **not run**. They're kept here, not in `packages/db/migrations`, so a routine
`migrate.mjs` run by any session can't apply them. When Justin OKs one:
1. renumber it to the next free number;
2. `git mv` it into `packages/db/migrations`;
3. run the migrator.

Details are in PLAN.md §6.

| File | For |
|---|---|
| 256_site_page_meta.sql | page title, "by", notes, link preview, thumbnail, order (keyed on site path + kind) |
| 257_site_page_templates.sql | Save as template / Saved templates (snapshots; `org_id` NULL = network-level) |
| 258_network_arrivals_handled.sql | the arrivals queue: welcomed / dismissed, per arrival row |
| 259_nextcloud_sync_subject.sql | per-person "Syncing" |
| 260_identity_kinds.sql | org kinds on the identity `users` row |
