# Platform exchange: workspace

**Status (2026-11-08):** design and plan only. No code, migration, build or deploy has been
made for it. Phase 0 (conventions and docs) is this folder; phase 1 waits on the owner
decisions in `DECISIONS.md`.

Purpose: one place where the reusable building blocks of the platform (page templates, route
templates, blocks and smart components, routines and ladders, presets, looks, later brand-kit
pieces) are shared between orgs and sites, with versions, licences, credits and a record of
use. The same folder holds the repo practice the exchange depends on: versioning, a changelog
convention, a release train, and open-source contribution guidelines for the public repo
(`GuruDharamSingh/eac-repo`).

The owner's brief (2026-11-08): "we have templates for puck pages and templates for routines,
templates for presets, perhaps we start an internal platform/network exchange, that preps code
base on, proper versioning for one, 2. Some guidelines for open source development, and
celebrating the better designs in here as more people edit sites. Build patterns etc."

## Files

| File | Holds |
|---|---|
| `README.md` | this index, the status line, how to leave notes |
| `EXCHANGE.md` | the model: item kinds, the common envelope, where items live, publish / discover / apply / fork / update, celebrating designs |
| `VERSIONING.md` | semver for packages, versions for content items, the changelog convention, pinning and migrating stored docs, deprecation, branches / commits / release train |
| `CONTRIBUTING.md` | open-source development guidelines: style per package type, adding a block / card / action, review, secrets hygiene, licences, attribution |
| `PLAN.md` | phases 0 to 5, the proposed migrations (not written), risks |
| `DECISIONS.md` | owner decisions, each with options and a recommendation |
| `NOTES/INBOX.md` | notes from other sessions (append here) |

Read order for a new session: this file, `EXCHANGE.md` §1–2, `PLAN.md` §1, then the file for
your task.

## How other sessions leave notes

- Append to `NOTES/INBOX.md`: date, your lane or session id, one paragraph, file paths.
  Newest at the bottom.
- Do not edit `EXCHANGE.md`, `VERSIONING.md`, `PLAN.md` or `DECISIONS.md` directly; the lead
  folds inbox notes in and marks them done. `CONTRIBUTING.md` takes direct fixes of fact
  (a wrong path, a renamed script) with a dated line under its History.
- Leave a note when you:
  - add a stored contract (a block id, prop, part name, route or Studio key, action id, preset
    answer key, look value) that a live site will save;
  - change `site_page_templates`, `packages/page-builder/src/templates/`,
    `packages/blocks/src/templates/`, `packages/studio/src/forms/presets.ts`, or the LMS
    course-version rules;
  - build anything that lists, applies or copies templates across orgs (a hub card, an MCP
    tool, an importer);
  - find that a rule in `VERSIONING.md` or `CONTRIBUTING.md` does not match the code.

## Sources read (2026-11-08)

- Repo practice: `CLAUDE.md`, `README.md`, `NOTICE`, `.gitignore`, `package.json`,
  `docs/README.md`, `docs/reference/packages.md`, `.claude/rules/00-working-style.md` and
  `01-writing-register.md` (untracked, `.gitignore:70`), `git log` (day branch
  `work/2026-11-08`, five "Snapshot of the working tree" commits from `56f5639e` to `ad58fbd`),
  `docs/open/PM_BOARD_2026-11-08.md` (cross-lane review, release train, repo hygiene).
- Page templates: `packages/db/migrations/257_site_page_templates.sql`,
  `packages/hub/src/server/site-builder.ts:218-240`, `packages/hub/src/site-builder/`
  (`NewPageDialog.tsx`, `model.ts:40`), `packages/actions/src/server/sb-runners.ts:103,159-164`,
  `packages/page-builder/src/templates/templates-plugin.tsx`,
  `packages/blocks/src/templates/store.ts:22` (`PageTemplate`), `apps/sunjay/src/lib/hub-site.ts:24`
  (`pageStarts`), `docs/open/hub-cards-handoff/PLAN.md` §6.
- Route templates and stored-block compatibility: `docs/open/SMART_COMPONENTS_KIT_2026-11-08.md`
  §2.1, §3, §4, §6.
- Prior design: `docs/open/PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md` (org patterns,
  revisions, `block_submissions`, `network_templates`).
- Routines: `docs/open/channel.md`, `docs/open/channel-handoff/ladders/`,
  `docs/open/CHANNEL_ROUTINES_AS_COURSES_PLAN_2026-11-07.md` §2.1, §2.6,
  `packages/db/migrations/140_lms_content.sql:93-110` (`lms_course_versions`, `change_kind`).
- Presets: `packages/studio/src/forms/presets.ts` (`PRESET_KEYS`, `PLATFORM_PRESETS`),
  `docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md` §4 (`content_prefs`).
- Catalogue precedent: `packages/actions/src/catalogue.ts`, `packages/actions/README.md`.
- Blocks and cards: `packages/blocks/src/registry.ts:40,81`, `packages/hub/src/contract.ts:164-168`.
- MCP: `docs/open/mcp-foundations/` (README, DECISIONS), `packages/mcp/src/server/tools.ts`.
