# Lane MACHINES: report (2026-11-20)

Status: DONE_WITH_CONCERNS (all four tasks shipped in source; nothing built, migrated, restarted or written to the database; the concerns are at the end).

## What shipped, per task

### 1. Block manifest
- Builder (pure): `packages/mcp/src/manifest/build.ts:121` `buildManifest({ contracts, defs, catalogue })`; shapes in `src/manifest/types.ts`; reader `src/manifest/index.ts` (`manifest()` gives `file`, `byId`, `visible`).
- Generated, checked in: `packages/mcp/src/manifest/blocks.generated.ts` (184 blocks: 49 shared, 4 box, 131 app-local; 48 visible to assistants). Built by `packages/mcp/scripts/build-manifest.mts` from `contractOf` of the shared catalogue (plus the record parts, with a no-op host action for checkout and rsvp) and `docs/open/DEVELOPMENT_APP_2026-11-20/blocks.json` for everything the script cannot import. `--check` exits 1 when the file is out of date (`ok   manifest is current (184 blocks)` at the end). `package.json` scripts: `manifest`, `check-manifest`.
- Per block: id, label, plain description, category, owner, source, offeredBy, styling, memberSafe, interactive, dataDriven, settings (kind, label, options, min/max/step/unit, rows columns, `binds`, `fieldable`, `boundFrom`), slots, parts (with the setting each draws), tokens, binds, opens, `reads` and `readsPlain` (C5), `agent: { read, why }`.
- Assistant visibility: `read` is true only for `owner === "package:blocks"` and `memberSafe` (so `contact-form` is hidden, and every app-local and box block is hidden). `reads` is filled for the blocks the spec names.

### 2. Six read tools
- `packages/mcp/src/server/site-tools.ts`: `list_pages` :58, `read_page` :92, `list_blocks` :120, `describe_block` :141, `find_fields` :156, `list_surfaces` :172. Registered from `tools.ts:335` (`registerSiteTools(server, ctx)`); `readTool`, `refuse` and two types are now exported from `tools.ts` (the only edits there).
- Pure half: `src/server/site-read.ts` (`fenceDocument` :34, `walkBlocks` :78, `findFields` :154, `referencedThreads` :116, `opensOf` :202, `isPagePath` :24).
- Rules kept: org from the grant through `settleOrg` (default deny for an org Justin does not run, a bound key never reaches another org); `read_page` and `find_fields` key strictly by the settled org (`puck:home` exists under danamccool and hidden-enneagram: the test proves each key reads its own row and that a key bound to sunjay, which has no home, gets "no such page" and nothing from another org); page text stripped and capped (`plain`) and listed under `untrusted`; one audit row per call and the same rate limits (via `readTool`); `list_surfaces` is `heavy` (it reads up to 40 pages).
- `find_fields` ids follow C4: `block:<page>:<block id>:<setting>`, and `record:thread:<id>:title` where a block shows a record's value because its typed setting is empty (feature-card title; `notice`: "This changes the post or gathering itself, everywhere it appears."). A record field is offered only when the thread belongs to the settled org (one `WHERE org_id = <settled org>` query).
- Host reader: `read_page`, `find_fields` and `list_surfaces` load pages through `host.pages.loadPageWithVersion` (new optional `McpPages` in `src/server/types.ts`; packages/mcp does not depend on the page builder). One small additive hunk in `apps/arts-collective/src/app/api/mcp/route.ts` passes it (see hunks). Without it the tools say the reader is not connected.
- C5 declaration: `BlockRead` and `BlockDef.reads` added to `packages/blocks/src/types.ts` (exported from `index.ts`); `reads:` on feature-card (`feature-card.tsx:207`), featured-person (`:114`), thread-feed (`:236`), record-header/body/facts (`record-parts.tsx:199,249,299`), checkout (`:401`), rsvp (`:471`). Data only: no block's behaviour changed.

### 3. Migration prepared, not run
- `packages/db/migrations/282_mcp_grants.sql`: a byte copy (`cmp` clean) of `docs/open/mcp-foundations/migrations/NNN_mcp_grants.sql`. 281 is `281_dev_versions.sql` (applied by the PM); nothing else held 282.

### 4. The Sites door (`apps/development`)
- Tab "Sites" (one line in `components/TopBar.tsx`).
- `/sites` (`src/app/sites/page.tsx`): every organisation with pages or drafts (5 today: danamccool, sunjay, elktours, hidden-enneagram, katie-the-potter), each page's title, address, last change, draft waiting.
- `/sites/[org]/[...slug]` (`src/app/sites/[org]/[...slug]/page.tsx`, `src/components/sites/SitePageView.tsx`): the stored document drawn with every block the registry can load (each top-level block in its own error boundary), a labelled placeholder for any block it cannot load (kept in the document, never dropped), the blocks as a list (which are drawn, placeholders, drawn with example data, can be changed here) and the document as data. Published page and waiting draft on tabs.
- Server module `src/lib/sites.ts` (header comment says why cross-org reads are allowed: every page and function is gated); `listSites` and `loadSitePage` call `adminOrThrow()` (which calls `getNetworkAdmin()`) first; both pages call `requireNetworkAdmin`.
- Editing (DOOR's steps and drafts had landed): `src/components/sites/SiteHands.tsx` (Words, Look, Assistant hands, each a step through `applySteps`, refusals in the door's own words) and `src/lib/sites-actions.ts` (`"use server"`): `saveSiteDraft`, `publishSiteDraft`, `discardSiteDraft`, each starting with `adminOrThrow()`. Save re-applies the steps on the server to the page as stored (draft if one waits, else the live page) with the shared and box contracts, then `saveDraft` with author `{ id: admin userId, kind: "person", label: "Network admin, development app" }` (no address kept in the draft). A page that changed since the screen opened answers stale and writes nothing. Publish calls `publishDraft` only when the draft's every block type is one the door can check (`unknownTypesOn`).
- Helpers: `src/lib/sites-doc.ts`, `src/lib/sites-contracts.ts`, `src/lib/sites-door.ts` (re-exports DOOR's steps by relative path, see decisions), `src/components/sites/sites.css` (`st-*` classes, own sheet).

## Decisions
1. Pages for the MCP tools come from a host-provided `pages.loadPageWithVersion` (the one allowed route hunk), not a new dependency: packages/mcp has no link to the page builder in `node_modules` and `pnpm install` is not mine to run.
2. `list_pages` and the draft flag are plain `SELECT`s on `site_config` (always `WHERE org_id = <settled org>`): the existing `listPages` returns a JS Date, not the `updated_at::text` version token an editor must hand back. `read_page` does use the validating loader.
3. Manifest is network-wide with `offeredBy`; `org` on `list_blocks` and `describe_block` is checked against the grant but does not filter (no reliable org-to-app map in the data).
4. Assistant visibility: shared and `memberSafe` only. `find_fields` still lists fields of a site's own (hidden) blocks, each marked `assistantMayEdit: false`, because `read_page` already shows that text; a record's field is always `assistantMayEdit: false` (the thread edit entry is not agent-exposed).
5. `apps/development` does not list `@elkdonis/house-editor` and no link exists in its `node_modules`, so `src/lib/sites-door.ts` re-exports `../../../../packages/house-editor/src/steps/index`. Change that one line to `@elkdonis/house-editor/steps` when the PM adds the dependency and installs.
6. Editing in the Sites door is limited to block types whose contracts the server can load (shared blocks and the four box blocks). A page with any other block can still be edited on those blocks, drafted and read, but Publish is withheld.
7. `feature-card` declares record kind `["thread"]` (the block's help text also says artwork; I did not verify an artwork resolver on any host).
8. `check-manifest` is `build-manifest.mts --check` rather than a separate script.

## Cuts
- `find_fields` takes `{org, slug}` only (the spec's `record?` input is cut).
- No per-org filter on `list_blocks`.
- `list_surfaces` lists pages and thread popups only; `popup:person` opens are not listed (no cheap org check).
- Box blocks have no contract in the manifest (catalogue data only).
- Sites door: no structure steps (insert, move, duplicate, remove: the door answers with its own "no list of blocks" refusal), no editing of a page that is only a draft, no per-site theme in the drawn page (it uses the app's Test theme and the site's scoped sheet for blocks from `registry/local`).
- Real pages not rendered in a browser or under node: a node render of the registry needs CSS and `@/` imports that the one-off container does not give. Verified by `tsc` and the unit check only; Justin's first look is the real test.
- The Sites check was written after the code (the MCP test was written first and watched failing).

## What a block could not learn from `metadata` (C5 note)
Resolvers receive `orgId`, `slug`, `placement` and the record. A block cannot learn from them: who is looking (no viewer, role or membership), the site's theme or menu, which journey step the visitor is on (rsvp, checkout, booking), nor whether a record belongs to this page's route versus a setting. `reads` declares them; filling them needs a shared environment object (not in this wave).

## Check results
- MCP test (in-process, real reads as Justin, writes nothing): see the full output below: 120 passed, 0 failed. Written first: with the six tools and manifest absent the same file failed first (the tool-list check, every `list_pages` and `read_page` check, then it could not load the new `site-read` module) before any tool code existed.
- `scripts/build-manifest.mts --check`: `ok   manifest is current (184 blocks)`.
- `apps/development/scripts/check-sites.mts`: 29 passed, 0 failed.
- `tsc` errors, before (start of the lane) and after: packages/mcp 0 and 0; packages/blocks 0 and 0; apps/development 0 and 0. (apps/arts-collective, touched by one hunk: 0 after.)

## Wiring and go-live (for the PM)
1. Apply `packages/db/migrations/282_mcp_grants.sql` (alone, as 281 was).
2. Rebuild arts-collective (the route hunk compiles `pages` in; the tools are in `packages/mcp`).
3. Mint a key (README steps), then `claude mcp add`.
4. Rebuild `apps/development` to show the Sites tab. It runs the new code only after a rebuild.
5. Optional: add `"@elkdonis/house-editor": "workspace:*"` to `apps/development/package.json`, install, and switch `src/lib/sites-door.ts` to the package path.
6. DOOR's finding applies to Publish: `publishDraft` uses the `::text::timestamptz` form and is unaffected; `savePage`'s guard is not used by my code.

## Concerns
- Not seen in a browser. The Sites screens, the drawing of real pages and the three hands have only been type-checked and unit-checked.
- Most real pages (sunjay, danamccool, hidden-enneagram) are built from the sites' own blocks, so today they are readable and drawable but their app-local blocks cannot be changed or published from the Sites door, and an assistant sees none of those blocks in `list_blocks`.
- `packages/blocks/src/registry.ts` shows as modified in the tree: that is lane LOOK's, not mine.

## Files touched
New:
- `packages/mcp/src/manifest/{types,build,index}.ts`, `packages/mcp/src/manifest/blocks.generated.ts`
- `packages/mcp/src/server/site-read.ts`, `packages/mcp/src/server/site-tools.ts`
- `packages/mcp/scripts/build-manifest.mts`, `packages/mcp/scripts/react-shim.mts`
- `packages/db/migrations/282_mcp_grants.sql` (copy, not run)
- `apps/development/src/app/sites/page.tsx`, `apps/development/src/app/sites/[org]/[...slug]/page.tsx`
- `apps/development/src/lib/{sites,sites-actions,sites-contracts,sites-doc,sites-door}.ts`
- `apps/development/src/components/sites/{SitePageView,SiteHands}.tsx`, `apps/development/src/components/sites/sites.css`
- `apps/development/scripts/check-sites.mts`

Edited (hunks below): `packages/mcp/src/server/{tools,types,index}.ts`, `packages/mcp/scripts/{test,harness}.mts` (also `test.mts` extended: 11-tool list, a new section of site-tool checks), `packages/mcp/package.json`, `packages/mcp/README.md`, `packages/blocks/src/{types,index}.ts`, `packages/blocks/src/blocks/{feature-card,featured-person,thread-feed,record-parts}.tsx`, `apps/arts-collective/src/app/api/mcp/route.ts`, `apps/development/src/components/TopBar.tsx` (one line: `{ href: "/sites", label: "Sites" },` before the Ideas tab).

## Hunks of edited files

`test.mts` and `harness.mts` diffs are in the tree (git diff packages/mcp/scripts); test.mts gains the eleven-tool list check and one new section of site-tool checks.

```diff
diff --git a/apps/arts-collective/src/app/api/mcp/route.ts b/apps/arts-collective/src/app/api/mcp/route.ts
index fb967858..22e79638 100644
--- a/apps/arts-collective/src/app/api/mcp/route.ts
+++ b/apps/arts-collective/src/app/api/mcp/route.ts
@@ -1,2 +1,3 @@
 import { getActiveEnrolment, getCourseBySlug, getLearnerOutline, listMyEnrolments, stepTask } from "@elkdonis/lms";
+import { loadPageWithVersion } from "@elkdonis/page-builder/server";
 import { ACTION_LINKS } from "@/lib/actions/links";
@@ -38,2 +39,4 @@ function mcp() {
       lms: LMS,
+      // The page reader for read_page and find_fields (validates each row on the way out).
+      pages: { loadPageWithVersion },
     }),
diff --git a/packages/blocks/src/blocks/feature-card.tsx b/packages/blocks/src/blocks/feature-card.tsx
index 607f69fb..587138ee 100644
--- a/packages/blocks/src/blocks/feature-card.tsx
+++ b/packages/blocks/src/blocks/feature-card.tsx
@@ -206,2 +206,3 @@ export const featureCard = defineBlock(
     memberSafe: true,
+    reads: [{ from: "record", via: "record", kinds: ["thread"] }],
     styling: "tokens",
diff --git a/packages/blocks/src/blocks/featured-person.tsx b/packages/blocks/src/blocks/featured-person.tsx
index b9abe1af..25bfbfe1 100644
--- a/packages/blocks/src/blocks/featured-person.tsx
+++ b/packages/blocks/src/blocks/featured-person.tsx
@@ -113,2 +113,3 @@ export const featuredPerson = defineBlock(
     memberSafe: true,
+    reads: [{ from: "site", what: "org" }, { from: "record", via: "person", kinds: ["person"] }],
     dataDriven: true,
diff --git a/packages/blocks/src/blocks/record-parts.tsx b/packages/blocks/src/blocks/record-parts.tsx
index 97172bf7..8040050a 100644
--- a/packages/blocks/src/blocks/record-parts.tsx
+++ b/packages/blocks/src/blocks/record-parts.tsx
@@ -3,5 +3,12 @@ import { sanitizeRichText } from "@elkdonis/utils/sanitize";
 import { defineBlock, type PropsOf } from "../registry";
-import type { Block } from "../types";
+import type { Block, BlockRead } from "../types";
 import { sized, srcSet } from "../media";
 
+/** What every record block works out for itself: the record in the address, else the one its setting names, on this site. */
+const RECORD_READS: readonly BlockRead[] = [
+  { from: "route", what: "record", kinds: ["thread", "service"] },
+  { from: "record", via: "record", kinds: ["thread", "service"] },
+  { from: "site", what: "org" },
+];
+
 // ============================================================================
@@ -191,2 +198,3 @@ export const recordHeader = defineBlock(
     memberSafe: true,
+    reads: RECORD_READS,
     dataDriven: true,
@@ -240,2 +248,3 @@ export const recordBody = defineBlock(
     memberSafe: true,
+    reads: RECORD_READS,
     dataDriven: true,
@@ -289,2 +298,3 @@ export const recordFacts = defineBlock(
     memberSafe: true,
+    reads: RECORD_READS,
     dataDriven: true,
@@ -390,2 +400,3 @@ export function checkoutBlock(host: CheckoutHost): Block<CheckoutProps> {
       memberSafe: true,
+      reads: [...RECORD_READS, { from: "flow", what: "checkout" }],
       dataDriven: true,
@@ -459,2 +470,3 @@ export function rsvpBlock(host: RsvpHost): Block<RsvpProps> {
       memberSafe: true,
+      reads: [...RECORD_READS, { from: "flow", what: "rsvp" }, { from: "viewer", what: "signed-in" }],
       dataDriven: true,
diff --git a/packages/blocks/src/blocks/thread-feed.tsx b/packages/blocks/src/blocks/thread-feed.tsx
index 7f86d408..d034ec6c 100644
--- a/packages/blocks/src/blocks/thread-feed.tsx
+++ b/packages/blocks/src/blocks/thread-feed.tsx
@@ -235,2 +235,3 @@ export const threadFeed = defineBlock(
     memberSafe: true,
+    reads: [{ from: "site", what: "org" }],
     styling: "tokens",
diff --git a/packages/blocks/src/index.ts b/packages/blocks/src/index.ts
index 3828362f..f5bc8ffa 100644
--- a/packages/blocks/src/index.ts
+++ b/packages/blocks/src/index.ts
@@ -27,2 +27,3 @@ export type {
   TokenDef,
+  BlockRead,
 } from "./types";
diff --git a/packages/blocks/src/types.ts b/packages/blocks/src/types.ts
index 4f8f829a..2d11d5a4 100644
--- a/packages/blocks/src/types.ts
+++ b/packages/blocks/src/types.ts
@@ -232,2 +232,20 @@ export interface PropDef {
 
+/**
+ * One thing a block reads from its surroundings.
+ *
+ *   route   the record in the address (`routeRecord`); `kinds` limits which kinds of record
+ *   site    the organisation, theme or menu of the site it is drawn on
+ *   viewer  who is looking: signed in, their role, their membership
+ *   record  a `binds` setting (`via`) names a record of one of `kinds`; the record fills what was left blank
+ *   place   where it sits on the page (`metadata.placement`)
+ *   flow    a step of a journey it knows (rsvp, checkout, booking)
+ */
+export type BlockRead =
+  | { from: "route"; what: "record"; kinds?: readonly string[] }
+  | { from: "site"; what: "org" | "theme" | "menu" }
+  | { from: "viewer"; what: "signed-in" | "role" | "membership" }
+  | { from: "record"; via: string; kinds: readonly string[] }
+  | { from: "place"; what: "placement" }
+  | { from: "flow"; what: string };
+
 /** One inner element of a block that a page may restyle. Declared here, never stored. */
@@ -406,2 +424,10 @@ export interface BlockDef {
   silexRoot?: string;
+
+  /**
+   * What this block works out for itself from where it sits, before it asks for a setting
+   * (doctrine rule 8; BUILD_SPEC C5, 2026-11-20). Data only: declaring it changes no block's
+   * behaviour. The live editor says "From the gathering in the address" for a value that comes
+   * from here, and the block manifest tells an assistant (`describe_block`).
+   */
+  reads?: readonly BlockRead[];
 }
diff --git a/packages/mcp/README.md b/packages/mcp/README.md
index 58d1f26f..b6274e93 100644
--- a/packages/mcp/README.md
+++ b/packages/mcp/README.md
@@ -16,2 +16,4 @@ registry. Mounted at `https://arts-collective.com/api/mcp`
 | Tools | `src/server/tools.ts` | `list_my_orgs`, `whats_next`, `routine_steps`, `org_summary`, `entry_status` (ids = catalogue entries with `agent` exposure and a check; never `appOnly`); resource `eac://catalogue` |
+| Site tools | `src/server/site-tools.ts`, `site-read.ts` | `list_pages`, `read_page`, `list_blocks`, `describe_block`, `find_fields`, `list_surfaces` (2026-11-20). Org from the grant (`settleOrg`); `read_page` loads through the host's `pages.loadPageWithVersion` (validated rows) and is keyed by the settled org only; page text fenced and listed under `untrusted`; field ids in the C4 grammar (`block:<page>:<block id>:<setting>`, `record:thread:<id>:title`) |
+| Block manifest | `src/manifest/` | `blocks.generated.ts` (checked in) built by `scripts/build-manifest.mts` from the shared catalogue's contracts plus `docs/open/DEVELOPMENT_APP_2026-11-20/blocks.json`. An assistant sees shared blocks marked `memberSafe` only; app-local blocks are listed in the file and hidden from the tools. `reads` (BUILD_SPEC C5) says what a block works out for itself. Regenerate: `pnpm --filter @elkdonis/mcp manifest`; drift check: `check-manifest` |
 | Audit | `src/server/audit.ts` | one `action_events` row per tool call: `mcp:<tool>`, via `mcp`, actor_type `ai`, settled org, arguments, outcome, `agent_id` (the grant) when the column exists; results not stored |
@@ -37,2 +39,3 @@ The tools never call `runAction` and never use `via: 'app'`; writes (pass 2) wil
   handler in-process with real reads as Justin; keys and audit rows in memory (writes nothing).
+- The test also covers the site tools (cross-org reads refused, `puck:home` under several orgs, hostile page text, field ids) and the manifest. It needs the page reader, which the harness passes in (`scripts/harness.mts`, with `scripts/react-shim.mts` for the block catalogue's JSX); the host passes `pages: { loadPageWithVersion }` (arts-collective `api/mcp/route.ts`).
 - `scripts/serve.mts`: the same handler on node:http for curl through the docker network,
diff --git a/packages/mcp/package.json b/packages/mcp/package.json
index 8632df10..67c98bf6 100644
--- a/packages/mcp/package.json
+++ b/packages/mcp/package.json
@@ -23,3 +23,5 @@
     "check-types": "tsc --noEmit",
-    "test": "pnpm --filter @elkdonis/lms exec tsx ../mcp/scripts/test.mts"
+    "test": "pnpm --filter @elkdonis/lms exec tsx ../mcp/scripts/test.mts",
+    "manifest": "pnpm --filter @elkdonis/lms exec tsx ../mcp/scripts/build-manifest.mts",
+    "check-manifest": "pnpm --filter @elkdonis/lms exec tsx ../mcp/scripts/build-manifest.mts --check"
   }
diff --git a/packages/mcp/src/server/index.ts b/packages/mcp/src/server/index.ts
index c293d97f..a8a7d5f6 100644
--- a/packages/mcp/src/server/index.ts
+++ b/packages/mcp/src/server/index.ts
@@ -7,2 +7,3 @@ export { settleOrg, settleChannel, managedOrgs, orgIdOf, boundOrg } from './org'
 export { plain, platformHref, platformHosts, UNTRUSTED_NOTICE } from './sanitize';
-export type { McpHostOptions, McpLms } from './types';
+export type { McpHostOptions, McpLms, McpPages } from './types';
+export { manifest, buildManifest, type ManifestBlock } from '../manifest';
diff --git a/packages/mcp/src/server/tools.ts b/packages/mcp/src/server/tools.ts
index 983fc29c..4909428f 100644
--- a/packages/mcp/src/server/tools.ts
+++ b/packages/mcp/src/server/tools.ts
@@ -10,2 +10,4 @@
  *                   the catalogue's `agent` field: default deny, never appOnly)
+ *   list_pages, read_page, list_blocks, describe_block, find_fields, list_surfaces
+ *                   the site tools (2026-11-20), registered from ./site-tools.ts
  *
@@ -24,2 +26,3 @@ import { boundOrg, managedOrgs, settleChannel, settleOrg } from './org';
 import { UNTRUSTED_NOTICE, plain, platformHref } from './sanitize';
+import { registerSiteTools } from './site-tools';
 
@@ -34,5 +37,5 @@ export interface ToolContext {
 
-type Json = Record<string, unknown>;
+export type Json = Record<string, unknown>;
 type Refusal = { refuse: string; code: 'input' | 'forbidden' | 'unknown' | 'limit' | 'auth' };
-type ToolOut = { data: Json; untrusted?: string[]; orgId?: string | null } | Refusal;
+export type ToolOut = { data: Json; untrusted?: string[]; orgId?: string | null } | Refusal;
 
@@ -40,3 +43,3 @@ const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempoten
 
-const refuse = (refuse: string, code: Refusal['code'] = 'forbidden'): Refusal => ({ refuse, code });
+export const refuse = (refuse: string, code: Refusal['code'] = 'forbidden'): Refusal => ({ refuse, code });
 const isRefusal = (o: ToolOut): o is Refusal => 'refuse' in o;
@@ -44,3 +47,3 @@ const isRefusal = (o: ToolOut): o is Refusal => 'refuse' in o;
 /** Register one read tool: scope check, limits, audit, error containment. */
-function readTool(
+export function readTool(
   server: McpServer,
@@ -330,2 +333,5 @@ export function registerTools(server: McpServer, ctx: ToolContext): void {
 
+  // The six site tools (pages, blocks, fields, surfaces): ./site-tools.ts
+  registerSiteTools(server, ctx);
+
   // ---------------------------------------------------------------- resource: the catalogue
diff --git a/packages/mcp/src/server/types.ts b/packages/mcp/src/server/types.ts
index 5871d3ec..a2511778 100644
--- a/packages/mcp/src/server/types.ts
+++ b/packages/mcp/src/server/types.ts
@@ -8,2 +8,11 @@ export type McpLms = DockLms;
 
+/**
+ * The page reader the site tools use, passed in by the host as the LMS readers are:
+ * `loadPageWithVersion` from `@elkdonis/page-builder/server`. It validates the row on the way out, so a
+ * malformed row is "no such page". Without it `read_page` and `find_fields` say the reader is not connected.
+ */
+export interface McpPages {
+  loadPageWithVersion(orgId: string, slug: string): Promise<{ data: unknown; updatedAt: string } | null>;
+}
+
 /** What a host passes to `mcpHandler`. Everything the tools read beyond the database comes from here. */
@@ -27,2 +36,4 @@ export interface McpHostOptions {
   lms?: McpLms;
+  /** The page reader (`@elkdonis/page-builder/server`); without it the page tools say so. */
+  pages?: McpPages;
   /** Where MCP keys are looked up. Default: the `mcp_grants` table. */
```

## Full output of the MCP test (final run, 120 passed, 0 failed)

```
responseMode: 'json' drops mid-call notifications. subscriptions/listen streams are always served over SSE regardless; other notifications emitted before a result are dropped.
ok   no key → 401 with WWW-Authenticate
ok   a device token (eacd_) → 401
ok   unknown key → 401 invalid_token
ok   expired key → 401
ok   org subdomain host → 404
ok   mapped custom domain → 404
ok   forwarded org host → 404
ok   foreign Origin → 403
ok   GET → 405 Allow: POST
ok   DELETE → 405
ok   body over 64 KiB → 413
ok   responses are no-store
ok   2025-11-25 initialize answers
ok   no Mcp-Session-Id minted (stateless)
ok   2025 tools/list: the eleven tools
ok   2026-07-28 tools/list: the same eleven
ok   every tool is annotated read-only
[mcp] protocol: Rejected inbound request (name-header-mismatch): Bad Request: the request headers and body disagree: the body carries params.name="list_my_orgs" but the Mcp-Name header names "whats_next"
ok   2026-07-28 header/body mismatch → 400
ok   entry_status lists no appOnly/hub ids
ok   entry_status lists no unexposed ids (thread-edit, thread-pin, dismiss)
ok   resources/list has eac://catalogue
ok   catalogue resource lists only exposed entries
ok   list_my_orgs: Justin’s orgs, owner/guide only
ok   list_my_orgs marks names untrusted
ok   bound key: list_my_orgs shows its one org
ok   org_summary tara
ok   org_summary by slug
ok   org_summary without org on an unbound key → refused
ok   bound key: org_summary defaults to its org
ok   bound key: another org (even one Justin runs) → refused
ok   unbound key: an org Justin does not run → refused, no fallback
ok   key bound to an org Justin does not run → refused
ok   entry_status profile
ok   entry_status org-details tara
ok   entry_status with an appOnly id → refused
ok   the appOnly refusal is audited (forbidden)
ok   entry_status with an unexposed id → refused
ok   unknown tool → error
ok   an appOnly entry is not callable as a tool
ok   whats_next answers (step + channel)
ok   whats_next for a channel Justin does not run → refused
ok   bound key: whats_next on another org → refused
ok   routine_steps lists enrolments
ok   routine_steps getting-started: steps
ok   routine_steps unknown course → refused
ok   key without mcp:read → refused
ok   audit: a row for every tool call
ok   audit rows carry the grant as agent id
ok   audit: refusals recorded as not ok
ok   audit: the bound refusal names the bound org
ok   list_pages sunjay: its stored pages
ok   list_pages: slug, title, address, version, draft flag per page
ok   list_pages marks titles untrusted
ok   list_pages tara: an org with no pages answers an empty list
ok   list_pages without org on an unbound key → refused
ok   bound key: list_pages defaults to its org (hidden-enneagram: home)
ok   bound key: another org (one Justin runs) → refused
ok   unbound key: an org Justin does not run → refused
ok   key bound to an org Justin does not run → refused
ok   fixture: puck:home exists under two orgs Justin runs, with different content
ok   read_page danamccool/home: the block count and version are that org’s row
ok   read_page hidden-enneagram/home: its own row, not danamccool’s
ok   bound key reads the home of its own org
ok   bound key: asking for another org’s home → refused, nothing returned
ok   a key bound to sunjay (no home page) never falls through to another org’s home
ok   read_page: an org Justin does not run → refused
ok   read_page: a bad address → refused
ok   read_page: no slug → refused
ok   read_page: the document, an outline of its blocks, and the untrusted notice
ok   read_page sunjay/landing: every block is outlined with id, type and path
ok   read_page sunjay/landing: a deeply nested page is whole, not cut short
ok   fenceDocument strips tags and caps long strings
ok   fenceDocument keeps ids and types untouched
ok   find_fields ids follow the C4 grammar
ok   find_fields: a typed setting is a block field
ok   find_fields: an empty setting filled from a record is offered as the record’s field, once
ok   find_fields: a record that is not this org’s gets no record field, and its blank setting stays a block field
ok   find_fields: a block type the manifest does not know yields no field
ok   find_fields: it walks into slots (any array of nodes)
ok   find_fields: values are fenced
ok   find_fields: an assistant may propose changes only to blocks the manifest shows it; never to a record’s own field
ok   find_fields: only plain string and text settings, never a link, a picture or a binding
ok   find_fields sunjay/landing: ids point at blocks of that page
ok   find_fields: fields of a site’s own (app-local) blocks are listed but marked read only for assistants
ok   find_fields lists its values under untrusted
ok   find_fields: a bound key cannot ask for another org’s page
ok   find_fields: no such page → refused
ok   list_blocks: the blocks an assistant may see (more than 30)
ok   list_blocks: feature-card and hero-banner are there
ok   list_blocks: each has id, label, plain description, category
ok   list_blocks: hides blocks not marked safe for assistants (contact-form) and every app-local block
ok   list_blocks: states the field-id pattern
ok   list_blocks: a key bound to an org Justin does not run → refused
ok   list_blocks with a named org Justin runs works
ok   list_blocks: bound key naming another org → refused
ok   describe_block feature-card: settings with kind and label, slots, parts, tokens
ok   describe_block: says what a block works out for itself (reads) in plain words
ok   describe_block: the binding and what it opens
ok   describe_block: marks which settings a page can edit by field id
ok   describe_block of a block assistants may not see → refused (forbidden, audited)
ok   describe_block of an unknown block → refused
ok   describe_block of an app-local block → refused
ok   list_surfaces sunjay: its pages as page:<slug> descriptors
ok   list_surfaces: states the descriptor grammar and carries no page content
ok   list_surfaces: bound key naming another org → refused
ok   manifest: every shared block of the catalogue is there (>= 49) with its declaration
ok   manifest: the app-local blocks are listed, hidden from assistants
ok   manifest: assistants see shared blocks marked memberSafe, no others
ok   manifest: every part that names a setting names one the block declares
ok   manifest: C5 reads are filled for the blocks that read their surroundings
ok   manifest: the record blocks read the record in the address
ok   manifest: rsvp and checkout name their flow
ok   audit: a row for every site-tool call
ok   audit: read_page rows name the settled org
ok   audit: cross-org refusals are recorded as forbidden
ok   plain strips tags and caps
ok   platformHref keeps platform hosts
ok   platformHref drops other hosts
ok   platformHref drops javascript:
ok   request window → 429 with Retry-After

120 passed, 0 failed
```


## Review fixes (after REVIEW-wave1.md)
Test extended first and watched fail (5 failures, then a missing function); now 130 passed, 0 failed (was 120). tsc: packages/mcp 0, apps/development 0. `check-sites.mts` 29 passed.
1. Fence: `fenceDocument` now drops any object key that is not a plain identifier (`SAFE_KEY`, 49 characters at most) and reports the page as `truncated`; `walkBlocks` writes a slot with an unsafe name into a path as `_`; `read_page` lists `blocks[*].id`, `.path`, `.type` under `untrusted`; `find_fields` lists `fields[*].block.path`; `list_pages` sanitises draft slugs (`plain`) and lists `draftsForNewPages[*]`. Block types are looked up by own key only (a type named "constructor" is not a block). Hostile-key, hostile-slot-name and hostile-type cases are in `test.mts`.
2. Default deny: `read_page` returns a block an assistant may not see (app-local, box, `contact-form`, unknown) as `{ type: "hidden", props: { id, label: "a block this assistant cannot read" } }`, and everything inside it is gone. A shared hidden block keeps its type name as `blockType` (the name is ours); an app-local or unknown type is not named. The outline marks such a block `hidden` and does not look inside it. `find_fields`, `referencedThreads` and `opensOf` skip hidden blocks and what is in them: no field, no text.
3. Corrected decision 4 (the original said `find_fields` still lists a site's own blocks as `assistantMayEdit: false`). That is withdrawn: an assistant now gets no field and no settings for any block it may not see. Consequence: today's real pages (built from the sites' own blocks and boxes) read as placeholders through the MCP tools; `read_page` shows their position and block count only.
4. `describe_block` no longer returns `source` (repo path).
5. Sites door: Publish is withheld when the draft has legacy `zones` (button hidden in `SitePageView.tsx`, refused in `publishSiteDraft` via `hasLegacyZones` in `sites-contracts.ts`), as for blocks the server could not check.
6. Found while re-running tsc: DOOR made `publishDraft`'s `clean` option required. `publishSiteDraft` now passes `cleanBoxDoc` (`@elkdonis/direct-edit/block`), the hosts' own cleaner without a resolver-key table (this app never adds resolver keys). Without it `apps/development` would not have type-checked.
Left alone as told: `sites-door.ts`, `apps/development/package.json`, `next.config.ts`. Not fixed: the reviewer's note that two admins saving at once lose one draft edit (not in my list; the live page stays protected by `base`).

Final MCP test output, 130 passed, 0 failed, replaces the one above: `~/scratch/machines/mcp-test-final.txt` on eris (same command).
