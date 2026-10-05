# Claude configuration structure — handover, 2026-09-23

Summary: Set up a layered Claude Code configuration for the repo, moved the
root-level session reports into `docs/`, and rewrote their durable content as
twelve reference docs checked against the code. Committed with the working-tree
snapshot `56f5639` (docs and root `CLAUDE.md`); `.claude/` is gitignored by
decision and exists on the maintainer's machine only.

## Changed
- `CLAUDE.md` — rewritten to 135 lines: overview, damage-preventing facts,
  operating rules, app table, current work. Previous version in git history.
- `docs/archive/` (47) and `docs/open/` (10) — reports moved, filenames unchanged.
  Index with status and successor: `docs/README.md`.
- `docs/reference/` — 12 docs (apps, packages, data-model, identity-and-tenancy,
  commerce, nextcloud, email, frontend-ui, authoring, workshops-and-lms, ops,
  testing). Verified: read-only checks against code, `app_schema_migrations`,
  `docker compose config/ps`, DNS and the Nextcloud container.
- `.claude/` (not in git) — guide `README.md`; always-on rules 00–03; 13 area
  and 12 app rule files with `paths:`; skills orient, note, handover,
  new-migration, launch-site, verify-ui; subagent doc-verifier; settings.json.
- `~/.claude/CLAUDE.md` — user-level preferences.
- Auto memory — 74 of 113 files removed after their content was promoted;
  index rewritten. Backup: `~/.claude/backups/eac-memory-2026-09-23/`.

## State at handover
- No code changed. No builds, restarts or database writes.
- Always-loaded context: about 13 KB, down from about 31 KB.

## Open items
- Findings recorded in the reference docs' Open items, notably:
  unverified session cookies (identity), unsanitised thread bodies and hard
  deletes (data-model) — both now in separate sessions; two Nextcloud ACL rules
  failing every sync since 09-20 (nextcloud); test sends missing font and
  banner, unsubscribe group applied to RSVP mail (email); `check-types` failing
  in cms-bindings (authoring); `puck-harness-tmp` publicly reachable (authoring).
- 39 memory files remain with residual detail; fold into reference docs as each
  area is next worked on.
- `.claude/` has no history or backup. Option: a local git repo inside it.

## Decisions
- Claude layer personal, not in git — developer.
- Inner Gathering described functionally only — developer.
- Reports moved and rewritten, originals kept verbatim — developer.
