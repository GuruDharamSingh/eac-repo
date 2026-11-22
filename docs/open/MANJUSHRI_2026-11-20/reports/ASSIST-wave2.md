# Lane ASSIST, wave 2 (2026-11-20)

Status: DONE. Source only: no rebuild, restart, migration, commit, key minted or production write. First source edit came after `rollout-wave1.log` ended (17:52).

## What shipped

1. **Two draft tools**, `packages/mcp/src/server/draft-tools.ts` (new), registered from `tools.ts` (`registerDraftTools`).
   - `propose_page_patch({ org, slug, steps, note })`: needs grant scope `mcp:draft`; org from the grant (`settleOrg`); loads the live page through `host.pages` and any waiting draft through `host.drafts`; runs the steps through the door on the waiting draft (only if its `base` equals the live version, and only if it is an assistant's) or the stored page; saves a draft with `author = { id: grant id, kind: "assistant", label: grant label }`, the note, and the steps (kept together with an assistant's earlier steps). Returns each step's `{ step, ok, code, say }` in the door's words. Never writes the live page; `McpDrafts` has no publish.
   - `set_field({ org, field, value })`: `block:<page>:<block id>:<setting>` becomes one `set_prop` step through the same pipeline. `record:` is refused with a plain reason (no draft state for records). Anything not in the grammar is refused.
   - Refusals are results (`isError` plus the plain message, and for draft refusals structured data: `ok:false, published:false, results[], stale?`), never thrown.
2. **Honest descriptions**: `registerChecked` in `tools.ts` appends "Nothing an assistant does through this door goes live until a person publishes it." to every tool's description (all 13). Server instructions text in `handler.ts` corrected (it said nothing here changes anything). Draft tools state their caps.
3. **Review component** `apps/development/src/components/sites/DraftReview.tsx` + own sheet `draft-review.css`: who proposed it (person or assistant, by label), the note, steps in plain words, what differs (words before/after, look changed, blocks added/removed), the two sides (drawn via an optional `renderPage`, else block lists), Publish and Discard through the existing gated actions, an out-of-date warning when `live.version !== draft.base`. Everything written by a machine or a person is drawn as plain text and cut. Props and the mounting line are on `BOARD.md` for DEV.
4. **Host writer**: `apps/arts-collective/src/lib/mcp-drafts.ts` (new) and one additive hunk in `src/app/api/mcp/route.ts` (an import and `drafts: mcpDrafts`). The step door is imported by relative path (as `apps/development/src/lib/sites-door.ts` does) because arts-collective does not list `@elkdonis/house-editor`; one-line swap once installed.

## Decisions (spec was silent or ambiguous)

- **Writer interface** (`types.ts`): `McpDrafts { applySteps(orgId, doc, steps, contracts), loadDraft(orgId, slug), saveDraft(orgId, slug, draft) }`, plus `DraftContract`, `McpDraft`, `McpDraftStepResult`. The tool builds the contracts from the manifest, for the blocks assistants may see only, and the host runs the door with `allowUnknownTypes: true`.
- **Assistants have `set_prop` and `set_look` only.** `set_token` is refused (the manifest carries no token types, so a value cannot be checked) and so are insert, move, duplicate, remove (they need the page builder's Puck config, which the host does not hand over; DEV's manifest-built config is a different lane). Plain "not available to assistants yet" messages. This is a cut.
- **Aim**: a step may name only a block whose type is `agent.read` and which is not inside a block that is not. The refusal says "That block is not one assistants may change" and names no type, setting or value. After the door runs, the tool also checks that every block an assistant may not change is byte-identical and the block count is unchanged (defence in depth).
- **A person's waiting draft is never replaced** by an assistant (refused, ask them to publish or discard). Spec said to run on a waiting draft whose base matches; I read that as the assistant's own draft, because `saveDraft` replaces and would relabel a person's work. Easy to relax.
- A waiting assistant draft whose base no longer matches the live page is refused as stale (not silently restarted).
- Unknown keys on a step are refused (nothing unexpected is stored). Steps are stored as sent (normalised by shape check), note replaces the previous note when given.
- Caps (stated in the descriptions): 50 steps, 32 KiB of steps, note 500 characters, set_field value 8 KiB; a draft keeps 200 steps in all. Enforced in code (not in the JSON schema), so the refusal is a plain result. Own rate window: 30 proposals a minute per key, on top of the 60 calls a minute.
- A page that does not exist is refused: assistants do not create pages.
- Scope: `mcp:draft` alone is enough to propose (the tool needs no `mcp:read`).

## Cuts / limits to know

- No structure steps, no token steps, no `record:` fields, no page creation (above).
- Two proposals landing at the same instant: the second save replaces the first (no compare-and-set in `saveDraft`). The live page is unaffected. A per-key 30/min window and normal sequential use make it unlikely.
- A call that fails the tool's JSON schema (steps not a list, missing `steps`) is rejected by the SDK before the tool runs, so it has no audit row (same for the read tools today). Every call that reaches a tool writes one.
- `DraftReview` was type-checked, not rendered in a browser (apps/development is not rebuilt).

## Checks (full output: `~/scratch/assist/test-3.txt` on eris; the red run before the code: `test-red.txt`, 188 passed 42 failed)

`packages/mcp/scripts/test.mts`, written first and watched fail (42 failures), now **230 passed, 0 failed** (was 130). Command: `sudo -n docker compose run --rm --no-deps -w /app/packages/mcp admin node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/test.mts` from `~/eac`. New cases (all inside one transaction that is rolled back, on a fixture page made in it; the harness binds the writer and the page reader to that transaction via `useTx`):
- read-only keys (unbound and bound) refused with "cannot propose changes", both tools, audited as `auth`, no draft kept
- a draft key proposes: ok, `published:false`, draft saved with assistant author, grant label, note, one step, base = live version, live page byte-identical
- the draft is readable only by its org; a second org's key refused (names this org, or with its own org has no such page); an org the person does not run refused
- 31 hostile lists each refused whole and leaving draft and live untouched: reserved names (morph, id, puck, blkStyle), prototype names (`__proto__`, `constructor`) as setting, block and part, unknown setting, wrong value kind, unknown part, a look that is not a look, a block not on the page, another page's block id, a hidden block (form) and a block inside a hidden block (refused with no type, setting or value), tokens, insert/remove/move, unknown op, extra key, non-object step, non-list, empty, no steps, 500 steps, 51 steps, a list over the size cap, a valid step followed by a bad one
- note over 500, bad address, missing page refused
- second proposal builds on the waiting draft; stale base refused (propose and set_field), draft untouched; after the draft is cleared a proposal starts on the new version; a person's draft is not overwritten
- set_field: block field saved as one `set_prop` step; record field refused; 9 malformed ids refused; hidden-block field refused without revealing; wrong kind and 9000-character value refused
- a draft-only key can propose; audit rows (org, codes, steps recorded, no key text); own rate window triggers; 13 tools listed, read tools read-only annotated, draft tools not read-only and not destructive, every description says nothing goes live until a person publishes, caps stated
- the live row is compared (value and version) after every case; at the end no fixture or draft row is left (counted through the pool)

tsc (`pnpm check-types`) errors before to after: packages/mcp 0 to 0; apps/development 0 to 0; apps/arts-collective 0 to 0.

## Files

New: `packages/mcp/src/server/draft-tools.ts`; `apps/development/src/components/sites/DraftReview.tsx`, `draft-review.css`; `apps/arts-collective/src/lib/mcp-drafts.ts`.
Edited: `packages/mcp/src/server/tools.ts` (shared `registerChecked`, `draftTool`, `refuseWith`, `NOT_LIVE`, `registerDraftTools` call, header comment), `types.ts` (appended `McpDrafts` etc. and `drafts?` on host options), `limit.ts` (appended `WRITE_LIMIT`), `index.ts` (type exports), `handler.ts` (instructions sentence); `packages/mcp/README.md` (table row, drafts section, limits); `packages/mcp/scripts/test.mts`, `scripts/harness.mts`; `apps/arts-collective/src/app/api/mcp/route.ts` (import plus `drafts: mcpDrafts`, one additive hunk).

## For the PM at go-live

1. Rebuild arts-collective (route plus writer; imports the steps by relative path, so confirm the build resolves `packages/house-editor/src/steps` outside the app: it is the same pattern as `apps/development`'s `sites-door.ts`; the clean alternative is to add `@elkdonis/house-editor` to the app, install, and switch the one import) and apps/development (after DEV mounts `DraftReview`).
2. Mint a key with scopes `mcp:read mcp:draft` (`mint-key.mts`). Until then both draft tools answer "This key cannot propose changes".
3. Concern: real pages today are built from sites' own (app-local) blocks and boxes, which assistants may not read, so a proposal against them is refused ("not one assistants may change"). Drafts become useful on pages made of shared member-safe blocks, such as the new development org's pages.

## Wave 2 follow-up (2026-11-20, PM): assistants read site blocks unless a deny list names them

Policy change (Justin: "unblock pages from sites"): `agent.read` is now "not on the deny list" instead of "shared and memberSafe". One module decides: `packages/mcp/src/manifest/deny.ts` (comment says why); `build.ts` asks it for every block; manifest regenerated (`check-manifest` ok, 184 blocks).

Deny list. (a) by id: `contact-form`. `box` is NOT denied: its declaration is a slot and a tag select, no CSS or HTML field (look lives under `morph`). (b) by declaration, whole-word match on a setting's name or label (so "capital" is not "api"; "emailLabel" is "email label"): email, recipient, token, key, secret, webhook, password, api (and plurals); a `binds` of person, user or guide; a setting named html, css, script, embed, iframe or markup (my addition: only `words.html` hit it); no settings in the manifest.

Counts: 184 blocks, **166 visible, 18 hidden** (was 48 visible). Hidden by reason: id 1 (contact-form), secret 2 (he-contact, he-service), person 5 (featured-person, profile-gallery, profile-store, store-shelf, pt-profile), markup 1 (words), no declaration 9 (he-sigil, home-forum, home-join, home-stage, m-exp-body, m-exp-facts, m-exp-hero, m-tour-blurb, pt-calendar).

Unchanged: the org lock (tools read only the settled org's pages; unbound keys only orgs the person runs as owner or guide), fencing (every value stripped, capped, under `untrusted`; keys and types sanitised), the caps. Draft contracts are built from the visible manifest, so proposals now reach app-local blocks; the denied ones are placeholders and proposals aimed at them are refused ("not one assistants may change", nothing revealed). Token types are STILL missing from the manifest (names only), so `set_token` stays refused; no structure steps added. Small addition: `list_blocks`/`describe_block` give app-local blocks a stand-in sentence where they have no written description.

Tests first (watched fail: 5 failures, then the missing module), now **239 passed, 0 failed** (was 230). Changed or added: a site's own blocks come back with fenced settings in `read_page`, `find_fields` offers their text fields, `describe_block` works for pt-band and refuses he-contact, manifest rule check (every block equals the deny function; named blocks hidden; box, pt-band, he-passage readable; no readable block has a secret-word setting or person bind), hostile text in an app-local block (ExperienceGallery heading with tags, 5000 characters, an odd key) stays fenced, a proposal on a site's own block is saved, proposals and `set_field` on a denied block are refused without revealing it. The nested-hidden fixture is now an unknown block type (box is readable). Output: `~/scratch/assist/test-5.txt` on eris. tsc packages/mcp 0 errors.

Unsure on the deny list: (1) `person`/`user`/`guide` binds hide `featured-person` and the profile/store shelf blocks, which were visible before; (2) `words` is hidden only for its `html` setting (it is sanitised on save, so this is cautious); (3) the 9 no-declaration blocks are hidden because the manifest has no settings for them, though some are probably harmless; (4) the `record` bind (posts and gatherings) stays readable. Files: new `src/manifest/deny.ts`; edited `src/manifest/build.ts`, `types.ts` (comment), regenerated `blocks.generated.ts`, `src/server/site-tools.ts`, `README.md`, `scripts/test.mts`.

## Wave 2 review fixes (2026-11-21)

Tests first (watched fail: 2, then the missing functions, then 2 for the race), now **259 passed, 0 failed** (was 239). tsc: packages/mcp 0, apps/arts-collective 0, apps/development 0. Output: `~/scratch/assist/test-r6.txt` on eris.

1. **Legacy zones leak** (`site-read.ts`): `redactHidden` now redacts every list under `zones` like `content` and slots; `walkBlocks` walks zones (path `zones.z<n>[i]`, by position, never by the member-written key), so `outlineOf`, `find_fields`, `opensOf`, `referencedThreads` see them too. The fence already drops zone keys with a colon, so zones come out empty from `read_page` (fail closed). Tests: pure (hidden contact-form, he-contact and an unknown type inside zones: no text, no type name; outline lists them hidden; find_fields offers only the readable block) and through `read_page`/`find_fields` on a fixture page in the rolled-back transaction.
2. **Fail closed on unresolved settings** (`manifest/deny.ts`): any setting of kind `unresolved` or named `?` denies the block (code `unresolved`). Manifest regenerated, `check-manifest` ok. **New counts: 184 blocks, 163 visible, 21 hidden**: id 1, secret 2, person 5, no declaration 9, unresolved 3 (ktp-artwork-grid, ktp-piece, ktp-piece-row), markup 1.
3. **Readable but not settable** (same module, `readOnlyReason`, `READ_ONLY_SETTINGS`): (a) by block and setting: pt-talk-room.membersOnly, pt-event-rsvp.showAttendees, pt-offering-card.showCall (who gets the call button); (b) a name rule for boolean or select settings with a whole word members, private, public, visibility, visible, attendee(s), login, signin, auth, access, restricted, hidden, secret. I read every readable block's settings: no other access switch found; the many `show...` switches (price, cover, count, bio, membership line) are presentation and stay open. `propose_page_patch` (and so `set_field`) refuse a `set_prop` on one with a plain reason, whole list refused, nothing saved; `read_page` still shows the value. Tests: unit (named, rule, non-matches, text kinds not caught) and through both tools (single, mixed list, no draft left).
4. **Lost update**: DOOR's `saveDraft({ ..., expected })` had landed. `draft-tools.ts` passes `expected: waiting?.savedAt ?? null` and turns `code: "draft_changed"` into "Someone saved a draft of this page while this was being prepared, so nothing was saved. Read the page again and propose again." (with `stale: true`). `McpDrafts.saveDraft` type carries `expected` and `code`; `apps/arts-collective/src/lib/mcp-drafts.ts` already passes the draft object through unchanged, so it is wired. Test: the harness hook `onBeforeSave` makes a person save a draft between the tool's read and its save; the assistant's save is refused and the person's draft is what is stored.

Not done from the review (not asked): the depth-40 scan gap, the draft-only-key oracle, audit input cap for writes, hyphenated-key fence residue, DraftReview look values.
Files: edited `src/manifest/deny.ts`, `src/server/site-read.ts`, `draft-tools.ts`, `types.ts`, regenerated `blocks.generated.ts`, `README.md`, `scripts/test.mts`, `scripts/harness.mts`.
