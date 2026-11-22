# Build spec, wave 1 (2026-11-20)

PM: Manjushri. Read `DOCTRINE.md` in this folder first (10 minutes). This file is the contract between three build lanes that run at the same time. Where this file and the doctrine disagree, this file wins.

## Justin's decisions (2026-11-20, "take all recs")

1. One stored look: `morph` (extended) is the one look format. Puck's Style panel values (`blkStyle`) are read through it. No stored page is converted.
2. Editing a record's value on a page changes the record itself, with a line that says so.
3. Org pages get drafts. A machine proposes, a person publishes.
4. Assistant read tools first. The parked `mcp_grants` migration and one arts-collective rebuild are approved; the PM runs both.
5. The other session's "in-house generator" folds into this plan.
6. His steer, verbatim: "act to align code base to this central editor as we go. make your best judgement calls but act swiftly accepting some things may get cut. keep in mind the live editor idea. and users wouldnt upload code but i should be able to get have full site and access and development capability in apps/developement".

Meaning for you: ship the smallest thing that works in each task, cut scope rather than stall, write down each cut. No user-uploaded code anywhere. `apps/development` becomes Justin's (network admin's) console onto every site.

## House rules that bind every lane

- Everything is on eris: `ssh eris '<cmd>'`. Repo `~/eac`. Write files by `scp` from your scratch folder or a quoted heredoc. Never build or install on the host.
- **The tree is shared and uncommitted (about 770 files).** Do not commit, stage, stash, revert, format or "tidy" anything. Other teams are editing right now: the development-app board's workers (`docs/open/DEVELOPMENT_APP_2026-11-20/BOARD.md`: V versions, S sample world, F free-move in `packages/direct-edit/src/canvas/*`, T, L, P) and the Puck 0.24 session (`packages/page-builder/src/editor.tsx`).
- **Prefer new files.** In a file someone else may be editing, make the smallest additive hunk, re-read the file immediately before you edit it, and never rewrite a whole file.
- Source only. No rebuilds, restarts, migrations, `pnpm install`, emails, or writes to the production database (`elkdonis_dev` IS production). A DB test runs inside `BEGIN ... ROLLBACK` or does not run.
- Puck is `@puckeditor/core` **0.24.0** (installed today). `~/eac/.claude/rules/areas/puck-blocks.md` is binding; read it.
- Run scripts in a one-off container, never through an app container's pnpm:
  `sudo -n docker run --rm -u 3003 -v $HOME/eac:/app -w /app/<dir> eac-dev node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs <script.mts>`
  (add `--network eac-network --env-file $HOME/eac/.env` only when a read needs the DB). Blocks evaluate JSX at import: start a tsx script with `import React from "react"; (globalThis as any).React = React;` and then `await import(...)` the rest.
  Type-check: `... -w /app/packages/<pkg> eac-dev pnpm check-types` (script name is `check-types`).
- `tsc` is already red in places from other people's files. Record the error list for your packages BEFORE you start and AFTER; your files must add none.
- Tests: there is no test runner. Each lane ships one runnable check script (`scripts/check-*.mts` in its package) that prints `N passed, M failed` and exits non-zero on failure. Write the check first, watch it fail, then write the code.
- Plain words in anything a site owner reads (labels, messages, errors). No jargon, no em dashes.
- When you start: append your lane letter, owned files and plan to `BOARD.md` here (`cat >>`, never rewrite). When you finish: append what shipped, what was cut, the check output, and the before/after `tsc` error counts.
- You may use up to 3 helpers (Agent tool, `model: "sonnet"` or `"haiku"`, `subagent_type: "general-purpose"`) for narrow, well-briefed pieces with disjoint files. Give them this file's rules. Check their work before you rely on it.

## Shared contracts (do not change without posting on the board)

### C1. The look: `props.morph` v1, extended in place

```ts
// packages/direct-edit/src/block/morph.ts (lane LOOK owns)
interface NodeMorph {
  v: 1;
  parts?: Record<string, PartLook>;      // part name -> look
  tokens?: Record<string, string>;
}
// PartLook = PartStyle plus two OPTIONAL reserved keys. A stored v1 look has neither and means exactly what it means today.
type PartLook = PartStyle & {
  states?: { hover?: PartStyle; focus?: PartStyle; active?: PartStyle };
  at?: { sm?: PartStyle; md?: PartStyle };   // sm: container/viewport <= 480px, md: <= 820px
};
```
- Helpers keep their names and meanings: `partLookOf(props, part)`, `setPartLook(props, part, look)`, `tokenOf`, `setToken`, `cleanMorph`, `morphCss`. New: `partLookAt(props, part, where)` and `setPartLookAt(props, part, where, look)` with `where = { state?: "hover"|"focus"|"active"; at?: "sm"|"md" }` (both absent = the base look). All are re-exported from `@elkdonis/direct-edit/puck/morph`.
- Reserved look keys on a block's props, exported as `LOOK_KEYS` from `packages/direct-edit/src/block/contract.ts`: `["morph", "look"]`. No content step may write them; no look step may write anything else.

### C2. The one door: `@elkdonis/house-editor/steps` (lane DOOR owns)

Pure and server-safe (no React, no DOM, no DB). New export path `"./steps": "./src/steps/index.ts"` in `packages/house-editor/package.json`.

```ts
export type Step =
  | { op: "set_prop";  block: string; prop: string; value: unknown }
  | { op: "set_look";  block: string; part: string; look: Record<string, unknown> | null; state?: "hover"|"focus"|"active"; at?: "sm"|"md" }
  | { op: "set_token"; block: string; name: string; value: string | null }
  | { op: "insert";    type: string; zone?: string; index?: number; props?: Record<string, unknown> }   // zone default "root:default-zone"
  | { op: "move";      block: string; zone?: string; index: number }
  | { op: "duplicate"; block: string }
  | { op: "remove";    block: string };

export interface StepContext {
  contracts: Readonly<Record<string, BlockContractLike>>;  // contractOf(blocks) satisfies it
  config?: unknown;        // the published Puck config; required for insert/move/duplicate/remove
  allowUnknownTypes?: boolean;   // a block type missing from `contracts` is kept untouched; steps ON it are refused
}
export interface StepResult {
  ok: boolean;
  doc: PageDoc;                    // unchanged when !ok
  side: "words" | "look" | "structure" | null;
  code: string;                    // stable machine code, e.g. "unknown_part", "not_a_look_value", "bound_prop"
  say: string;                     // plain words for a person
  touched?: string[];              // block ids written or created
}
export function applyStep(doc: PageDoc, step: unknown, ctx: StepContext): StepResult;
export function applySteps(doc: PageDoc, steps: unknown[], ctx: StepContext): { ok: boolean; doc: PageDoc; results: StepResult[] };  // stops at the first refusal, returns the original doc
export function fingerprint(value: unknown): string;
export function sidesOf(node): { words: Record<string, unknown>; look: unknown };
```
- Start from `apps/development/src/ideas/manjushri/ops.ts` (17 checks pass against the real hero-banner contract; the check script is in the PM's notes below). Keep its refusal wording.
- Words and slots: a step never drops, reorders or rewrites a block it was not aimed at. A document with block types the context does not know goes in and comes out byte-identical apart from the aimed-at block.
- Structure steps run on Puck's own reducer (`createReducer` from `@puckeditor/core/internal`), wrapped in ONE module, `src/steps/engine.ts`, and nowhere else. Verified working on 0.24: bootstrap a bare private state, reduce `{type:"setData", data}`, then `insert` / `duplicate` / `move` / `replace` / `remove`. Silence its `console.warn` on `setData`.

### C3. Drafts: `@elkdonis/page-builder/server` (lane DOOR owns `packages/page-builder/src/drafts.ts`)

No migration. A draft is one `site_config` row: `org_id`, key `puck-draft:<slug>`, value
`{ v: 1, data: <Puck doc>, base: <updated_at::text of the live row the draft started from, or null for a new page>, author: { id, kind: "person"|"assistant", label }, note?: string, steps?: unknown[], savedAt: <ISO> }`.
```ts
loadDraft(orgId, slug): Promise<PageDraft | null>
saveDraft(orgId, slug, draft: { data; base; author; note?; steps? }): Promise<{ ok: boolean; error?: string }>   // validatePage + the same sanitisers savePage runs
publishDraft(orgId, slug): Promise<SavePageResult>   // savePage(orgId, slug, data, draft.base): a changed live row answers stale and publishes nothing; on success the draft row is deleted in the same transaction
discardDraft(orgId, slug): Promise<void>
listDrafts(orgId): Promise<Array<{ slug; author; note; savedAt; base }>>
```
`listPages` must keep ignoring `puck-draft:` rows (check it). Public routes never read a draft.

### C4. Field ids (the live editor)

One grammar, the one `packages/house-editor/src/fields/registry.ts` already uses for `data-field`, extended with two owners:
- `block:<page slug>:<block id>:<prop>`: a setting of a block on a page. Saved as a `set_prop` step.
- `record:<kind>:<id>:<field>`: a field of a record a block draws (kind `thread` first). Saved through that record's catalogue action and gate, never as a block prop.

### C5. Smart components: a block reads its surroundings before it asks for settings

Justin, 2026-11-20: "better react components that operate more largely in the environments rather than by ui ... smart components that understand the flow of ux". This is the direction of `docs/open/SMART_COMPONENTS_KIT_2026-11-08.md` (read its section 2) and of the record blocks (`packages/blocks/src/blocks/record-parts.tsx`: one setting, `record`, empty = the record in the address). It is doctrine rule 8. In this wave it is a declaration, not a rewrite:

```ts
// packages/blocks/src/types.ts, on BlockDef: additive, optional, data only (lane MACHINES adds the type; no block's behaviour changes)
reads?: readonly BlockRead[];
type BlockRead =
  | { from: "route";  what: "record"; kinds?: readonly string[] }   // the record in the address (routeRecord)
  | { from: "site";   what: "org" | "theme" | "menu" }
  | { from: "viewer"; what: "signed-in" | "role" | "membership" }
  | { from: "record"; via: string; kinds: readonly string[] }        // a binds prop naming a record
  | { from: "place";  what: "placement" }                             // where it sits on the page (metadata.placement)
  | { from: "flow";   what: string };                                 // a step of a journey it knows (rsvp, checkout, booking)
```
- Lane MACHINES: add the type, fill it for the blocks that already behave this way (the record blocks, `feature-card`, `featured-person`, `thread-feed`, `checkout`/`rsvp`), and carry it in the manifest. `describe_block` then tells an assistant what a block will work out for itself.
- Lane DOOR: where a value comes from the surroundings, the live editor says where ("From the gathering in the address") instead of offering a setting.
- Not in this wave: a shared environment object for blocks. Resolvers already receive `metadata` (`orgId`, `slug`, `placement`, the record); note in your report what a block could not learn from it.

### What Puck 0.24 adds that you may use (lane P, read from the bundle, not run)
- `<Render fieldTransforms>` on the published route (`puck-0.24.0/dist/rsc.js:930`): rewrites a prop's value by field type before the block draws. It does not wrap the block. Lane DOOR may weigh it against part selectors for marking editable text; it turns a string into an element, which breaks blocks that do string work on the value, so part selectors stay the default.
- Slots forward extra props (`data-*`, `className`) to their element (`rsc.js:763`).
- `dnd.enableDragHandle` and `ActionBar.DragHandle`: a dedicated grip, so the rest of a block's surface need not start a drag.
- Unchanged and still binding: `replace` runs no resolver; the `look.items` walk trap is NOT fixed in 0.24 (`index.js:1597`); only `props` reach the public page; `internal.js` is identical.

## Lanes

### Lane LOOK (`packages/direct-edit/src/block/**`, plus the three small hunks named below)
1. **Close the public-500 trap.** In `packages/page-builder/src/config.tsx` the hidden field for `morph` becomes a hidden object field (`{ type: "object", objectFields: {}, visible: false }`, as `look` already has). First prove the trap on 0.24 with a check: a block with a slot named `items` and a stored `morph.parts.items` through `resolveAllData` from `@puckeditor/core/rsc`. If 0.24 no longer walks it, say so, and still make the change. Also make `createCatalogue` (`packages/blocks/src/registry.ts`) throw at module load when a block declares a part named like one of its own slots.
2. **Keep every look key across the settings sheet.** `packages/direct-edit/src/canvas/tree-editor.ts` near line 553 keeps only `morph` when the host's editor hands a block back. Keep every key in `LOOK_KEYS` the same way. Worker F is editing this file today: one small hunk, re-read first.
3. **States and screen sizes in the stored look** (contract C1): cleaner, compiler and helpers. `morphCss` emits `:hover` / `:focus-visible` / `:active` rules and size rules after the base rules, all scoped and `!important` like today. A v1 morph must compile to byte-identical CSS before and after your change: prove it in the check over at least 12 varied morphs. Choose container query or media query, test it at 390 px and 1280 px in the harness pattern of `~/scratch/manjushri/h/` (esbuild bundle + headless Chromium), and write down which and why. No panel UI in this wave.
4. **One look reader.** `packages/direct-edit/src/block/read-look.ts`: `readLook(node, def)` returns, per part, the base look, states and sizes, plus what `blkStyle` (`packages/page-builder/src/style/`) and a box `look` add at the root, and a `conflicts` list where two sources set the same CSS property on the root. Read-only: it must not change what any page emits. direct-edit must not import page-builder: take the `blkStyle`-to-declarations function as an argument.
Check script: `packages/direct-edit/scripts/check-look.mts`.

### Lane DOOR (`packages/house-editor/src/steps/**`, `packages/page-builder/src/drafts.ts`, `packages/house-editor/src/fields/**`, the block-mark hunk in `packages/page-builder/src/config.tsx`)
1. **The steps module** (contract C2), with `packages/house-editor/scripts/check-steps.mts`: the 17 existing checks, then structure steps, unknown-type pass-through (byte-identical), and `applySteps` stopping whole on a refusal. `set_look` with `state`/`at` calls lane LOOK's `setPartLookAt` when it exists; until then it refuses those two with code `not_yet`.
2. **Drafts** (contract C3), with a check that runs its SQL inside `BEGIN ... ROLLBACK` against a made-up slug on one real org, and leaves no row.
3. **The live editor reaches block content** (contract C4). Today the Fields lens only finds hand-placed `[data-field]` marks and nothing a block draws carries one. Make it generic from what blocks already declare:
   - a block's `parts` entry with a `prop` names the element that draws that setting. When a page is drawn for someone who may edit it, `buildPuckConfig` (a new opt-in option, default off, public pages byte-identical when off) puts a marker before each block carrying the block id and type; the lens resolves each such part to its element and offers it for editing with id `block:<slug>:<id>:<prop>`. Plain `string` and `text` settings only in this wave.
   - provenance: where a block shows a record's value because the typed setting is empty (`feature-card.tsx:131`, "typed first; the record fills only what was left blank"), the lens must offer `record:thread:<id>:title` instead, show "This changes the gathering itself, everywhere it appears", and save through the thread's existing catalogue action and gate. Find that action in `packages/actions` (`atlas:q` is described in `docs/sessions/2026-11-16_dock-rails-atlas.md`). If the resolver does not hand the block the record id, add it to what the resolver returns (it must stay out of saved props: resolver keys are stripped on save).
   - saving a `block:` field: one `set_prop` step, through the app's gated page-save action (`createSavePageAction`) with the stale-save guard. A refused step shows its `say` text.
   - Pilot wiring on sunjay only, source only. Prove it with a headless run on a throwaway dev copy with every save request aborted (recipe: `docs/open/HOUSE_EDITOR_ONE_2026-11-20/PROGRESS.md`, "PM: signed-in browser checks"). If the dev-copy run is out of reach, say so and deliver the check at unit level.
   Cut order if short of time: record provenance is kept, the sunjay browser proof is cut first.

### Lane MACHINES (`packages/mcp/**`, `apps/development/src/app/sites/**`, `apps/development/src/lib/sites*.ts`, one tab line in `apps/development/src/components/TopBar.tsx`)
1. **Block manifest.** One function that builds the manifest for a catalogue from `contractOf(blocks)` plus what `docs/open/DEVELOPMENT_APP_2026-11-20/blocks.json` knows about app-local blocks: id, label, plain description, settings with kinds and limits, slots, parts (with the setting each draws), tokens, binds, what it opens, whether an assistant may see it (default: yes for shared blocks marked `memberSafe`, no otherwise). Shape: `manifest.json` > `block_manifest_example` in this folder.
2. **Six read tools** in `packages/mcp` beside the five that exist, under every rule in `packages/mcp/README.md` (org lock from the grant, default deny, member-written text fenced as untrusted, one audit row per call, the rate limits): `list_pages`, `read_page`, `list_blocks`, `describe_block`, `find_fields`, `list_surfaces`. `read_page` keys strictly by the grant's org (`puck:home` exists under several orgs). `find_fields` returns ids in the C4 grammar. Extend the package's own in-process test (`pnpm --filter @elkdonis/mcp test` equivalent in a one-off container) to cover them, including a cross-org read that must be refused.
3. **Prepare, do not run:** copy `docs/open/mcp-foundations/migrations/NNN_mcp_grants.sql` to `packages/db/migrations/282_mcp_grants.sql` (281 is taken and not yet applied; check the folder first and take the next free number). The PM applies it and rebuilds arts-collective.
4. **The Sites door in `apps/development`** (network admins only; every page and every server action calls the gate in `src/lib/gate.ts`). New tab "Sites":
   - `/sites`: every organisation that has pages, with its page list (title, address, last change, whether a draft is waiting).
   - `/sites/[org]/[...slug]`: that page's stored document drawn with every block this app can load (the registry in `src/registry/`), a labelled placeholder for any block it cannot load (never dropped from the document), the page's blocks as a list, and the document itself.
   - Editing arrives when lane DOOR's steps and drafts land: the three hands from `src/ideas/manjushri/OneDocument.tsx` on a real page, every change a step, saved as a **draft** for that org with author = the signed-in admin; "Publish" calls `publishDraft` and is offered only when every block type on the page is one this app could check. Build the read-only part first so it stands alone; wire editing behind the C2/C3 contracts as soon as the files exist (ask the PM if they have not landed when you get there).
   - Six other workers are editing `apps/development` today. Your files are new; the one shared line is the tab in `TopBar.tsx`.
Check script: the MCP test, plus `apps/development` type-check with no new errors.

## PM notes
- Verified on 0.24.0 today: step logic 17/17, headless reducer 8/8, demo page 25/25 in headless Chromium, live sites answering. Scripts: this session's scratch (`mj-test.mts`, `mj-headless.mts`); harness `~/scratch/manjushri/h/` on eris.
- The frozen Puck 0.23.0 is at `~/scratch/manjushri/puck-0.23.0/`; lane P is writing the 0.23 to 0.24 differences into `puck-internals.md` and `seams.json`.
- Go-live (migrations, rebuilds) is the PM's, after review.
