
## Agent B — phase 1 pickers + sources
Source only; nothing rebuilt, committed or migrated.
- page-builder/src/fields/{site-sources.ts, record-fields.tsx, record-sources.ts}: SiteSources { artworks?, galleries?, pages? } loaders + PickerCopy words; shared ArtworkPickerField, GalleryPickerField, RecordPickerField, PageLinkField, TileKeyField; siteBindsFields(sources, copy) = the binds mapper for artwork/gallery/opens-gallery/record/page-link/tile-key (null otherwise, so hosts chain gallery-pictures/tile-layout); itemsFromEndpoint(url); recordSourcesFrom(sources) = structural canvas RecordSources for artwork/gallery/opens-gallery/gallery-pictures/page-link. All exported from index.ts.
- danamccool: new lib/puck/site-sources.ts (danaSources, danaPickerCopy); config.client.ts uses siteBindsFields; old artwork-picker, gallery-picker, record-picker, tile-fields deleted (only config.client imported them).
- katie: new lib/puck/site-sources.ts; config.client.ts uses shared field; components/studio/artwork-picker.tsx deleted.
- Same stored values and UI text for Dana and Katie (wording passed as copy). Canvas wiring (phase 6): const records = recordSourcesFrom(danaSources).
- tsc clean: packages/page-builder, apps/danamccool, apps/katie-the-potter, apps/sunjay; page-builder npm test passes.

## Agent A — phase 0 + media factories

Source only; nothing rebuilt, restarted, committed, or written to the DB.

Task A (stale-save guard, backwards compatible):
- `packages/page-builder/src/store.ts`: `loadPageWithVersion(orgId, slug)` -> `{data, updatedAt}` (updatedAt = `updated_at::text`, opaque, microsecond-exact); `savePage(..., expectedUpdatedAt?)` returns `{ok, error?, stale?, updatedAt?}`. Guarded path is one `UPDATE site_config SET value=..., updated_at=NOW() WHERE org_id AND key AND updated_at = $expected::timestamptz RETURNING updated_at::text`; zero rows = `stale: true` (also covers a page deleted since). No expected = the old upsert unchanged (plus a RETURNING).
- `packages/page-builder/src/server.ts`: exports `loadPageWithVersion`, type `SavePageResult`.
- `packages/page-builder/src/editor.tsx`: optional `version` prop; `onPublish(slug, data, version?)` (existing 2-arg handlers still work); on `stale` it stashes the edits in localStorage, keeps `dirty`, shows "This page changed since you opened it. Reload to get the latest; your changes are kept in this browser."; on success it takes `updatedAt` as the new held version.
- danamccool only: `lib/puck/store.ts` (bound `loadPageWithVersion`, `savePage(slug,data,expected?)`), `lib/puck/actions.ts` (`savePageAction(slug,data,expectedUpdatedAt?)`), `app/studio/[...path]/page.tsx` + `components/studio/page-editor.tsx` pass `version`.
- A brand-new page (no row yet) has no version, so its first save is unguarded and returns the version for later saves.

Task B (media factories):
- `packages/services/src/media-upload-route.ts` (new) + 2 appended lines in `services/src/index.ts`: `mediaUploadRoute(opts)` -> `{ POST }`. Options: orgId, label, canEdit(request)->{userId}|null, target "owner"|"org", ownerUserId, ensureOwnerFolder, retryOnFailure, ensureFoldersOnRetry, maxSizeMb, tooLargeStatus, rejectHeic, messages.
- `apps/danamccool/src/app/api/media/upload/route.ts`: now a thin bind (original saved at eris /tmp/dana-upload-orig.ts).
- `packages/cms-ui/src/files/make-choose-picture.tsx` (new) + 3 appended lines in `files/index.ts`: `makeChoosePicture({uploadEndpoint, libraries, label?})`. Uses a `@ts-ignore` on `react-dom/client` because cms-ui has no `@types/react-dom`.
- Not switched: katie upload, the three page-picture-chooser copies, Dana's `[...path]` / library routes.

## PM review (2026-11-20 04:50 UTC)
- tsc re-run by PM: page-builder, danamccool, katie-the-potter, sunjay all 0 errors. Agent A saw record-fields errors only while Agent B was still mid-edit.
- Picker labels: every UI string in Dana's 4 deleted pickers is still present, either as shared defaults or in `danaPickerCopy`.
- Guard SQL tested on a TEMP copy of `puck:home` inside BEGIN/ROLLBACK. The `updated_at::text` token round-trips, so a matching version gives UPDATE 1 and a stale one gives UPDATE 0. Her real row was untouched.
- The only `puck:*` writers are page-builder `store.ts` and `scripts/to-puck.mts` (never run it).
- Not yet checked in a browser.
- A rebuild of danamccool would also pick up other sessions' uncommitted shared work (`cms-ui/surface`, `services`).
- **Katie has a large amount of uncommitted checkout/orders work from another session.** A katie rebuild would ship it, so check with its owner first.
- Open: `@ts-ignore` on `react-dom/client` in `cms-ui/files/make-choose-picture.tsx`. The better fix is adding `@types/react-dom` as a devDependency.

## Agent C — phase 2 pages
Source only; nothing rebuilt, committed, migrated or written to the DB.
- services/src/site-pages.ts (+2 appended lines in index.ts): listSitePages(orgId, {galleriesOfUserId?}) -> {slug,title,href,updatedAt,gallery?}. Same SQL, title rule (root title prop, else last slug part with dashes as spaces) and href rule (home = /) as Dana's listPagesForHud. The gallery key is present (object or null) only when galleriesOfUserId is given; it carries itemCount too, for her chip.
- page-builder/src/pages/pages-plugin.tsx (+2 appended lines in index.ts): PagesPanel (list, hrefOf, current, hubHref, landingSlug, allowNew, classes) and pagesPlugin({list, hrefOf, current, label, ...}). Neutral inline styles by default; a host passing `classes` gets only the structure (no inline look).
- danamccool: lib/hud-actions.ts listPagesForHud keeps its gate and return shape, calls listSitePages. components/hud/pages-panel.tsx is a wrapper passing her dm-hud classes, hrefOf=/studio/slug, hubHref=/hub. page-editor.tsx untouched (still uses PagesPanel directly).
- direct-edit: tree-editor option `pages {list, current, open?}` (also on mountTreePage): the page menu (name pill) lists the pages, current ticked; picking one confirms if dirty, markSaved, then open(slug) or location.href = href. Restore item kept below it. Not in the popup. Absent = unchanged. Not wired into any app.
- tsc clean for page-builder, direct-edit, danamccool (except menu-plugin.tsx, the other agent), services (only pre-existing nextcloud/utils/social-feeds), sunjay (only menu-plugin).
- Not checked: live SQL of listSitePages against the DB, a browser, the direct-edit harness (needs a scratch h3 folder).

## Agent D — phase 2 menu
Source only; nothing rebuilt, committed, migrated or written to the DB.
- services: `nav-core.ts` (pure, client-safe: NavItem, NavGroup, groupNav, cleanNav, NAV_MAX_ITEMS; subpath export `@elkdonis/services/nav-core`) and `nav.ts` (`loadSiteNav(orgId,{key="nav:main",fallback})`, `saveSiteNav(orgId,items,{key})`, DEFAULT_NAV_KEY). Dana's rules copied verbatim. Exported from services index (appended).
- page-builder `src/menu/`: `NavEditor` (className + per-slot `classNames`; with classNames it adds no inline styles, otherwise neutral Puck-variable styles), `menuPlugin({load,save,memoKey?,label?,current?,editor?,heading?,loading?,renderError?})`, `MenuPanel`; per-memoKey module memo keeps drafts across tab switches. Exported from index (appended).
- danamccool: navigation.ts re-exports the shared model and keeps DEFAULT_NAV; navigation-store.ts calls the services functions with key nav:main + DEFAULT_NAV; nav-editor.tsx and editor-tabs MenuTab are thin wrappers (same dm-* classes/markup). `nav:main` read as stored.
- sunjay: lib/nav-default.ts, lib/nav.ts, lib/puck/nav-actions.ts (getApiEditor gate, revalidatePath("/","layout")); header takes `nav` prop (default DEFAULT_NAV); layout loads it; page-editor has the Menu tab.
- katie: same files (nav-default, nav, puck/nav-actions), header + layout wired. NOT wired: Menu tab, because `components/studio/page-editor.tsx` has others' uncommitted edits. Ready-made `components/studio/menu-plugin.ts` exports `MENU`; remaining edit = import it and add to `PLUGINS` there.
- Neither header renders `sub` as a submenu yet (flat links); external links open in a new tab.
- tsc: page-builder, danamccool, sunjay, katie-the-potter 0 errors; services only the known nextcloud/utils/social-feeds errors.

## PM review, phase 2 (2026-11-20)
- tsc 0 errors: page-builder, direct-edit, danamccool, katie-the-potter, sunjay.
- `listSitePages` SQL was run read-only against danamccool with her owner id: 27 pages with the correct galleries. It matches the old `listPagesForHud` SQL apart from the optional-owner guard.
- `cleanNav` was run on her live `nav:main` (14 items): same content, `sub` and `external` flags kept. The only difference is key order, which jsonb produces anyway.
- Still open:
  - katie `components/studio/page-editor.tsx` has another session's uncommitted work, so its Menu tab is not wired (needs 2 lines);
  - `sub` items render flat on the sunjay and katie headers;
  - Menu candidates can move to `listSitePages`;
  - nothing has been browser-tested yet.
- Rebuild set when Justin says yes: danamccool (phases 0-2). sunjay would pick up the menu change. Hold katie for its other session.

## elktours canvas-first (2026-11-20)
Source only; nothing rebuilt, restarted, committed, migrated or written to the DB. No shared package touched.
- New components/studio/CanvasEditor.tsx (port of sunjay: mountTreePage, canvasConfig/canvasContract, records, choosePicture from components/landing, designTools, inception, blockEditorHref, editSettings -> openBlockSettings with the same partsPlugin as page-editor.tsx, pages switcher).
- app/studio/[slug]/page.tsx now renders the canvas (phone branch, slugProblem, startingDocument kept); new app/studio/[slug]/blocks/page.tsx = Puck PageEditor, same gating.
- Stale guard: lib/puck/store.ts binds loadPageWithVersion and savePage(slug,data,expected?); savePageAction(slug,data,expectedUpdatedAt?) returns stale/updatedAt; canvas holds+updates the version, on stale returns {ok:false,error} (direct-edit shows "Not saved: ..." and stays dirty); PageEditor passes version to PuckEditor.
- New gated server action listEditablePagesAction (excludes landing, m-*).
- tsc apps/elktours: 0 errors. direct-edit harness not run (no direct-edit change). Not browser-tested.
