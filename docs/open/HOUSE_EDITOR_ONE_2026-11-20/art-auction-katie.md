# House editor audit: art-auction and katie-the-potter (2026-11-20, read-only)

Paths relative to ~/eac/apps/<app>/src unless noted. Atlas areas read: apps.art-auction.{admin,market,rest,series,studio}, apps.katie-the-potter.{claim,site}. Atlas query CLI was started once (output not used; capability ids were taken from the area files). Line numbers are given where grepped; elsewhere file only.

## 0. Dirty state (collision risk)
- `git status --short apps/art-auction apps/katie-the-potter | wc -l` = 38.
- art-auction: 1 file, `app/artworks/[id]/page.tsx` (not an editor). All art-auction editor files are clean.
- katie: 37 files. Editor-relevant uncommitted: `components/studio/page-editor.tsx` (templatesPlugin added), `app/studio/[...path]/page.tsx`, `lib/puck/config.client.ts` (siteBindsFields), `blocks/index.ts`, `blocks/about-hero.tsx|studio-strip.tsx|about.css` (new), `lib/puck/templates.ts` (new), `lib/puck/site-sources.ts` (new), `components/studio/menu-plugin.ts` (new, unwired), `lib/puck/nav-actions.ts`, `lib/nav*.ts` (new), `components/studio/artwork-picker.tsx` (deleted), `components/manage/piece-form.tsx` + `piece-images.tsx` (new), `components/channel/ArtworkQuickForm.tsx`, `app/api/media/upload|library/mine/route.ts`, `lib/manage-actions.ts`, `lib/piece-template.ts`, `app/layout.tsx`, `site-header.tsx`. The rest (checkout, orders, shipping, cart) is another session's. Editing page-editor.tsx or config.client.ts means editing over uncommitted work: have the owner commit first. PROGRESS.md already says hold a katie rebuild.

## 1. Surface inventory

### art-auction (org `market`, siteConfig.marketplaceOrgId)
Engines: Puck (pages, panel), three.js (installations, loft, parlour), custom forms (everything else). No direct-edit anywhere (art-auction/package.json has no direct-edit dependency).

1. **Designed pages** `/edit/[slug]` (list at /admin/pages; no `home`, `/` is code). Component `components/pages/page-editor.tsx`. Save `lib/puck/actions.ts savePageAction`. Engine: Puck `PuckEditor` + `templatesPlugin` only (no partsPlugin, no canvas). Store: site_config `puck:<slug>` via `lib/puck/store.ts`. Gate: `getPagesEditor` (`lib/puck/auth.ts:15`, platform admin or owner/guide of market), re-checked in the action. Cleaning: `stripResolved` + `slugProblem` (reserved slugs); no `cleanBoxDoc`. Guard: none. Media: Puck `/api/upload` only, no site sources. Draft/review: none, Publish is instant. **Class B.**
2. **Store panel** `/panel/[orgSlug]?page=N`. Components `components/panel/panel-editor.tsx` (164 lines), `lib/store-panel/{actions,config.client}.ts`. Save `saveStorePanel` (`actions.ts:25`) and `submitStorePanel` (`:35`). Engine: Puck with restricted `STORE_PANEL_BLOCKS`, one fixed 720x720 viewport, plugins templatesPlugin(STORE_TEMPLATES) + Pages tab + Submit tab (`panel-editor.tsx:83`). Store: `user_pages` (user, org, key `store:N`, status draft/pending/published/archived). Gate: signed-in user, own panel only; submit needs the hosting org's `member_store_panels`. Cleaning: validatePage, sanitizeRichValues, 512KB cap (page-builder `user-store.ts`). Guard: none. Media `/api/upload`. Draft/review: YES, the only draft -> submit -> review flow in the repo (section 3a). The review UI is not in art-auction; `reviewUserPage` is called only by ifac `api/manage/submissions`. **Class B** (keep the flow, move onto the house kit).
3. **Installations** `/studio/installations/[id]`. `app/studio/installations/[id]/installation-editor.tsx` (1122 lines). Save `installations/actions.ts`: saveLayoutAction, saveSceneAction, rename, setStatus, setVenue, delete. Engine: three.js (`@elkdonis/three/hallway`) with custom React UI: wall layout, framing/crop, lamps, lighting, undo (`HISTORY = 100`, `:59`), debounced autosave (`SAVE_DELAY_MS = 600`, `:57`); walking order = `sequence`. Gate: `requireStudioStore` + store ownership (`ownInstallation`). Cleaning `cleanPieces` (`lib/installation-input.ts`). Guard: none (last write wins). Picker: the store's hangable artworks tray. Draft: draft/published toggle only. **Class C.**
4. **Landing loft** `/admin/loft`. `admin/loft/landing-loft-editor.tsx` wraps the same `InstallationEditor` through props (saveLayout, saveScene, studioControls=false, openSpot, toolbar). Save `admin/loft/actions.ts`: saveLandingLayoutAction, saveLandingSceneAction, publishLandingAction, revertLandingAction. Store: an org-owned installation (autosaved working copy) plus a snapshot in site_config `home_loft` {installationId, published:{at,hallway,scene,pieces}} (`lib/landing-loft.ts`). Gate `getPagesEditor` + `isLandingInstallation`. Draft/review: YES, snapshot model (3b). **Class C.**
5. **Home hero** `/admin/pages` (HeroForm; also the series Features page). `hero-actions.ts saveHeroAction` (`viaSeriesSlug` lets series editors in). Custom form, ordered artist list; site_config via `lib/home-hero.ts`; gate canEditHome or canEditSeries. **Class C** (a record source / sidebar field).
6. **Welcome letter**, in place on `/` ("Edit welcome"). `components/home-welcome.tsx` WelcomeDialog, `app/home-actions.ts saveWelcomeAction`. Custom `<dialog>` with heading, subline, body, linkLabel, linkHref. site_config `home_welcome` (`lib/home-sections.ts`). Gate canEditHome. **Class C** (live-editor field edit, section 5).
7. **About page**, in place on `/about`. `about/about-editor.tsx` (Dialog from series panels, RichTextEditor from cms-ui), `about/actions.ts saveAboutAction`. Lede + up to 20 sections (kicker, title, rich html, media, link). site_config via `lib/about-content.ts` (`cleanAbout`, `sanitizeRichText`). Gate `canEditAbout` = canCreateSeries(market). **Class C**, or B if About becomes a Puck page with an About template (katie did exactly that); then this store retires (D for the JSON editor).
8. **Series page, in place** `/series/[slug]` (`series/[slug]/page-editor.tsx`, 183 lines: Change cover, Edit text, Add artwork/article). `manage/actions.ts saveSeriesAction` etc. Custom dialogs + RichTextEditor + MediaDrop; commerce tables; gate canEditSeries / contributor. Contributors "submit own piece", an editor approves (`series-week-item-approve`): a second, separate review flow. **Class C.**
9. **Series workspace** `/series/[slug]/manage/*` (page look, weeks, lots, rules, team, orgs, orders). `manage/panels.tsx` (PageLookPanel at `:1045`, WeeksBoard, LotsBoard), 26 `series-*` atlas capabilities. Record administration. **Stay bespoke**; PageLookPanel's cover/title/curator fields are the field-edit candidates.
10. **Artwork form** `/studio/artworks/*` (`studio/_components/artwork-form.tsx`, 912 lines, studio-ui MultiImageUploader), actions `artwork-update/publish/archive`. **Stay bespoke.** Kit overlap is `@elkdonis/studio-forms` artworkActions (katie /channel uses it). The atlas drift row says create/update/setMedia should become one kit action.
11. **Artist profile** `/studio/profile` (`artist-profile-form.tsx`, `market-store-profile-save`). **Stay bespoke.**
12. **Gallery items** `PATCH /api/galleries/[id]/items` (called by the shared gallery-grid block client; panel config passes `editable:false`). Uses `updateOwnGalleryItems` (services checks ownership). No art-auction UI of its own: same shared mechanism danamccool uses. **Class A-ish.**
13. **Gallery Parlour / virtual gallery** (`components/virtual-gallery.tsx`, `@elkdonis/three/gallery`): viewer, not an editor. Stays.
14. **Admin** (store approvals, payouts, marketplace settings, artwork hide): moderation forms. Stay bespoke.

Not found anywhere in art-auction: direct-edit, `mountTreePage`, Site style, `makeChoosePicture`, `listSitePages`, `loadSiteNav`, the stale-save guard.

### katie-the-potter (org siteConfig.orgId)
1. **Pages** `/studio/[...path]` (index `/studio`; `/manage/site` links to it). `components/studio/page-editor.tsx` (49 lines), `lib/puck/actions.ts savePageAction(slug, data)`. Engine: Puck-FIRST with `[templatesPlugin(PAGE_TEMPLATES), partsPlugin]` (`page-editor.tsx:23,31`); there is no mountTreePage canvas anywhere in katie. Store `puck:<path>` via `lib/puck/store.ts`. Gate `getApiEditor` (`lib/auth.ts:42`, viewer.canEdit). Cleaning `cleanBoxDoc(stripResolvedKeys(...))`. Guard: none (store.ts binds `savePage(slug,data)` only). Media `/api/media/upload` + libraries site/mine; artwork picker via `siteBindsFields(katieSources)`. **Class B.**
2. **Piece-detail template** `/studio/piece-detail`: same editor; save also `revalidatePath("/pieces/[slug]","page")`. Class B; needs sunjay's TEMPLATE_NOTICE style warning (saving changes every piece page).
3. **Site style** (public pages "Site style" button; hidden under /studio and /manage). `components/site-style/SiteStyleButton.tsx`, `lib/site-style-actions.ts` (byte-identical to sunjay/elktours except katie revalidates). direct-edit/site SiteStyleEditor. **Class A.**
4. **Channel quick form** `/channel`. `components/channel/ArtworkQuickForm.tsx`, `lib/channel-artwork-actions.ts`. studio-forms FormShell tier=quick, MediaPicker. **Class A** (form kit, not a page editor).
5. **Manage pieces** `/manage/pieces/*`. `components/manage/piece-form.tsx` + `piece-images.tsx`, `lib/manage-actions.ts savePieceAction`. Custom form + RichTextEditor. Stay bespoke (later studio-forms).
6. **Menu**: `components/studio/menu-plugin.ts` (MENU) written but NOT in PLUGINS; `lib/puck/nav-actions.ts` ready. Class B (2 lines, blocked by the dirty page-editor.tsx).

## 2. Classification counts
- A (already on house stack): 3 (katie Site style, katie channel quick form, gallery-grid items route as shared mechanism). Katie Pages is only half on the stack (Puck + parts, no canvas).
- B (adopt shared kit): 4 (art-auction pages, art-auction store panel, katie pages, katie piece-detail template).
- C (keep own UI, expose or share parts): 6 (installations, landing loft, hero, welcome, about, series in-place page; About may become B).
- D (retire/redirect): 0 outright; candidate: the About JSON editor if About moves to Puck.
- Stay bespoke, not page editors: series workspace, artwork form, artist profile, admin moderation; Parlour is a viewer.

### B: exact pieces
art-auction pages:
- Add a canvas: a CanvasEditor port of sunjay's (mountTreePage, canvasConfig/canvasContract, openBlockSettings) with art-auction's resolvers (the `au-*` resolvers in `lib/puck/config.client.ts` already fall back to sample data). Keep `/edit/[slug]/blocks` as the Puck page.
- Add partsPlugin + `@elkdonis/direct-edit/direct-edit.css`, MorphMark in the config, `cleanBoxDoc` in the save action (currently stripResolved only).
- Stale guard: bind `loadPageWithVersion`/`savePage(expected)` in `lib/puck/store.ts`; `savePageAction` takes `expectedUpdatedAt`.
- Pickers: SiteSources {artworks, galleries, pages} over art-auction endpoints; RecordSources for lots and series. Media: makeChoosePicture for the canvas.
- pagesPlugin via `listSitePages(marketplaceOrgId)`. menuPlugin deferred (nav is code in `site-nav.tsx`).
- Site style: art-auction has no schema, store or button, and its header is Tailwind code. Decision for Justin: scope style to designed pages only, or skip. "Its own product" argues for skip or scoped.
- Keep gate `getPagesEditor`, RESERVED_SLUGS/TEMPLATE_SLUGS.
store panel: keep Puck (restricted palette and the fixed viewport are existing PuckEditor props); add partsPlugin, a stale guard (needs a `loadUserPageWithVersion`), and move Submit from a plugin tab into the shared save bar (3a). Do not move it to the full canvas: a fixed box inside someone else's page is what Puck's `viewports` is for.

## 3. Features to INHERIT into the one house editor

**a) Draft -> submit -> review (store panel).** `saveUserPage` writes status `draft`, and a row that was `published` flips to `draft` while `data` is overwritten in the same row (`packages/page-builder/src/user-store.ts:141`). Consequence (verify before relying on it): editing and saving a published panel overwrites the live copy AND unpublishes it until re-approved, because `loadPublishedUserPage` then returns null. The comment above that SQL says "what is LIVE stays whatever it was", which the SQL does not do. A real draft/published split fixes it. Recommended house model: PuckEditor already has `onSaveDraft` and `publishedLabel` (`packages/page-builder/src/editor.tsx:82`, used by artdirect). Make the save bar three-state through one `saveMode` prop: `"instant"` (today, default), `"draft+publish"` (onSaveDraft + onPublish, draft in a separate key), `"draft+review"` (Save draft, Submit for review, status badge; approval elsewhere). That meets the plan's wish for drafts instead of instant canonical edits without a new engine. Reuse `submitUserPage`, `reviewUserPage`, `listPendingUserPages` from services as the review back end for sites that turn it on (ifac already has the queue UI).

**b) Landing loft snapshot** (`lib/landing-loft.ts:154` publishLanding, `:167` revertLanding): working copy autosaves, "Put on the page" snapshots the live copy, "Go back to what visitors see" reverts, dirty = working.updatedAt > published.at. The live copy is never touched by a save. This is the smallest working draft/publish/revert and generalises to Puck pages as `puck:<slug>` (live) + a draft key; Revert = copy live over draft. Better precedent than the panel's status column.

**c) Installations / loft vs direct-edit arrange.** Not comparable: 3D wall placements (frame, crop, lamp, walking order) vs 2D blocks on a page. Do not merge. Inherit the undo stack (100 steps) and debounced autosave with a merged SaveState (`worse()`), as an option once drafts exist. Expose the installation editor as a house SURFACE: a block holding only `installationId` whose Puck field / canvas "Settings..." opens the installation editor in a popup (same `openStudioPopup` pattern); walking order stays the `sequence` field.

**d) Katie's templatesPlugin.** Already shared in page-builder (art-auction uses it for pages and STORE_TEMPLATES, sunjay too). Inherit katie's per-slug starting document (`TEMPLATE_FOR_SLUG[slug]` in `app/studio/[...path]/page.tsx`; art-auction has `startingTemplate(slug, start)`) as one `startingFor(slug)` hook. No gap.

**e)** Sunjay's TEMPLATE_NOTICE (template saves change many pages) as a per-slug `saveNotice`; katie's piece-detail needs it. **f)** The panel's `viewports` and restricted `blocks` as per-surface props.

## 4. Katie vs sunjay wiring, option by option
| Option | sunjay CanvasEditor.tsx | katie now | Varies by app |
|---|---|---|---|
| host | mountTreePage on a div | PuckEditor only | shared |
| config / contract | canvasConfig, canvasContract | same exports exist (`config.client.ts:125-132`) | app supplies |
| resolved rows | resolveAllData + resolvedRows, KEYS = RESOLVED_KEYS + thread-feed | no canvas; stripResolvedKeys on save | app supplies RESOLVED_KEYS |
| metadata | {orgId, slug, ...record} | PuckEditor adds orgId, slug | record varies (sunjay thread/piece, katie piece) |
| choosePicture | `components/studio/page-picture-chooser.tsx` (MediaPicker, `/api/upload`, libraries org/mine) | none | uploadEndpoint (`/api/upload` vs `/api/media/upload`), libraries; use cms-ui `makeChoosePicture` |
| records | `landing/person-records` | none (katieSources.artworks exists) | RecordSources; `recordSourcesFrom(sources)` |
| developer | false | false | constant |
| designTools | true | n/a | constant true |
| pageName | root title or /slug | TITLES[slug] | derived |
| blockEditorHref | `/studio/<slug>/blocks` | n/a | route; katie needs `/studio/<path>/blocks` under a catch-all |
| onSave | savePageAction(slug, d), no version | savePageAction(slug, data) | app supplies; add expectedUpdatedAt |
| saveNotice | TEMPLATE_NOTICE map | none | app map |
| onDone | router.push (template -> /manage/builder, else /<slug>) | none | app back target |
| inception / editSettings | true; openBlockSettings with partsPlugin handBack:true and popup with records | partsPlugin without handBack, no records | constant on |
| plugins | templatesPlugin, MENU, PARTS | templatesPlugin, PARTS (MENU unwired) | app list; shared factory for PARTS+MENU+PAGES |
| pages switcher | none yet in the file | none | listSitePages / pagesPlugin |
| Site style | SiteStyleButton, same action | same, hidden in /studio | SITE_STYLE schema per app |
| gate | getApiEditor | getApiEditor | identical |
| path shape | `[slug]` single segment | `[...path]` nested | HouseEditor takes the full path string |
| site look | none | `setCanvasSiteLook(siteLook)` + CanvasFonts wrapper | katie-only; optional `canvasWrap` |

Thin-bind proposal: `HouseEditor({ slug, orgId, initial, version, config, canvasConfig, contract, records, resolvedKeys, choosePicture, save, templates, plugins, saveMode, saveNotice, blockEditorHref, onDone, viewports?, blocks?, canvasWrap? })`. Katie's delta to sunjay is small: add a canvas route, records (pieces), choosePicture on its own upload path, version, a notice for piece-detail, and the nested-slug href. Watch for a page literally named `blocks` under `/studio/[...path]`.

## 5. live-editor (`@elkdonis/live-editor`) and art-auction
Finding: art-auction does NOT use it. Zero hits in `apps/art-auction/src` for `live-editor`, `LiveEditor`, `data-trait`, or any import of `@elkdonis/ui` / `@elkdonis/cms-bindings`. It shows only in art-auction's package.json and `transpilePackages` as `@elkdonis/cms-bindings`, which depends on live-editor for TYPES (`packages/cms-bindings/package.json:24`; `src/workshop/editor-config.ts:1` imports FieldDef, CssVarDef; `field-registry.ts`). `@elkdonis/ui` re-exports LiveEditor (`packages/ui/src/index.ts:63`) but art-auction does not depend on `@elkdonis/ui`. So the presence is transitive and inert. Real consumers: arts-collective `components/WorkshopLiveEditor.tsx` and `sites/[slug]/[contentSlug]/page.tsx`, ifac `profile-editor-panel.tsx` and `gallery-editor.tsx`, artdirect `ProfileEditorPanel.tsx`. Uncertainty: I did not inspect built bundles; a renamed copy would not show in grep (none seen).

How it works (`packages/live-editor/src/types.ts`): `FieldDef {trait, label, input: text|textarea|url|number|datetime|date|select|image|compound|readonly, initialValue, options}` matches `data-trait="..."` in rendered HTML; `onSaveField({trait, value})`; optional CSS-variable panel via `onSaveCss`. It is a field overlay, never layout.

Every on-site field/copy edit in art-auction and whether it should become a live-editor field edit (recommendation, Justin decides):
- Welcome letter (heading, subline, body, link label, link href): YES, 5 text/textarea/url fields. Best first conversion.
- About lede: YES (textarea).
- About sections: title, kicker, link, media as fields yes; rich html and add/remove/reorder no (structural; rich text keeps its editor).
- Series title, subtitle, eyebrow, blurb, card image, proceeds note, beneficiary, curator name/role/portrait: YES (text/image).
- Series description (rich) and journal entries: no. Series cover: image field only for the image kind; kind switch stays a dialog.
- Week titles/notes and week item copy: maybe, text only; approval and ordering stay in the workspace.
- Lot text: possible for the owner on the lot page, but auction rules lock fields after bids; only with locked fields as `readonly`. Not first wave.
- Artwork title/description: yes as fields; price and status are sale state, NOT in-place; keep the form.
- Artist profile bio, portrait: yes, low risk.
- Home hero (which artists, order): no (selection and ordering: record source).
- Designed-page text: no, direct-edit text editing already exists on the canvas.
- Loft/installation settings: no.
Prerequisites: render `data-trait` on those blocks (none exist), a FieldDef builder per surface (cms-bindings `workshop/editor-config` is the model), gated save actions reusing the existing ones (saveWelcome, saveAbout, saveSeriesAction), and a stale guard for the JSON stores in site_config (updated_at as version, like `loadPageWithVersion`).

## 6. What must stay bespoke in art-auction
1. Installation and loft 3D editors (`@elkdonis/three/hallway`): expose, do not rebuild.
2. Series workspace and lot/auction management (rules, weeks, lots, team, money, orders, bids): record administration with auction constraints.
3. Artwork form, artist profile, payouts, shipping, store admin.
4. Gallery Parlour / virtual gallery: viewer.
5. The store panel's review back end (user_pages status + services); its editing UI joins the house kit.

## 7. Open risks and questions
- Panel overwrite-on-save unpublishes the live panel (3a): not tested against live data; verify read-only on a TEMP copy.
- art-auction has no Site style and no site-look variables; rollout needs a schema decision first.
- art-auction `/` has no designed home by design (`lib/puck/store.ts` comment); a canvas must not create `home`.
- Katie page-editor.tsx and config.client.ts carry another session's uncommitted changes.
- Both apps are unguarded on Puck saves; art-auction has several owners/guides, so silent overwrite is a real risk there.
- Nothing browser-tested, rebuilt or run beyond read-only greps.

## 8. About editor as the reference for the house "Fields" lens
Verified: `app/about/about-editor.tsx` is its OWN BUILD. It does not import `@elkdonis/live-editor` (no `data-trait`, no FieldDef). It is React state over one JSON document (`AboutContent`, `lib/about-content.ts`) saved whole by `saveAboutAction`, with: an edit bar (`srs-editbar`, "Edit page" / "Done", "unsaved" flag, "+ Add section"); per-section chips (`srs-edit-chip`: Edit, up, down, Remove); an "Edit intro" chip for the lede; a section dialog (kicker, header, `RichTextEditor`, a `MediaField` with drop/choose/paste-URL, link + link text); upload through its own `/api/about/media`; each change saves at once (autosave per action, `update()`); no stale guard. Differences from live-editor: live-editor edits a field the rendered HTML names (`data-trait`) in a popover; About edits structured content (a list) with dialogs, so it covers things live-editor cannot (rich text, reorder, add/remove).
Who else follows the pattern:
- Series page (`app/series/[slug]/page-editor.tsx`): YES, same `srs-editbar` and `srs-edit-chip` classes ("Change cover", "Edit text", "Add artwork", "Add article"), same Dialog/RichTextEditor/MediaDrop. Same family, different state and actions.
- Welcome letter (`components/home-welcome.tsx`): partly. A single "Edit welcome" button and a dialog; no edit bar, no per-field chips.
- Home hero: no (a form on /admin/pages). Should: an "Edit" chip on the hero band is a natural fit, but its content is a record selection, so a picker dialog, not a text field.
- Loft: no (three.js editor with its own toolbar and publish bar). Should not copy the chip pattern; share only the draft/publish bar (3b).
- Series weeks (`manage/panels.tsx` WeekCard in the workspace): no, admin forms. Could take the chips on the public series page (add/approve/reorder are already ReorderButtons-like in LotsBoard) but approvals stay in the workspace.
Recommendation for the Fields lens: lift the About pattern, not live-editor, as the house shell (edit bar + chips + dialog host + MediaField via makeChoosePicture + RichTextEditor + dirty flag + stale version on the stored document), and let live-editor's `FieldDef` vocabulary (trait, input kind, hint) describe single-value fields inside it. Add what About lacks: a `version` for the guard, a draft/Done-to-publish step instead of save-on-every-click (every chip action currently writes the live About page), and picker-based media instead of its own upload route. Uncertainty: whether live-editor's popover can host RichTextEditor was not checked (its input kinds exclude rich text).
