# Lane F: fields, content binding, MCP and LMS (2026-11-20)

Read-only research, lead F. Every claim carries `path:line` (paths relative to `~/eac`). "unverified" marks what I did not confirm. No sub-agents were used; I read everything myself.

## 0. In one paragraph (for Justin)
Today the idea "a value a person can change" is declared several different ways, and each way has its own rule about who may change it. A page can show a title that really belongs to a post, and nothing on the page says so. The fix is not a new system: one small "field descriptor" that points at what already exists (a block setting, a database column, a catalogue action) and is generated, not typed twice. Once fields and blocks are written down in generated files, an assistant can be given a read-only tour first, then the right to suggest changes that wait in a draft for a person to approve.

---

## 1. Field systems inventory

*Plain words: there are eight places where the code says "this is something you can edit". They overlap (a title is declared in three of them) and they disagree about who is allowed to save.*

| # | System | Declared | Kinds | Stored (from code) | Validation / sanitise | Gate | Save path |
|---|---|---|---|---|---|---|---|
| 1 | Block `PropDef` | `packages/blocks/src/types.ts:132` | string text richtext number boolean select list url image slot rows (`types.ts:56-67`); extras `binds` (:222), `format:"color"`, `inlineEditable`, min/max | Puck document: `site_config(org_id,key="puck:<slug>").value` jsonb (`packages/page-builder/src/store.ts:46-48`); people's pages `user_pages.data` (`user-store.ts:58`) | `coerceProps` clamps to min/max (doc in `types.ts` PropDef); `validatePage` shallow shape (`validate.ts:61`); `sanitizeRichValues` at save (`store.ts:136`); size cap; `RichText` / `cleanStyle` at render | per-app, e.g. sunjay `getApiEditor` (`apps/sunjay/src/lib/puck/actions.ts:35-44`); art-auction its own (atlas `page-save` drift, `packages/actions/atlas/areas/orgapps.editing.ts:20`) | `savePageAction` -> `savePage` with `expectedUpdatedAt` (`store.ts:120,154`) |
| 2 | Puck fields built from #1 | `toPuckFields` + `buildPuckConfig` (`page-builder/src/config.tsx:360`); custom controls `fields/*.tsx` | same + custom pickers (`fields/record-fields.tsx`) | same document | `readOnly` on resolver keys (`config.tsx:504`) | editor UI only | none |
| 3 | cms-bindings workshop `fieldRegistry` | `packages/cms-bindings/src/workshop/field-registry.ts:106`, shape `FieldMeta` (:65) | text textarea url number datetime date select image compound readonly, plus color gallery media boolean | `threads.*`, `workshop_pages.*`, `users.*`, `org_profiles.*` | numeric coercion only (`apps/arts-collective/src/lib/cms/actions.ts:295-303`); no max, no sanitiser seen | `canEditOrgSite(user.id, org_id)` (`actions.ts:351`) | `updateWorkshopFieldByTraitAction` (:284) -> `updateWorkshopFieldAction` (:331): raw `UPDATE threads SET ${db(cols)}`; not `performAction`, so no `action_events` row (atlas `edit-workshop-live`, `arts-collective.hub.ts:1824`) |
| 4 | cms-bindings dossier registry | `cms-bindings/src/dossier/field-registry.ts:29` (`DossierFieldMeta`) | text textarea url image compound, `list`, `json` flag | `users.<col>` or a key inside `users.oad_dossier` jsonb | in the save action (depth unverified) | `canEditProfile` = self or global admin (`apps/ifac/src/lib/profile-editor-actions.ts:25`) | `saveProfileFieldAction` (ifac and artdirect copies) -> `updateProfile`; atlas `profile-field-save` (`orgapps.editing.ts:211`), drift note: avatar URL stored unvalidated |
| 5 | live-editor `FieldDef` / `FieldPopover` | `packages/live-editor/src/types.ts:26`, kinds :1 | text textarea url number datetime date select image compound readonly | whatever the app's `onSaveField` writes (systems 3 and 4) | none in the package | none: the host's action | `SaveFieldPayload{trait,value}`; used in ifac, artdirect, arts-collective (31 files by grep) |
| 6 | **Fields lens** | `packages/house-editor/src/fields/registry.ts:20` (`FieldSpec`), `defineFields`; DOM mark `data-field="kind:id:field"` (`registry.ts:4`) | live-editor kinds + rich boolean color; flags inline, max, optional, readOnly | host's `FieldsRoute`; sunjay: `org_site_sections(org_id,section_key).content` jsonb (`apps/sunjay/src/app/fields/actions.ts:21-25`) | `checkValue` (`registry.ts:100`) in page and again on server (`save.ts:96-101`); `linkOk` | host `authorize()` plus the hub gate (owners and guides) | `createFieldsActions` (`save.ts:70`) -> `performHubAction('site-section-save')` (`packages/actions/src/server/sb-runners.ts:42`): merge, slot allow-list, `updated_by`, audit row. Live only on sunjay (`apps/sunjay/src/lib/fields.ts:12`); demo `apps/development/src/ideas/FieldsLensDemo.tsx:66` |
| 7 | Studio forms | `packages/studio-forms/src/forms/contract.ts:52` (`FormSection`); field list lives in cms-ui `compose` (contract.ts header) | per `ContentFieldSpec` | threads, artwork (commerce) | adapters (`adapters/artwork.ts` drops unmapped keys with a warning) | per adapter | `FormActions` -> services / commerce |
| 8 | Ad hoc | innergathering page patches `site_config('page-edits:<page>')` (`apps/innergathering/src/lib/page-edits.ts:24`, `cleanPatches` on read); direct-edit words boxes (props / `look` in the Puck doc); `site-section-copy-save` in four `/manage/pages` copies (atlas `orgapps.cms.ts:198`); Channel quick sheet (`packages/channel/src/quick-spec.ts`: edits plans, not values) | | | | | |

**Overlap**
- A workshop title: #3 (`threads.title`), the #7 form, and a Puck block prop if a page draws it.
- Org section copy (hero title, footer): #6 on sunjay, `site-section-copy-save` in four apps, and Puck blocks with `inlineEditable`. Atlas already records the drift (`apps.ifac.manage.ts:197`).
- Profile bio: #4, #5 and the profile surface.

**Drift (concrete)**
1. Four gates for "may edit this site's words": `getApiEditor` (page save), `canEditOrgSite` (workshop), hub `canManageOrgPeople` (Fields lens, `orgEditor` in `packages/actions/src/server/run.ts`), `canEditProfile` (profile). A person can pass one and fail another on the same page.
2. Only the Fields lens and `page-save` leave an audit row; #3 and #5 write straight to the table.
3. Validation speaks three dialects: `PropDef.min/max/format`, `FieldSpec.max/optional`, and none in #3. Two input unions "must stay assignable" by comment only (`workshop/field-registry.ts:1-6`; `live-editor/src/types.ts:1`).
4. The Fields lens header says it leaves cms-bindings `fieldRegistry` alone as "the workshop store's coercion table" (`house-editor/src/fields/registry.ts:8-9`): the join was deliberately deferred.
5. `opens` is declared on only 3 blocks (feature-card, featured-person, link-button: `OPENS_PROP` grep, `blocks/src/opens.ts:22`).

---

## 2. The binding seam

*Plain words: a card on the page can show a title that is not stored on the page at all; it is looked up from a post every time. If Justin clicks that title to edit it, the page does not know whose title it is, so today the edit would quietly change the card, not the post.*

**How it works now**
- A block declares a string prop with `binds: "<kind>"` holding a reference (`types.ts:222`; rule in `.claude/rules/areas/puck-blocks.md`).
- The host resolver returns extra props (`bound`, `opened`, `rec`). Sunjay server: `"feature-card": cardRecord(props.record), resolveOpens(props.opens)` (`apps/sunjay/src/lib/puck/config.server.ts:33`); the editor reaches the same through a server action (`config.client.ts:99`). Two code paths for one resolver is a drift risk.
- Puck: `resolveData` returns `{props, readOnly}` and locks every returned key (`page-builder/src/config.tsx:489-505`).
- Save: `stripResolvedKeys(data, RESOLVED_KEYS)` removes resolver keys so records never become page content (`blocks/src/record/resolved.ts:21`; per-app tables, e.g. `apps/hidden-enneagram/src/blocks/resolved-keys.ts`).
- Record blocks: one `record` ref or the route's `routeRecord`; host returns `rec: RecordView` (`blocks/src/blocks/record-parts.tsx:39`).
- Visibility lives in the resolver SQL: a thread resolves only if published, public, no `min_role`, feed public (`apps/sunjay/src/lib/opens-server.ts:20-45`), which stops a stored reference showing a private or another org's record.

**The gap, traced for "edit a thread title shown on a page"**
1. `feature-card` draws `text(title) || text(b?.title)` (`blocks/src/blocks/feature-card.tsx:131`). The markup does not say which of the two it drew.
2. Its part `title` declares `prop: "title"` (`feature-card.tsx:214`), so the aesthetic editor's popup types into the block prop, which then overrides the record permanently (typed wins by design). It never touches the thread.
3. The Fields lens finds only `[data-field]` (`FieldsLens.tsx:84`) and declines anything inside `[data-puck-component]` (:50). Record-driven words carry no `data-field`.
4. Resolvers return plain draw-only JSON with no provenance: no record kind, id, column or version (`RecordView` has `title`, `facts[]`, no source: `record-parts.tsx:39-52`).
5. A save path for the thread exists (`thread-edit` catalogue entry, scope `thread`, runnable: `packages/actions/src/catalogue.ts`), but its text says "Drafts from any door; a published post only from the host's own pages", and it is absent from `AGENT_EXPOSURE` (`packages/actions/src/agent.ts:17`).

**What must exist**
- Provenance: the resolver output carries `fieldSources`, e.g. `{ title: "thread:<id>:title" }`, and the block spreads a `fieldMark(...)` (new, sibling of `editItem`, `edit-item.ts:27`) on the element that drew it, only when the value came from `bound`/`rec`. Mark value = a `data-field` ref in the existing grammar, so the lens finds it unchanged.
- A registry entry for kind `thread` (title, excerpt, body) routed to `thread-edit`; the lens save already routes capability + `toInput` (`save.ts:105-109`), but scope `thread` needs a `subjectId` on the `toInput` result (new).
- Gate: lens `authorize()` AND the action's own `threadEditor` (author or org owner/guide, `run.ts`) AND the site lock `siteOrgId`, which refuses a post not on this site (`run.ts` ~470-492). Re-evaluate visibility server-side; never trust the page's mark.
- Refresh: lens `onSaved` -> `router.refresh()` exists (`FieldsLensProps.onSaved`); in the canvas call `getPuck().resolveDataById(id,"replace")` (rule in `puck-blocks.md`: a plain `replace` runs no `resolveData`).
- Stopgap: a part that shows a bound value should not offer `prop` while the prop is empty and the value came from `bound` (unverified how the part checks enforce `draws`, `types.ts:243`).

---

## 3. One field descriptor: `FieldDescriptor`

*Plain words: one card per field saying what it is called, where its value really lives, who may change it and what to warn about. Blocks, the inline editor, forms and assistants all read the same card. It is generated from things we already have, so nobody writes it twice.*

```
FieldDescriptor {
  id        "<ownerKind>:<owner>:<path>"  e.g. block:feature-card:title | thread:*:title | section:hero:title
  owner     { type:"block-prop", block, prop } | { type:"record", kind, idFrom:"mark|ref|route", path }
  kind      one merged union: string text richtext number boolean select list url image color date rows
  label, help (plain words), placeholder
  limits    { max, min, optional, options[], format }   // one checker = checkValue + coerceProps
  sanitiser "plain" | "link" | "rich" | "css"           // names sanitizePageText / linkOk / cleanStyle
  gate      { capability: <catalogue id>, roles[] }     // from ActionMeta.roles, not a function
  save      { action: <catalogue id>, inputRecipe }     // from FieldsRoute.toInput
  risk      ActionRisk[] + confirm wording              // ActionMeta.risk / confirm
  agent     none | read | draft                          // ActionMeta.agent
  binds?    reference kind (block props)
  stored    "puck:<slug>" | "table.column" | "table.jsonb.key"   // informational
}
```
**Derived, not invented**
- Block-prop fields from `PropDef` (`types.ts:132`) via `contractOf` (`contract.ts:60`) or the extractor JSON.
- Record fields from `fieldRegistry` (`workshop/field-registry.ts:106`: `table`+`col` -> `stored`, `label`, `hint`, `input`), dossier groups (`dossier/field-registry.ts:29`) and `defineFields` registries (`apps/sunjay/src/lib/fields.ts:12`). A thin `toDescriptor()` adapter per source is the whole join.
- Gate / save / risk / agent from the catalogue entry named by `save.action` (`ActionMeta`, `packages/actions/src/types.ts:85`: `roles`, `risk`, `confirm`, `agent`, `address`).
- Validation: lift `checkValue` (`registry.ts:100`) into a shared module that also accepts `PropDef` limits, so the page, server and MCP use one checker.

**Finding fields on any page: both, reconciled by the ref**
1. DOM `data-field`: the only mark the lens trusts, and only when the registry knows the ref (`FieldsLens.tsx:70-77`).
2. Document: walk the resolved Puck doc and emit `block:<type>:<prop>` refs with node ids. MCP `find_fields` uses this. It matches DOM through direct-edit's `data-node` / `data-part` marks (`packages/direct-edit/src/block/*`).
3. A part with `prop` (`types.ts:243`) already links element -> prop. Add the record mark only where the value was bound.

**Not breaking Puck or the aesthetic editor**
- Keep "one writer per value": the lens declines `[data-puck-component]` and `[data-field-off]` (`FieldsLens.tsx:50`; `docs/open/HOUSE_EDITOR_ONE_2026-11-20/PLAN.md:24`). Record descriptors work everywhere; block-prop descriptors in lens mode only on the published page, saving through page-save with `expectedUpdatedAt` (`store.ts:154`).
- `data-field` differs from `data-part`, `data-edit-item`, `data-node`, and `[data-fields-ui]` guards the lens chrome.
- Inline typing of a block prop obeys `inlineEditable` (verbatim-rendered values only, `types.ts` PropDef doc).

---

## 4. Block manifest for machines

*Plain words: one generated file per site listing every block it offers: what it is in plain words, what can be changed, where it can open a popup, whether an assistant may touch it. Nobody maintains it by hand.*

**Sources already present**
- `createCatalogue` (`packages/blocks/src/registry.ts:81`): ids, props, `memberSafe`, `dataDriven`, `interactive`, `category`, `parts`, `tokens`, `resize`, `manipulate`, `silexRoot` (`types.ts:283+`).
- `contractOf` (`contract.ts:60`): props + group, sample rows, parts, tokens. Runtime-only.
- `docs/open/DEVELOPMENT_APP_2026-11-20/blocks.json`: 184 blocks (static TS-AST extractor, `extract-blocks.js:1`, reuse it). Per owner: blocks 49, elktours 44, sunjay 31, hidden-enneagram 17, art-auction 15, danamccool 14, katie 8, direct-edit 4, arts-collective 2. 27 bind a record, 3 declare `opens`, 100 have parts, 13 have slots. Fields per entry include `bindsKinds`, `parts`, `slots`, `resolver`, `offeredBy`, `needs`.
- `ACTION_CATALOGUE` + `AGENT_EXPOSURE` (`actions/src/agent.ts:17`) for triggers.
- Surfaces: `SurfaceDescriptor` (`packages/cms-ui/src/surface/types.ts:65`), `serializeDescriptor` / `parseDescriptor` (`url.ts:23,109`).

**Shape**: see `manifest.json` -> `block_manifest_example` (a real block, `feature-card`). Network manifest = merge of per-site manifests via `offeredBy`; per-site = filtered by that app's catalogue (`apps/<app>/src/lib/puck/catalogue.ts`).

**Not declared yet**
- Agent exposure for blocks does not exist (only for actions).
- Slot `disallow` is not on `PropDef` (only `allow`, `types.ts` PropDef); the rules file says it is declared there for Puck; where it is stored is unverified.
- `opens` targets: the host resolver decides (`opens-server.ts:59`); the block only carries `OPENS_PROP`. The manifest must merge each host's `opensSources` (`opens-server.ts`, "Step one of From what?") per site.
- Triggers: no block says "I run RSVP / checkout" as a catalogue id (`checkoutBlock(host)` / `rsvpBlock(host)` carry host actions, `puck-blocks.md`).
- A binding's visibility rule is code, not data.
- Extractor reliability: 164 `defineBlock` entries are solid; 12 `puck-config`, 4 `block-literal` and 3 unresolved props are weaker.

**Generation**: `scripts/build-block-manifest.mjs` runs the extractor, joins `AGENT_EXPOSURE`, joins each host's `describeSources()` (new, tiny), writes a per-app JSON plus a network file in arts-collective. CI fails if a block id disappears (ids are stored in page JSON).

---

## 5. MCP tools, pass 2

*Plain words: first the assistant can look (list pages, read one, see which blocks exist). Then it can suggest ("change this heading", "add a card here") and its suggestion lands in a draft that Justin sees as before and after and approves. It never publishes, and it can never reach another site.*

**Today**: 5 read tools registered at `packages/mcp/src/server/tools.ts:119`; `readTool` does scope, limits, audit, error containment (:45). Org lock `settleOrg` (`mcp/src/server/org.ts:37`): bound key = one org; unbound = owner/guide orgs; a refused claim stays refused. Audit `action_events` via `mcp`, actor_type `ai` (`audit.ts:47`). Planned writes: `draft_<id>` per `agent:'draft'` entry, scope `mcp:draft`, `lockOrgId` (`docs/open/mcp-foundations/PLAN.md:100,158,240-243`). `AGENT_DRAFT_IDS` exists (`actions/src/catalogue.ts:154`).

**Blocker to state first: org Puck pages have no draft state.** `savePage` writes `site_config` live (`store.ts:120-170`); only `user_pages` has draft/pending/published/archived (`user-store.ts:32`). Org-page drafts need a new row: key `puck-draft:<slug>` in `site_config` (same table, same `withOrg` RLS pattern as `page-edits`, `page-edits.ts:7-24`) holding `{data, baseUpdatedAt, by:"agent:<grant>", ops}`. Unverified: any existing diff-review UI (`PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md` exists, not read).

| Tier | Tool | Input sketch | Validates against | Gate | Why safe |
|---|---|---|---|---|---|
| read | `list_pages` | `{org}` | `listPages(orgId)` (`store.ts:177`) | `settleOrg` | org from the grant; slugs only |
| read | `read_page` | `{org,slug}` | `loadPage` -> `validatePage` (`validate.ts:61`) | `settleOrg`, owner/guide | stored doc only (no resolved data); member text under `untrusted`; returns `updatedAt` |
| read | `list_blocks` | `{org}` | per-site manifest | `settleOrg` | static file, no DB |
| read | `describe_block` | `{org,block}` | manifest entry | `settleOrg` | same |
| read | `find_fields` | `{org,slug?}` | descriptor generator over page doc and registries | `settleOrg` | ids and limits, values fenced |
| read | `list_surfaces` | `{org}` | `SurfaceDescriptor` + opens sources | `settleOrg` | descriptors, no content |
| draft | `propose_page_patch` | `{org,slug,baseVersion,ops[insert,move,remove,set,look,bind]}` | manifest (block exists, prop kind and limits, slot `allow`, `memberSafe`), `validatePage`, `cleanStyle`/`cleanCustomCss`, `sanitizeRichValues`, 1 MB cap, base == `updatedAt` | `mcp:draft` + owner/guide + `lockOrgId` | ops applied to a copy; written to `puck-draft:<slug>`; live page untouched |
| draft | `set_field` | `{fieldId,subject?,value,baseVersion}` | descriptor limits via shared `checkValue` | descriptor `agent:"draft"` + capability roles | record kinds with a draft state only (threads: `thread-edit` allows drafts from non-app doors); live site-section copy is not agent-draftable until it has a draft row |
| act | `open_surface` | `{org,descriptor}` | `parseDescriptor` (`url.ts:109`) allow-list | read-only | returns a `?surface=` link; opens nothing; `custom` has no URL (`url.ts` `case "custom"`) |
| act | `run_action` | `{id,input,org}` | `AGENT_DRAFT_IDS` only | `performAction` `via:'mcp'` (`run.ts:441`) + `lockOrgId` | catalogue `agent:'draft'`; `appOnly` impossible |

Audit: every call writes `action_events` as `mcp:<tool>` with arguments (4000-char cap, `audit.ts:30`); patch ops are the arguments, so a reviewer can replay them.

**Review before live**: `propose_page_patch` returns an `href` to a review route (proposed, not built): before/after rendered through the same `resolveAllData` path, a Publish button that calls the site's existing `savePageAction(slug, data, expectedUpdatedAt)` as the person (`apps/sunjay/src/lib/puck/actions.ts:35-61`), so the human gate, `RESOLVED_KEYS` strip and sanitiser are the existing ones. A stale base shows "page changed since".

**Cannot break binding**: `set` refuses keys in `RESOLVED_KEYS` / resolver output and the names `id, puck, editMode, children, morph` (`registry.ts:79`); on a `binds` prop it accepts only a reference string the host resolver can read publicly (`opens-server.ts:20-45`); `bind` stores the reference only, never a copy. **Cannot cross tenants**: org comes only from the grant (`org.ts:37`), every store call takes that `orgId` (`store.ts:46-48`), host resolvers read their own org only (`opens-server.ts:17`), and a reference outside the org resolves to nothing. Page text in results is fenced under `untrusted` like `sanitize.ts`.

---

## 6. LMS reach

*Plain words: a lesson step could say "Change the headline on your home page" and take the learner there with the headline outlined and the editor open on it. Today a step can only name a whole task like "set up your profile" and ticks when the database says it is done.*

**What exists**
- A `task` step has `settings.task = {id (catalogue entry), scope person|org, params}` (`packages/lms/src/types.ts:80`, `tasks.ts:14`); completion is derived by asking the entry's status (`tasks.ts:38-64`), not by an event.
- Route: `routeFor(id,{hub,orgSlug})` builds `<path>?surface=<descriptor>` from the entry's `address` (`packages/actions/src/route.ts:19`), plus the `?eac-step=` return ticket (`withTicket`).
- Anchor: `data-eac-anchor="<entry id>"` via `anchorProps` (`actions/src/anchor.ts:14`); the dock outlines the first visible match (`packages/dock/src/dock.tsx:170-195`). One anchor per entry id, so it cannot say "this heading".
- Push completion: `onPerformed` after a successful run (`run.ts:446`).

**Missing**
1. A step cannot name a block or field: add optional `target:{fieldId|nodeId,page}` and `lens:"fields"|"look"` to `settings.task`.
2. Anchor vocabulary: allow `field:<fieldId>` and `node:<nodeId>`. The lens already sets `data-fields-ok` on every declared field (`FieldsLens.tsx:84-90`), so lens fields need no new markup; look targets use direct-edit's `data-node`.
3. Opening the lens: a query such as `?eac-edit=field:<id>` handled in `FieldsLens` (sets `on`, opens the panel focused). Today only the bar opens it.
4. Done by event: a lens save through `performAction('site-section-save')` already writes an `action_events` row and fires `onPerformed` (`save.ts:105`, `run.ts:446`). Add `fieldId` to the audit input and an lms check "a row for action X with input.fieldId=Y since step start"; `TaskStatus` is state-only today (`tasks.ts:44`).
5. A block must expose `data-node` plus, per editable element, `data-field` (record) or `data-part` with `prop` (block). Lesson authors choose targets from `find_fields` and the manifest.

---

## 7. First three moves

1. **Shared checker plus descriptor generator (S).** Lift `checkValue` / `linkOk` (`house-editor/src/fields/registry.ts:100`) so `PropDef` limits work; add `describeFields(catalogue, registries)` -> `FieldDescriptor[]`. Files: `packages/house-editor/src/fields/registry.ts`, new `packages/blocks/src/field-descriptor.ts`, a test.
2. **Block manifest plus read tools (S/M).** `scripts/build-block-manifest.mjs` reusing `DEVELOPMENT_APP_2026-11-20/extract-blocks.js`; optional `agent`, slot `disallow`, `triggers` on `BlockDef` (`blocks/src/types.ts`); MCP `list_blocks`, `describe_block`, `list_pages`, `read_page`, `find_fields` in `mcp/src/server/tools.ts` reusing `readTool` and `settleOrg`.
3. **Record provenance mark and the first record field (M).** `fieldMark()` beside `editItem` (`blocks/src/edit-item.ts`); `fieldSources` from the `feature-card` and `record-header` resolvers (`feature-card.tsx:131`, `record-parts.tsx`, sunjay `opens-server.ts:77`); a `thread` kind in sunjay `lib/fields.ts` routed to `thread-edit` with `subjectId`; extend `FieldsRoute.toInput` (`save.ts`). Justin sees: with "Edit page" on, a card whose title comes from a gathering becomes editable and saves to the gathering.

Later: the `puck-draft:<slug>` store and review route, then `propose_page_patch`; unify the four gates into one `canEditSite`.

## Risks
- **Tenancy**: `puck:home` is one key shared by every app and arts-collective renders every org (`puck-blocks.md`, 2026-10-30): `read_page` must key by the grant's org and treat unknown blocks as foreign. `page-edits` uses `withOrg` (RLS) but `savePage` uses plain `db` (`store.ts:46`): whether RLS covers it is unverified.
- **Sanitising**: workshop live save has no sanitiser (system 3); avatar URL unvalidated (atlas `profile-field-save` drift); patches must pass `sanitizeRichValues`, looks `cleanStyle` / `cleanCustomCss`.
- **Binding**: typed-wins-over-bound means any block-prop edit of a bound value silently detaches it; a `set` on a bound card's `title` must warn. The resolver exists twice (client `config.client.ts:99`, server `config.server.ts:33`).
- **Audit gap**: systems 3 and 5 write no `action_events` row.

## Not verified
art-auction `getPagesEditor` role set; RLS on `site_config` for `savePage`; depth of validation in `updateProfile`; SurfaceDescriptor members past line 140 of `types.ts`; any existing diff-review UI; `thread-edit` is simply absent from the `AGENT_EXPOSURE` I read.
