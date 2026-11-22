# House editor audit: ifac and hidden-enneagram (2026-11-20, read-only)

Method: code read on eris, atlas `atlas:q --app ifac` (113 capabilities) and `--app hidden-enneagram`, drift.md, JOURNAL.md, PUCK_LIFT PROGRESS.md. No edits, no DB access, nothing rebuilt.
Dirty state: `git status --short apps/ifac apps/hidden-enneagram packages/live-editor | wc -l` = **0**. No uncommitted editor files in these paths.

## 0. @elkdonis/live-editor: KEEP (Justin). Role: "on-site field/copy quick edit"

It is the house editor's FIELD layer: it says "you are editing this field" (a bio, a title, thread copy, a section's words), not "you are restyling the page". Look, layout and blocks stay with the direct-edit canvas and Puck.

What it is (packages/live-editor, 1379 lines, created 2026-09-06, last touched 2026-09-17; it predates direct-edit by two months):
- `LiveEditor` (LiveEditor.tsx): fixed control bar (role chip, "Live Edit", "Styles", "Full editor ->" via `fullEditorUrl`, `extra` slot).
- `EditOverlay` + `FieldPopover`: a pencil pin on every `[data-trait]` element whose trait matches a `FieldDef` (EditOverlay.tsx scan, first match per trait); input kinds text, textarea, url, number, datetime, date, select, image, compound, readonly (types.ts:1-12). Save is the host callback `onSaveField({trait, value}) -> {ok, error}`.
- `StyleOverlay` + `CssPanel` + `preview.ts`: paint pins on `[data-theme-vars="--a,--b"]` elements narrowed to those variables; one shared preview `<style id="lve-theme-preview">`; saves only variables that differ from default.
- `ThemeStyle` (`@elkdonis/live-editor/theme`, server component): renders `resolveTheme()` as one `:root{}` rule; kept off the barrel so postgres stays out of client bundles.
- Users: ifac (6 imports), arts-collective (5), artdirect (2), packages/cms-bindings (builds `FieldDef`/`CssVarDef` from `fieldRegistry`: "one registry, two renderers", workshop/field-registry.ts), packages/ui re-export. **art-auction: no LiveEditor or live-editor reference found under apps/art-auction/src or its package.json; Justin says it is used there, so this is uncertain (maybe via @elkdonis/ui). Verify.**

Generic (the reusable field layer): trait-pin scan and popover, `FieldDef`/`FieldInputType`, compound fields, the `SaveFieldPayload` contract, per-element style pins keyed on variable names, shared preview tag, `ThemeStyle`. App-specific parts live only in host callbacks and the `CssVarDef` list.

Gaps against the house stack: plain text only (no rich text or `cleanRich`), image input is not `makeChoosePicture`, no undo or dirty tracking, no stale-save guard, own inline-styled dark bar (top right, would collide with canvas chrome), one flat field list per page, no records/`binds`.

### Hand-off to canvas and Puck for look
1. Two doors stay visibly distinct: pencil pin = a field; paint pin = a small named-variable set; anything bigger (layout, blocks, parts look) hands off.
2. Replace `fullEditorUrl` with a typed `handoff: { look?: href|fn, blocks?: href|fn }`. Canvas-first apps point `look` at `/studio/<slug>`; apps without a canvas keep a link to their form.
3. Reverse direction (inception): the canvas "Settings..." sheet and a sealed block's field box render the same `FieldDef[]`, so one list serves pin popover, canvas right column and Puck fields. cms-bindings already derives it from one registry; extend that rather than write a third list.
4. Style pins write through the one theme model (section 4), not per-app `saveMy...ThemeAction`s.

### Overlap with other in-place field editors, and one shared model
| Editor | Atlas id | Code | Store | Engine |
|---|---|---|---|---|
| ifac bio | profile-field-save | apps/ifac/src/lib/profile-editor-actions.ts:50 `saveProfileFieldAction`, `FIELD_TO_COLUMN {bio}` | `users.bio` | live-editor `data-trait="bio"` |
| ifac gallery title/description | gallery-details-save | gallery-actions.ts:83 `saveGalleryFieldAction` (traits galleryTitle, galleryDescription) | `user_galleries` | live-editor |
| arts-collective workshop | edit-workshop-live | `updateWorkshopFieldByTraitAction` (lib/cms/actions.ts:284): `fieldRegistry[trait]`, numeric coercion, compound expand | threads columns | live-editor in WorkshopLiveEditor.tsx |
| innergathering home copy | page-edits-save | `savePageEditsAction` | `site_config` patches over fixed layout, allow-list home | direct-edit block patch editor |
| section copy (4 apps incl. ifac) | site-section-copy-save | `saveSectionAction`; ifac `api/manage/content` (`ifac-site-section-save`) | `org_site_sections` jsonb | raw JSON textarea (ifac) / section form |

All five are "one named slot, one value, one gate, one write". Gates differ (ifac self-or-admin `canEditProfile`; others owner/guide; workshop author), the shape does not.

**Recommended single model: a field slot.** A slot is `{ trait, input, label, hint, scope, source }`, declared once in a registry (extend cms-bindings `fieldRegistry` beyond workshops): ifac registers bio, galleryTitle, galleryDescription; sections register their copy keys; innergathering's patch editor becomes slots with scope org-page. One thin server entry per app resolves the slot, runs the scope's gate (`self-or-admin`, `org-editor`, `thread-author`), cleans by input kind, writes, revalidates from the slot, and takes optional `expectedUpdatedAt`. Retire bespoke `FIELD_TO_COLUMN` maps and per-app actions as slots migrate. Atlas open question for page-edits-save ("which survives?") resolves as: wording belongs to slots; anything structural belongs to the Puck/canvas page (atlas `canonical`: fold into page-save).

### The "Fields lens" (Justin's addition): proposal

(d) What exists today toward it:
- Declaration side exists in two places: `FieldDef.trait` matched to `[data-trait]` in the DOM (live-editor), and `fieldRegistry` mapping trait to table columns with coercion (cms-bindings, workshops only). The registry is the closest thing to "record kind + field + input kind" and already feeds live-editor via editor-config.ts.
- Save side exists in the atlas: every field-save action is already an atlas capability with gate, risk and confirm wording (`profile-field-save`, `gallery-details-save`, `edit-workshop-live`, `site-section-copy-save`, `page-edits-save`, `ifac-site-section-save`). The runtime twin is `packages/actions/src/server/run.ts`: `RUNNERS: Record<id, Runner>`, `Runner<I> = { input (zod), allowed(ctx,input), run(ctx,input), failure }` (run.ts:111-118), and `performAction(id, ctx, raw)` (run.ts:441), which checks sign-in, resolves `actionMeta(id)` scope (`thread` subject, `org` must equal `siteOrgId`), validates input, runs the gate and handler, writes an audit row, fires `onPerformed`. Site-bound variants: `SITE_BUILDER_RUNNERS` (sb-runners.ts:41, e.g. `site-section-save` takes `{pageId, values}` and maps slot keys to `org_site_sections` section/field through the host `SiteBuilderAdapter.templatePages[].slots`) and `HUB_RUNNERS`. `actionInputSchema(id)` returns the zod schema as JSON Schema.
- Gap: the atlas rows for field saves (ifac, arts-collective, innergathering) are documentation of host-owned server actions, not runners. Only a few field entries are real runners today (`profile`, `org-details`, `listing`, `site-section-save` in the registry). The registry runners are not yet keyed per field, and `RUNNABLE_IDS` does not include ifac's `profile-field-save`. Confirm wording exists on atlas rows (`confirm.text`, status draft/approved), e.g. edit-workshop-live "Change {name} on the workshop {title}? Visitors see the change at once."

(a) API, as its own package or subpath (e.g. `@elkdonis/direct-edit/fields` or `@elkdonis/fields`; do not keep it in the barrel with `ThemeStyle`'s db dependency):
- Declare in markup: `data-field="<kind>:<id>:<field>"` (e.g. `profile:<userId>:bio`, `section:home:hero.title`, `thread:<id>:title`) plus optional `data-field-input` override. Keep `data-trait` as an alias during migration.
- Declare in code: `defineFields({ kind, fields: { bio: { input: 'textarea', capability: 'profile-field-save', source: {...}, label, hint } } })`, a registry module shared by server and client (pure data, no db import, so the client can read labels and input kinds; the server reads the same entry to validate).
- Lens runtime: `mountFieldsLens({ host, registry, resolveValue?, save, handoff })` scans for `[data-field]` (MutationObserver instead of live-editor's rAF scan), draws the pin and popover, edits in place, and calls one `save({ capability, subject, field, value, expectedUpdatedAt? })`.
- Value for the pin: initial value from the DOM text/HTML or a `resolveValue`; compound and image kinds as live-editor.

(b) Routing each save through the atlas:
- `save` calls a single host server action `runFieldAction({capability, subject, field, value})` that does `performAction(capability, ctx, {subject, field, value})`. The host resolves `ctx` from its session (as `runAction` already requires; the actor is never client supplied).
- Each field-save capability gets a runner whose zod input is `{subjectId, field, value}`, `allowed` is the capability's gate (`threadEditor`, `orgEditor`, or a new `selfOrAdmin` using `canEditProfile`), `run` calls the service that already writes (`updateProfile`, `updateUserGallery`, `savePageEdits`, the `org_site_sections` merge). Gate, risk class and confirm wording are then inherited from `actionMeta(id)` / `REGISTRY_CONFIRM` (registry-confirm.ts), and every save gets the audit row for free.
- New feature becomes quick-editable by: (1) adding a registry entry that names an existing capability or a new runner, (2) adding `data-field` on the element. No new form, no new server action.
- Cautions (evidence): confirm wording is only drafted for some rows and the lens would show it only for risky kinds (public + irreversible), not on every keystroke save; `appOnly` entries are refused except through the site-bound hub door (run.ts `meta?.appOnly` check), so field entries must carry `siteOrgId` through `performHubAction`; atlas `scope` is person/org/thread/channel/series/other, so a field's `subject` maps to `scope` (a profile field is `person`, a workshop field `thread`, section copy `org`); the atlas check (`atlas:check --strict`) would then also guard drift for fields. This is a proposal; I did not prototype it.

(c) Switching to the Look lens (canvas/Puck):
- One mode bar for the house editor with lens tabs: Fields (pencil pins) and Look (canvas). The host mounts one lens at a time; switching passes the current selection: the lens knows the element's `data-field` and the enclosing block id (`data-block`/node id), so "Edit look" from a field opens the block popup (`openStudioPopup`) or the canvas on that node, and "Edit field" from the canvas Settings sheet focuses the pin. `handBack` and `inception` in direct-edit already implement the stack and the hand-back of a selection (mount.ts `inception`, `editSettings`).
- A field inside a sealed block (a Puck prop) is edited through the block popup, not the Fields lens; the Fields lens only owns fields that are NOT part of a page document (profile, thread, section copy slots). Where a page document holds the copy (Puck `puck:<slug>` text), the canvas is the single owner, and the Fields lens declines the element. This rule keeps one writer per value.

#### UX model for the Fields lens: art-auction About editor (apps/art-auction/src/app/about/about-editor.tsx, 229 lines; lib/about-content.ts)

What it does (read): on-page bar with an `Edit page` / `Done` toggle (about-editor.tsx:208); per-section chips `Edit`, up and down arrows (`move`, :169-192), `Remove` (confirm, :176), an `Edit intro` chip for the lede, `Add section` (:181); one dialog per section with kicker, title, `RichTextEditor` from `@elkdonis/cms-ui/editor` (:131), a `MediaField` (upload to `/api/about/media` or URL, :55-93) and a link; one `saveAboutAction(next)` (app/about/actions.ts) then a sonner toast (:162-165). Store: `site_config` (org `market`, key `about_page`), `cleanAbout()` validates and drops unknown keys on write and read (about-content.ts:99-150); gate `canEditAbout` (owner of the market org or admin). Atlas: `about-page-save`, `about-media-upload` (areas/apps.art-auction.admin.ts:113, :168).

Generalise into the lens:
- The bar (state label, Edit/Done toggle, role chip): replaces live-editor's dark top-right bar; same bar hosts the Look-lens switch.
- The chip pattern: a chip drawn on any `[data-field]` or `[data-field-group]` element; a group (a repeating section) adds up/down/remove/add. This is the one thing live-editor lacks: it edits a value, About edits a LIST of rows. Model as `data-field-list="<kind>:<id>:<field>"` with row ids.
- The dialog: render from the declared field list, in this order of kinds: text, textarea, rich (`RichTextEditor`, with `cleanRich`), media (upload or URL, through `makeChoosePicture` or the site's `mediaUploadRoute`, not About's own `/api/about/media`), link (url + label), select, number, date, compound. These are live-editor's kinds plus rich, media and link.
- Save contract: one action per scope, optimistic `dirty`, toast on result, `expectedUpdatedAt` guard; clean on write and read with a declared cleaner (About's `cleanAbout` is the model: unknown keys dropped).
- Gate as a named function in the capability (`canEditAbout`), not in the UI.

About-specific (do not generalise): the section shape `{id, kicker, title, html, media, link}`, the layout (`abt-row`, `is-text`, media beside text), the commission figure, the market org key, and the whole-document save (it saves the entire page JSON at once). In the lens the save unit should be the one slot or one list row, with the whole-document form as an option for list-valued stores like this one.

Reading About as a field-lens client: it is a list-of-rows slot (`about_page.sections[]`) plus one lede slot. In the proposal it would be two declarations (`defineFields({kind:'about', fields:{lede:{input:'rich'}, sections:{list:{kicker:'text', title:'text', html:'rich', media:'media', link:'link'}}}})`) bound to capability `about-page-save`, and `about-editor.tsx` (229 lines) shrinks to markup carrying `data-field` attributes. Same for ifac sections (`org_site_sections`, now raw JSON) and innergathering page-edits.

## 1. ifac editor surfaces

| # | Surface | Edits and store | Engine | Gate, cleaning, guard, media | Class |
|---|---|---|---|---|---|
| 1 | `/artists/[slug]`, `/dealers/[slug]`; `components/profile-editor-panel.tsx` -> `saveProfileFieldAction` (profile-editor-actions.ts:50) | bio, `users.bio` | live-editor field pin | `canEditProfile` self or admin; only `bio`; no guard | C (field layer, register as slot) |
| 2 | Same panel, "Change portrait" -> POST `/api/upload` then `saveAvatarAction` (:60) | `users.avatar_url` | custom file input | same auth; avatar path not validated | B (makeChoosePicture, mediaUploadRoute) |
| 3 | Profile "Featured work" `GalleryPanel` -> `ProfileGallery` (cms-ui/gallery) -> `saveGalleryAction` (:83) | `org_profiles.portfolio` (migration 264) `{id,url,title,x,y,w,h}` | shared widget, drag and resize | self/admin, 400ms debounce, no guard | C (expose as gallery source) |
| 4 | `/artists/[slug]/galleries/[gallery]`; `components/gallery-editor.tsx` -> gallery-actions.ts (`saveGalleryItemsAction`, `saveGalleryFieldAction`, `setGalleryPublicAction`, `saveGallerySettingsAction`, `deleteGalleryAction`) | `user_galleries` items, title, description, is_public, `settings` (page-scoped CSS vars) | live-editor pins + style pins + ProfileGallery | owner read from row, `sanitizeThemeVars`; `/api/upload`, `/api/my-media`; no guard | C |
| 5 | `/hub/profile` `PageSectionSwitches` -> PATCH `/api/hub/profile-sections` | `users.profile_sections` jsonb merge | custom switches | self only, 4-key allow-list, raw SQL | C (page-settings / section toggles) |
| 6 | `/artists/[slug]/writing[/piece]`, `WritingDesk` (cms-ui/writing) -> writing-actions.ts (`savePieceAction` :85, start, delete, listing) | threads: title, bodyHtml, slug, listing (thread_orgs) | `RichTextEditor` + preview | author or admin from row; no guard (rows carry `updatedAt`) | C |
| 7 | Store panel `store:1`, shown at person-view.tsx:168, edited on art-auction `/panel/ifac` | `user_pages` (per person, org, key; status draft/pending/published; IFAC reviews via `ifac-submission-page-decide`) | Puck (page-builder `saveUserPage`) | review workflow, `sanitizeRichValues`, 512KB cap; no guard | C (precedent for member-authored page) |
| 8 | `/manage/sections` (`components/manage/sections-editor.tsx`) -> POST `api/manage/content` | `org_site_sections` jsonb per key (hero, about, signup, rsvp, gallery, dealers, blog, videos, social, embeds, footer) | **raw JSON textarea** (admitted holding position) | `canManageIfac`; `db.json(body.content ?? {})` with **no validation or sanitising**; no guard | **B** |
| 9 | `/`, `/about`, `/publications` (coded pages, app/page.tsx etc.) | none editable in place | none | no canvas, no `?edit`, no `puck:*` doc | **B** (largest gap) |
| 10 | `/manage/appearance` `AppearanceCard` -> `saveIfacThemeAction` (theme-actions.ts:16) | `site_themes` ('' and 'hub') | live-editor CssPanel | owner/guide; `sanitizeThemeVars` | B (Site style) |
| 11 | Own colours in ProfileEditorPanel -> `saveMyIfacThemeAction` | `users.theme` | live-editor | own row | C |
| 12 | `/manage/appearance` skin select -> `saveHubSkinAction` | `site_config hub:skin {skin}` | custom select | `canEdit`; `isHubSkin` | C (becomes a choice var) |
| 13 | `/hub/compose` `ComposeWorkspace` -> `lib/cms/actions.ts` | threads | studio-forms | member | forms stack (outside page editing) |
| 14 | `/hub/series/[id]` `SeriesPlannerPage`, `/api/hub/series-page` | series thread and page | `@elkdonis/series-site` | shared route | C |
| 15 | `/manage/email/series/[id]/mailings/[slug]` `EmailSurface` | mailings | cms-ui email | editor | C |
| 16 | `/hub/email/[key]/edit` | template body | **GrapesJS** `@elkdonis/newsletter/editor` | `requireOrgEditor` | C |
| 17 | `/manage/directory`, `/manage/submissions` | org_profiles, moderation | custom forms | manager | C (admin) |

Counts for ifac editor surfaces 1-12, 14-17: A = 0, B = 4 (2, 8, 9, 10), C = 13, D = 0 now (after migration retire the JSON sections editor and `saveIfacThemeAction`). Item 13 is the forms stack.
ifac imports page-builder and blocks only to RENDER `store:1` (person-view.tsx:23-24, 85). It has no `@elkdonis/direct-edit` dependency, no `/studio`, no Site style, no menu, pages or guard kit; nav is hard-coded in components/site-chrome.tsx.

**B set for ifac, exactly:** add `@elkdonis/direct-edit`; canvas at `/studio/[slug]` and Puck at `/studio/[slug]/blocks` for landing, about, publications (as `puck:*` docs with code defaults, as HE `default-pages.ts`; event stage, art strip, sign-up frame, series slides as sealed blocks with resolvers); `savePageAction` gated by `canManageIfac` + `cleanBoxDoc` with `loadPageWithVersion`/`expectedUpdatedAt` from day one; Site style schema from `IFAC_THEME_VARS` (--paper, --surface, --ink, --line, --oxide, --gold, --blue, --moss, --frame, --frame-soft, --frame-width) plus hub skin as a `choice` var, with `data-chrome`/`data-part` in site-chrome; `makeChoosePicture` and `mediaUploadRoute`; `menuPlugin` with `loadSiteNav/saveSiteNav` for primary nav; `pagesPlugin`/`listSitePages`; person page as a template doc with live-editor pins kept for member self-edit.

## 2. hidden-enneagram editor surfaces

Deps include direct-edit, page-builder, studio, studio-forms, site-forms, newsletter. Gate: `getApiEditor()` / `requireOrgEditor`.

| # | Surface | Edits and store | Engine | Save, gate, cleaning, guard | Class |
|---|---|---|---|---|---|
| 1 | `/studio/[slug]` (`components/studio/CanvasEditor.tsx`) | `site_config puck:<slug>`: home, enneagram, readings, about, service, post, person, music, new pages | direct-edit `mountTreePage` | `savePageAction` (lib/puck/actions.ts) `getApiEditor`, `isValidSlug`+`ROUTE_SLUGS`, `cleanBoxDoc(stripResolvedKeys(...))`; **no guard** | A |
| 2 | `/studio/[slug]/blocks` (`page-editor.tsx`) | same doc | Puck + `partsPlugin` + local pagesPlugin | same action | A |
| 3 | `/studio`, `/manage/pages` (list, new, "Start a reading" with unguessable `readingSlug()`) | page list | custom | `requireOrgEditor` | A |
| 4 | `SiteStyleButton` (hidden on /studio, /manage), `/manage/site` | `site_themes` page_key '' + `site_config site-style:chrome` | direct-edit/site | `saveSiteStyleAction`, `cleanSiteStyle(schema)` both ways, revalidates `/` layout | A |
| 5 | `--he-look` Quiet/AEON preset + `LookWatcher` | one `choice` var mirrored to `data-he-look` | Site style | n/a | A |
| 6 | `/publish` Studio pop-up (`publish/studio-surface.tsx`; `lib/studio/writing-actions.ts`, `service-actions.ts`) | writing, services (threads) | `@elkdonis/studio` | editor | A (forms stack) |
| 7 | `/manage/content/new|[id]` (`saveContentAction`, lib/cms/actions.ts) | threads | shared composer | editor | D candidate: overlaps 6 (HE own forms/actions.ts holds post and service forms too); canonical not verified |
| 8 | `/manage/newsletter/[slug]` -> PUT `/api/newsletter/[slug]` (he-newsletter-save) | letter title, `project`, raw `html` | **GrapesJS** | `getApiEditor`; cleaning inside package, not verified | C |
| 9 | `/manage/music` `music-settings.tsx` -> `saveAudioConfigAction` | `site_config he-audio` | custom form, `cleanAudioConfig` | editor | C (a Settings sheet) |
| 10 | `/api/center/{profile,layout,portfolio}`, `/center` | follower profile | shared center | signed in | C |

Counts (surfaces 1-10): A = 6, B = 0, C = 3, D = 1 (candidate). HE gaps against the shared kit (absent by grep): stale guard; `menuPlugin`/`loadSiteNav` (nav is code in site-header.tsx); `templatesPlugin`; `SiteSources`/`siteBindsFields`/`recordSourcesFrom` and `records` on `mountTreePage` (sunjay passes `person-records`, HE does not); `makeChoosePicture` (local `page-picture-chooser.tsx` copy, same as sunjay); `mediaUploadRoute` (own 32-line `api/upload`); direct-edit `pages` option (HE's pagesPlugin is Puck-only). Combined A/B/C/D across both apps: A 6, B 4, C 16, D 1.

## 3. Features worth INHERITING into the one house editor
1. Scope-aware field pins with a role chip (live-editor): member edits own bio on a page they do not own; admin can too. The house editor is owner/guide only today. Resolve `canEdit` per slot.
2. Per-element style pins naming variables and row-scoped looks (a gallery's `settings`, a person's `users.theme`). The canvas has per-block parts look but no per-page or per-person variable layer. Inherit as a scope ladder (org > page > person) using `resolveTheme(precedence)` (services/themes.ts:86-118).
3. Diff-only writes (CssPanel stores only values that differ from default, so untouched variables keep following the site palette).
4. One shared live-preview style tag across panels (preview.ts).
5. `ProfileGallery` with user-vs-org library labels and the org-scoped portfolio list: make it a gallery source for `siteBindsFields`/`GalleryPickerField` and a block.
6. Member-authored pages with org review (`user_pages` status + `submitUserPage`): treat "publish" vs "submit for review" as a first-class publish mode.
7. Hub skin as a named arrangement: model as a Site style `choice` var plus attribute mirror (HE `--he-look` and `LookWatcher` already do this).
8. HE-only: `boxify` + `presets` (lib/puck/boxify.ts, 294 lines), `TEMPLATE_NOTICE` (a template save changes many addresses), `readingSlug()` unguessable private pages. Promote boxify/presets to the shared mount helper, the notice to the shared `saveNotice`.
9. The stale-save guard exists only in danamccool and elktours; ifac, HE and sunjay lack it. Make it universal.

## 4. The theme split and one model

| Action (atlas id) | Code | Storage | Scope | Gate | Vocabulary |
|---|---|---|---|---|---|
| site-theme-save | ifac theme-actions.ts:16 -> services `saveSiteTheme` (themes.ts:139) | `site_themes(org_id, page_key, vars jsonb, updated_by)` | site ('') and page key ('hub') | owner/guide | `CssVarDef[]`, free `--var` map, regex-sanitised (themes.ts:31-52) |
| user-theme-save | `saveMyIfacThemeAction` -> `saveUserTheme` (themes.ts:162) | `users.theme` jsonb | one person, network-wide | own row | same bag |
| gallery look | `saveGallerySettingsAction` | `user_galleries.settings` | one gallery | owner | same bag and sanitiser |
| site-style-save | per app `lib/site-style.ts` (HE :19-38): `cleanSiteStyle(raw, SITE_STYLE)` then `saveSiteTheme(ORG, "", ...)` + chrome upsert | **`site_themes` page_key '' (the SAME row ifac writes)** + `site_config site-style:chrome` | org site | owner/guide/editor | `SiteStyleSchema` (kinds hsl, color, length, font, background, choice; chrome parts) |
| hub-skin-save | ifac `setHubSkin` | `site_config hub:skin` | org hub | owner/guide | named skin |

Findings: site-theme-save and site-style-save write the same table and bag, differing only in schema type and chrome. `resolveTheme` already layers org, page and person. A skin is the one thing a variable bag cannot express; HE solves it with a `choice` var and an attribute mirror. Revalidation differs (sunjay and elktours do not revalidate).

**Proposal:** (1) one typed `SiteStyleSchema` per site is the source of truth for variables, kinds and chrome parts; `CssVarDef` becomes an adapter derived from it (drop `IFAC_THEME_VARS` as a separate list). (2) One store, `site_themes`, with scope keys: site '', page key, plus `users.theme` and row `settings`; one `saveTheme({scope, id, vars})` and the existing `resolveTheme` ladder; chrome stays `site-style:chrome`. (3) One cleaner (`cleanSiteStyle`) on write and read, diff-only writes. (4) Skins become `choice` vars (`--hub-skin` mirrored to `data-hub-skin`), read `hub:skin` as fallback during migration. (5) One door: "Site style" as a canvas menu item (ROUND1 open item 1) plus the live-editor style pins, both through one action with a parameterised gate (`org-editor` | `self`). (6) One revalidate policy: `revalidatePath("/", "layout")`.

## 5. HE canvas/Puck wiring vs sunjay, option by option

Files: apps/hidden-enneagram/src/components/studio/{CanvasEditor.tsx (162), page-editor.tsx (102)}; apps/sunjay/src/components/studio/{CanvasEditor.tsx (172), page-editor.tsx}; routes `app/studio/[slug]/{page,blocks/page}.tsx`. Option list: packages/direct-edit/src/puck/mount.ts:19-70.

| Option | HE | sunjay | Varies by |
|---|---|---|---|
| `doc` | passed through `boxifyDoc` first | raw | HE-only: hook `normaliseDoc?` |
| `config` | `canvasConfig` with `permissions.insert=false` for BOXED_TYPES | as is | prop `hideFromInsert` |
| `contract` | `canvasContract` | same | prop (catalogue) |
| `resolved` | `resolvedRows` with `RESOLVED_KEYS` | same with `KEYS = {...RESOLVED_KEYS, "thread-feed": ["items"]}` | prop `resolvedKeys` |
| `metadata` | `{orgId, slug}` | plus `...record` (template opened on one record) | prop |
| `choosePicture` | local MediaPicker copy | same copy | replace with `makeChoosePicture` |
| `presets` | boxed starting layouts | none | prop |
| `records` | not passed | `person-records` | prop (needs `recordSourcesFrom`) |
| `designTools`, `developer` | true, false | true, false | defaults |
| `blockEditorHref` | `/studio/<slug>/blocks` | plus record query | prop |
| `onSave` | `savePageAction(slug, d)`, no version | same, no version | prop; add `expectedUpdatedAt` |
| `saveNotice` | `TEMPLATE_NOTICE` {service, post, person} | {event-detail, journal-piece} | prop |
| `onDone` | `window.location.assign(publicPath ?? PUBLIC_PATH[slug] ?? /slug)` | `router.push` (templates to /manage/builder) | prop `doneHref` |
| `inception` | **not set** | true | default true (HE should enable) |
| `editSettings` | `openBlockSettings({config, node, metadata, title, strip})` | adds `plugins: sheetPlugins` (partsPlugin `handBack:true`, popup via `openStudioPopup` with `records`) and `escape: true` | HE lacks sheet plugins and Esc walk-back |
| `pages`, `onRestore`, `cleanRich` | unset | unset | `pages` exists in direct-edit, unused by both |

PuckEditor: HE `plugins [PARTS (no handBack), pagesPlugin(local)]`, title map, no `metadata`, no templates or menu; sunjay `[templatesPlugin, MENU, PARTS(handBack)]`, `metadata`, `templates`. Both `onPublish={savePageAction}`, neither passes `version`. Server pages: HE gates `isValidSlug`+`ROUTE_SLUGS`, `startingPoint`; sunjay uses async `slugProblem` (feed check), redirects the landing slug to `/`, `templateDocument(startingTemplate(...), loadHomeSeed())`, record query. Actions: HE `stripResolvedKeys(data, RESOLVED_KEYS)` from `@elkdonis/blocks/record`; sunjay `stripResolved`; sunjay revalidates the full layout for templates.

**Proposed shared `HouseEditor` props:** `slug, orgId, initial, version?, metadata?, catalogue {canvasConfig, canvasContract, puckConfig}, resolvedKeys, save(slug, doc, expectedUpdatedAt?) -> {ok, error?, stale?, updatedAt?}, doneHref, blockEditorHref, saveNotice?, records?, presets?, hideFromInsert?, normaliseDoc?, choosePicture, plugins {templates?, menu?, pages?}`. On by default: `designTools`, `inception`, `handBack`, `escape`; `developer` off. The two apps then differ only in their bind. `withProps`, `resolvedRows`, `holdsData` are verbatim duplicates in both files and move into the shared component. The Fields lens (section 0) mounts beside it as a second lens, not a second editor.

## 6. Dirty state
`git status --short apps/ifac apps/hidden-enneagram packages/live-editor | wc -l` = 0.

## Uncertainties
- art-auction use of live-editor not found (section 0).
- Not checked: browser behaviour; `@elkdonis/newsletter` html cleaning; whether HE `/manage/content/*` is still linked; ifac `api/upload` rules; art-auction `/panel/ifac` save path (call site and `saveUserPage` read only); whether any ifac field-save id is in `RUNNABLE_IDS` (I believe not; not grepped exhaustively).
- The Fields-lens API and atlas routing are a proposal, not prototyped.
