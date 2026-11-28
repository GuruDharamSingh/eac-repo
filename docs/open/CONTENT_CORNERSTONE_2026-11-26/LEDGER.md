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

## 2026-11-26 night: Step 3 wiring, art-auction (agent D)

Nothing built, restarted, committed or pushed. tsc (throwaway containers) is clean for apps/art-auction, packages/content and packages/hub (verified). Nothing has run in a browser (unknown).

**Created (apps/art-auction/src):** `lib/content-host.ts` (contentHost: viewer from getCurrentUserId; site market / Collect Art / America/Toronto / storeOrgIds [market]; urls.piece artwork to /artworks/<id>, threads null; urls.studio artwork to /studio/artworks/<id>/edit; actions artwork-hide, artwork-show; fileSources per CONTRACT 10.8: mine = userStorageRoot(getStorageSlug) with showPrivate, plus org:<id> per org-owned store the person acts for AND holds a role in, showPrivate false; uses listStoresForUser(v.userId), the function listActableStores wraps, so it never depends on the session), `lib/hub-site.ts` (hubSite, getHubCardViewer: keepers get role owner, isNetworkAdmin from users.is_admin), `lib/content-cards.ts` (artworksServer, libraryServer, CONTENT_SERVERS), `app/hub/actions.ts` (runHubAction: requireKeeper, only artwork-hide/artwork-show, market org, revalidates), `components/hub/cards.tsx` (ContentCardMount, ContentDetail; imports hub-cards.css and content.css; links.hubBase /admin), `components/center/my-work.tsx` (client; imports content.css), `app/center/page.tsx`, `app/admin/content/page.tsx` (requireKeeper in the page; no ?preset= shows both cards; ?preset=artworks|library shows that full library), `app/api/content/{search,folders,upload}/route.ts` (force-dynamic).
**Changed:** `next.config.ts` (+@elkdonis/cms-ui, content, hub), `app/admin/layout.tsx` (Content tab; keepers now see Stores, Artworks, Content), `packages/content/package.json` (+ "./host" export; MOUNTING imports @elkdonis/content/host but it was not exported), `packages/content/src/hub/{card.tsx,model.ts,server.ts}` (additive: preset.includeHidden; itemActions from data.actions + item.can.hide / item.hidden calling host.act({artworkId}), then the library remounts to refetch and host.refresh; with empty actions nothing changes; ContentLibrary gets includeHidden and itemActions).
CSS is imported from the client files that use it, so public pages are untouched; globals.css not edited.

**Verified by reading:** searchContent/hydrate set can.hide for keepers on non-draft artwork and send `hidden` to keepers only; includeHidden is honoured only for keeper/admin (access.ts). Show is offered on `item.hidden === true` (not on can.hide), so it does not depend on the status of a hidden row.
**Assumed:** the Hidden badge and Show button render in the lightbox as built; the org role check (user_organizations) matches "holds a role"; `organizations.name` exists (used in artist-space.ts too).
**Knowns:** (1) ContentLibrary runs the folder browser only when NOT remote (ContentLibrary.tsx line 226), so in remote mode its Files view reads the index (no files until Step 5). /center works around it: my-work.tsx drops `source` while view is Files, so Files browses folders and Published/All are remote. The hub card passes folders with a source, so its Files view will show the index (empty), not folders; agent B/C should decide. (2) Thread pieces have no studio link on the market (urls.studio null); their lead action is "Open" with the server link. (3) Upload route answers 501. (4) Show/Hide failure shows window.alert with the server error (an open order blocks Hide).

**PM: after the build, check** (test accounts only, never a real person)
- Signed out: GET /center redirects to /login?next=/center; /admin/content redirects to /login; /api/content/search?scope=mine answers 401; ?scope=network answers 200 with public published items only; /api/content/folders answers 401. Public pages (/, /artworks/<id>, /studio) unchanged.
- Seller (a test account with an active store): /center shows "My work" with their artworks, Published | Files | All; open an artwork, lead button "Edit" goes to /studio/artworks/<id>/edit; Files shows "My files" folders (and an org root only for an org-owned store with a role); another person pieces never appear; /admin/content redirects to / .
- Keeper (test account that is owner of org market, not admin; and one admin): /admin shows the Content tab (keeper sees Stores, Artworks, Content); /admin/content shows two cards, Artworks (with count) and Content library; open Artworks, group by store, a hidden piece shows Hidden and "Show on the site"; open a visible artwork, "Hide from the site" then it shows Hidden; check /artworks/<id> 404s for a stranger while hidden and returns after Show; the card Open page link goes to /admin/content?preset=artworks. Hide on a piece with an open order shows the error.
- Stranger (signed in, no store, not keeper): /center works (empty or their credited pieces); /admin and /admin/content redirect to /.

## 2026-11-26 night: Step 3 signed-in verification (agent E, BUILD_ID PKZjPuX_-0bGWkONrnB79)

Test accounts only (seller, keeper = owner of org market not admin, stranger; all @test.invalid), all deleted afterwards; nothing built, restarted or edited. Hide/Show was driven through the real card button in headless Chrome (zenika/alpine-chrome, removed after), i.e. runHubAction on the live app, on the test artwork only.

- API mine: seller sees exactly their 2 pieces (draft included), can.edit true, no one else (verified). Stranger mine empty (verified). Signed-out mine 401 (verified).
- API network/person: stranger network has the published test piece, not the draft; person:<seller> returns only the published piece (verified).
- API site: keeper sees both pieces, storefront set, can.hide true on the published one (verified). NOTE the query param is `hidden=1`, not `includeHidden=1` (query-string.ts); with `includeHidden=1` hidden rows are not returned. Seller scope=site answers 200 with published rows plus their own draft, no one elses drafts; stranger site is published only (verified).
- API folders: source=mine 200 empty; no source, `..`, a/../b, org:market for a non-member, Private under org source: all 404 (verified). source=mine&path=Private 200 (own Private, by design).
- Pages: /center seller 200 with "My work" (verified). /admin/content keeper 200, two cards Artworks and Content library; seller and stranger 307 to / (verified). Keeper layout shows Stores, Artworks, Content tabs (verified); keeper /admin itself redirects to / (admin-only overview; unchanged behaviour, unknown whether intended).
- Hide then Show: after Hide, DB status archived, stranger and seller /artworks/<id> 404, network search omits it, keeper (hidden=1) shows hidden true with can.hide true; after Show all three restored and /artworks 200 (verified). No alert on either click.
- Chrome render at 1280 and 390: no page errors, no horizontal page overflow; popup opens with the Hide/Show button in the lightbox (verified). Screenshots in /tmp/agentE/ on eris.
- Freshness: content_index rows existed for both pieces right after createArtwork/publishArtwork, and after Hide/Show (verified).
- Findings (not fixed): (1) "Not everything was read: publish_jobs, plan." shows in red on /center and in every card popup because hydrate.ts/list-legacy.ts hard-code `missing`. (2) Artworks card (types=[artwork]) headline "17 pieces, 15 artwork 1 writing 1 product" and the Kind filter offers Writing: facets ignore the types filter. (3) Store filter and facet names fall back to the raw store id for stores with no store.display_name (6 of 8 stores on dev). groupBy store renders as a Store select with counts, not group headings in the list. (4) After a keeper Hide the owner loses the piece from scope=mine/My work (status archived is excluded). (5) Hidden lightbox shows a "Draft listing / not listed" row. (6) hc-popup has 6px inner horizontal overflow (1029 vs 1023) and shows a horizontal scrollbar.
- Cleanup: artwork_media, artwork_variant, artworks, store, content_index, content_index_queue (drain had re-queued the 2 keys), org_profiles (market row created for the keeper), user_organizations, users, GoTrue users, Chrome container; table counts back to baseline; a scan of every id-like column finds zero rows (verified). content_index_queue went 16 to 0 because searches drain it (not mine).

## 2026-11-26: Step 1 fixes from the live market check (agent A)

- `missing` now lists only real failed or absent reads. The by-design lines (publish_jobs and plan not read; owner-only sources not read for this viewer) moved to the new optional `ContentSearchResult.notes`. `list-legacy.ts` (parity reference, Step 7) still has the old hard-coded strings; `listContent` no longer does.
- Facets apply every hard filter of the query (types, statuses, storeIds, saleStates, seriesId, q), so they sit inside the selection. types [artwork] gives only artwork.
- Store name chain for `facets.stores` and `item.storefront.name`: store.display_name, then the owner's display name, then the owner org's name, then "Store" (the store table has no name or slug column). Never a uuid.
- `mine` (and `person` when it is the viewer) now includes the owner's own keeper-hidden pieces, flagged `hidden: true`; the owner gets `hidden` on their own items. Others never see hidden rows; an owner's ordinary archived pieces stay excluded unless asked for.
- check-search: 70 pass, 0 fail (new: facets inside selection and narrowed by storeIds, readable store names, owner sees own hidden piece in mine facets while a stranger's person scope does not, hidden never leaks to others, notes vs missing).
- 2026-11-26 agent B (market live check): (a) groupBy="store" headings now carry a count; the remote harness (remote-groupby-store, -list) draws them, so a live popup with no headings means the mount passes no groupBy (card.tsx uses preset.groupBy) or items carry no storefront. (b) hidden item: lightbox shows "Hidden from the site" in place of the timeline plus the Hidden badge; rows show a Hidden chip; bricks already had the badge (page hidden-owner). (c) 6px popup overflow could NOT be reproduced in a popup-overflow harness page (scroll=client=1023); defensive fix in content.css: .eac-c-lib { min-width:0; max-width:100%; overflow-x: clip } so the library cannot widen its host; unverified live, if it persists the cause is outside the library (hub-cards.css untouched). (d) missing already renders only when non-empty. 25/25 checks, existing pages DOM-identical, tsc content and hub clean.

## 2026-11-26 night: PM status, Step 3 live, fixes waiting on a shared build

- **Gates Justin approved and I ran:**
  - Snapshot commit `7d93fe2e` on `work/2026-11-16`, after a secret scan that found nothing. New branch `work/2026-11-26`. Not pushed.
  - One install: `@elkdonis/hub` added to content and channel, and content and hub added to art-auction. The lockfile gained 12 lines.
  - Art-auction build `PKZjPuX_-0bGWkONrnB79`. The backup is `~/eac-backups/next/art-auction-20261126-1915.tgz` and the log is `art-auction-build-20261126.log`.
- **Step 3 is live.** It serves `/center` ("My work"), `/admin/content` (keeper cards Artworks and Content library, with Hide/Show) and `/api/content/{search,folders,upload}`. The signed-out checks and agent E's signed-in checks passed, and the test data was removed (verified).
- **Six issues from E are fixed in source** (A: missing/notes, facets, store names, owner's hidden pieces; B: remote store headings, hidden status, popup overflow guard). check-search passes 70 of 70, check-library 25 of 25, and the 48 existing pages are still DOM-identical. tsc is clean on content, hub and art-auction (verified by the PM).
  - **Not live yet.** They need an art-auction rebuild.
- **Build coordination.** The market lane (session "Market arts-collective /center page redesign") took over `apps/art-auction/src/app/center/**` at Justin's request and is moving My work to `/center/work`. I hold the rebuild until they say center/** is safe to ship, or until their own build, which Justin approves, carries these fixes. After that build: a signed-in re-check of the six fixes with fresh test accounts.
- **Next steps in the plan:**
  - Step 4: switch Sunjay to the lifted Channel card after a render comparison; a market Channel loader.
  - Step 5: files in the index, with the media lane.
  - Step 6: the Puck picker, the MCP `content.search` tool, the network-search tab and the /center section type.
  - Step 7: retire the copies, and drop `list-legacy.ts`.
  - Registry entries `artwork-hide`/`artwork-show`. Today they are app-level dispatch in `runHubAction`.

## 2026-11-26 night: Step 3 re-check (agent E, BUILD_ID Rq-HLEaBo7nvgpDg3mCEn)

Fresh test accounts (seller with a store whose display_name is NULL, keeper = market owner, stranger), all deleted with zero rows remaining. Screenshots: /tmp/agentE2/. Hide and Show done by real lightbox clicks in headless Chrome.
- (1) PASS: no "Not everything was read" on /center, /center/work, or the Artworks popup; API missing is [], notes has one entry. /center 200 for all three accounts, /center/work 200.
- (2) PASS: scope=site&types=artwork facets.types = {artwork: 34}; Artworks card "15 artwork"; Kind filter Artwork only. (The Content library card still shows "1 writing, 1 product", correct, it has no type filter.)
- (3) PASS: no UUID names in facets.stores, item.storefront.name or popup; the NULL-display-name store shows the owner name (agente2-seller-test).
- (4) PASS: after Hide, seller /center/work and scope=mine show the piece with hidden:true and a Hidden chip, lightbox says "Hidden from the site" (seller and keeper); stranger network and person omit it, /artworks/<id> 404; keeper search hidden:true. After Show: published, /artworks 200, network and person include it.
- (5) FAIL: the Artworks popup shows a Store select with counts, but the list has no store group headings (flat list ordered by date) at 1280 and 390.
- (6) FAIL: .hc-popup still overflows horizontally: scrollWidth 1029 vs clientWidth 1023 at 1280, 362 vs 356 at 390; the horizontal scrollbar shows in the screenshot.
- Cleanup: artwork_media, variants, artworks, store, content_index, queue, org_profiles (keeper market row), user_organizations, users, GoTrue users, Chrome container; counts back to baseline, id scan 0 rows.

## 2026-11-26 night: Step 6 faces (agent G): registry Hide/Show, MCP content tools, `piece` picker source

Nothing built, restarted, committed, pushed, installed or migrated; no `apps/**`, `packages/content/src/{model.ts,ui,server}` touched. tsc (throwaway containers) is clean for actions, mcp, page-builder, direct-edit and content (verified, last run after all edits).

### 1. Registry entries `artwork-hide` and `artwork-show` (packages/actions)
- **Changed:** `src/catalogue.ts` (two entries after `thread-pin`: scope `org`, area `market`, `runnable` true, `derived` false, with `performs`), `src/present.ts` (both: `{ kind: 'none' }`, offered beside the piece), `src/server/run.ts` (helper `orgKeeper`, two runners with `input: { artworkId }`). `src/agent.ts` has NO row for them: agent exposure is deny (doctrine rule 6; verified: `agentExposure` is null for both because default is deny, and neither is in `AGENT_EXPOSURE`).
- **Rule (`orgKeeper`):** the door must be 'app' (a keeper's hide is public and human-only; HTTP and agent doors refused), `ctx.orgId` set by the host, and the actor is an owner of that org (`user_organizations.role = 'owner'`) or `users.is_admin`. Guides are refused (stricter than `orgEditor`; same as `isMarketKeeper`). The runners call commerce `adminHideArtwork(artworkId, userId, orgId)` / `adminShowArtwork(artworkId, orgId)` (which re-index content_index and hold the status rules; the SQL is `org_id = ctx.orgId`, so an artwork of another org cannot be touched). A commerce error comes back as `{ ok: false, error }`, same words as today.
- **Counts:** `check:registry` before: 51 entries, 34 runners, 29 checks, consistent. After: 53 entries, 36 runners, 29 checks, consistent (verified). Its warning line "person-facing entries still lack an address, confirm or risk" went 24 to 26 (the two new ones; not curated in atlas/entries.ts on purpose: no dock address, they are not dock steps). `atlas:check` before: 7 errors; after: 7 errors, the same seven ("claimed key not in inventory" for the commerce `createArtwork`, `updateArtwork`, `publishArtwork`, `archiveArtwork`, `setArtworkAvailability`, `adminHideArtwork`, `adminShowArtwork`; the inventory scanner does not see the `(...args: Parameters<...>)` wrappers added for the content_index hook; not mine, not fixed). `atlas:emit` not needed (atlas/entries.ts unchanged, so registry-data.ts is not stale).
- **Not run end to end:** the runners were not performed against a real artwork (assumed correct by reading and by the commerce functions being the ones art-auction already calls).
- **How art-auction's `runHubAction` switches later (needs a rebuild; NOT done):** in `apps/art-auction/src/app/hub/actions.ts`, keep `requireKeeper()` and the id allow-list, then replace the two `adminHide/ShowArtwork` calls with
  `const r = await performAction(id, { userId, email, orgId: siteConfig.marketplaceOrgId, via: 'app' }, { artworkId });` (from `@elkdonis/actions/server`) and return `r.ok ? { ok: true as const, value: null } : { ok: false as const, error: r.error }`. `email` comes from the session user (`getCurrentUser`) or an empty string. This adds the registry's `action_events` audit row and the keeper check inside the runner, so the page-level `requireKeeper` becomes belt and braces. `admin/actions.ts`'s `adminHideArtworkAction` / `adminShowArtworkAction` can switch the same way. Add `@elkdonis/actions` to art-auction's deps if it is not there (unknown: check package.json; installing is a separate gate).

### 2. MCP read tools `content.search` and `content.resolve` (packages/mcp)
- **New:** `src/server/content-tools.ts`. **Changed:** `src/server/tools.ts` (import + one `registerContentTools(server, ctx)` call), `src/server/types.ts` (`McpContent`, `McpContentItem`, `content?: McpContent` on `McpHostOptions`), `src/server/index.ts` (type exports). **New check:** `scripts/content-tools-check.mts`.
- **Why `content` is host-passed:** packages/mcp does not depend on `@elkdonis/content`, and adding the dependency is an install (not allowed). The host passes the two readers, as it passes `pages` and `drafts`. Without `content` the tools are NOT registered, so the existing 13-tool list and `scripts/test.mts` (which asserts exactly 13) are unchanged (assumed: test.mts not re-run; the harness passes no `content`).
- **Host wiring (a later change in `apps/arts-collective/src/app/api/mcp/route.ts`, needs its rebuild):** pass
  `content: { search: async (userId, q) => { const r = await searchContent(userId ? { userId } : null, q, host); return { items: r.items, nextCursor: r.nextCursor, missing: r.missing }; }, resolve: async (userId, keys) => resolveContentRefs(userId ? { userId } : null, keys, host) }`
  with `searchContent` / `resolveContentRefs` from `@elkdonis/content/server` and a `ContentHost` (arts-collective's; `defaultHost()` also works for org and network scopes). arts-collective must have `@elkdonis/content` as a dep (unknown whether it does).
- **`content.search` input:** `q`, `scope` ("org" default | "network"), `org`, `types` (max 8), `view` ("published" default | "all"), `limit` (1 to 20, default 10; a larger one is refused by the schema), `cursor`. **Lock:** org scope settles the org with `settleOrg` (bound key: only its org; unbound: an org the person owns or guides; a foreign claim refused; with neither, "Name the organisation"). Viewer is always the grant's person; `network` reads as nobody (null viewer), so it is public and published only, and a network call that names a foreign org on a bound key is refused too. **Output:** `scope`, `items[] { key, type, title, excerpt, status, site, owner, date, sale, link }`, `nextCursor`, `notRead`. Title, excerpt, site and owner are listed under `untrusted` with the standard notice; `link` goes through `platformHref` (host must be a platform host; `linkHosts` is the host's list). Audit row by `readTool` (action_events `mcp:content.search`, via 'mcp'; orgId is the settled org).
- **`content.resolve`:** `keys` (1 to 50, `thread:<id>` or `artwork:<id>`), optional `org`. Keys that the index says belong to the settled (or bound) org are read as the grant's person; all other keys are read as public (null viewer), so it cannot be used to peek at another org's drafts. Gone, hidden, unreadable and malformed keys come back as `{ key, gone: true }`. The org lookup reads `content_index.org_id` directly with the mcp package's own `db` (assumed the column name from search.ts's SELECT; the check ran it with an org set and a bound key).
- **Verified by `scripts/content-tools-check.mts`** (in-process handler, synthetic grants for the real owner of org market, in-memory audit sink so nothing was written to live `action_events`; the real searchContent over the dev DB, which drains content_index_queue like any search): 16 of 16 ok. tools/list shows both, read-only; bound `market` key: org search answers with scope `org:market` (1 item on dev: a thread titled "The Silent Launch"), items carry only the declared fields, untrusted fields named, notice present; network search returned 20 items, all `published`; a bound key naming another org (astromonarch) refused ("limited to another organisation"); an unbound key naming an org the person does not run refused; a network call naming a foreign org on a bound key refused; `content.resolve` naming a foreign org refused; org scope with no org on an unbound key told to name one; unknown scope refused; limit 99 not honoured; resolve returns a real key and marks a missing and a malformed key gone; 10 audit rows in memory with the grant id, person, settled org `market` and input on the ok row and codes on refusals. No row reached the live DB, so nothing to delete.
- **Unknown / not done:** the rate window is `heavy` (10 a minute, same as `whats_next`) because a search runs the queue drain; not tuned. `view: "all"` for an org returns drafts the person may read (they are untrusted text, fenced). No `content-passport` read (pass 2 detail not landed). No registry status entry with `agent: 'read'` for the dock: the plan asked for one, but a `read` entry needs a status check and content has no "done" state; left out on purpose, say if you want one.

### 3. Puck/canvas picker source `piece` (packages/page-builder)
- **LIAISON:** appended to `docs/open/LIAISON/HOUSE_EDITOR_PM.md` ("### [Content cornerstone, agent G (Step 6 faces)] 2026-11-26 20:05 ..."): no reply to the 18:10 post existed, so I went ahead on the smallest shape and said how to stop me. If the house-editor PM answers asking row H to wait or take another shape, the new file can be deleted and the two export lines removed; nothing else depends on it.
- **New:** `src/fields/content-source.ts`: `contentRecordSource({ endpoint, resolveEndpoint?, orgs?, network?, types?, limit?, fetch? })` returns a `RecordSourcesLike` that handles only `binds: "piece"`; `withContentSource(base, content)` composes it over any other sources (`piece` goes to content, the rest to `base`). **Changed:** `src/index.ts`: two export lines (value + type). No existing field, `recordSourcesFrom`, `record-fields.tsx`, `site-sources.ts` or direct-edit file changed.
- **Behaviour:** "From what?" lists Your work (`scope=mine`), each org in `orgs` (`scope=org:<id>`), and Whole network (`scope=network`); choices are `GET <endpoint>?scope=..&view=published&limit=60` (cookie, same origin), value = the content key, label = title, hint = type, site and (if not published) status. A source ref the list did not offer is never turned into a scope. `resolve` returns the listed piece, else asks `resolveEndpoint` (`?keys=`, expecting `{ results }` as resolveContentRefs; no such route exists yet) and else falls back to `{ item: { key, title: key } }`; `describe` falls back to the key. Verified: a fake-fetch script (handles, sources, choices, refused source, resolve seen/unknown, describe) ran as expected, and the result type-checks as direct-edit's `RecordSources` (assignment in a temporary file, removed).
- **Three lines an app adds (not done by me):**
  1. `import { contentRecordSource, withContentSource, recordSourcesFrom } from "@elkdonis/page-builder";`
  2. `const records = withContentSource(recordSourcesFrom(sources), contentRecordSource({ endpoint: "/api/content/search", orgs: [{ id: "market", name: "The Collective Market" }] }));` (pass this as direct-edit's `records` option; the app must serve `/api/content/search`, as art-auction already does)
  3. A block setting declares `binds: "piece"` (its value is a content key; the block renders it with `resolveContentRefs`).
- **Open (needs a decision, not built):** (a) the drawer filters the loaded list client-side only, so with more than 60 pieces a person cannot reach the rest; a server-side search needs an optional `search?(binds, source, q)` on direct-edit's `RecordSources` and one change in `mountRecordChooser` (shared editor code; I did not touch it). (b) The plan's compact `density` for Puck's side panel is not built: the drawer rows are already one line each; not seen in Puck's panel (unknown). (c) A Puck custom field for `binds: "piece"` in `record-fields.tsx` (the Puck side of row H) is not added; apps that mount the canvas drawer in Puck (`person-picker.tsx`) get it by passing `records`.
- **Not seen in a browser** (unknown); nothing is wired in any app.

## 2026-11-26 night: Step 5 files (agent F)

Nothing built, restarted, committed or pushed; `apps/**` untouched. No migration: migration 293 already had the file columns (file_source, file_path, file_mime, file_size, file_folder) and store 'file'.

- **Key:** `file:<Nextcloud file id>`. `dav.ts` PROPFIND now also asks `oc:fileid` and `getetag` (additive `DavEntry.fileId`, `etag`); the id is stable across moves, so a move updates the same row. A `p<sha1 of path>` id is the fallback when a listing has no file id. (verified: all 1859 rows got numeric ids)
- **Not in `media`.** Files go straight into `content_index`; only the existing `registerLibraryItem` still writes `media` for site/forum uploads, as before.
- **Indexer** (`services/content-index.ts`): `indexFilesUnder(root, {principal, limit})` (one Depth-infinity listing, skips rows whose id, path, size and modified time match, removes rows whose file is gone unless the listing was empty or capped), `indexFilePath(path)` (one folder listing, for uploads), `classifyFilePath`, `fileIndexId`. Listings only, never bytes. Exported from `@elkdonis/services`.
- **Rights mapping** (columns from the path; `contentReadSql` file clause in `access.ts`; at least as strict as `canReadMedia`):
  - `users/<folder>/..`: owner_user_id = the account with that storage_folder (folders no account claims are skipped); org_id null.
  - `<org>/..`: org_id = site_org_id = org.
  - A `Private` segment: visibility PRIVATE. Read by the owner; org affiliates (non-viewer role, or org_profiles without a viewer membership: new `ContentRights.affiliateOrgIds`, optional) for org files; people who share a non-`oad` org with the owner for personal files.
  - `<org>/workshops/<id>/..`: visibility WORKSHOP, readable only by owners/guides of the org (stricter than canReadMedia, which also admits enrolled people; assumed acceptable).
  - Everything else PUBLIC (network scope, signed-out, person scope).
  - Admin sees all. A site keeper has no extra file right beyond being an affiliate.
- **Hydration** (`hydrate.ts`): `file {source, path, mime, size, folder}`, cover and images for images, ownerName, `can.pick` (owner always, others public only), `can.edit` for owner/org manager/keeper; hide/publish/archive false. `source` is the viewer's own fileSources key when the file sits under one of their roots (path relative), else "network" with the full path.
- **Upload route** (`routes.ts`): `contentRoutes(host).upload` implemented through `storeUpload`: `source` defaults to "mine" (must equal the viewer's own `userStorageRoot`); `org:<id>` needs the source in `host.fileSources` and owner/guide of that org; then `indexFilePath`; answers `{url, name, path (relative), source, key}`. Folder chosen from the file's family; storeUpload still sniffs. (not exercised against Nextcloud: unknown)
- **Seam:** `registerLibraryItem` now calls `indexFilePath(item.path)` in a `finally` (never throws).
- **Reindex** `packages/content/scripts/content-files-reindex.mts` (`--user`, `--org`, `--all`, `--limit`). Ran `--all --limit 3000` on dev: 130 roots (100 accounts, 30 orgs), 1862 listed, 1859 rows, 12.5 s; types: 1549 images, 83 video, 11 audio, 156 documents, 60 other. Second run on a root: 0 upserts. (verified)
- **check-files.mts:** 19 pass (synthetic rows in a rolled-back transaction for every role, real private and public file by name, stranger never sees private, classify agrees with parseMediaPath, incremental no-op). check-search: 70 pass (one assertion now excludes store 'file' from the published-view count). tsc clean for services, content, commerce outside the known unrelated errors (verified).
- **Unknown/assumed:** the sharing rule (people sharing an org with the owner see personal Private files) is verified by reading only, no synthetic users with memberships; `serveMedia` is untouched and still gates bytes; upload route not run end to end; no scheduled reconcile job exists yet (run the script, or wire it to cron). A moved or deleted file is reconciled only on the next reindex of its root. The UI was not touched.
- 2026-11-26 (agent F, CONTRACT s14): files left the network and person scopes (owner, org affiliates, keepers, admin only); can.pick on files is owner and org affiliates; the share-an-org rule for personal Private files is dropped. check-files updated. (verified by check-files)

## 2026-11-26 night: Step 6 wiring (agent I)

Nothing built, restarted, installed, committed or migrated. No `apps/art-auction/**`, `packages/content/src/{model.ts,server,ui}` touched.

### 1. arts-collective MCP content (changed: `apps/arts-collective/src/app/api/mcp/route.ts`)
- Passes `content: McpContent` (type from `@elkdonis/mcp/server`; the file is `packages/mcp/src/server/types.ts`, not `src/types.ts`) backed by `searchContent` / `resolveContentRefs` and `defaultHost()`. The viewer is the userId the tools pass from the grant; no request parameter is read. `@elkdonis/content` was already a dependency and already in arts-collective `transpilePackages` (verified), so no config change. tsc clean for this file (verified). Not exercised through the live endpoint (unknown); needs an arts-collective rebuild to go live.
- `defaultHost()` org scope uses `site.orgId = "elkdonis"` and absolute market/directory piece links; fine for the assistant (assumed).

### 2. `resolve` in `contentRoutes` (changed: `packages/content/src/routes.ts`, `MOUNTING.md` §1)
- `GET ?keys=a,b,c`: 1 to 50 keys (400 on none or more than 50), viewer from `host.viewer(req)` (null = public rows only), `no-store`, returns `{ results, missing }` from `resolveContentRefs`. `ContentRoutes.resolve` is required in the interface (the only implementer is the factory). Not mounted anywhere.
- Verified in process (defaultHost, null viewer, dev DB, read only): two real public thread keys plus a bogus thread uuid returned 200, `no-store`, two items (titles) and `{ key, gone: true }`; 51 keys returned 400.

### 3. `content` section in the center
- Added `content` to `CenterSectionId` (`cms-ui/src/center/layout.ts`), `SECTION_LABEL` (CenterPage), `CENTER_SECTION_IDS` (`services/src/center-layout.ts`) and the arrange label map (`services/src/org-site-routes-2.ts`, "Content library"). The two id lists agree (verified by reading). `CenterPage` has `contentSlot?: ReactNode`; the section renders `contentSlot ?? null`, so with no slot it is dropped from the flow. NOT in `DEFAULT_CENTER_LAYOUT`.
- **App opts in:** (a) pass `contentSlot={<ContentLibrary source={{ endpoint: "/api/content/search" }} scope={{ kind: "mine" }} ... />}` to `CenterPage` (the app must serve `/api/content/search`, MOUNTING.md §1; `ContentLibrary` is a client component, so build the slot where that is allowed); (b) put `"content"` in the org's stored layout columns (arrange surface, or network default row). Until both, nothing changes.
- CenterDesk uses a fallback width (340) for `content`; a wider one may suit a library (not done, unseen).

### Checks (throwaway containers)
tsc clean: packages/content, mcp, cms-ui, services (only the known sanitize/social-feeds/CalendarEmbed ones), apps/sunjay. arts-collective: only `nextcloud/FileUploader.tsx` and `nextcloud/talk.ts` errors, not from these files (assumed pre-existing; not compared to a baseline). Rebuilds needed: arts-collective (MCP), and any app that mounts resolve or the content slot, plus sunjay and every CenterPage app only when they opt in (shared cms-ui/services code changes ship with their next rebuild).

## 2026-11-26 Step 4 Channel card (agent H)

- **Sunjay (verified: tsc clean on sunjay and on packages/channel).** `components/hub/hub-card-host.tsx` gained `ChannelCardMount` (`HubCardMount` + `channelCard`, `act` = Sunjay's `runChannelAction` from `lib/channel-door.ts`, theme "industry"). `app/hub/page.tsx` renders it instead of `ChannelFace` (import swapped). Loader (`lib/hub-channel.ts`) and door unchanged. `ChannelFace.tsx`, `ChannelSurface.tsx`, the `channel` surface registration in `HubSurfaces.tsx` and `/api/hub/channel` are left on disk, now unused by the hub page (Step 7 removes them).
- **Package fix (verified):** `packages/channel/src/hub/card.tsx` `useRun` read `r.error` from a union that sunjay's non-strict tsconfig cannot narrow (TS2339). Now `(r as { error: string }).error`; strict package still clean.
- **Visual change on Sunjay (assumed, not compared):** the tile moves from SurfaceCard chrome to hub-card chrome (`hc-card`, hub "industry" theme), and the pop-up from a cms-ui surface frame to the hub `PopupShell` (one layer, no stack). The mini matrix inside is the same `ChannelHubFace`.
- **Art-auction (verified: tsc clean with a temporary path mapping, removed afterwards).** New `lib/market-channel.ts` (`siteChannelLoader({orgId:"market"})`, `loadMarketChannel`, `marketPlanProposals`; returns null unless the viewer is an owner/guide of `market`), new `lib/channel-door.ts` (`runChannelAction`: market-keeper gate, then `performSiteChannelAction` with `SITE_DOOR_ALLOW`), `components/hub/cards.tsx` (CSS imports for summary, channel site and hub; `ChannelCardMount`), `app/admin/content/page.tsx` (third card, keeper-gated by the page, hidden when the loader returns null or throws), `package.json` (+`@elkdonis/channel`), `next.config.ts` (+transpilePackages).
- **Install needed (verified):** one `pnpm install`. Until it runs, art-auction's own `tsc` reports TS2307 for `@elkdonis/channel/*` (the workspace link is missing).
- **Artwork pieces flow through the loader (verified):** `load.ts` lists `listStoreArtworks` for stores owned by or pinned to the org as `artwork` pieces. No package work was needed.
- **Limit (verified on real data):** with org `market` the loader sees stores where `store.owner_org_id = 'market'` or pinned by `shop:store`; the render check found 1 piece. Artworks of other stores are NOT in the market Channel. A market-wide view needs a loader option in `packages/channel/src/load.ts`; not forked here.
- **Keeper who is not a market member (verified by reading):** the loader falls back to personal scope, so `loadMarketChannel` returns null and no card shows; the door also refuses (`resolveChannelOrg` needs owner/guide in `market`). Platform admins who are not members of `market` therefore get no card (assumed: matches the intent, unknown whether Justin wants admin override).
- **Links (assumed):** the market has no `/channel` page, so "Open the Channel page" goes to `https://arts-collective.com/channel?org=market`; Edit goes to `/studio/artworks/<id>/edit`; no Make into. Detail page `/admin/content?preset=` is not wired for Channel (the pop-up's "Open page" goes to `/admin/channel`, which does not exist: unknown/open).
- **Render checks (verified):** `react-dom/server` render of `channelCard.Face` inside `HubRoot`, real DB loader data, throwaway containers. Sunjay (owner of org sunjay): counts waiting 1, failed 0, pieces 11, 6 matrix rows, 8350 chars of HTML. Art-auction (owner of org market): waiting 0, failed 0, pieces 1, 1 matrix row, 5591 chars. No throw. Temporary files (render-check.mts, tsconfig.render.json, render-stub.cjs, tsconfig.check.json) deleted. Not checked: the pop-up, writes, a browser.

## 2026-11-26 late night: PM status after Steps 4–6 (agents F, G, H, I)

- **In source (verified by the PM with one tsc sweep across 15 packages and apps, no new errors):**
  - Step 4: Channel card on Sunjay (hub tile switched to `channelCard`; old files unused) and on art-auction `/admin/content`, with the PM-added `/admin/channel` detail page.
  - Step 5: 1,859 files indexed, keyed `file:<oc:fileid>`. Raw files are excluded from the network and person scopes (§14). Upload is live via `storeUpload`.
  - Step 6:
    - registry `artwork-hide` and `artwork-show` (human only)
    - MCP `content.search` and `content.resolve`, wired in arts-collective
    - `contentRoutes().resolve`
    - the `piece` picker source in page-builder
    - the cms-ui `/center` section `content` (opt-in through `contentSlot`; not in the default layout)
- **Installs:** a second install added `@elkdonis/channel` to art-auction (lockfile +16 lines).
- **Re-check of Step 3 (Rq-HLEaBo):** 4 of 6 fixes passed. The other two (popup headings and 6px overflow) are fixed by the PM in source, pending a build.
- **Rebuilds pending:**
  - art-auction: the market lane's next build, which Justin approves; the market lane was told the tree is green.
  - Sunjay: the Channel tile changes look, so it needs Justin's go.
  - arts-collective: the MCP content tools; needs Justin's go.
- **Open:**
  - The market Channel lists only market-owned or pinned stores (1 piece). A market-wide view needs a loader option in `packages/channel`.
  - The scheduled file reindex is not set up.
  - Server-side search inside the direct-edit drawer (`RecordSources.search`, shared editor code).
  - Step 7 retirements, including `list-legacy.ts`, Sunjay's old Channel files, `/admin/artworks` and the `MediaLibrary` wrapper.

## 2026-11-26 ~20:40: rebuilds Justin approved, and the nightly reindex

- **Sunjay is live** as `V9iQccRLDZkDoy8b_JvUR`. The previous build `2_2SowBsPRhfrPBJn11it` is backed up at `~/eac-backups/next/sunjay-20261126-2027.tgz`. The hub's Channel tile is now the shared `channelCard`. Through the edge, `/` returns 200 and `/hub`, `/center` and `/channel` redirect to login; the logs have no errors (verified). Not seen signed in.
- **arts-collective is live** as `RJ9fPbJibPao9vQ0707se`. The previous build `-gr3_f5pvlofJEOGplyj9` is backed up at `~/eac-backups/next/arts-collective-20261126-2029.tgz`. It was built with the memory cap raised to 9g for the build and put back to 5g (verified). It carries the MCP `content.search` and `content.resolve` tools. Through the edge, `/` returns 200, `/api/mcp` GET returns 405, and the logs are clean (verified). The MCP tools have not been called live.
- **Nightly reindex:** `scripts/content-reindex-nightly.sh`, in guru's crontab at 03:40, logs to `~/eac-backups/content-reindex.log`. It runs `content-reindex.mts --reconcile --fix`, then `content-files-reindex.mts --all --limit 5000`, through `../db/node_modules/.bin/tsx` because packages/content has no tsx. A manual run passed: 130 roots, 1,862 listed, 0 upserted (verified).
- **ops.md drift:** the doc says `backup-db.sh` runs from guru's crontab, but that line is commented out there. Backups moved to root's TrueNAS cron on 2026-10-14. The docs should be updated; I did not change ops.md.
- **Step 7 (agent J) in progress:** the arts-collective Channel library moves to `ContentLibrary` remote mode, Sunjay's dead Channel glue goes, and `list-legacy.ts` is removed.

## 2026-11-26 Step 7 retirements (agent J)

Nothing built, restarted, installed, committed or migrated. No art-auction, elktours, MediaLibrary, studio/channel or content-row-actions files touched.

### 1. Channel library on ContentLibrary, remote mode (arts-collective)
- New: `src/lib/content-host.ts` (`defaultHost()` plus `viewer` from `getCurrentUser()`; the site is the default `elkdonis` network org), `src/app/api/content/{search,folders,resolve}/route.ts` (`contentRoutes(contentHost)`, force-dynamic). (verified: tsc)
- `components/channel/Library.tsx` rewritten: `ContentLibrary` with `source={{endpoint:"/api/content/search"}}`, scope `mine`, `identities={model.identities}` (scope toggle "All yours | You | each org"; orgs map to scope org), `groupBy="site"`, inside `SurfaceFrame`. Chooser kept: with `onPick` the title is "Choose a piece" and the lead is "Use this piece" (reports the key, then pops); otherwise the lead is "Manage this piece" and calls `openPiece(key)`. The `kind:` start key and the "Open now" tag are kept; the Content/People/Sites/Forum tabs go in as `header`. (verified by reading + tsc)
- Deleted `lib/channel/content-list.ts` (nothing else imported it; verified by grep).
- Assumed, not seen in a browser: the count line, status text and Escape handling are now the library's own; brick markup is the library's (`chn-bricks`, styled by channel.css). Unknown whether scope `mine` alone covers all org pieces in "All yours" (org pieces are reachable through the org toggles).
- `lib/channel/content-detail.ts` left in place (was imported by content-list; may now be unused: unknown, not removed).

### 2. Sunjay dead glue
- Deleted `components/hub/ChannelFace.tsx`, `ChannelSurface.tsx`, `app/api/hub/channel/route.ts`; removed the `channel` surface registration and import in `HubSurfaces.tsx`. grep of apps and packages (ts, tsx, mts, json) found `/api/hub/channel` only in those files and in comments (verified). Kept `lib/hub-channel.ts`, `lib/channel-model.ts`, `lib/channel-door.ts`. tsc clean on sunjay (verified).

### 3. Parity reference
- Deleted `packages/content/src/server/list-legacy.ts`; removed section D (the `parity()` function and its parity assertions) and the import from `check-search.mts`; fixed the comment in `list.ts`. Every other assertion kept. `check-search`: 55 passed, 0 failed (verified, dev DB). Unused `strip`/`canon` helpers remain in the script (harmless).

### Checks
- tsc clean: packages/content, packages/channel, apps/sunjay, apps/arts-collective (verified, throwaway containers; the known baseline errors did not appear this run).
- In-process handler (`contentRoutes` with a null-viewer host equal to the mounted one, because `getCurrentUser` needs Next request scope): `scope=network` gave 200, `no-store`, 3 items; signed-out `scope=mine` gave 401 (verified). The mounted route files were not hit over HTTP (unknown).

### Rebuilds needed
- arts-collective (new content routes, new Channel library; Justin's go). Sunjay: removed files only, no visible change beyond Step 4's tile change.
- 2026-11-26 (agent A): scope mine takes includeManagedOrgs (rows also where org_id is in the viewer's managed orgs, still under contentReadSql, facets follow); query string `scope=mine+orgs` ("mine orgs" also parsed). check-search asserts a guide sees another member's org draft under mine+orgs, not under mine.

## 2026-11-26 night: Step 3 light look (agent E, BUILD_ID IQlFvc03NaqDZVsg73hBb)
- PASS: /hub Artworks popup has store group headings with counts (H3 sections), Hide from the site present in the lightbox (not clicked), Channel popup renders with no exceptions, /hub/content?preset=artworks and /hub/channel 200 with detail, /admin/content 200. FAIL: .hc-popup still overflows (1029/1023 at 1280, 362/356 at 390).
- Screenshots /tmp/agentE3/. Test accounts, store, artwork, org_profiles all deleted; counts at baseline (105/140/12/66/264/112), id scan 0 rows.

- 2026-11-26 ~21:00 (PM): the arts-collective Channel library uses scope `mine` + `includeManagedOrgs` (`mine+orgs`), so "All yours" again covers the orgs the person runs. tsc is clean on content and arts-collective (verified). The /hub light look on IQlFvc03 passed: store headings, Hide offered, the Channel popup, and /hub/content and /hub/channel at 200. The 6px scrollWidth reading is an artifact of overflow being hidden; the screenshot shows no horizontal scrollbar (verified visually). Pending: an arts-collective rebuild for Step 7, which needs Justin's go.

## 2026-11-26 Add a work picker (agent K)
- New apps/art-auction/src/app/studio/_components/library-picker.tsx: "Choose from your files" toggles an inline panel under MultiImageUploader in artwork-form.tsx (one import, one line). ContentLibrary view=files, lockView, pickMany, accept image/*, folders + upload through /api/content/*.
- Sources: client cannot learn them (folders route needs a source key), so the picker defaults to [My files] (key "mine", every seller has it) and takes an optional sources prop. The Add-a-work frame lives in center/** (market lane), so org folders are not wired there; to add them, pass sources (from contentHost.fileSources) through the frame data into ArtworkForm and LibraryPicker.
- Mapping: toggled file -> UploadedImage { url: links.public ?? cover, alt: "" } (no path/id: the source-relative path is not the nextcloudPath the uploader returns). Link, not copy. Appended in pick order; toggling again removes; at 12, toast.error. onCreated untouched.
- Checks: art-auction tsc clean; react-dom/server render of the picker closed (button) and open (library markup) ok. Needs an art-auction rebuild.

## 2026-11-26 night: picker look (agent E, BUILD_ID u005NUhRyUkbPVs9G7c8H)
- PASS at 1280 and 390: /center "Add a work" frame, Images "Choose from your files" opens the Library in the dialog (Search, Upload, "My files" source, empty folder message), no page errors; /api/content/folders?source=mine 200 (empty). Screenshots /tmp/agentE4/picker-{1280,390}.png.
- Test seller, store, org_profiles, users, GoTrue users deleted; counts at baseline (105/140/12/112), id scan 0 rows.

## 2026-11-26 night: In-stack edit (agent N)
- ArtworkForm gains optional onSaved (edit mode calls it instead of router.refresh(); no onSaved = unchanged). onCreated, its call sites and sources untouched.
- New components/hub/edit-artwork-frame.tsx (client: loads via action, Loading, Cancel, ArtworkForm onSaved=onDone, own Toaster) and app/hub/edit-artwork-action.ts (loadEditArtworkData: getArtworkForEdit(id, session user) = store owner or roll member, same as the edit page; store from the artwork, not the acting store; listingContext + fileSources). Otherwise returns { error }.
- Keepers: getArtworkForEdit and updateArtwork both gate on store owner/roll, so a keeper who is not on the store roll gets an error here (they keep Hide/Show on the card). Widening needs a commerce change.
- cards.tsx: ContentCardMount passes host.renderEdit for keys "artwork:<id>" (for every ContentCardMount, incl. /hub). /admin/content now mounts Artworks + Channel only (Library card dropped).
- Dialogs: the card popup is the cms-ui Surface (native modal dialog); ui/dialog.tsx portals into dialog[open], so ArtworkForm dialogs layer correctly. Not exercised in a browser.
- Checks: art-auction tsc clean; server render of EditArtworkFrame (loading+Cancel) and ArtworkForm with onSaved ok (esbuild bundle + plain node, temp files deleted). Needs an art-auction rebuild.

## 2026-11-26 Suggest + registry routing (agent M)
- suggestContent(viewer|null, q, host, { limit 5, max 10 }) in packages/content/src/server/suggest.ts, exported from server/index.ts. Returns { pieces[{key,title,type,cover}], people[{id,name,avatar,href}], orgs[{id,name,logo,href}] }. Pieces: content_index titles (prefix, substring, trigram) under contentReadSql(rights, null, host), files excluded, published and draft only; empty q = recent pieces. People and orgs only for a non-empty q.
- People rule: users.slug set AND directory_listed AND entity_type = person (the forum listMembers / ArtDirect rule). Pseudonyms show as their own users row; identity_control is never read. Href = ARTDIRECT_URL/<slug>. No email selected anywhere. Orgs: join_policy <> private AND subdomain_confirmed, never oad (the listAffiliationOrgs rule); logo = profile user avatar; href = siteHome or orgUrlOf (now exported from hydrate.ts).
- Migration: none. users 105 rows, organizations 25; a seq scan beats a trigram index.
- Route: contentRoutes(host).suggest, GET /api/content/suggest?q=&limit=, no-store, q capped at 100; mounted in art-auction and arts-collective.
- MCP: content.suggest (packages/mcp content-tools.ts), registered only when the host passes McpContent.suggest (arts-collective mcp route does). Same org lock as content.search; piece titles, people and org names listed under untrusted; links via platformHref.
- runHubAction (art-auction app/hub/actions.ts) now calls performAction (artwork-hide / artwork-show) with orgId and siteOrgId = marketplace org, via app, actor = session person; requireKeeper gate, accepted ids and the { ok, error } shape kept. performHubAction was not used because it needs an owner/guide role and would refuse platform admins that requireKeeper admits.
- Checks: tsc clean for content, mcp, actions, art-auction, arts-collective; scripts/check-suggest.mts 8/8 (rolled back); check-search 56/56.

## 2026-11-26 Round 2 in code (agent L)

Justin's approved round 2 hub-card design, built in packages only. Opt-in: a preset with `scopes` gets the new face and popup; every other preset renders as before (check-library 25/25, tsc clean for content, hub, channel, sunjay, arts-collective).

- Popup stack: `packages/content/src/hub/popup.tsx` (`R2Popup`): list > piece > edit in one dark popup, no SurfaceProvider needed. Dark is pinned to `.eac-c-hubdark` (both --sf-* and --ec-*); styles appended to `content.css` (`hp-*`, `hf-*`).
- Face: `FaceR2` in `card.tsx` (36px serif title, Open pill, 8-thumbnail grid, one count line; no glyph, no kicker). The server loads 8 latest when `scopes` is set.
- Preset (additive, model.ts): `scopes: { site, network }`, `kinds: [{ label, types? }]`.
- Edit: `HubCardMountBase.host` now accepts `HubCardHostExtras.renderEdit({ key, onDone, onCancel })` (packages/hub/src/mount). Present: Edit pushes it as the third frame. Absent: Edit links to `item.links.studio` or `host.studioHref`. onDone pops to the piece, reloads the list and calls host.refresh.
- Suggest: `ui/library/suggest.tsx` (`SuggestSearch`, ARIA combobox/listbox). The popup reads the search endpoint with `/search` replaced by `/suggest`. A person sets scope person:<id>, an org sets org:<id>, a piece opens its frame.
- ContentLibrary: `tileSize="large"`, `views`, `suggest={{ endpoint }}` (additive).
- Harness: scripts/channel-harness/hub-content (pages face, list-site, list-network, piece, edit, suggest; 1280 and 390).
- Notes: Hide/Show are host.act("artwork-hide" / "artwork-show", { artworkId }) as before. The network Store filter is client-side by site name (facets.stores is empty there). "Write about it" and "Use in a post" from the design are not drawn (no hrefs in the package).

## 2026-11-26 ~22:40: PM, round 2 in code (agents L, M, N)

- **Round 2 is built and wired.**
  - L: the dark popup stack (list → piece → edit), a large-tile face, `tileSize`, `views`, `suggest`, and `renderEdit` in `@elkdonis/hub/mount`.
  - M: `suggestContent`, the `/api/content/suggest` route (art-auction, arts-collective), MCP `content.suggest`, and `runHubAction` on `performAction`.
  - N: `EditArtworkFrame`, `ArtworkForm` `onSaved`, and `/admin/content` reduced to Artworks and Channel.
  - PM: the art-auction Artworks preset opts in (scopes Collect Art / The collective, a Kind select).
- **tsc sweep** across 11 packages and apps: 0 new errors (verified).
- The art-auction build goes out with the market lane's artist-profile build.
- **Open:**
  - keepers can't edit another seller's artwork (the commerce save allows only the store's owner or its roll), which is Justin's call
  - "Write about it" and "Use in a post" aren't drawn (the package has no hrefs for them)
  - the network Store filter runs on the client
  - agents work in worktrees next round (RETROSPECTIVE §5)

## 2026-11-26 ~23:00: v1.3 people store (ArtDirect session)

Justin chose to build the directory index next to the cornerstone in the main checkout; the PM approved v1.3 with conditions (worktree or overlay, privacy, explicit rights clause, host urls, checks, migration applied alone). CONTRACT §15 has the shape.

- Written in a scratch overlay over the main checkout and copied in at once when green (no half-done edit was ever in the tree).
- Migration `298_content_index_people.sql` written, **not applied** (297 was taken by `297_store_profile_extras.sql`). It is to be applied alone with its tracker row (the 293/294 recipe); 263 stays pending.
- Code: `services/content-index.ts` (personSelect, indexPerson, reindexPeople, person drift, queue), `content` model/search-types/host/access/search/hydrate/server index, `scripts/check-search.mts` part G (skipped before 298) and the trigger list, `content-reindex.mts` store list. ArtDirect: `src/lib/content-host.ts`, `src/app/page.tsx` (people view, text search, kind counts, keyset pages; falls back to listDossiers when the search fails or the index has no people), `next.config.ts` transpilePackages (+content, +commerce), package.json dependency, and a hand-made `apps/artdirect/node_modules/@elkdonis/content` symlink (what pnpm would make; the lockfile is not updated).
- Checks before 298: tsc 0 new errors (content and artdirect clean; services, commerce, mcp, actions, hub, channel, art-auction, arts-collective, sunjay, elktours compared before/after: same error sets); check-search 56/56 with G skipped. verified.
- Not verified: anything with real person rows (needs 298 applied and a backfill: `content-reindex.mts --stores=person`, or the nightly reconcile); the ArtDirect page (production mode, needs a rebuild).
- Known gap: an app still running pre-v1.3 code drains `person:` keys as no-ops, so until every draining app carries this code a person change may wait for the nightly reconcile (03:40).
- Later the same night (ArtDirect session): migration 298 applied ALONE with Justin's go (tracker row, sha256 f99eabc65fa5; `--status` 263, 295, 297 pending; `--verify` 0 drifted). Backfill `content-reindex.mts --stores=person`: 73 rows (27 person, 46 organization), drift 0; no person row has owner/org columns. check-search 64/64 with part G (its network-facets reference query now counts stores thread and artwork only; it had counted the 73 people), check-suggest ok, check-files 19/19. ArtDirect rebuilt in eac-artdirect (backup `~/eac-backups/next/artdirect-20261126-2257-dir.tgz`, BUILD_ID `n8JeJ02hbMgXY78qPd3Qs`) and restarted; through the edge: 73 on record, Artists 27 / Organizations 46, pages of 48 + 25, "paint" finds 4. verified.

## 2026-11-27: round 2 look, BLOCKED (agent E, BUILD_ID _vo3MUbgAz3FyhTwCgcE8)
- Could not create test accounts: GoTrue POST /admin/users answers 500 "Database error creating new user" (auth log: relation "content_index_queue" does not exist). Cause: migration 298 trigger function content_index_enqueue_person() inserts into content_index_queue UNQUALIFIED; GoTrue runs with a search_path that excludes public, so any insert into public.users (new sign-up) fails. The table exists in public. Likely breaks real sign-ups too (a 500 from referer elkdonis-arts.org was logged at 05:07 UTC).
- Nothing created, nothing to clean (rows with agente5 emails: 0). The UI checks (1) to (4) were not run.

## 2026-11-27 05:09 UTC: INCIDENT, sign-ups failing after 298, fixed by 299 (PM)

- **Symptom:** GoTrue `POST /admin/users` and real sign-ups returned "Database error creating new user". The Postgres log showed `relation "content_index_queue" does not exist`.
- **Cause:** 298's trigger on `users` (`content_index_enqueue_person`) inserts into the unqualified `content_index_queue`. GoTrue writes `public.users` with a `search_path` that excludes `public`, so the trigger failed the whole insert. Found by agent E during a test-account seed.
- **Window:** 298 was applied at 03:52:42 UTC; 299 was applied at 05:09:10 UTC. Postgres logged only 2 failures, both at 05:07 UTC, which is E's seed time; it is unknown whether either was a real visitor (verified count, assumed source).
- **Fix:** migration 299 (`299_content_index_search_path.sql`), applied ALONE: file plus tracker row in one transaction under lock 7246001. It runs `ALTER FUNCTION … SET search_path = public, pg_temp` on all five `content_index_enqueue_*` functions (artwork, lot, person, thread, vouch). No function bodies changed, and 294 and 298 are not edited. `--status` shows 299 applied, with 263 and 295 pending (others'); `--verify` shows 0 drifted (verified).
- **Proof:** one throwaway GoTrue user was created (200), its `public.users` row appeared, then both were deleted; 0 remain (verified).
- **Rule for every future trigger:** schema-qualify table names, or pin `search_path` on the function, because GoTrue and other services write with their own `search_path`. Added to EXTENDING.md.

## 2026-11-27: listing kinds (§16), ArtDirect session

- `listing_kind` is computed in the people view's query, not stored (no migration): `organization` when some `organizations.profile_user_id` is the identity, `associated` for other `entity_type 'organization'` identities, else `artist`. Query filter `listingKinds`, facet `facets.people.listingKinds` (counted under every other filter), card field `ContentPerson.listingKind` (hydration, same rule).
- ArtDirect `/`: buttons All · Artists · Organizations · Associated (`?kind=`); old `?entity=` links still work (person → artists; organization → both org kinds).
- check-search part G gains a listing-kinds test (facet = the live tables, filter returns only that kind): 65/65 on the overlay. verified.

## 2026-11-27: round 2 look (agent E, BUILD_ID _vo3MUbgAz3FyhTwCgcE8, after migration 299)
- /hub keeper PASS: Artworks face dark (large title, 8-thumb grid, no icon/kicker); popup dark (.hp-scrim), toolbar fixed when switching to The collective (tiles 35 to 12), rail Store/Sale/Status, no errors, no h-scroll at 1280 and 390; clicking the search box shows Pieces suggestions incl. the test title; piece foot offers Hide from the site (not clicked). NOTES: a programmatic .focus() on the search input froze the page in headless Chrome (a real mouse click is fine); typing "Age" lists the piece under Pieces but the result list says Nothing matches "Age".
- Seller: /hub redirects sellers to /; the card is on /center (piece frame in a dialog). "Edit the listing" opens the form inside the same dialog, URL unchanged (PASS); Save changes wrote the new title to the DB, but the popup stayed on the form (old title in header after 5 s), did not return to the piece (FAIL). Cleanup done, zero rows, counts at baseline.
- 2026-11-27 (agent L): large-tile pictures forced to cover the 4/5 frame (abs-fill, top-centre, broken image hides to the blank tile); color-scheme: dark on .eac-c-hubdark.
- 2026-11-27 (agent A): searchContent text match now agrees with suggestContent: tsv websearch OR tsv word-prefix query (word:* joined with &, tokens sanitised) OR title ILIKE substring OR title trigram; rank adds a title-prefix boost; rights and facets use the same match. check-search asserts a prefix and a mid-word substring each find their title.

## 2026-11-27 ~05:45 UTC: PM, round 2 live check and follow-ups

- **Live check** on art-auction `_vo3MUbgAz3FyhTwCgcE8` (agent E, test accounts deleted). The dark card and popup pass, as do the fixed toolbar and Collect Art / The collective switch, the rail, the large tiles, no horizontal scroll and Hide offered (verified, screenshots in agentE5).
- **Follow-ups found and fixed in source:**
  - A, search: searchContent now matches prefix, substring and trigram like suggest. check-search passes 66 of 66.
  - L, popup CSS: the large-tile picture fills its 4/5 frame, a broken image falls back to the blank tile, and the popup uses dark scrollbars.
  - Market lane: the /center edit frame passes `onSaved`, so it pops back to the piece and refreshes it.
- **tsc sweep:** 0 new errors in content, hub, services, mcp, art-auction, artdirect, arts-collective and sunjay (verified). The market lane has been told the tree is green; these ship with their next art-auction build, which needs Justin's go.
- **Not exercised live:** the hub card's in-stack Edit. Sellers can't open /hub, and keepers who aren't on the store's roll can't save. It is harness-verified only.

## 2026-11-27: re-look (agent E, BUILD_ID RMXFp3tS_s8-53ufFpSR2)
- Keeper /hub Artworks popup: scrollbars dark (PASS) but FAIL on pictures: grid tiles show no pictures, the img elements measure ~0x1 px (naturalWidth fine, e.g. 563x780, object-fit cover) so the title sits under a dot; no 4/5 tile renders. "Zeb" shows the piece in the results grid (PASS). Seller Edit the listing, rename, Save: popup returns to the piece with the new title "Zebra Renamed" within 2.5 s (PASS).
- Fixtures deleted (artwork, store, org_profiles, users, GoTrue, person: queue keys); zero rows, Chrome container removed.

## 2026-11-27: v1.4 offers view and checkout (ArtDirect session's team: agents C, D; lead edits)

- D: offers view (`server/offers.ts`, access/search/hydrate/model/search-types), check-search part H; 71/71. Migration `300_content_index_offers.sql` written, NOT applied (threads UPDATE trigger gains price/currency; workshop_pages trigger; search_path pinned). tsc 0 in content, mcp, hub, channel, arts-collective, art-auction, artdirect, sunjay; services the same 17 pre-existing. A type error in hydrate.ts was in the shared tree for a few minutes and fixed.
- Lead: service rows gated behind `CONTENT_INDEX_SERVICES=1` (off) before the art-auction build `8FrfkNVffQxFB6CXgskGC`; 0 service/tour/experience rows in content_index at that time. verified (query).
- C: checkout adapter, commerce `networkSale`, payments/checkout optional `idempotencyKey`; check-checkout 11/11 on a read-only session with Stripe stubbed; tsc 0 in content, payments, checkout, commerce and eight apps. verified.
- PM review: first read approved the shape with fixes A-D (forged host, CSRF, abuse limits, variants) and E (idempotency) before enabling; re-read 2026-11-27 approved A-E and the wiring, with conditions: hosts pass `redisRateLimiter(client)`, routes stay unmounted until Justin's go per app, and enabling waits on Justin's call on order visibility (F).
- Lead: routes.ts wired (`contentRoutes(host, { payments, limiter })`, additive; no app passes payments); tsc 0 in content, art-auction, arts-collective, sunjay. verified.
- 2026-11-27 ~01:45 EST (ArtDirect session, Justin's go): migration 300 applied ALONE (tracker 525cc7080a91; --verify 0 drifted); thread reindex filled 5 priced threads, 0 service rows; check-search 71/71 (expected trigger list now includes workshop_pages). Checkout mounted on arts-collective only (`src/lib/content-checkout.ts`, `redisRateLimiter(getRedisClient())`); arts-collective live `3CXoMFM1u4zuVsIcnQNK2`, artdirect live `Qtd6k05sY1Uwew1arVwVX`. Edge checks: non-JSON 403, foreign Origin 403, GET 405, forged Host / X-Forwarded-Host 400 (also on /return), 11th try from one IP limited (400 "Too many attempts"), /hub/admin/sales 404 for a non-admin and 401/307 signed out; no orders created. Not run: a Stripe session (live keys); the admin view signed in. verified.

## 2026-11-27 ~16:05 UTC: six-app rebuild, services on, checkout on sunjay and artdirect (PM, Justin "yes 1, 2, 3")

- **Source (ArtDirect team):**
  - Checkout is mounted on sunjay and artdirect (as on arts-collective, with redisRateLimiter).
  - `SERVICES_ON` defaults to on (`CONTENT_INDEX_SERVICES=0` turns it off).
  - The PM ran the install that added `@elkdonis/redis` to sunjay and artdirect.
- **Builds (PM, in order):**
  - sunjay O37SHGfhWOOqDjxHz5zAt
  - katie JEantk4r0PIknL08YgP_T
  - development OojZQL3cuh6gwpt785S7c
  - art-auction 3Um5aFVL2F_x0ZdineAR6, after a Google Fonts failure. The scripted restore failed (`.next` is a mount point), so the market answered 502 for about 2 minutes until a manual restore to 8FrfkNVf, then the rebuild.
  - artdirect em-sQDIcDII1UPk18wS5y
  - arts-collective a2sgrhEpgLSB-JNcfyngO
  - Backups are `*-20261127-1055|1059-services.tgz` (verified).
- **Reindex:** threads `--reconcile --fix` gave 0 stale and 0 orphan, 8 service rows, and an empty queue. Network/published search shows no services (verified).
- **Open:** the `view=offers` route parameter isn't parsed, so the route falls back to published (sent to the ArtDirect team). art-auction logged one heap OOM at 15:59:30 UTC: the old server process while the failed build shared the container. The new server is healthy.

## 2026-11-27: lane P (Pay) fixes the four checkout bugs (authorised by the PM; no Stripe, no DB writes, no containers touched)

- **Bug 1, services could not be bought** (confirmed in code and by test): `resolveContentRefs` gains `opts.offers`, passed to `contentReadSql`'s existing `offers` option; checkout passes `offers: true`. Only checkout does: `/api/content/resolve`, MCP, search views and suggest are unchanged (a service is still "gone" there). `server/search.ts`, `server/checkout.ts`.
- **Bug 2, Done never opened** (confirmed): the return hop now keeps the page's own `surface` value from `returnTo` when it is an `offer:done:...`; otherwise it writes `offer:done:<encodeURIComponent(key)>:<svc|evt|art>` (`doneSurfaceFor(kind, key)`, new `key` parameter on the success URL, checked against the key pattern; a bad key writes no surface). A stale `payment=cancelled` is dropped; `paid=1` stays.
- **Bug 3, cancel landed on Done** (confirmed): the cancel URL is now `returnTo` with `surface=offer:<svc|evt|art>-offer:<encoded key>` (`offerSurfaceFor`) plus `payment=cancelled`. Kit side: new `cms-ui/src/offer-surface/cancelled.tsx` (`PaymentCancelledScope`, `PaymentCancelledNote`: reads `payment=cancelled` once, removes it from the address, shows "Payment was cancelled."), wrapped round the evt/svc/art offer layers in `OfferLayer.tsx` and drawn at the top of the body in `OfferFrame.tsx` (3 additive lines). Also: checkout's offer kind now treats event, meeting, workshop and reading_group as event (as offer-site.ts `kindOf` does); before, a workshop would have cancelled to the service layer.
- **Bug 4, page price vs charge** (confirmed; the page side is lane L's): new `threadChargeFor(key)` and pure `chargeOfThreadRow(row)` in `server/offers.ts`, exported from `@elkdonis/content/server`. Same rule as commerce `createThreadOrder`: `workshop_pages.price_member` first, else `threads.price`, major to minor, currency CAD when empty, sliding range from `price_sliding_min`. Returns `{ amountMinor, currency, sliding? } | null`.
- **Also**: `PieceLightbox.tsx` shows "Open in Studio" only when `item.can?.edit` (it was shown to strangers). Not changed: the rate limiter still fails open when Redis is down (a decision for Justin).
- **Tests**: `scripts/check-checkout.mts` extended (20/20) with the REAL rights check (no stub) for a service, an event and an artwork, Stripe and order creation stubbed; asserts services stay hidden from the ordinary resolve and the published/all views, a non-public service stays unavailable to a stranger, the cancel and done values parse in url.ts, and `threadChargeFor` equals the index price for 12 priced threads. Run in a throwaway `docker run --rm` (eac-dev, repo mounted read-only, env file without Stripe keys, DATABASE_URL with `default_transaction_read_only=on`; the script refuses to run unless the session is read-only). Writes: none. tsc 0 in content, cms-ui, arts-collective; services shows its 17 pre-existing errors (none in files touched). verified.
- **Not verified**: a real Stripe session (success redirect actually landing on Done in a browser, a cancel actually showing the line, the sliding amount and booking row end to end).
- Docs note: checkout is mounted on arts-collective (live POST of `{}` answers 400, not 404); `OFFER_SURFACES/README.md` saying "mounted nowhere" is out of date.
