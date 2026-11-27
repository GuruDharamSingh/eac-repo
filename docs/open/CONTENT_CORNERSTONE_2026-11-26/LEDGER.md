# Content cornerstone: ledger

Append only, newest at the bottom. Mark each claim as **verified**, **assumed** or
**unknown**. Plan: PLAN.md. Contract: CONTRACT.md.

## 2026-11-26: decisions (Justin, in the PM session system32-43)

1. The content library becomes the platform's default search, with one component and many
   faces: /center "My work", a site-wide hub card for admins, pickers, the file browser and
   an assistant tool.
2. **One search index:** a unified `content_index` table, with one full-text and trigram
   index. Write paths keep it current, and there is a backfill and a nightly reconcile.
3. **One search with a scope toggle:** Published | Files | All. Files become indexed
   items.
4. **This lane is the umbrella and the foundation, and its PM has authority over the
   neighbouring lanes.** `MediaLibrary` folds into `ContentLibrary`; the file browser is a
   limited expression of the same component. The market /center and /hub lane is UI work
   that consumes this contract.
5. **Hub cards use the `defineHubCard` contract,** for both the Content card and the
   lifted Channel card.
6. **The first new host is art-auction.** The Channel hub card follows it there.

## 2026-11-26: starting state (read-only survey; verified unless marked)

- `ContentLibrary` is mounted in no app, only in `scripts/channel-harness/publish.tsx`.
- `listContent` is called from `apps/arts-collective/src/lib/studio-create-actions.ts:52`
  and `packages/channel/src/site/page.tsx:191`. It has no text query and no site scope.
  Artwork is re-read in full on every page.
- There are four separate `ContentListItem` mappings: `list.ts`,
  `arts-collective lib/channel/content-list.ts`, `channel site/summary-view.ts` and
  `channel hub/server.ts`.
- `MediaLibrary` (`packages/content/src/ui/MediaLibrary.tsx`, 706 lines, untracked) was
  built today by the media lane and is used by elktours `components/manage/media-field.tsx`
  (source only).
- Full-text search exists only on forum threads and replies (`114_forum_search.sql`).
  Artwork, users, orgs and files have none.
- The `media` table has no owner columns, personal uploads write no row, and
  `nextcloud.ts:175 listFiles` is a stub that returns `[]`.
- art-auction has no /center, no /hub and no surface stack. It is a built image
  (`next start`). The market center and dock design is at
  `docs/open/MARKET_CENTER_AND_DOCK_2026-11-24.md` (round 5 is today's).
- The branch is `work/2026-11-16`, with about 303 dirty paths from many sessions.

## Open (needs Justin)

- [ ] A snapshot commit and a new day branch before the code lands. This is Step 0's gate.
- [ ] Deploys: none planned until Step 3.

## Lane posts

- 2026-11-26: posted to the media lane (ELKTOURS_MEDIA_STRUCTURE §5), the market lane
  (MARKET_CENTER_AND_DOCK, plus a message to its session), and the house-editor PM
  (LIAISON).

## 2026-11-26: market lane needs against contract v1 (market /center + /hub session, design only)

The market lane read CONTRACT.md v1 and PLAN.md. It wires nothing into art-auction; boards are on canvas page "Round 5" (R5Center, R5Hub, R5Storefront, R5Map). Points where round 5 draws something v1 does not cover (all **assumed** needs, from the boards, not from code):

1. **Artworks "By store" (/hub).** `ContentQuery` has no store or owner filter and no grouping; the board groups tiles by store and has a store picker. Needs a store filter (owner identity or store id) and a per-store facet, plus a group-by-store option beside `groupBySite`.
2. **Sale states.** The /hub chips are For sale · In auction · Sold · Hidden; /center Listings is Current | Past (sold, passed, withdrawn). `ContentStatus` has no sale state. Needs a commerce field on `ContentListItem` and a facet for it, and `hidden` as a filter for keepers.
3. **Landing picks.** /hub Artworks has "On the landing" and "Save landing picks". Needs a registry action in `host.actions`, or the market keeps landing picks as its own frame outside the card.
4. **Host-owned piece frame.** On /center a Listings row opens the market's piece frame, which has a rail: Write about it, Make into a post, Enter in a series. It then stacks: piece → write, piece → post, piece → series entry. Needs one of:
   - `onOpen(item)`, so the host can replace `PieceLightbox`;
   - a rail or extra-actions slot in the lightbox.

   Also needs an answer: can a `HubCardMount` popup push a layer (crumb, Back)? If not, the market keeps the cms-ui SurfaceProvider for its own frames, for example Orders → Order → Refund.
5. **Series in search.** "Ongoing series" (/center) and the hub Series card list auction series (`auction_series`, not a `ContentStore`) beside meeting series (`threads.kind='series'`). Should auction series be indexed, or does the market read them with its own query?
6. **One card or two on /hub.** Round 5 drew both "Artworks" and "Content library" faces. Can the Content card mount twice with presets (types `[artwork]` vs all, scope `site` vs `network`)? Otherwise the market lane folds them into one face.
7. **No gap:** "+ Add article" on the store Writing tab = `ContentLibrary` `mode="pick"`, scope `mine`, types `[writing]`. Where the store keeps its chosen articles is market-side, still open.

## 2026-11-26: agent C, plumbing (mount, routes, Content card, Channel lift)

Nothing built, deployed, installed or committed. Paths from `~/eac`. Labels: V verified, A assumed, U unknown.

**Built**
- `packages/hub/src/mount/{HubCardMount.tsx,index.ts}` + export `./mount`. `HubCardMount`, `HubCardDetailMount`, `useHubCardHost`. Takes `card`, `data`, `act`, plain-data `links`, `host` overrides, `navigate`, `refresh`, `icons`, `theme`. One layer, no SurfaceProvider, no `next/*` (falls back to `window.location`). V: `packages/hub` tsc clean. U: not rendered in a browser.
- `packages/content/src/query-string.ts` (`parseContentQuery`, `contentQueryParams`, `parseScope`) + export `./query`: one parser for the route and the card's remote source.
- `packages/content/src/routes.ts` `contentRoutes(host)` -> `{search, folders, upload}` + export `./routes`. search: viewer from `host.viewer(req)`, signed out limited to `network` (else 401), `no-store`. folders: roots from `host.fileSources`, `cleanSourcePath` plus a startsWith(root) check, `Private/` hidden unless `showPrivate`, 404 for missing and not allowed, 401 signed out. upload: typed stub, 501. A: `resolveWithin` is not exported from `@elkdonis/services` (only `cleanSourcePath`, which has the same rule and is what `listMediaSource` uses), so I did not import it. U: never run against a database or Nextcloud.
- `packages/content/src/hub/{model.ts,server.ts,card.tsx,index.ts}` + exports `./hub`, `./hub/server`. `contentCard` (face: count, top types, latest 3; popup: remote `ContentLibrary`, compact; detail: full page) and `contentServer({host, preset, endpoints})`. Gate in the server half: `site`/`org` need owner, guide or network admin (face shows `allowed:false` otherwise and loads nothing); `mine`/`network` open to any signed-in viewer (A: "any member" read as signed in). Preset `{id,title,scope,types,view,groupBy}`; the card is mounted once per preset, each with its own `contentServer`. The remote source is the function form (`source={{search}}`, which injects the preset's scope/types/view), not `{endpoint}`, so the preset's scope reaches the route.
- `packages/channel/src/hub/{card.tsx,card-server.ts}` + exports `./hub/card`, `./hub/card-server`: `channelCard` (gate guide, actions `SITE_DOOR_ALLOW`), `channelServer(load)` / `channelHubServer`, `channelHubRoutes(door)` (`{GET}`, same 403/500/no-store as sunjay's route), `ChannelHubDoor`. Kept off `./hub` (index.ts) on purpose so sites importing the bare face and panel do not need `@elkdonis/hub`. The pop-up reads the card data and calls `host.refresh()` after a write that went (sunjay refetched `/api/hub/channel`). Escape inside the chart's quick-form dialog is stopped from closing the pop-up.
- `docs/open/CONTENT_CORNERSTONE_2026-11-26/MOUNTING.md`.

**Type-check (throwaway containers)**
- V `packages/hub`: 0 errors. V `apps/sunjay`: 0 errors.
- `packages/channel`: 0 errors with a temporary tsconfig mapping `@elkdonis/hub/*` to the source; **6 errors (TS2307) without it**, all in the new `hub/card*.ts*` files: `@elkdonis/hub` is not a dependency of channel.
- `packages/content`: with the same mapping, my files are clean except `hub/card.tsx` (`ContentLibraryProps` has no `source`/`view`/`groupBy`/`folders`/`density` until agent B lands) and `src/hub/server.ts` / `routes.ts`, which import `./server/search` (agent A, not there yet; clean against a stub of the contract signature). Plain `tsc` also shows TS2307 for `@elkdonis/hub`, and agent A's `services/src/content-index.ts` has 9 TS2345 errors (not mine). Temp tsconfigs removed.

**Dependency edges needed (not done: no installs, and I was told to edit only the exports fields)**
- `packages/content/package.json` and `packages/channel/package.json`: add `"@elkdonis/hub": "workspace:*"`, then `pnpm install`. No cycle: hub depends on analytics, db, fonts, services, utils only. Until it lands, `check-types` for content and channel is red on the new files; apps that do not import `./hub*`, `./routes` or `./hub/card*` are unaffected (sunjay checked).

**Channel lift: render parity not proven, so no Sunjay patch**
- The lifted tile uses hub-card chrome (`hc-card`, `PopupShell`), not sunjay's `SurfaceCard` plus `SurfaceFrame` (kind board, flush), so the tile and pop-up frame differ by design; the inner `ChannelHubFace`/`ChannelHubPanel` are the same components. I ran no render comparison (a harness needs a build and shot rig; not run), so I prepared no patch and touched nothing in `apps/sunjay`. The six glue files stay. Switching is a visual decision for Justin, not only a refactor.

**Open**
- Re-run content `check-types` once A's `server/search.ts` and B's `ContentLibrary` props land; then the `hub/card.tsx` error should clear (A: prop names match CONTRACT §7).
- `data.actions` (host.actions) is carried but not yet wired into the lightbox (no §7 prop for it; `onOpen`/`railSlot` are B's).
- `performHubAction` has no Content entries yet; `act` can be a stub while `actions` is empty.
- Art-auction needs a market `siteChannelLoader` and an `email` lookup for `HubViewer` in the Channel loader.
- Add `./hub/card` and friends to the art-auction `transpilePackages` (MOUNTING.md step 0).

## 2026-11-26: Step 1, the search core (agent A)

**Built (all verified by running unless marked):**
- `packages/content/src/host.ts` (ContentHost + `defaultHost()` + MARKET_URL/ARTDIRECT_URL/NETWORK_HOST) and `search-types.ts` (browser-safe query/result types).
- Migration `293_content_index.sql`, applied ALONE on elkdonis_dev (one transaction, migrate lock key 7246001, tracker row with the file's sha256). `migrate --status` now shows only 263 pending; `--verify` 0 drifted. verified.
- `packages/services/src/content-index.ts` (+ additive export lines in services `index.ts`): `indexThread`, `indexArtwork`, `unindexContent` (never throw, log and swallow), `reindexAll`, `reconcileContentIndex({fix?})`.
- Backfill run (`packages/content/scripts/content-reindex.mts`): 198 threads, 66 artwork indexed; drift 0 missing, 0 stale, 0 orphan. verified.
- `server/search.ts` (`searchContent`, exported from `server/index.ts`), `server/hydrate.ts` (the one ContentListItem mapping on the server), `contentReadSql` / `isSiteKeeper` / `siteOrgIds` in `server/access.ts` (`threadReadSql` untouched).
- `listContent` is now a wrapper over `searchContent` (parity proven first). The old loader is kept as `server/list-legacy.ts` (parity reference only, delete in Step 7). New optional 3rd/4th args on `listContent` (pre-resolved rights, host) and an `opts` arg on `searchContent` (`maxLimit`, `now`, `rights` for tests).
- `packages/content/scripts/check-search.mts`: 50 checks, all pass.

**Check results (verified):** rights over 19 synthetic fixture rows inserted in a ROLLED-BACK transaction (stranger, owner/author, pseudonym, credited piece, org member/guide/owner, site keeper, admin, signed-out; org, site, mine, network scopes; includeHidden honoured only for keeper/admin); leftover fixtures 0. `contentReadSql` equals `threadReadSql` on all real threads for stranger/viewer/member/guide/owner across 11 orgs. Facet totals equal the paged item totals for stranger/guide/owner/admin in org and site scopes. Parity (old vs new, same keys, same fields except the new store/can/sale/hidden): `{ownerUserId, limit:200}` for test accounts house-editor-test and claude-center-1018c; `{orgId, limit:200}` for inner_group, oad, ifac, sunjay, market, amrit_canada as the guide test account and as a synthetic admin; paged `{orgId, limit:7, types:[writing], cursor}` for guide and stranger. Accounts used: synthetic rights, house-editor-test (guide of inner_group), claude-center-1018c@test.invalid. No other real account. Timing incl. hydration: p95 0.8-16 ms for 7 query shapes (target 150 ms). EXPLAIN: dev table is 264 rows so the default planner seq-scans (0.05-0.3 ms); with seq scans disabled it uses idx_content_index_{sort,org_sort,owner_sort,ident_sort,tsv,title_trgm,store_id}.

**Decisions and limits (read these):**
- Index holds raw status draft | published | archived. `scheduled`/`live` come from the owner's timeline at hydration, so asking for them filters as published in SQL; facets count raw statuses. Hidden-by-keeper rows are archived + hidden; `includeHidden` (keeper/admin only) also returns them whatever the status filter.
- artwork `org_id` = store.owner_org_id (NULL for personal stores); `site_org_id` = store.org_id ('market'). Site scope = site_org_id or org_id in [host.site.orgId, ...storeOrgIds], so personal market stores are covered (fixes the owner_org_id gap). Org scope also includes stores pinned via site_config shop:store, as list.ts did.
- Hydration re-reads the live row and re-checks readability for threads (a stale index row is reported in `missing`, never shown); `sale` and price are recomputed live for the page, filters and facets use the index.
- `listContent` now throws if `ownerUserId` is not the viewer (both callers pass the viewer). `searchContent` max limit is 100 by default, 200 only via `opts.maxLimit` (the wrapper); the route factory must cap at 100.
- Personal-page URLs still use ARTDIRECT_URL from host.ts (the ContentHost interface cannot express author slugs); org site URLs use `host.urls.siteHome(id) ?? org_domains`.
- `item.series` stays null (as before); `series_id` is indexed for `seriesId` filtering only.

**Write paths hooked (index call after the write, errors swallowed):** services `createThread`, `updatePost`, `deletePost` (posts.ts); forum `createTopic` (via createThread, plus min_role), `setTopicAudience`, `moderateThread` delete/move; `createMeeting`/`updateMeeting`/`deleteMeeting` (meetings.ts); meeting-content save (incl. kind change); site-post-content `savePostContent`; moderation review (publish/archive). Commerce `createArtwork`, `updateArtwork`, `setArtworkMedia`, `publishArtwork`, `adminHideArtwork`, `adminShowArtwork`, `archiveArtwork`, `setArtworkAvailability` (wrappers; the originals are now `*Raw`, exports unchanged), series `addSeriesLot`, `addListingToSeries`.

**NOT covered (index drifts until reconcile; assumed list from grep, not exhaustively traced):** services meeting-series.ts, series-form.ts, artist-offerings.ts, service-offerings.ts, profiles.ts (artwork); every app-local `INSERT/UPDATE threads` (arts-collective cms/actions, post-actions, draft-actions, share-actions; amrit-canada, elktours, hidden-enneagram, ifac, innergathering, sunjay, pigeonshoot, fourthwayBookreaders, admin); app-local artwork writes (danamccool artwork-actions, katie-the-potter manage/channel actions); commerce `syncArtworkStatus` (stock.ts, runs inside the order transaction, so a post-commit hook is needed at its callers) and auction lot start/end/pass transitions (sale_state in_auction/passed); series sessions changing a parent series' next_at.
**Recommendation (needs Justin's yes):** one more migration adding AFTER triggers on `threads` and `artwork` (and auction_lot) that re-run the index upsert inside a swallowing `EXCEPTION` block would close every gap above at once; until then run `content-reindex.mts --fix` (reconcile) nightly and after bulk imports.

**Open items:** (1) nightly reconcile is not scheduled (script ready: `content-reindex.mts --reconcile [--fix]`). (2) `server/list-legacy.ts` to delete in Step 7. (3) `server-only` not added (not a dependency; report only). (4) Files store (Step 5): columns exist, no indexer yet. (5) 263 still pending, not mine. (6) packages/content tsc shows errors only in `src/hub/*` (agent C's, missing `@elkdonis/hub/contract`), and channel `src/hub/*` likewise.

## 2026-11-26: Step 2 UI, agent B (the unified ContentLibrary; MediaLibrary folded in)

**Built.** `ContentLibrary` is now the one component; `MediaLibrary` is a thin wrapper over it. Nothing was built, deployed, committed or installed.

Files (all under `packages/content/src/`):
- new `ui/library/`: `bar.tsx` (SearchBox, ViewToggle, SegGroup, CountLine), `folder-nav.tsx` (history hook, PathBar, FolderChips), `upload.tsx` (useUpload, UploadButton, useDropZone), `file-tiles.tsx` (FileBrick, FileRow, FilePreview), `file-lightbox.tsx`, `file-model.ts` (file <-> ContentListItem, `MediaLibraryFile`), `file-utils.ts` (acceptsFile, kindOf, parseListing, ...), `FileBrowser.tsx` (MediaLibrary's body, moved), `use-remote-search.ts`, `badges.tsx`.
- changed: `ui/ContentLibrary.tsx`, `ui/MediaLibrary.tsx` (706 lines to about 110), `ui/PieceLightbox.tsx`, `ui/PieceRow.tsx` (additive: `mode`/`selected`, badges), `ui/index.ts` (additive exports), `content.css` (appended block).
- harness (`scripts/channel-harness/`, new files only): `library.tsx`, `library-data.ts`, `library-mock.ts`, `library-pages.json`, `build-library.mjs`, `shot-library.mjs`, `check-library.mjs`. Existing harness files untouched.

**New ContentLibrary props** (names as CONTRACT §7/§10): `source` ({endpoint} | {search}), `scope`, `includeHidden`, `types`, `view`, `lockView`, `onViewChange`, `mode`, `value`, `picked`, `onPick`, `onToggle`, `folders` ({endpoint?, sources[] with optional per-source `endpoint`/`params`/`startPath`}), `accept`, `upload`, `onUploaded`, `density`, `groupBy` (`groupBySite` kept as alias), `onOpen` (true skips the lightbox), `railSlot`, `itemActions` (§10.9, secondary lightbox actions after `primaryAction`), `rememberAs`, `initialSource`, `emptyText`. `items`, `identities`, `timeZone` became optional (remote mode). Item display: sale state and price badge, "Hidden" badge (shown only when the item carries `hidden`; never inferred).

**Verified (run in throwaway containers, headless Chrome):**
- Back-compat: 16 existing pages x 3 widths (1280, 900, 390) = 48 DOM dumps identical before and after (`library`, `lightbox`, `content`, `content-list`, `content-lightbox`, `content-empty`, `lightbox-piece`, `popup`, `popup-lightbox`, plus the 7 media fixtures). PNGs: 47 of 48 byte-identical; `content-1280.png` differs, but it also differed between two runs of the untouched baseline (renderer noise), and its DOM is identical.
- MediaLibrary wrapper: the DOM of all 7 MediaLibrary fixtures (browse, pick, pickMany, list, lightbox, flat endpoint, 403 error) at 3 widths is byte-identical to the old component, so there are no visible differences. Values reported to `onPick`/`onToggle`/`onUploaded`/`fileAction` are mapped back to the same `MediaLibraryFile` shape (a dropped tile still reports no `mimeType`/`size`). `media-field.tsx` unchanged and type-clean. Not exercised: the real elktours routes signed in (assumed fine; needs a test-account check by the media lane).
- New pages (3 widths each, no page errors, no horizontal overflow at 390): remote, remote-dark, remote-fn, remote-all, remote-files, remote-error, remote-missing, files-folders, files-toggle, pick, pickmany, files-pick, files-pickmany, compact, groupby-store, groupby-store-list, badges, lightbox-extras, onopen. Screenshots on eris in `/tmp/agentB/new/png/` (baseline `/tmp/agentB/base/png/`, after `/tmp/agentB/after/png/`); rebuild: `scripts/channel-harness/build-library.mjs` and `shot-library.mjs`.
- `check-library.mjs`, 25 of 25 checks pass: Tab order starts at search; Enter opens the lightbox and focus moves into it; background inert; Escape closes and focus returns to the same brick; onOpen(true) skips it; debounce sends one request; stale slow answer does not overwrite a newer one (AbortSignal); Show more appends; error with "Try again"; `missing` shown; pick and pickMany toggle with aria-pressed; files pick reports source and path; folder chip, Up and Back.
- tsc: `packages/content`, `packages/channel`, `apps/elktours`, `apps/arts-collective` show no errors from this work. Remaining errors are all in `hub/*` and `channel/src/hub/*`: TS2307 for `@elkdonis/hub/*` plus implicit-any errors that follow from it. `hub/card.tsx` raises no error about its ContentLibrary props (`source` function form, `view`, `groupBy`, `folders`, `density`).

**Assumed / unknown.**
- `groupBy="store"` groups by `siteIdentityId`/`siteName` (same key as "site", with no host line), because `ContentListItem` has no store id or name. The server mapping must put the store there for artwork, or the PM should add a `store?: {id,name}` field to model.ts. Open item.
- The scope toggle maps an identity `org:<id>` to `{kind:"org"}` and a user identity to `{kind:"mine"}`; the base scope is the `scope` prop (default mine).
- `can.pick === false` makes a pick-mode click do nothing (no disabled styling yet).
- Count line stays `role="status"` (an implicit polite live region). Adding `aria-live` would have changed the existing DOM.
- A `{search}` source is keyed as "fn": changing the function does not refetch by itself; change the library's React `key` or the query.
- Compact density: one column of rows, selects for kind and status, no view toggle or sort. Judged on one 340 px screenshot only.
- The file `key` for a listed file is `file:<source>:<path>` (no index id until Step 5).
- Visual differences: none for MediaLibrary. New: badges, Published|Files|All seg, sale and store filters appear only when their data or props exist.

**Open items.** Real signed-in elktours check; `store` info on the item (above); disabled styling for `can.pick=false`; MediaLibrary stays until Step 7.
- 2026-11-26 (agent A): searchContent fills ContentListItem.storefront {id,name} for artwork from content_index store_id + store.display_name (threads omit it); check-search excludes it from parity and asserts it for public artwork.
- 2026-11-26 agent B follow-up: groupBy="store" now groups by item.storefront (id, name; items without one fall back to the site group), pick-mode items with can.pick === false get aria-disabled and a dimmed .is-disabled style (additive; verified: groupby-store and pick pages re-shot, 25/25 checks, 48/48 existing DOM dumps still identical, tsc content clean outside hub/*).

## 2026-11-26 evening: PM status after agents A, B and C (session system32-43)

- **Steps 1 and 2 are done in source; nothing is built or deployed.**
  - Step 1: migration 293 was applied alone, the backfill indexed 198 threads and 66 artworks, and check-search passes 51 of 51.
  - Step 2: ContentLibrary is now the one library, file browser and picker; MediaLibrary is a wrapper; 48 of 48 DOM-identical checks and 25 of 25 behaviour checks pass. The Step 4 pieces (HubCardMount, contentCard, channelCard) and MOUNTING.md are written.
  - The contract grew to v1.1 (§10.1–10.10).
- **Verified by the PM:** tsc on content, channel, studio, hub and commerce. Every error is in the new `hub/*` files, and all of them come from `@elkdonis/hub` not yet being a dependency of content and channel (TS2307 plus the implicit-any errors it causes). Studio, hub and commerce are clean. I also reviewed the index hooks: they run after the write, never throw, and use no open transaction.
- **Open:**
  - Add `@elkdonis/hub` as a dependency of content and channel (optionally also `server-only`), and run one install. Planned with the Step 3 wiring.
  - Justin: should triggers feed a queue table so app-local, order and auction writes never leave the index stale?
  - Justin: a snapshot commit and a new day branch.
  - Elktours' media field signed in with a test account (media lane).
  - Sunjay's Channel card switch waits on a side-by-side render.
  - Gate reading for the `mine` scope: "signed in" (C's reading).
- 2026-11-26 (C, v1.2): query-string and routes handle scope person:<id> (signed-out: network/person only; no scope = network), preset may use it, MOUNTING.md has Public reuse. Written against the contract (person not yet in search-types.ts, CONTRACT 11 not yet on eris); not type-checked. (assumed)
- 2026-11-26 (C, v1.2): query-string and routes handle scope person:<id> (signed-out: network/person only; no scope = network), preset may use it, MOUNTING.md has Public reuse. Written against the contract (person not yet in search-types.ts, CONTRACT 11 not yet on eris); not type-checked. (assumed)
- 2026-11-26 agent B (CONTRACT §11.3-4): added pickPart ("item" | "image"; image shows item.images, cover first, as thumbs in the lightbox and calls onPick(item, { image })), onPick second arg, and an attribution line ("ownerName · siteName", ownerName read if the server sends it, else the site) on others' pieces in pick modes; harness pages pick-image, pick-attribution; 25/25 checks, 48/48 existing DOM identical. tsc content: only error outside hub/* is query-string.ts(39) (person scope not yet in search-types, not mine).

## 2026-11-26: Step 1 round 2, contract v1.2 (agent A)

- **Migration 294_content_index_queue.sql** applied ALONE (same recipe; `--status` only 263 pending, `--verify` 0 drifted). Table `content_index_queue(key PK, queued_at)`; AFTER INSERT/DELETE and column-limited AFTER UPDATE triggers on threads, artwork, auction_lot (lot to its artwork). Deviation from the letter of s12: re-enqueue is `ON CONFLICT DO UPDATE SET queued_at = clock_timestamp()` (not DO NOTHING), so a change landing while a key is being re-indexed is not lost; the drain deletes a key only if its queued_at is unchanged (compared as text: postgres.js rounds timestamptz parameters to ms, which kept rows queued until fixed). artwork_variant (price) has no trigger; `updateArtwork`/`createArtwork` hooks cover it. verified.
- `drainContentQueue({limit|all})` in services content-index.ts; `searchContent` and `resolveContentRefs` drain 25 first; `content-reindex.mts` drains all. A raw UPDATE and DELETE on a thread row are reflected by the next search with no hook (check-search, live fixture thread in org `development`, removed afterwards; queue empty after). verified.
- Person scope `{kind:"person", userId}` (search-types, contentReadSql, searchContent; open to signed-out; own userId normalises to `mine`). `listContent({ownerUserId: other})` now returns it instead of throwing. Network scope = every published PUBLIC non-hidden row; its facet total equals the published PUBLIC rows in the source tables. `can.pick` = signed-in and (own, or published PUBLIC and not hidden); false signed-out and on others' drafts. `images` filled (thread: cover + attached public image media, excluding /Private/ and /workshops/ paths; artwork: artwork_media by position, cover first). `ownerName` = the author identity's own display_name (threads: author_id is the identity; artwork: credited identity, else metadata.artistName, else the artist, else the store), never the account behind a pseudonym.
- `resolveContentRefs(viewer, keys[], host)` exported from `@elkdonis/content/server`: one indexed query (`contentReadSql` with null scope = rights only), then hydration; returns `{results, missing}` with `{key, gone:true}` for unpublished, hidden, deleted, unreadable, unknown or malformed keys, in input order.
- check-search: 66 pass, 0 fail (rights incl. person scope and refs predicate in the rolled-back transaction; live fixtures for the queue, refs and a synthetic pseudonym user, all deleted and verified). No pseudonym exists on dev, hence the fixture.

## 2026-11-26 late: PM verification after round 2 (v1.2 and §12)

- **tsc (PM, throwaway containers):** commerce, studio and hub are clean.
  - content and channel: errors only in the new `hub/*` files, all caused by the missing `@elkdonis/hub` dependency edge (verified).
  - services: only errors that were already there (`social-feeds.ts`, utils `sanitize*`, nextcloud `CalendarEmbed`), none in cornerstone files (verified).
- **DB (eac-postgres, elkdonis_dev):** `content_index` holds 66 artwork and 198 thread rows. There are 3 triggers each on artwork, auction_lot and threads. `content_index_queue` holds 16 thread keys, queued within 3 s at 23:58:46 UTC by a write outside the hooks (source unknown). That shows the triggers fire. They drain on the next search or reindex; nothing searches yet because no host is mounted (verified).
- **Live fixtures:** agent A's queue, refs and pseudonym checks briefly created a thread in org `development` and a synthetic pseudonym. Both were deleted and verified gone (A's report; assumed).
- **Next:** Step 3 (art-auction). It needs one install (the `@elkdonis/hub` edge for content and channel, plus art-auction's deps), then a build and deploy with Justin's go.
