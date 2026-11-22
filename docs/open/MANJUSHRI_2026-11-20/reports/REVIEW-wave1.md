# Review, wave 1 (2026-11-20): MACHINES and DOOR

Read-only pass. No Critical findings. Four Important, several Minor. Nothing was built, run or written to the database.

## Go / no-go

| | Verdict |
|---|---|
| (a) apply migration 282 | GO |
| (b) rebuild arts-collective with the new tools | GO (Important 1 is a small edit worth doing first) |
| (c) rebuild apps/development with the Sites door | GO |
| (d) rebuild sunjay with live field editing | GO after Important 2 (one line) |

## Findings

### Important

1. **Unfenced member text reaches the assistant through object keys and block paths.** `packages/mcp/src/server/site-read.ts:59` (`out[k] = walk(...)`: keys copied verbatim, uncapped) and `:84-106` (`outlineOf` returns `path`, which embeds a slot's prop name, and `type` cut to 80 chars but not name-checked; `blocks` is not listed under `untrusted`). Scenario: someone who can save a page stores a block with a prop named "Ignore earlier instructions and ..." holding a one-block array; `read_page` returns that sentence as a key and inside `blocks[].path`, outside the fence. Same in `find_fields` (`block.path`). Fix: in `fenceDocument` replace a key that fails `SAFE_NAME` with `plain(k, 60)` (or drop it); in `walkBlocks` build `path` only from keys that pass `SAFE_NAME`; test `type` in `outlineOf` the same way; add `blocks[*].path` and `blocks[*].type` to `untrusted`.

2. **Block saves on sunjay run without the store's stale guard.** `apps/sunjay/src/lib/fields-blocks.ts:27` (`storeGuard: false`), used at `packages/house-editor/src/fields/blocks.ts:103`. The comment says the store's version compare never matches; `packages/page-builder/src/store.ts` was fixed today (`::text::timestamptz`). With the guard off, `saveBlock` reads the page, compares the version in JS, then does an unconditional upsert of the whole page. A canvas save landing between read and write is overwritten by the older page plus one changed word. Fix: delete that line (and the comment); the default passes `at.page.updatedAt`.

3. **A step aimed at one block can overwrite another that shares its id.** `packages/house-editor/src/steps/walk.ts:56` (`replaceProps` replaces every node whose `props.id === id` with props computed from the FIRST match). Scenario: two blocks both `id:"hero"`, different types; `set_prop` on the first rewrites the second's props to the first's, breaking "a step never rewrites a block it was not aimed at". Reachable from the Sites door and the sunjay lens. Fix: count matches in `findNode`; refuse with `duplicate_id` when more than one block carries the id.

4. **(Policy, low) `read_page` and `find_fields` return props of blocks that are not visible to assistants.** `packages/mcp/src/server/site-tools.ts:105-112, 167` use `m.byId` (all blocks) and only mark `assistantMayEdit:false`; the README says app-local and not-`memberSafe` blocks are hidden from the tools (`contact-form`, `box`, `banner` are `agent.read:false`). I found no secret-bearing prop names in `blocks.json` and a page's content is public, so this is a consistency gap, not a leak. Fix: replace the props of a block whose type is not in `m.visible` with `{ hidden: true }`, or say in the README that page text is readable whatever the block.

### Minor

- `packages/house-editor/src/steps/engine.ts:85,88`: `zoneLength` with a zone such as `constructor:x` or `__proto__:x` throws a TypeError (`nodes['constructor']` is `Object`) instead of refusing, so `applyStep` throws rather than returning the original doc. Not reachable today (the Sites door and the lens give no `config`, so structure steps answer `no_config`). Fix: `Object.hasOwn(nodes, key)` before reading.
- `packages/mcp/src/server/site-tools.ts:77-88`: `draftsForNewPages` returns draft slugs unsanitised and not under `untrusted`. Wrap in `plain()` and list them.
- `packages/mcp/src/manifest/build.ts:149`: `describe_block` returns `source` (a repo file path) for visible blocks. Drop it from the tool output.
- `apps/development/src/lib/sites-contracts.ts:50` and `sites-actions.ts:99`: `unknownTypesOn` walks `content` only; a page with legacy `zones` holding an unknown block can be published. Walk `zones` too, or refuse a draft that has them.
- `apps/development/src/lib/sites-actions.ts:75`: read then unconditional `saveDraft` upsert; two admins saving at once lose one draft edit (the live page stays protected by `base`).
- `packages/page-builder/src/drafts.ts:190`: `publishDraft` without `opts.clean` skips `cleanBoxDoc` and the resolver-key strip every app's save action applies. Safe while drafts come from stored pages with set_prop and set_look only; pass the target app's cleaner before anyone adds insert steps.
- Publishing from the development app cannot call the target app's `revalidatePath`; a statically cached target page would show the old page until it revalidates (not verified; sunjay is dynamic).
- `fenceDocument` caps string characters but not keys or structure; a 512 KB page returns about 1 MB.

## Categories checked

**1. Assistant tools.** Clean on tenancy. Every tool calls `settleOrg` (the grant's org wins; a bound key naming another org is refused; unbound keys reach only owner/guide orgs via `resolveActionOrg` with `siteOrgId`). Every SQL in `site-tools.ts` has `WHERE org_id = <settled org>` (`list_pages`, its draft EXISTS subquery joins on `c.org_id`, `list_surfaces`, `threadsOf`). `read_page` and `find_fields` go through `loadPageWithVersion(orgId, slug)`, keyed by org and validated; no org comes from tool input except the claim `settleOrg` checks. `slug` passes `isPagePath` and the store's `isValidPagePath`, so no hostile storage key. Drafts: `puck-draft:` rows are read only for existence, never content; `puck:%` does not match them. All six use `readTool`: scope check, per-key limits (`list_surfaces` heavy), one audit row per call, error containment. Nothing writes; no `runAction`. Strings are fenced by `plain` and capped, nested slots, rows and rich text included, because `fenceDocument` walks every value; the gaps are keys and paths (Important 1). No emails, Stripe ids or `Private/` paths in manifest or tool code. Route hunk is one additive line.

**2. Sites door.** `saveSiteDraft`, `publishSiteDraft`, `discardSiteDraft` (the only `"use server"` exports) each call `adminOrThrow()` (`getNetworkAdmin`: session, then `isAdmin`) first; the actor is `admin.userId` from the session, never an argument. `listSites` and `loadSitePage` gate themselves too; both pages call `requireNetworkAdmin`. Org is checked to exist, slug by `isValidPagePath`. Publish is refused server-side when the draft holds a type the door cannot check, and uses `publishDraft`, whose `base` guard stops a changed live page. Save refuses the whole list at the first refused step and keeps unknown blocks. Nothing is rendered as raw HTML (JSX text, `JSON.stringify` in `<pre>`). Gap: zones (Minor).

**3. Drafts.** Same `sanitizeRichValues`, `validatePage` and 512 KB cap as `savePage`; key length and path validated. `publishDraft` locks the draft row `FOR UPDATE`, writes the live row with `updated_at = base::text::timestamptz` (new page: `ON CONFLICT DO NOTHING`) and deletes the draft in the same transaction only on success; stale or error returns early and keeps the draft. `listPages` and every other reader (`hub/site-builder.ts`, `services/site-pages.ts`, `danamccool/hud-actions.ts`) use `LIKE 'puck:%'`; the only readers of `puck-draft:` are drafts.ts, the MCP tools and the Sites door.

**4. The one door.** Content steps refuse `morph`, `look`, `blkStyle` and `id`, `puck`, `editMode`, `children` first; the prop must be declared in the contract; `binds` settings refused; kinds and lengths checked. `set_look` and `set_token` write only `morph`, only for declared parts (`own()`), tokens validated. Insert props go through `setWord`. Unknown types pass through (`graft` restores original objects). `applySteps` returns the original doc on any refusal. The Puck reducer is imported only in `engine.ts` (grepped). `__proto__` and `constructor` as part, token or prop names are refused by the declared-name checks; as block ids by `findNode`. Exceptions: Important 3 and the Minor `zoneLength`.

**5. Live field editing.** With `marks` off, `marked === morphed` and nothing changes (no template, no attribute). With it on, sunjay's `renderPuckPage` picks `markedPuckConfig` only when `viewer?.canEdit`; `FieldsLensGate` renders nothing for non-editors. Block saves: `createFieldsActions` calls `authorize()` (`getViewer().canEdit`), then `set_prop` steps go through `savePageAction`, which is `createSavePageAction` with `getApiEditor` as gate, slug rules, `cleanBoxDoc` and resolver strip (the default clean keeps `cleanBoxDoc`, so replacing the old explicit call lost nothing). A `record:thread:` field goes through the `thread` route to `performAction("thread-edit")` with the session user and `siteOrgId`, read scoped by `org_id`; never a block prop. Values are written with `textContent`; `set_prop` checks kind and length; bound settings are not offered. Gap: Important 2. Block hunks (`reads`, `BlockRead`, the `createCatalogue` slot-name guard) are data or load-time checks; the blocks.json inventory shows no block with a part named like its own slot.

**6. Migration 282.** Safe. `IF NOT EXISTS` throughout and `ADD COLUMN IF NOT EXISTS agent_id varchar(64)` (nullable, no default: catalogue-only in Postgres 11+), so idempotent and non-destructive. FK and column types match (`users.id` uuid; `org_scope varchar(50)` matches `organizations.id`). Locks: a brief ACCESS EXCLUSIVE on `action_events`, then a plain (non-concurrent) partial `CREATE INDEX` on an all-null column: one table scan, inserts blocked meanwhile; fine unless the table is large. The append-only trigger is UPDATE/DELETE only. `REVOKE ALL ... FROM eac_tenant` is correct. 282 is free; 281_dev_versions is independent. Old running builds keep working (audit rows without `agent_id`). After migration and rebuild `/api/mcp` answers 401 until a key is minted.

## Could not verify

- Whether `apps/development` builds with `sites-door.ts` importing `../../../../packages/house-editor/src/steps/index` by relative path (house-editor is not in its `package.json` or `transpilePackages`; `@puckeditor/core/internal` resolves from house-editor's own install, same 0.24.0). Check the build log.
- That no stored page prop holds a `Private/` path (`read_page` would return it).
- That no app-local catalogue outside `blocks.json` has a part named like a slot (the new load-time throw would stop that app starting).
- Runtime behaviour: the MCP in-process test, `check-steps`, `check-drafts` and the sunjay lens were not run.
- Whether any target app statically caches a page that Publish rewrites.
- The arts-collective rebuild also takes in the rest of the shared uncommitted tree, including `@puckeditor/core` 0.23.0 to 0.24.0 in its `package.json`; not this wave's code, not reviewed.
