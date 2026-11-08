# Contributing to the EAC platform (draft, 2026-11-08)

Guidelines for the owner, the Claude sessions working in the shared tree, and outside
contributors to the public repo `GuruDharamSingh/eac-repo`. Draft: once D-1 and D-2 are
decided it moves to the repo root as `CONTRIBUTING.md`, with a root `LICENSE`.

## 1. Before you start

- Read `CLAUDE.md` (facts that prevent damage), then `docs/reference/<area>.md` for the
  subsystem. `docs/open/` holds plans; check them against `reference/` before acting.
- The maintainer's rule files (`.claude/rules/*.md`) are untracked (`.gitignore:70`).
  Outside contributors get their content from `CLAUDE.md`, `docs/README.md` (writing rules)
  and this file. When a rule here and one there disagree, the rule file wins and this file is
  corrected.
- The database `elkdonis_dev` is production and the Stripe keys in `.env` are live. Never run
  probe scripts, create Stripe objects or write to the DB to "try something".
- There is no CI and no automated test suite. Verification is manual
  (`docs/reference/testing.md`): `pnpm --filter <pkg> check-types` in a container, and a
  harness render where one exists (`scripts/forms-harness`, `scripts/hub-cards-harness`,
  `scripts/channel-harness`) at 1280 and 390 px.

## 2. Code style per package type

Common to all: TypeScript, Prettier (`.prettierrc.js`), the `check-types` script name (turbo
skips other names). Comments state what code does and why; they cite plan docs as
`docs/open/<FILE>.md §n`.

| Type | Examples | Rules |
|---|---|---|
| Source-exported package | `services`, `blocks`, `hub`, `actions`, `studio` | Keep it compiling between edits: one broken file in `services` fails 17 apps (`packages.md` §Source-exported). Add it to each consumer's `transpilePackages`. |
| Dist package | `db`, `types`, `auth-server`, `email`, `ui` | Rebuild after editing `src` before trusting an app's type check; apps read `dist/*.d.ts`. |
| Client/server split | `blocks`, `page-builder`, `commerce`, `actions` | Root entry client-safe; database code only in `./server`. One `@elkdonis/db` import reachable from a client component ships `postgres` to the browser (`scripts/check-client-barrels.mjs`). |
| UI | `cms-ui`, `primitives`, `hub`, `studio` | Plain CSS on `--eac-*` tokens; no Mantine in new code (five legacy apps only). React 19 types: `React.ReactNode` via the namespace import, not a named type import. `cms-ui` must not import `primitives`. |
| Blocks | `packages/blocks/src/blocks/`, app `src/blocks/` | `defineBlock` data first; interactive parts in a `.client.tsx` island; ids, props, part names frozen once live (`VERSIONING.md` §3). |
| Apps | `apps/*` | Acting user from `getServerSession()`, never request params; filter content by `org_id`; external URLs from `publicOrigin()`; capabilities for more than one org go in a package or arts-collective `/hub`, not one app. |
| SQL and migrations | `packages/db/migrations` | `\d <table>` before writing SQL; jsonb via `db.json(x)`; no backtick inside a `db\`…\`` template; additive (`IF NOT EXISTS`, nullable or defaulted); next number chosen immediately before writing (`/new-migration`); never edit an applied file. |
| Docs | `docs/**` | Neutral register, claims labelled verified / assumed, `path:line` citations, dated status lines (`docs/README.md`, end). |

## 3. How to add things

### 3.1 A block or smart component
1. Declare it with `defineBlock` (`packages/blocks/src/registry.ts:40`) in
   `packages/blocks/src/blocks/<id>.tsx` if more than one site could use it, else in the
   app's `src/blocks/`. Prefix app-only ids (`he-`, `ktp-`).
2. Give every prop a default. Islands (audio, booking, popups) render inside `<div inert>`
   while editing (`editingOf(puck).drawn`, kit §2.4). Use the Puck block id, not `useId`, for
   DOM ids.
3. Record-reading blocks take `site`, read through a record source (kit §2.2), declare their
   resolved keys, and never write; writes go through the action registry.
4. Register it in the host's `createCatalogue` (`registry.ts:81`).
5. Render it in a harness or a dev page at both widths; type-check the package and one host.
6. Once a live site saves it, add the id to the frozen list (kit §4) and, from phase 1, a
   code-catalogue entry in the exchange (`EXCHANGE.md` §2).

### 3.2 A hub card
1. `defineHubCard` / `defineHubCardServer` (`packages/hub/src/contract.ts:164-168`):
   `load(site, viewer)` for the face, `loadDetail` for the pop-up.
2. Chrome-free; the host passes connectors. Guards run on the server for every write.
3. Render in `scripts/hub-cards-harness`; pilot on one host (sunjay was the Site Builder
   pilot, `c50f354d`) before mounting elsewhere.

### 3.3 An action (registry entry)
1. Add plain data to `packages/actions/src/catalogue.ts`: `id`, `label`, `describe`, `scope`,
   `area`. The id is frozen: course versions store it.
2. A runner, if performable, in `packages/actions/src/server/` with a zod input; it saves
   drafts unless the door is the host's own (`via: 'app'`).
3. Agent exposure is opt-in in `packages/actions/src/agent.ts` (`withAgent`; default deny;
   never `appOnly`).
4. Run `check:registry` (`packages/actions/package.json:29`).

### 3.4 A preset, template or look
Content items go through the exchange (`EXCHANGE.md` §3), not code. A platform default
(shipped to everyone) goes in code: `PLATFORM_PRESETS`, `STORE_TEMPLATES`, an app's
`pageStarts`, `defineLooks`, with a code-catalogue entry.

## 4. Review expectations

The model is the cross-lane review of 2026-11-08 (`PM_BOARD_2026-11-08.md`, "Cross-lane code
review: DONE"): a reviewer from another lane reads the diff, not the author's summary.

- Findings are numbered and graded **Blocker** (unsafe or loses data; fixed before merge),
  **Fix before live** (fixed before the next train), **Follow-up** (an open item with an owner).
  Each cites `path:line`, and the fix commit is cited back on the board (`94f2040` fixed
  forms #5–8; `b005399` hub #1–3).
- Standing reviewers:
  - stored blocks, props, route keys: the lane D owner;
  - migrations: the PM reads them (additive, numbered), the owner approves the run;
  - privacy (visibility, join links, `Private/` media, cross-org reads): a privacy pass
    before live;
  - registry and MCP exposure: the MCP lead.
- The reviewer checks what a summary hides: side effects at draft time (forms #5 created a
  public Talk room from a partial title), door checks (hub #1, `appOnly` via the dock), and
  races (8 buyers for one original, `7d6540c`).
- Authors state in the commit body what they verified and how (type check exit code,
  harness widths, query).

## 5. Secrets hygiene in a public repo

The repo is public; anything committed is published, including history.
- Never commit `.env*` (only `*.example`, `*.template` are allowed, `.gitignore:10-20`),
  keys (`*.key`, `secrets/`), tokens, MCP keys (`eacm_…`), JWT secrets, connection strings
  with passwords, Stripe or Meta ids with secrets, or Nextcloud app passwords.
- Docs and board entries name where a secret is kept, never its value (the MCP key line on
  the PM board names a local path, which is the pattern).
- No personal data in docs, fixtures or screenshots: member emails, phone numbers, home
  addresses, payment details. Use the org's public contact or a placeholder.
- Media paths: anything without a `Private/` segment is public on the site too.
- Scan before every push from the shared tree: `gitleaks git --log-opts="origin/main..HEAD"`
  (not installed on eris on 2026-11-08, verified with `which`; D-8). The morning snapshot is
  scanned before it is pushed (`ad58fbd`, "secret scan clean").
- If a secret is pushed: rotate it first (it is already public), then remove it from the tree,
  then decide with the owner whether to rewrite history. Rewriting does not reach forks or
  caches.

## 6. Licences

Today the repo has no `LICENSE` file and no `license` field (`package.json`), so the code is
all rights reserved by default even though it is public. Adapted third-party code is credited
in `NOTICE` (Cerberus, Colorlib email templates, MIT).

| For | Options | Recommendation |
|---|---|---|
| Platform code | MIT, Apache-2.0, MPL-2.0, AGPL-3.0-or-later | **AGPL-3.0-or-later** (D-1): the platform is a network service; AGPL keeps hosted forks open; it matches Nextcloud and Silex, which the platform extends (licences assumed, check before adoption); MIT- and Apache-licensed dependencies are compatible. Leaf packages useful on their own (`tokens`, `gradients`) may later carry MIT in their own folder. |
| User-made exchange items | CC0, CC-BY-4.0, CC-BY-SA-4.0, org-only (no licence) | **CC-BY-4.0 for network items, org-only for org items** (D-2): credit is required, which the credits page already provides; reuse and forks stay free; SA would bind every page built from a template. |
| Contributions | CLA, DCO | **DCO** (`Signed-off-by`) for outside contributors; the owner and agent sessions are covered as the collective's own work. Relicensing is easiest now, before outside contributions. |

## 7. Attribution

- Adapted code: an entry in `NOTICE` naming the source, its licence, and the files that use it
  (follow the existing Cerberus entry). Copy the licence text if it requires it.
- Agent work: commit trailers name the model and session (`Co-Authored-By`, session link).
- Exchange items: `credits` on the envelope, carried through forks; shown on the item page and
  the applying org's `/credits` page (`EXCHANGE.md` §4).
- A design lifted from an org into code keeps its credit in the code catalogue entry and a
  `NOTICE`-style line.

## History
- 2026-11-08: drafted in `docs/open/platform-exchange/` (design session).
