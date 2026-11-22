# House editor audit: innergathering + sunjay (read-only, 2026-11-20)

Sources: code read on eris; atlas (`atlas:q`, `reports/drift.md`, areas `orgapps.editing/cms/site-style`). Paths relative to `~/eac/apps/<app>/src`. `inner-gathering` (hyphen) not touched, treated as retired. Nothing browser-tested; nothing run.

Classification key: A on the house-editor stack; B adopt the shared kit (pieces named); C keep own UI, expose as a house-editor surface; D retire or redirect.

## 0. Headline
- sunjay is the reference canvas-first app: canvas at `/studio/<slug>`, Puck whole-page at `/studio/<slug>/blocks`, inception both ways, Menu tab, Site style, templates drawer, records, design tools.
- innergathering is an early canvas port: Puck at `/studio/<slug>`, bare canvas at `/studio/<slug>/canvas`. It has none of: contract, partsPlugin, openBlockSettings/inception, records, designTools, stripResolved, slugProblem, Site style, Menu, templates, stale guard, an "Edit this page" door on `/p/<slug>`.
- Neither app uses `SiteSources`, `siteBindsFields`, `recordSourcesFrom`, `pagesPlugin`, `makeChoosePicture`, `loadPageWithVersion`/`expectedUpdatedAt`, the `pages` option of `mountTreePage`, or services `mediaUploadRoute` (grep of `src`: none). sunjay has `menuPlugin`, `loadSiteNav/saveSiteNav` and `@elkdonis/direct-edit/site`; innergathering has none of those.
- innergathering has one dead action: `savePageEditsAction` (`lib/page-edits-actions.ts:10`) has no caller. Only `loadPageEdits` is still read (`app/page.tsx:46`, patch CSS at `:376-379`). Patches are style + image only (`packages/direct-edit/src/block/patch.ts:28-48`), not copy.

## 1. Surface inventory (editor surfaces: page content, layout, look)

| # | Surface (route) | Component | Edits / stored where | Engine | Save path, gate, cleaning | Guard | Media | Class |
|---|---|---|---|---|---|---|---|---|
| S1 | sunjay `/studio/<slug>` (also templates `event-detail`, `journal-piece`, `?thread=`/`?piece=` record) | `components/studio/CanvasEditor.tsx` | `site_config` key `puck:<slug>` (PuckDoc) | direct-edit canvas `mountTreePage` + Puck sheet via `openBlockSettings` + `partsPlugin` | `savePageAction` `lib/puck/actions.ts:39`: `getApiEditor`, `slugProblem(allowTemplate)`, `cleanBoxDoc(stripResolved())`, revalidate (layout for templates) | none | own `choosePicture` (`page-picture-chooser.tsx`, MediaPicker, 2 libraries) | A (reference), minus guard/pages/pagesPlugin/SiteSources |
| S2 | sunjay `/studio/<slug>/blocks` | `components/studio/page-editor.tsx` -> shared `PuckEditor` | same doc | Puck, plugins templates + Menu + parts | same `savePageAction` | none | `buildEditorConfig` media (upload + 2 libraries) | A |
| S3 | sunjay `/studio/<slug>/canvas` | `app/studio/[slug]/canvas/page.tsx` | none | redirect to S1 | n/a | n/a | n/a | D (already a redirect; keep) |
| S4 | sunjay `/` home ("Edit page") | `components/landing/EditPageButton.tsx` + `page-editor-mount.ts` | `puck:landing` (first save converts the code page to a tree) | `openVisitorPage` (canvas on visitor HTML) + contract + records + `saveNotice` + `onRestore` | `saveLandingAction` `actions.ts:58` (cleanBoxDoc+stripResolved, revalidate "/"); `restoreLandingAction` | none | same chooser | A (own mount; no Settings/inception: no `editSettings`, `inception`, `designTools`) |
| S5 | sunjay published page "Edit this page" | `lib/puck/render.tsx:82-90` | link only | door to S1 with record query | n/a | n/a | n/a | A (door) |
| S6 | sunjay Site style (`/?site-style=1`, button on every non-studio page) | `components/site-style/SiteStyleButton.tsx` | site style row via `lib/site-style.ts` | `@elkdonis/direct-edit/site/editor` | `saveSiteStyleAction` (`getApiEditor`); no revalidate (atlas drift note 9) | none | n/a | A. Hidden on `/studio` (`:53`): not reachable from the canvas. |
| S7 | sunjay Menu | Puck Menu tab (`page-editor.tsx:41`), `lib/puck/nav-actions.ts`, `lib/nav.ts` | `nav:main` via `loadSiteNav/saveSiteNav` | `menuPlugin` | `getApiEditor`, revalidate layout | none | n/a | A in Puck only; not on the canvas |
| S8 | sunjay Hub Site Builder `/hub/site` | `app/hub/site/page.tsx`, `lib/hub-site-adapter.ts`, `lib/hub-site.ts` | pages (`puck:*`), copy slots (`org_site_sections`), theme | hub card (own UI) | adapter `sanitizeDoc = cleanBoxDoc(stripResolved)`, `pathProblem = slugProblem`; owner/guide | none | n/a | C: its pages already open S1 via `puckEditHref` (`hub-card-host.tsx:35`) |
| S9 | sunjay `/manage/builder` + NewPageForm | `app/manage/builder/page.tsx`, `components/manage/new-page-form.tsx:25` | list + create | form | `checkNewPageAction` | none | n/a | C (page list; fold into `pagesPlugin`/Site Builder) |
| S10 | sunjay landing banner | `components/site/banner-editor.tsx`, `lib/banner-actions.ts` | `site_config.image_spaces.hero {path,alt,frame}` | dialog: MediaPicker + CoverFramer | `saveBanner`: `getApiEditor`, refuses non-`/api/media/`/https and `Private/` paths, clamps frame | none | MediaPicker (`/api/media/upload`, library) | C (see section 3, F5) |
| S11 | innergathering `/studio/<slug>` | `components/studio/PuckEditor.tsx` -> shared `PuckEditor` | `puck:<slug>` | Puck only, no plugins | `savePageAction` `lib/puck/actions.ts:17`: `getApiEditor`, `cleanBoxDoc` only, revalidate `/p/<slug>` | none | `buildEditorConfig` media | B |
| S12 | innergathering `/studio/<slug>/canvas` | `components/studio/CanvasEditor.tsx` | same doc | `mountTreePage` bare | same action | none | `components/landing/page-picture-chooser.tsx` | B (becomes the S1 shape) |
| S13 | innergathering `/studio` index | `app/studio/page.tsx` | list + "New page" form | plain list | `requireOrgEditor` | n/a | n/a | C (replace by `pagesPlugin`/page menu) |
| S14 | innergathering published `/p/<slug>` | `app/p/[slug]/page.tsx` | read only | Render | none | n/a | n/a | B: add "Edit this page" door (sunjay `render.tsx:82`) |
| S15 | innergathering `/` landing "Edit page" | `components/landing/EditPageButton.tsx` + `page-editor-mount.ts` | `puck:landing`; legacy patches `page-edits:home` read-only | `openPageAsTree` on live DOM (not visitor HTML), `edits` carry-over, `classes` hook, `onRestore` | `savePageAction(LANDING_SLUG)`: no stripResolved; revalidates `/p/landing` not `/` (`actions.ts:25`; uncertain whether `/` is dynamic) | none | page-picture-chooser | B |
| S16 | innergathering `page-edits-save` | `lib/page-edits-actions.ts` (no caller) | `site_config page-edits:home` | none (dead) | `getViewer().canEdit`, `cleanPatches` | none | n/a | D |
| S17 | innergathering restore landing | `restoreLandingAction` `actions.ts:30` | deletes `puck:landing` | button | `getApiEditor`; no revalidate | none | n/a | B (as sunjay, add revalidate) |

Atlas cross-checks: `page-save` hosts = sunjay `savePageAction -> /studio/{slug}`, innergathering `-> /p/{slug}` (atlas address stale; editor is `/studio`). Atlas notes innergathering skips the reserved-slug check and uses `cleanBoxDoc` only; sunjay uses `cleanBoxDoc` + `stripResolved` + reserved/feed slug check.

## 2. Diff: innergathering vs sunjay, option by option

### `mountTreePage` options
| Option | sunjay `CanvasEditor.tsx` | innergathering `CanvasEditor.tsx` | Per-app or shared |
|---|---|---|---|
| config | `canvasConfig` (CATALOGUE + BOX) | `canvasConfig` (SHARED_BLOCKS + BOX) `:43` | per-app |
| contract | `canvasContract = contractOf(CATALOGUE)` `:119` | absent | per-app (`contractOf` imported by path from `packages/blocks/src/contract`, sunjay `config.client.ts:10`) |
| resolved | `resolvedRows(filled)`: only keys in `RESOLVED_KEYS` + `thread-feed.items`, only if non-empty `:35-49` | `resolvedProps(filled)`: ALL props of any node with an `id` `:11-23` | shared walker, per-app key map. Likely innergathering bug: sunjay comment `:30-33` says listed props win over the node's own props, so panel edits to non-resolver props would not draw. Unverified. |
| metadata | `{orgId, slug, ...record}` | `{orgId, slug}` | per-app `record` |
| choosePicture | own chooser | own chooser (near-identical; library key `org` vs `site`) | shared (`makeChoosePicture`) |
| records | `person-records` `:126` | absent | per-app (`recordSourcesFrom(sources)`) |
| developer | false | default | shared, default false |
| designTools | true | absent | shared true |
| pageName | page title or `/slug` | absent | shared derivation |
| blockEditorHref | `/studio/<slug>/blocks` (+record query) | `/studio/<slug>` | per-app route shape |
| onSave | `savePageAction(slug,d)` | same | per-app action |
| saveNotice | template-reach notice | absent | per-app map |
| onDone | `/manage/builder` for templates else `/<slug>` | `/studio` | per-app |
| inception + editSettings | `true` + `openBlockSettings` with `puckConfig`, `strip` from KEYS, `plugins: sheetPlugins`, `escape: true`, then re-resolve rows `:138-158` | absent | shared (only `puckConfig`, strip keys, plugins vary) |
| pages | absent | absent | shared (to add: `listSitePages`) |
| wrapper div | `minHeight:100vh` | plus `paddingTop:44` | shared |

### Plugins on the Puck sheet / whole-page Puck
| Plugin | sunjay | innergathering |
|---|---|---|
| `partsPlugin` (`contract`, look helpers `partLookOf/setPartLook/partSafeDecls`, `panel: mountLookPanel`, `handBack`, `popup: openStudioPopup`, `developer:false`) | yes, built twice (CanvasEditor `:104-113`, `page-editor.tsx:30-38`); `MorphMark` in both configs | none |
| `templatesPlugin` | `/blocks` only | none |
| `menuPlugin` (`memoKey: "sunjay"`) | `/blocks` only | none |
| `pagesPlugin` | none | none |
| `morph` in `buildPuckConfig/buildEditorConfig` | `MorphMark` | none |
| `fields.string/richtext` binds (service/person/opens/record/piece/gathering/guide) | yes (`config.client.ts:189-218`) | none |

### Save action
| | sunjay `lib/puck/actions.ts` | innergathering `lib/puck/actions.ts` |
|---|---|---|
| gate | `getApiEditor` | `getApiEditor` |
| slug rules | `slugProblem` (valid, reserved, templates, feed slugs) `:20-31` | none (valid path only, in store) |
| cleaning | `cleanBoxDoc(stripResolved(data))` `:49` | `cleanBoxDoc(data)` `:24` |
| revalidate | layout for templates, `/` for home, else `/<slug>` | `/p/<slug>` only |
| landing | `saveLandingAction` + `restoreLandingAction` (revalidate `/`) | landing saved via `savePageAction("landing")`; restore without revalidate |
| guard | none | none |
| store | `lib/puck/store.ts` binds loadPage/savePage/listPages + `HOME_SLUG` + `deletePage` | same minus `HOME_SLUG` |

### Studio route
| | sunjay `app/studio/[slug]/page.tsx` | innergathering `app/studio/[slug]/page.tsx` + `/canvas/page.tsx` |
|---|---|---|
| renders | canvas (`:67`) | Puck at `page.tsx`, canvas at `/canvas` |
| record query | `studioRecord` (`record.ts`) for templates | none |
| name check | `slugProblem` page with "name taken" | none |
| starting doc | `templateDocument(startingTemplate(...))` for unsaved page | `EMPTY_PAGE` |
| landing | redirect `/` (home and landing) | redirect `/` |
| Puck route | `/studio/<slug>/blocks` | `/studio/<slug>` |
| old canvas URL | `/canvas` redirects | live route |
| metadata | `robots noindex` | none |

### Proposed shared `HouseEditor`
One client component (in `@elkdonis/page-builder` or `direct-edit/puck`) mounting `mountTreePage` plus the Puck sheet. Both `CanvasEditor.tsx` files become ~25-line binds.

```ts
interface HouseEditorProps {
  slug: string;
  orgId: string;
  initial: PuckDoc;
  version?: string;                        // updatedAt token from loadPageWithVersion
  // per-app bindings (what really differs):
  config: { canvasConfig; puckConfig; contract? };   // contract optional so innergathering opens without the look panel at first
  save: (slug, doc, version?) => Promise<{ ok; error?; stale?; updatedAt? }>;  // the app's gated savePageAction
  resolvedKeys?: Record<string, readonly string[]>;  // RESOLVED_KEYS; omit = resolve nothing (fixes ig)
  records?: RecordSources;                           // recordSourcesFrom(sources)
  sources?: SiteSources;                             // siteBindsFields feed for Puck and canvas pickers
  choosePicture: PictureChooser;                     // makeChoosePicture({ uploadEndpoint, libraries })
  routes: { blocks(slug, record?): string; done(slug): string; page?(slug): string };
  pages?: { list(): Promise<PanelPage[]>; hrefOf?(slug): string };  // listSitePages -> mountTreePage `pages`
  nav?: { load; save; memoKey };                     // menuPlugin
  templates?: PageTemplate[];                        // templatesPlugin (whole-page Puck)
  record?: { threadId?: string; piece?: string };    // template metadata
  saveNotice?: string;                               // per-slug notice
  titleOf?: (slug, doc) => string;                   // pageName
  siteStyle?: { schema; initial; save };             // so Site style opens from the canvas too
  flags?: { developer?: boolean; designTools?: boolean; inception?: boolean };  // defaults false / true / true
}
```
Shared inside: `resolvedRows` and `withProps` walkers (currently sunjay-only; the sunjay copy is the right one), a single `partsPlugin` instance, the `editSettings` -> `openBlockSettings` -> re-resolve loop, stale-version hold/update, Esc layer stacking. A second thin component `HouseWholePage` wraps `PuckEditor` with the same plugins. A third entry `openHouseLanding` wraps `openVisitorPage`/`openPageAsTree` with the same options.

## 3. FIELD layer (Justin's direction: @elkdonis/live-editor)
live-editor today (`packages/live-editor/src`): `FieldDef {trait, label, input: text|textarea|url|number|datetime|date|select|image|compound|readonly, hint, initialValue, options, compound[]}`, pins on `[data-trait]` elements (`EditOverlay.tsx`), `FieldPopover` (Esc and outside click close, pending/saved states), host supplies `onSaveField(payload) => {ok,error}`. Also `StyleOverlay`/`CssPanel` (look: overlaps Site style; keep out of the field layer). Used today by artdirect and arts-collective sites, not by either of my apps.

Every in-place field/copy edit found in my apps:

| # | Edit | Where (UI, action) | Stored | Gate / cleaning today | Should become a live-editor field? | Features live-editor should inherit |
|---|---|---|---|---|---|---|
| F1 | Page copy (hero, about, visiting, resources, footer...) | sunjay `/manage/pages` SectionEditor -> `saveSectionAction` `lib/cms/actions.ts:433`; innergathering same (`:447`) | `org_site_sections(org, section_key, content)` | `requireOrgEditor`; REPLACES whole content, free-text key, no sanitising or cap (atlas; fourthway is the strict model) | YES, each `section.field` as `data-trait="hero.title"` (text/textarea). Save goes to ONE canonical merge action with an allow-listed key set (hub `sb-runners` path, zod 20000 cap). Retire both `/manage/pages` forms (D). | allow-listed keys, merge not replace, `updated_by`, per-field hint, "empty keeps the default wording" rule, revalidate layout. In tree mode these words are canvas text, not live-editor. |
| F2 | Site Builder copy slots (hub card) | sunjay `lib/hub-site.ts:47-72` -> `runHubAction`, canonical runner | same table | merged, capped | Same engine as F1: field on the page; the card stays as the list view (C) | slot groups ("Header", "Footer"); `type`/`rows` per slot map to `FieldDef.input` |
| F3 | Footer lines | sunjay `site-footer.tsx` (`data-edit-section="footer"`), section `footer.body/note` | section row | as F1 | YES (same F1 action) | appears on every page: revalidate layout |
| F4 | Feed (page) name, tagline, description, presenter, accent, order, public | `/manage/feeds` FeedEditor -> `saveFeedAction` (`cms/actions.ts:391` sunjay / `:405` ig) | org feeds table | `requireOrgEditor`; byte-identical in 4 apps | PARTIAL: name/tagline/description as fields on the feed page; accent, order, visibility, slug stay in the Site Builder form (C) | `isPublic` switch, accent picker (`FieldInputType` lacks `boolean`, `color`: add) |
| F5 | Landing banner picture, alt, framing | sunjay `BannerEditor` dialog -> `saveBanner` (`lib/banner-actions.ts`) | `site_config.image_spaces.hero` | gate; picture must be `/api/media/` or https, not `Private/`; frame clamped (0-100, zoom 1-4) | YES as `input:"image"` plus compound (path, alt, frame). innergathering has no such editor: its landing images are the elkdonis-org `site_config` set by the network admin route (atlas: unsanitised, SECURITY open item). | CoverFramer (focal point + zoom, wide and phone shapes), private-path refusal, alt text, Remove picture. live-editor `image` lacks libraries and a framer: add MediaPicker libraries (This site / My files) and the frame editor. |
| F6 | Center promo (title, body, link, image, Clear) | innergathering `/manage/center` CenterPromoEditor -> `saveCenterPromoAction` `cms/actions.ts:486` | `site_config center_promo` | `requireOrgEditor`; title required; href/image http(s) or same-site path only (`linkOk`) | YES, best fit: `compound` (title, body, href, imageUrl) pinned on the `/center` promo card; keep Clear. (sunjay has no equivalent slot.) | `linkOk` validation, Clear/remove action (live-editor has no delete), "another placement kind is set; saving replaces it" read-only state |
| F7 | Own profile bio/photo/links | `/account` ProfileEditForm -> `updateOwnProfileAction` (both apps, byte-identical) | `profiles` | self only; avatarUrl `/api/media/` or http(s) (innergathering) | YES on the person's own page (`profile-field-save`) | self-only-by-construction gate, 12-link cap with http(s) only |
| F8 | Guide / teacher profile | `saveGuideProfileAction` (both) | org people tables | `requireOrgEditor`; revalidates `/about`, `/about/<slug>` | PARTIAL: compound fields on `/about/<slug>`; creation stays in `/manage/people` | slug handling |
| F9 | Gathering/post/workshop copy | sunjay Channel "Edit here" `components/channel/meeting-sheet-form.tsx` (quick tier of shared `SiteFormPage`, with "More options in Studio"); innergathering `/manage/content/<id>` `SiteFormPageHost`; `EditThreadButton` opens the surface | `threads` via `meeting-save` / `post-save` | action gate only "signed in"; the owner/guide rule is in services (atlas) | YES for title, short description, date/time, place as live-editor fields on the thread page; the full form stays (C: it is the "More options" tier) | quick-tier-then-"More options" ladder, Back-to-Channel hand-back (`closeHref`), reach notices; `datetime` already in live-editor |
| F10 | Thread email text | sunjay `api/threads/[id]/email-settings` | thread metadata | atlas `sunjay-email-settings-save` | MAYBE (textarea; low priority) | n/a |
| F11 | Standing meeting choice | `setStandingMeetingAction` (`cms/actions.ts:311` sunjay / `:325` ig) | site config | `requireOrgEditor` | MAYBE: `select` field on the hub meeting banner | options from data |
| F12 | Hub meeting plan / record / light (innergathering) | `api/hub/meeting/{light,record,rota}` | meeting tables | per route | NO (hub work surfaces) | n/a |
| F13 | Email template text | innergathering `app/hub/email/[key]`; sunjay `EmailSurface` | template rows | per route | NO (own template editor with Reset/Test) | n/a |
| F14 | Page edit patches (innergathering) | `savePageEditsAction` | `page-edits:home` | `canEdit` + `cleanPatches` | NO: look, not copy, and dead. D. | none |
| F15 | Toggles: `EventPageToggle`, `StoreSectionToggle`, status, pin | `lib/puck/event-actions.ts`, `account-actions` | flags | gates | NO (switches; expose in Settings sheet / sidebar, class C) | n/a |

Look and layout are not field edits and stay out: Site style (S6), page patches, center layout (`PATCH /api/center/layout`; atlas: `?org=` reaches other orgs, SECURITY open item), portfolio ordering (innergathering `api/center/portfolio`).

Gaps live-editor needs to be the field layer here: `boolean` and `color` input types; `image` with libraries + frame; a Clear/Remove action; a read-only state with a reason; stale/version guard on save (`SaveResult.stale`); an "editing this field" cue visibly different from the canvas selection box; server-side cap + sanitise; Enter-to-save for single line. Layer hand-off: a field popover offering "Open in the canvas" when the page is a tree, and canvas "Settings…" offering the field popover for record-backed copy.

## 4. Features worth INHERITING into the one house editor
1. sunjay `slugProblem` (reserved, template, feed slugs), `actions.ts:20`: into shared `savePage` options.
2. sunjay `resolvedRows` (keys only, non-empty) + `withProps` + `stripResolved` as shared utilities; innergathering's variant is the weaker one.
3. sunjay record-aware templates: `studioRecord`/`recordQuery`, `LayoutDoor`, `editHref` with `?thread=`/`?piece=`, `TEMPLATE_NOTICE` (say the reach of a save before it).
4. sunjay inception wiring: single `partsPlugin`, `handBack`, `escape: true` layer stack, re-resolve rows after Settings.
5. sunjay `openVisitorPage` (works on signed-out HTML) + `FIRST_SAVE` notice + `onRestore` + `quietThePage`; innergathering `classes` hook (re-adds `in-view`) and `edits` carry-over in `openPageAsTree`.
6. sunjay Site Builder adapter shape (`sanitizeDoc`, `pathProblem`, `startDoc`, `revalidate`): already the contract for `HouseEditor.save`.
7. sunjay banner: private-path refusal, CoverFramer, alt text.
8. innergathering center-promo Clear + `linkOk` rule + "foreign placement is taken" notice.
9. sunjay Channel quick-tier form with "More options in Studio".
10. innergathering `/studio` "new page = visit its address" (no create step); sunjay `NewPageForm` + `startingTemplate` is better, keep that.
11. sunjay `designTools: true`, per-slug `pageName` from root title.

## 5. Dirty state
`git status --short apps/innergathering apps/sunjay | wc -l` = **16**. innergathering: 0 dirty. sunjay: 12 modified + 4 untracked.

Editor-relevant uncommitted (collision risk when extracting `HouseEditor`):
- `apps/sunjay/src/components/studio/page-editor.tsx` (adds `menuPlugin` + `MENU`).
- `apps/sunjay/src/lib/puck/nav-actions.ts` (untracked), `src/lib/nav.ts` (untracked), `src/lib/nav-default.ts` (untracked): menu data path.
- `apps/sunjay/src/app/layout.tsx`, `components/site-header.tsx` (load nav; layout also mounts `SiteStyleButton`).
- `apps/sunjay/src/lib/forms/site.tsx` (+2), `components/channel/meeting-sheet-form.tsx`, `meeting-sheet.css` (Channel quick edit).
- Uncommitted, not editor: `[feed]/[slug]/page.tsx`, `globals.css`, `manage/content/[id]/page.tsx`, `manage/content/new/page.tsx`, `lib/data.ts`, `lib/types.ts`, `components/thread/` (untracked).
- Clean and safe to edit: sunjay `components/studio/CanvasEditor.tsx`, `lib/puck/actions.ts`, `lib/puck/store.ts`, `app/studio/**`, `components/landing/*`, `components/site-style/*`, `components/site/banner-editor.tsx`; all innergathering editor files.
- PROGRESS.md: a sunjay rebuild also ships the menu change; rebuilds of either app pick up other sessions' uncommitted shared work in `cms-ui/surface` and `services`.

## 6. Per-surface counts
Editor surfaces (section 1, 17 rows): A = 6 (S1, S2, S4, S5, S6, S7), B = 5 (S11, S12, S14, S15, S17), C = 4 (S8, S9, S10, S13), D = 2 (S3, S16).
Field edits (section 3, 15 rows): live-editor YES = 7 (F1, F2, F3, F5, F6, F7, F9); PARTIAL = 2 (F4, F8); MAYBE = 2 (F10, F11); NO = 4 (F12-F15).

## 7. Uncertain
- innergathering `resolvedProps` effect on panel edits is inferred from sunjay's comment, not run.
- Whether `/` revalidates after an innergathering landing save (`/p/landing` is revalidated; `/` may be dynamic through cookies).
- innergathering `/manage/pages` sections: `getSiteSections` is read by `[feed]/page.tsx`, not the landing (landing copy is the elkdonis-org `site_config`). So F1 matters less there.
- Atlas host keys for `page-edits-save`, `profile-field-save`, `center-promo-save` did not parse to sunjay/innergathering keys here; the locations above come from code.
- Nothing exercised in a browser or the direct-edit harness.
