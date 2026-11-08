# Versioning, changelogs and releases (2026-11-08)

Rules for how code and content items are versioned, how stored documents stay valid as code
changes, how things are deprecated, and how many parallel agent sessions branch, commit and
release. Current practice is stated first (verified 2026-11-08 by `git log`, `git tag`,
`package.json` reads), then the rule.

## 0. Current state

- 53 `packages/*/package.json` files: 38 at `0.1.0` with `"private": true`, one at `0.1.0`
  (`reading-wizard`) and 14 at `1.0.0` with no `private` field (`auth-client`, `auth-server`,
  `db`, `services`, `ui`, …). None is published to npm; apps consume them as `workspace:*`.
  The numbers carry no meaning (assumed: no bump appears in recent history).
- No `CHANGELOG.md` anywhere in the tree; no git tags.
- Day branches `work/YYYY-MM-DD` cut from `main` after a morning "Snapshot of the working
  tree" commit (five so far, `56f5639e` … `ad58fbd`); merged back at day's end
  (`PM_BOARD_2026-11-08.md`, Repo hygiene).
- Commits mostly `type(scope): …` (`feat(hub,ifac)`, `fix(actions)`, `docs(mcp-foundations)`)
  or `area: …` (`forms: …`, `commerce: …`), each citing its plan doc.
- Deploys go out as a release train run by the PM: three on 2026-11-08, logged at
  `~/eac-backups/next/train-20261108.log`, `train2-…`, `train3-…`, with `.next` backups.
- Content versions exist in one place: `lms_course_versions` (mig 140): integer `version_no`,
  immutable rows, `change_kind` fix or structural.

## 1. Code: semver for packages

- **The public API of a package is its stored contracts**, not its TypeScript exports: block
  ids, prop names, part names, route and Studio keys, action ids, preset answer keys, look
  values, CSS custom property names used in org CSS, table and column names. Exports are
  internal to the monorepo and change in the same commit as their callers.
- Semver applies to the exchange-facing packages: `blocks`, `page-builder`, `direct-edit`,
  `hub`, `actions`, `studio` (forms), `lms`, `tokens`, `gradients`, and `exchange` when it
  exists. For these:
  - **major**: a stored contract stops working without a data migration. Expected to be
    rare; needs a deprecation (§4) and owner approval.
  - **minor**: a new contract (block, prop with a default, entry, preset key, look value), or
    a contract deprecated.
  - **patch**: a fix with no contract change.
- Stay at `0.x` until a package is published outside the repo; in `0.x`, a minor bump marks a
  deprecation or removal and a patch anything else.
- Other packages keep their numbers and are not bumped. Set `"private": true` on the 15
  without it (a one-line code change; follow-up, not done here) so nothing can be published
  by accident from a public repo.
- Versions are bumped once per release train (§5.4), never per commit, so parallel sessions
  do not collide on `package.json`.

## 2. Content items: integer versions

- Content items (`page`, `route`, `preset`, `look`, `routine`) use an integer `version`
  starting at 1, plus `change_kind`, the mig-140 vocabulary:
  - `fix`: wording, colour, spacing; the same blocks in the same order, same settings keys.
  - `structural`: blocks added, removed or reordered; settings keys added or removed; steps
    or rules changed.
- A version row is immutable once published. Correcting it means publishing the next one.
- Each version carries a one-line `note` written by the publisher; it is the item's
  changelog, shown on the item page and in "v3 is out" notices.
- Code items in the exchange show their package semver; their changelog is the package
  `CHANGELOG.md` (§1, §5.3).

## 3. Pinning and migrating stored documents

Lane D's lesson (`SMART_COMPONENTS_KIT_2026-11-08.md` §3–4): a published Puck doc stores
block ids, prop names and part names, and nothing else pins them. A rename silently breaks
every live page that saved the old name. The frozen list for hidden-enneagram and
katie-the-potter is in that doc's §4.

### 3.1 Puck documents (pages, route templates)
1. **Never rename** a block id, prop name, part name, Studio or route key. Reason: published
   docs in `site_config` (`puck:<slug>`) hold them and are not versioned.
2. **Add, with defaults.** A new prop has a default in the block's `PropDef`; reading code
   treats a missing prop as that default (`packages/blocks/src/coerce.ts`). An old doc then
   renders as before.
3. **Strip resolved keys before save.** Resolver output is never stored (`stripResolvedKeys`;
   kit §3 proposes deriving the list from the block config). A template snapshot goes
   through `sanitizeDoc` (mig 257 header; hub-cards PLAN line 83).
4. **Breaking change = new block id.** Ship `<id>-2` beside `<id>`; the old block keeps
   rendering, leaves the insert menu, and gains an `upgrade(props) → { type, props }` that
   the editor applies when the doc is opened. The next Publish writes the new form. No bulk
   rewrite of live docs without a dry run on a copy, a DB backup and the owner's OK.
5. **No version stamp inside docs.** Docs do not carry `_v` props; the block id is the
   version. Provenance (which exchange item and version a page came from) lives in
   `exchange_uses` (`EXCHANGE.md` §3.3).
6. **Review gate:** any change to a block in the frozen list is reviewed by the lane D owner
   (session system32-a1 on 2026-11-08) before merge.

### 3.2 Page templates
A template is a snapshot (mig 257). Pages made from it own their copy and never move with
it. Updating the template publishes a new version; copies are told, not changed.

### 3.3 Presets
- A preset stores `{ kind, values }`. On apply, values are filtered to `PRESET_KEYS[kind]`
  (`packages/studio/src/forms/presets.ts`); unknown keys are dropped and listed to the person
  ("2 settings no longer exist and were skipped").
- Renaming an answer key needs an alias entry kept for at least one deprecation period (§4),
  so stored presets keep applying.
- A preset never carries content (title, body, date, picture), as `presets.ts` states.

### 3.4 Routines and ladders
- A run pins `course_version_id` (mig 140/141). A `fix` version fast-forwards open runs; a
  `structural` one is adopted explicitly by the person.
- Step task ids are action ids; they are frozen because published course versions store
  them (`packages/actions/src/catalogue.ts` header).

### 3.5 Looks and tokens
Look values (`house`, `ember`, `glaze-lab`, `profile`; Site style `Quiet`, `ÆON`) and
`--eac-*` custom properties used in org CSS are frozen contracts. A changed look is a new
value; the old one maps to it in `defineLooks`.

## 4. Deprecation policy

1. **Announce:** a `Deprecated` entry in the package `CHANGELOG.md` naming the replacement,
   and a `@deprecated` JSDoc on the export or block config.
2. **Hide:** out of insert menus, pickers, the exchange and MCP listings. Still renders,
   still applies where already used.
3. **Measure:** a query lists every live use (Puck docs in `site_config puck:%`, presets,
   course versions). Store the query in the changelog entry.
4. **Remove** only when uses are zero, or after a data migration converts them, and no sooner
   than 90 days after step 1. Removal is a major (or `0.x` minor) bump and an owner decision.
5. Exchange items are retired, never deleted (`EXCHANGE.md` §3.5).

## 5. Branches, commits and the release train

### 5.1 Branches
- `main` is what the last train deployed plus merged day branches.
- One day branch, `work/YYYY-MM-DD`, cut from `main` after the morning snapshot; all sessions
  commit to it; merged to `main` (fast-forward) at the end of the day by the PM.
- A session needing isolation uses a worktree on `work/YYYY-MM-DD-<lane>`, merged into the
  day branch by the PM. Not a long-lived feature branch: the shared tree is what runs.
- Remote `claude/*` and `copilot/*` branches are reviewed by the PM before merge; they are
  not built.

### 5.2 Commits
- **Explicit paths only:** `git add <path> …` or `git commit -- <path> …`. Never `git add -A`
  or `git commit -a`: the tree holds other sessions' uncommitted work
  (`.claude/rules/00-working-style.md`).
- Message: `type(scope): what changed` with `type` in feat, fix, docs, refactor, chore, db
  and `scope` = package, app or workspace (`forms`, `hub,ifac`, `platform-exchange`). The body
  cites the plan doc and section, migrations by number, and any frozen contract touched.
- Agent sessions end the message with their attribution trailers (`Co-Authored-By`, the
  session link).
- Snapshot commits are the PM's, once a day, after a secret scan (`CONTRIBUTING.md` §5).
- Migrations: commit the file when written; record "applied" on the PM board when the owner
  or PM runs it. Never edit an applied migration.

### 5.3 Changelog convention
- One `CHANGELOG.md` per exchange-facing package (§1), Keep a Changelog headings: `Added`,
  `Changed`, `Deprecated`, `Removed`, `Fixed`, `Contracts` (stored ids added or touched).
- Sessions add lines under `## Unreleased` in the commit that makes the change, one line
  each, with the commit's subject and the plan doc. Append-only, so parallel sessions merge
  cleanly.
- At a train, the PM moves `Unreleased` under `## <version> · train-YYYYMMDD-N` and bumps the
  version.
- Other packages and apps need no changelog; their history is `git log -- <path>`.

### 5.4 Release train
- The PM runs trains; sessions do not build or deploy apps outside one.
- Order: migrations reviewed and applied (owner approval) → `.next` backups → builds in the
  listed order → edge checks (200 signed out, 307 for gated routes) → logs clean → log file
  `~/eac-backups/next/train-YYYYMMDD[-N].log`.
- After a successful train: tag the deployed commit `train-YYYYMMDD-N` (annotated, listing
  apps and build ids), fold changelogs, push `main` and the tag. Then "what code is live on
  ifac" is `git describe`.
- A failed app in a train is rolled back from its backup and listed in the log; the tag
  names only the apps that went out.
