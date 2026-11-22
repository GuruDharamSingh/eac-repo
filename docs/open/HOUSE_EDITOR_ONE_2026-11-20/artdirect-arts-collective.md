# House editor: artdirect + arts-collective audit (2026-11-20)

READ-ONLY audit. Nothing edited, rebuilt, committed or written to the DB (DB reads were SELECT-only counts). Apps: artdirect, arts-collective (+ packages/live-editor, hub Site Builder card, silex*). Method: atlas:q (areas apps.artdirect.dossier, arts-collective.hub/sites/network/studio, pkg.page-builder) then code reads. Paths are under ~/eac.

## 0. Headline findings

1. **Neither app has the canvas (`mountTreePage`), Site style (`@elkdonis/direct-edit/site`), the stale guard, `SiteSources`, `pagesPlugin`/`menuPlugin`, or `makeChoosePicture`.** A grep of both apps for `mountTreePage|direct-edit/site|loadPageWithVersion|expectedUpdatedAt|pagesPlugin|menuPlugin|makeChoosePicture|openBlockSettings` finds nothing. arts-collective imports `@elkdonis/direct-edit` only for the classifieds/cards block editor (not the tree-page canvas).
2. **The Site Builder hub card is not mounted in arts-collective.** Its only consumer is sunjay (`apps/sunjay/src/components/hub/hub-card-host.tsx`, `lib/hub-site-adapter.ts`, `app/hub/site/page.tsx`). arts-collective's hub has its own "Organization" console (`components/hub/console/ConsoleSettings.tsx`) with links to /design, /classifieds, /cards and Silex.
3. **Silex is live for exactly one org.** `organizations`: 23 `layout_mode=default`, 1 `silex` = `hidden-enneagram` (published path `nextcloud://.../hidden-enneagram/silex/published/index.html`). The `eac-silex` container is up (4 days). hidden-enneagram also has a `puck:home` row (2026-11-11) and is being re-stood onto Puck/direct-edit (memory: Hidden Enneagram re-stand).
4. **Person-page drafts (artdirect) have never been used in prod**: `user_pages` has 0 rows for org `oad`; the only user_pages rows are 4 ifac store panels. The model is sound but unproven.
5. **classifieds and cards editors have no stored data**: `site_config` has no `classifieds:page` or `cards*` rows. `puck:home` rows exist for katie-the-potter, hidden-enneagram, danamccool only (all have their own apps); nothing proves arts-collective `/hub/sites/<slug>/design` has ever published.
6. **Dirty state**: `git status --short apps/artdirect apps/arts-collective packages/live-editor packages/hub | wc -l` = **1**: ` M apps/arts-collective/src/components/studio/StudioApp.tsx` (a 1-line Studio change, not an editor surface). artdirect, live-editor and hub are clean.

## 1. Per-surface table

Engine: DE = direct-edit, PK = Puck, LE = live-editor, SX = Silex. Class: A on house stack, B adopt shared kit, C keep own UI but expose as a house-editor surface, D retire/redirect.

### artdirect

| # | Surface (URL) | Component / save action | Stored | Engine | Gate / cleaning | Guard | Drafts | Media | Class |
|---|---|---|---|---|---|---|---|---|---|
| a1 | `/<slug>/design`, `/<slug>/featured/design` | `components/design/DesignerRoute.tsx` (server), `PersonPageDesigner.tsx` (159 lines); `lib/person-page-actions.ts` `savePersonPageDraftAction`, `publishPersonPageAction` | person's own profile/featured page: Puck docs in `user_pages(user_id,'oad',key)`; keys `profile`,`featured` (live), `profiledraft`,`featureddraft` (draft) | PK `PuckEditor` + `buildEditorConfig`, `templatesPlugin`, a "person-page" panel plugin, `onSaveDraft` | session user + `canEditProfile` (self or admin), `publishesWithoutReview("oad")`; `stripResolved` drops resolver-filled props; `saveUserPage`/`publishUserPage` sanitise rich text, `validatePage`, size cap | none (no `version`, last write wins) | YES, two rows (section 3) | own `/api/upload?slug&target=page` via page-builder ImageField (no cms-ui picker) | **B**: canvas door, stale guard, `makeChoosePicture`; keep the draft model |
| a2 | `/<slug>` owner chrome, bio | `components/oad/ProfileEditorPanel.tsx` -> `LiveEditor` (`data-trait="bio"`); `lib/profile-editor-actions.ts` `saveProfileFieldAction` | `users.bio` via `updateProfile` | **LE** (one trait) + plain avatar upload + store toggle | `canEditProfile`; revalidatePath | none | no | `/api/upload` target=avatar | **A** as the field layer; add "Edit the look..." |
| a3 | `/<slug>` "Your file" sidebar | `components/oad/DossierSidebar.tsx` (695 lines); `lib/dossier-editor-actions.ts` `saveDossierFieldAction`, `setProfileSectionAction`, `setProfileLayoutAction` | users columns + `oad_dossier` jsonb, `profile_sections`, `profile_layout`; declared once in `@elkdonis/cms-bindings/dossier` | generated form (NOT LE) | `canEditProfile`, trait allow-list | none | no | none | **C**, move field editing to LE (section 2) |
| a4 | `/<slug>` PersonDrawer | `components/oad/PersonDrawer.tsx`; `lib/space-actions.ts` `setSectionOrderAction`, `setPageBackgroundAction` | section order; page background (contrast-capped, MAX_GROUND_LUMINANCE 0.040) | custom | session user only | none | no | none | **C** (background belongs in Site style; section order = a canvas move on a designed page) |
| a5 | `/<slug>` gallery | `GalleryPanel.tsx`, `saveGalleryAction` | `users.portfolio` | custom (`@elkdonis/cms-ui/gallery`) | `canEditProfile` | none | no | `/api/upload` target=gallery | **C** (gallery record source for the canvas) |
| a6 | `/<slug>/edit`, `/new` | `DossierForm.tsx`; `lib/oad-actions.ts` `updateDossier`, `createDossier` | whole dossier | custom form | **weak**: any signed-in person can edit an unclaimed dossier (atlas open note, oad-actions.ts:138-170) | none | no | URL fields | **C** (wiki model; fix URL validation) |
| a7 | businesses / offerings forms | `components/business/BusinessForms.tsx`, `components/design/OfferingPickerField.tsx` | business/offering rows | custom forms | per action | none | no | none | **C** (yellow-pages source data, not page editors) |

### arts-collective

| # | Surface | Component / save | Stored | Engine | Gate / cleaning | Guard | Drafts | Media | Class |
|---|---|---|---|---|---|---|---|---|---|
| c1 | `/hub/sites/<slug>/design` (org landing page) | `app/hub/sites/[slug]/design/page.tsx`, `components/studio/OrgPageEditor.tsx`; `lib/puck/actions.ts` `saveOrgHomeAction` (atlas `publish-org-landing-page`), `removeOrgHomeAction` | `site_config(org_id,'puck:home')` via page-builder `loadPage/savePage` (`lib/puck/store.ts`) | PK `PuckEditor` + `templatesPlugin` (org-identity-seeded template) | page gate and action gate `canEditOrgSite` (owner/guide); `stripResolved`; savePage validates | **none** (`saveOrgHome` calls `savePage` without `expectedUpdatedAt`) | none (Publish is live; removing goes back to offering) | `editorConfigFor(orgSlug)` own media routes | **B**: canvas-first door like sunjay (`CanvasEditor` + `/blocks`), `loadPageWithVersion` + `expectedUpdatedAt`, `pagesPlugin`, `makeChoosePicture`, Site style |
| c2 | `/hub/sites/<slug>/classifieds` | `ClassifiedsEditor.tsx` -> `lib/classifieds/editor-engine.ts`; `saveClassifiedsAction` (`save-classifieds-page`) | `site_config(org_id,'classifieds:page')` via `withOrg` RLS | **DE** block editor | `canEditOrgSite`; `cleanDoc` field by field | none | none | none | **A** (0 rows stored) |
| c3 | `/hub/sites/<slug>/cards` | `CardsEditor.tsx` (same engine, pattern mode); `saveCardsAction` | site_config cards key (`lib/cards/store.ts`) | **DE** | `canEditOrgSite`; `cleanCards` | none | none | none | **A** (0 rows stored) |
| c4 | Silex: `/edit/<slug>` -> external Silex (`eac-silex`) | `app/edit/[slug]/page.tsx`, `api/silex/{token,auth,layout,publish,assets}`, `SilexLaunchButton`, `SilexSurfaceControls`, `silex-layout.tsx` -> `@elkdonis/silex-render` | published HTML in Nextcloud; `organizations.layout_mode`, `silex_published_path` | SX | publish = `isOrgOwner` only (stricter than canEditOrgSite); `sanitizeSilexHtml`, 2 MB cap | none | none (publish overwrites) | Silex asset route | **D** (section 5) |
| c5 | Workshop page in-place edit | `components/WorkshopLiveEditor.tsx` -> `LiveEditor`; `lib/cms/actions.ts` `updateWorkshopFieldByTraitAction`, `updateWorkshopThemeAction` (atlas `edit-workshop-live`); mounted at `app/sites/[slug]/[contentSlug]/page.tsx:101` for owners | thread/workshop fields via `fieldRegistry` (table+col); CSS-var overrides | **LE** (fields + `CssPanel`; `fullEditorUrl={hubUrl}`) | owner gate in action; numeric coercion | none | none | none | **A** (field layer) |
| c6 | Subdomain editor bar | `components/SubdomainEditorBar.tsx` (community-dark; pill: "+ New", "Workshops", "Edit layout" only if `silexEditorUrl`) | links only | custom | `canEdit` | n/a | n/a | n/a | **B/C**: becomes the one "Edit this page" door. The community-dark page never passes `silexEditorUrl` (page.tsx:958) so "Edit layout" is dead there |
| c7 | Site appearance (hub) | `hub/AppearancePanel.tsx`, `MyAppearancePanel.tsx`, `TokenImportPanel.tsx` using LE `CssPanel`; `lib/theme-tokens.ts` | org/person theme vars (services `ThemeVars`) | **LE** `CssPanel` | per action | none | none | none | **B**: this is "Site style" on the older LE panel; converge on `@elkdonis/direct-edit/site` (`site_themes`), same-store question not traced |
| c8 | Org identity | `hub/OrgIdentityPanel.tsx` | org name/headline/bio/logo/links | custom form | per action | none | none | `/api/upload/image` | **C** (record source; also move to LE on the org default page) |
| c9 | Org letters (email templates) | `/hub/email` `components/hub/email/EmailSuiteHost.tsx` (shared `@elkdonis/email` components); `PUT api/org/[slug]/email/template/[key]` (`save-email-template`), `packages/email/src/template-store.ts` | org template rows (6 `email:identity` rows exist) | shared suite; copy-slot model (`copy-slots.ts`: network default < org slot < org whole html) | `guardOrgEmailWrite`; `sanitizeRichText` on the way in | none | none (reset = clear) | none | **C** (page-like but not Puck; slot model is LE-shaped) |
| c10 | Channel quick sheet | `components/channel/QuickSheet.tsx` (282 lines); `lib/channel/actions.ts` `saveQuickSheetAction` | `channel_deliveries` draft/scheduled caption per outlet | custom surface sheet | `mayTouch(deliver)` | none | YES (draft vs scheduled) | thumbs | **C, leave**: delivery captions, not site copy |
| c11 | Studio create / summary | `components/studio/StudioApp.tsx` (the dirty file), `@elkdonis/studio` extensions | posts/artwork/service via form actions | Studio shell | per action | none | studio-owned | cms-ui `MediaPicker` | **C** (shared packages already; later "Edit the look" on the piece page) |
| c12 | Site Builder hub card | not mounted in arts-collective | n/a | n/a | n/a | n/a | n/a | n/a | **B**: mount `siteBuilderCard` with a `SiteBuilderHost` (`puckEditHref`, `themeEditorHref`, `uploadImage`, `liveHref`) |

### Counts (distinct editor surfaces: a1-a7, c1-c11; c12 is a missing mount)

- **A**: 4 (a2, c2, c3, c5)
- **B**: 4 (a1, c1, c6, c7) plus c12 (mount)
- **C**: 9 (a3, a4, a5, a6, a7, c8, c9, c10, c11)
- **D**: 1 (c4 Silex)

## 2. In-place field/copy edits (live-editor audit)

Justin's direction: **keep `@elkdonis/live-editor` as the house editor's FIELD layer** (on-site quick editor for content fields; signals "editing this field", not the page look).

| Field edit | Where | Already LE? | Verdict |
|---|---|---|---|
| Bio | artdirect `ProfileEditorPanel` `fields=[bio]` -> `saveProfileFieldAction` | YES (1 trait) | keep, widen the FieldDef list |
| Dossier fields (name, headline, occupation, links, photo, `oad_dossier.*`) | artdirect `DossierSidebar` -> `saveDossierFieldAction` | NO (generated form) | **MOVE to LE**: `dossierFieldGroups`/`dossierFieldRegistry` already carry label, input kind, group, so map to `FieldDef` (text/textarea/url/select/compound) and emit `data-trait` on the page. Keep the sidebar only for section/layout toggles |
| Workshop fields and page colours | arts-collective `WorkshopLiveEditor` | YES (+ `CssPanel`, `fullEditorUrl`) | keep as is |
| Own profile fields on arts-collective sites (`/sites/<org>/profile`, `/center`) | pages only import `ThemeStyle`; edits go through the hub `edit-my-profile` form (atlas drift: 8 app copies) | NO | **MOVE to LE** when the person views their own page |
| Org identity (name/headline/bio) | `OrgIdentityPanel` form | NO | MOVE to LE on `OrgDefaultPage.tsx`, same action |
| Letter copy slots | `EmailSuiteHost` / `PUT email/template/[key]` | NO (own editor in `@elkdonis/email`) | keep UI; slot declaration is already LE-shaped; low priority |
| Site-section copy | not in these apps (sunjay `site-section-copy-save`, Site Builder SlotEditor) | n/a | n/a |
| Channel quick sheet, Studio forms | caption/post forms | NO | not site fields; leave |
| Classifieds/cards text | inline text inside the DE block engine | n/a | stays DE (copy and look together) |

Evidence of LE use: artdirect (`ProfileEditorPanel`, `ThemeStyle` on 5 routes), arts-collective (`WorkshopLiveEditor`, three appearance panels, `ThemeStyle` on 6 pages), ifac (14 files), `cms-bindings/workshop/*`. **Uncertain:** the coordinator says art-auction uses it; `grep` for `LiveEditor|CssPanel|live-editor` in `apps/art-auction/src` finds nothing, so it either goes through `@elkdonis/ui` (which re-exports it, `packages/ui/src/index.ts`) or refers to a different surface.

### "Edit the look..." handoff

LE already has a hook: `fullEditorUrl` renders "Full editor ->" in the bar (`packages/live-editor/src/LiveEditor.tsx:16,85`). Proposal:
1. Add `onEditLook?: (target) => void` (keep `fullEditorUrl` as fallback). `FieldPopover.tsx` gets an "Edit the look..." footer item; the bar button stays for the whole page.
2. Target = the trait's block. On a designed (Puck) page the pin sits inside a block, so the host passes the block id (arts-collective has `lib/puck/block-ids.ts`) and the handler calls `openBlockSettings` / the direct-edit popup for that block: the existing inception path.
3. On non-Puck pages (dossier, workshop template HTML) the look is CSS vars: "Edit the look..." opens that pin's `StyleOverlay`/`CssPanel` (already built), plus "Open the canvas" to `/design` when a designed variant exists.
4. Register the LE popover on the shared layer stack `globalThis[Symbol.for("eac.layer-stack.v1")]` so Esc and stacking behave like the inception layers.

## 3. Drafts model to inherit (user-store)

`packages/page-builder/src/user-store.ts` (`loadUserPage`, `saveUserPage`, `publishUserPage`, `listUserPages`) + artdirect `lib/person-pages.ts`:
- One table `user_pages(user_id, org_id, key, data, status, updated_at, reviewed_*)`.
- **Two rows per page**: live `profile` (status `published`) and `profiledraft` (status `draft`). Reason (person-pages.ts header): `saveUserPage` flips an edited published row back to `draft`, which would take the live page down, so the draft needs its own key. Publish writes live, then the draft equal to it, so the editor reopens on what is live.
- The editor opens on draft, else live, else template (`DesignerRoute.tsx` initial). `PuckEditor` shows "Save draft" beside Publish (`editor.tsx:77-82,216-241`).
- Review is switchable per org (`publishesWithoutReview`): `oad` publishes at once; ifac store panels go draft -> submit -> review.
- Shared hardening: `sanitizeRichValues`, `validatePage`, `MAX_PAGE_BYTES`, `isValidUserPageKey`.

Gaps to fix when lifting to org pages (`site_config puck:*` has NO drafts today):
1. No stale guard on user_pages (the new `expectedUpdatedAt` exists only for `site_config`). Add the same `updated_at = $expected` guard to `saveUserPage`/`publishUserPage` and return `updatedAt`.
2. The designer's state ("published"/"draft"/"new") derives from row existence only, so a draft differing from live shows as "live". Add an unpublished-changes flag and a "Discard draft" action (none exists).
3. One draft, no history. A shape: `draft:puck:<slug>` in `site_config` mirroring the pair, plus bounded history.
4. `PersonPageDesigner` does not pass `version` to PuckEditor.
5. Zero production use: browser-test before relying on it.

## 4. Doors: Site Builder card, per-site /studio, network shell

Today:
- **Site Builder card** (`packages/hub/src/site-builder/*`, 2507 lines: Face, Popup, Detail, PagesTab, ThemeTab, ProfileTab, SlotEditor, NewPageDialog) is wired only in sunjay. "Open editor" and "View page" call `host.puckEditHref(path)` (sunjay: `/studio/<path>`, now the canvas).
- **Per-site `/studio/<slug>` canvas**: sunjay, danamccool, elktours (source only), katie. arts-collective `/studio` is a different thing (Studio create/summary/video shell).
- **Network shell** `<slug>.arts-collective.com` (`app/sites/[slug]/*`): templated pages, community-dark, optional `puck:home`. Doors today: `components/sites/OrgDefaultPage.tsx:61,99-101` ("Design this page", classifieds, cards), `sites/[slug]/page.tsx:62-70`, `sites/[slug]/hub/page.tsx:51` ("Site Builder" -> `/hub/sites/<slug>/design`), `ConsoleSettings.tsx:237`, `SubdomainEditorBar`.

Recommendation (no shell design work):
1. `/hub/sites/<slug>` hosts the Site Builder card for the org (arts-collective `SiteBuilderHost`). "Open editor" -> `/hub/sites/<slug>/design`, which becomes the **canvas** (`mountTreePage`, as sunjay); whole-page Puck at `/hub/sites/<slug>/design/blocks`.
2. Every "Edit this page" on a shell page links to that one URL. `SubdomainEditorBar` swaps "Edit layout" (Silex) for "Edit page" and keeps "+ New" and "Workshops".
3. Classifieds and feed cards become pages in the card's list rather than three hand-written links.
4. artdirect (yellow pages, source for users/orgs/businesses): person pages stay at `/<slug>/design` but mount the same canvas component; register users/orgs/businesses as `recordSourcesFrom` kinds so any site's canvas can bind to them.
5. The shell stays the fallback renderer; it only needs the doors.

## 5. Silex verdict

**Retire (D) with a migration path; do not delete code yet.**
- Evidence: 1 of 24 orgs uses it (hidden-enneagram), which also has `puck:home` and is being rebuilt onto Puck/direct-edit/kits. Publish is owner-only, overwrites with no draft or guard, and is labelled "Phase 1" (`api/silex/publish/route.ts`). "Edit layout" is dead on community-dark. `HubCard.tsx:30` still says "Coming soon - Silex".
- Steps: finish the hidden-enneagram Puck page; set its `layout_mode` to `default`; remove `SilexLaunchButton`, `SilexSurfaceControls`, `/edit/[slug]`, the Silex branch of `ConsoleSettings` and `organization/page.tsx:144-171`, then `api/silex/*`; keep `silex-render` and the `eac-silex` container until nothing reads `silex_published_path`; mark atlas rows `open-silex-editor`, `publish-silex-site`, `save-silex-layout` retired.
- Decision for Justin: this removes the only arbitrary-HTML layout path; Puck and the canvas cannot place free HTML.

## 6. live-editor verdict

**Keep (Justin).** It is the field layer plus `CssPanel`/`StyleOverlay` for CSS-variable looks and `ThemeStyle` for public pages. Work: (a) "Edit the look..." handoff, (b) move dossier fields, org identity and own-profile fields onto it, (c) decide whether `CssPanel` appearance saves converge on `site_themes` / direct-edit Site style (c7), (d) pins use `[data-trait]`, so Puck blocks need a shared helper emitting `data-trait` / block id.

## 7. Top inheritance candidates

1. **user-store draft/publish pair** (a1) as the page-draft model, with a stale guard and an unpublished-changes indicator.
2. **Registry-driven fields** (`dossierFieldRegistry`, `fieldRegistry`): one declaration feeds the form and LE FieldDefs.
3. **LE field popover with `fullEditorUrl`** as the base of "Edit the look...".
4. **Identity-seeded start document** (`orgHomeTemplate(seed)`, c1): a new page opens built from the record, not blank (fits `startingDocument`).
5. **Copy-slot model** (`@elkdonis/email` `copy-slots.ts`, Site Builder `CopySlotDeclaration`): default < override < whole replacement.
6. **Classifieds/cards pattern mode** (one card design over live feed data) as a canvas feature.
7. **Contrast-capped page background** (`space-actions.ts`) as a validation rule for Site style.

## 8. Uncertainties

- No browser or running-app verification.
- Whether `AppearancePanel` saves and Site style write the same store (c7) was not traced.
- arts-collective `/design` use is unproven either way (no matching rows).
- art-auction use of live-editor not found in source.
- c10/c11 classed C-leave is a judgement call.
