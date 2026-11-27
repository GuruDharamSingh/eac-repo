# Content Library as the platform cornerstone: one search, one component, many faces

## Context

Justin wants the content library (`packages/content`, `@elkdonis/content`) to become the
platform's **default search**: one component that people use to find their own published
work *and* their cloud files, that admins use to look over site-wide listings, and that
shows up as a hub card, a /center section, an editor picker and an assistant tool. The
first new host is **art-auction** (market.arts-collective.com), and Sunjay's Channel hub
card is due to follow it there.

I am the foundational PM for this, with authority to redirect or undo neighbouring
lanes so the result is one unified component.

**Is it a positive move? Yes.** Today the same idea exists in many partial copies:
- Four separate mappings into `ContentListItem`.
- A search that covers the forum only.
- `/admin/artworks`, a 300-row table with no filters.
- Live-WebDAV file listings with no index.
- Five copies of `content-row-actions.tsx`.
- Two card systems.
- A second library component, `MediaLibrary`.

Turning these into one contract (item key, query, rights, paging) is what lets every face
agree. It only holds if **search, rights and paging move to the server**. Today the
library filters in the browser, `listContent` has no text query and no site-wide scope,
and files have no database rows. Those gaps are the core of this plan.

### Decisions already made (2026-11-26)
- **One search index.** A unified `content_index` table with one Postgres full-text and
  trigram index, kept current by the write paths, plus a backfill and a nightly reconcile.
- **One search, with a scope toggle:** Published | Files | All. Files become indexed items.
- **This plan is the umbrella.** The MediaLibrary is **folded into ContentLibrary**. The
  file browser becomes a limited expression of the same component (files only, with
  folders). The market /center and /hub lane is UI work and consumes this contract.
- **Hub cards use the `defineHubCard` contract** (`packages/hub/src/contract.ts`). That
  covers both the Content card and the lifted Channel card.

---

## Principles (the best practices this cornerstone must keep)

1. **One contract, many faces.** The model, the query, the rights and the actions live in
   the package. Faces (/center section, hub card, picker, file browser, MCP tool) are thin
   and only choose a scope, a mode and a layout. This follows Manjushri HANDOFF
   "a platform component has faces" and the surface recipe in EDITING_LANDSCAPE detail.md.
2. **The server is authoritative.** Search, rights, counts and paging run in SQL. The
   client never decides what someone may see. `can.*` comes from the server.
3. **One rights rule, written once in SQL.** It replaces the drift between
   `canViewThread`, `threadReadSql`, the forum's `visible()`, `mayManageOrg`,
   `isMarketKeeper` and `canReadMedia`, in a single place: `server/access.ts`.
4. **Stable identity everywhere.** Each item is `<store>:<id>` (`thread:`, `artwork:`,
   `file:`). Picker values, deep links, registry inputs, the passport and the index all use
   this key.
5. **Hosts adapt and the package never hard-codes.** A `ContentHost` per app supplies
   URLs, allowed actions and the site scope. This retires the `MARKET`, `ARTDIRECT` and
   `NETWORK_HOST` constants and the relative `/studio` links in `list.ts`.
6. **Search for keys, then hydrate the page.** The index returns one sorted, keyset-paged
   page of keys. The full-row reads and owner-only marks are filled for that page only. This
   fixes short pages, the sort mismatch, and artwork being re-read on every page.
7. **Additive and versioned.** Adapters come before rewrites. Pilot in one host. Retire
   copies only after the replacement is verified. Mark the contract `v1` and add to it
   rather than breaking it.
8. **Never drop silently.** `missing` is surfaced in the UI and the logs, which keeps the
   existing rule.
9. **Agents propose, people publish.** Assistant reads are org-locked MCP read tools
   (DOCTRINE rule 6). Writes go through registry entries with allow-lists.
10. **Verified means rendered and signed in.** Model checks, harness screenshots, and
    signed-in checks with **test accounts only** (never a real account on a dev copy).
    Run `check-types` for each importing app, never in a live container.

---

## The contract (v1, written to `docs/open/CONTENT_CORNERSTONE_2026-11-26/CONTRACT.md`)

- **Stores:** `thread | artwork | file` (`model.ts` `ContentStore`, which today is
  thread/artwork only). Store (which table) stays separate from type (how it is shown):
  writing, meeting, series, artwork, product, image, video, audio, document…
- **Query:** `ContentQuery { q?, scope, facets: { types?, statuses?, series? }, sort:
  recent|next|title|relevance, cursor?, limit }`.
  - `scope` is one of: `mine` (the person plus their pseudonyms), `org: id`,
    `site` (what the host's site covers; for the market that is the `market` org plus
    every store with `org_id='market'`) or `network` (public only).
  - A view toggle chooses Published | Files | All.
- **Result:** `{ items: ContentListItem[], nextCursor, facetCounts, missing }`.
  - `ContentListItem` keeps today's shape (`model.ts:193`), with `store` and `file` fields
    (path, mime, size, folder) added.
- **Server entry:** `searchContent(viewer, query, host)` in `@elkdonis/content/server`.
  `listContent` becomes a thin wrapper over it, so the two existing callers keep working.
- **Route factory:** `contentRoutes(host)`, following the `centerRoutes({who})` pattern.
  An app mounts `/api/content/search` (plus `/folders` and `/upload` for files) in about
  5 lines. Rights come from the session and never from parameters.
- **UI:** `ContentLibrary` gains:
  - `source` (remote search with debounce, cursor "Show more" and URL state; the
    `items` prop stays for Channel until it is switched)
  - `mode` (`browse | pick | pickMany`, lifted from MediaLibrary)
  - `view` (`published | files | all`) and folder navigation when the view is files
  - `upload` and drag/drop (lifted from MediaLibrary)
  - lightbox lead actions resolved from `can.*` and the host's allowed actions
- **Hub card:** `contentCard` + `contentServer` via `defineHubCard`/`defineHubCardServer`,
  with a gate, an `actions` allow-list and Face/Popup/Detail, plus one generic
  `HubCardMount` that every app reuses.

---

## Steps (each lists its main work, who to keep in sync, and when it counts as done)

### Step 0: Take the lead and freeze the contract (docs only)
- **Work:**
  - Write `docs/open/CONTENT_CORNERSTONE_2026-11-26/` with `PLAN.md` (this plan),
    `CONTRACT.md` (above, with types), and `LEDGER.md` (decisions, owners, open items).
  - Inventory what is reused from the other lanes' work.
  - **Ask Justin for a snapshot commit plus a new day branch.** `work/2026-11-16` has
    about 303 dirty paths from many sessions, and the plan starts from a known tree.
- **Sync (messages to send):**
  - **Media lane** (`ELKTOURS_MEDIA_STRUCTURE_2026-11-26.md`, the uncommitted
    `ui/MediaLibrary.tsx`, `dav.ts` and `media-library.ts` diffs): MediaLibrary folds into
    ContentLibrary. Its listing contract `{path, browsable, items}`, folder navigation,
    upload and drag code are kept and moved. `@elkdonis/content/media-library` stays as a
    compatibility wrapper until elktours' `media-field.tsx` moves over. No new
    MediaLibrary features in the meantime.
  - **Market /center + /hub lane** (`MARKET_CENTER_AND_DOCK_2026-11-24.md`): the Content
    library card, the Listings face, the Publish face's library frame, and the Artworks
    "by recent or by store" view are all faces of this contract. Hand them `CONTRACT.md`
    and the step order. Their UI builds on Steps 2–4. Answer their open items
    "lift channel:library?" (yes, into this component) and "which card system?"
    (`defineHubCard`).
  - **House editor PM** (`docs/open/LIAISON/HOUSE_EDITOR_PM.md`): row H, the picker,
    arrives in Step 6. Post before touching shared editor code.
  - **Channel lane:** Channel's `LibrarySurface` and its client mappings will be switched
    over in Step 7, and the Channel hub card lifted in Step 4.
- **Done when:** the contract doc is published, each lane has been posted to, and Justin
  has approved the snapshot and branch.

### Step 1: The search core (the cornerstone)
- **Work:**
  - Migration `content_index`: `store, id, key, type, org_id, owner_user_id,
    owner_identity_ids, site_org_ids, visibility, min_role, status, hidden, title, text,
    tsv (title A, excerpt B, body C, the same weighting as `114_forum_search.sql`),
    sort_at, cover, updated_at`.
    - Indexes: GIN on `tsv`, trigram on `title`, btree on `(org_id, sort_at, key)` and on
      `(owner_user_id, sort_at, key)`.
  - `indexContent(ref)` / `unindexContent(ref)`, called from the **shared write paths**:
    - services thread create, update, publish and kind change
    - commerce `createArtwork`, `updateArtwork`, `publishArtwork` and `adminHideArtwork`
  - `scripts/content-reindex.mts` for the backfill. A nightly reconcile compares the index
    with its source tables and reports drift. App-local writes that skip the shared paths
    are listed in `missing` until they move.
  - `searchContent`:
    - Rights are one SQL predicate, `contentReadSql(rights, scope)`, built from
      `threadReadSql` plus the artwork rules (status listed, `hiddenByAdmin`, store state).
    - A **site-keeper rule** comes from the database: market owners per
      `isMarketKeeper`, generalised as "owner of the site's org", plus `is_admin`.
    - Keyset paging on `(sort_at, key)`, relevance via `ts_rank` when `q` is given, and
      facet counts.
  - Fix the market scope gap: personal market stores have `org_id='market'`, but
    `listContent` reads `owner_org_id`.
  - Re-base `listContent` on `searchContent`, and hydrate owner-only marks per page.
- **Sync:** none outside this lane. This is new code behind the existing exports.
- **Done when:**
  - The new check (`packages/content/scripts/check-search.mts`) passes. It runs on
    `elkdonis_dev` with test accounts (stranger, seller, keeper, admin) and confirms each
    sees exactly the right set.
  - `EXPLAIN` uses the indexes, and search on the dev data is under about 150 ms.
  - The two current `listContent` callers return the same items as before.

### Step 2: Host adapter and the unified component
- **Work:**
  - Add `ContentHost` (site URLs from `org_domains`/siteConfig, the studio hand-off via
    `StudioHandoff.href`, allowed actions, site scope) and `contentRoutes(host)`.
  - Fold MediaLibrary into `ContentLibrary`: modes, folder navigation, upload, drag and
    the files view.
  - Keep `MediaLibrary` as a wrapper (`view="files"`, the same props) so elktours does not
    change.
  - Collapse the four list-item mappings into the server one. Channel's own mapping stays
    until Step 7.
- **Sync:** the media lane reviews the folded component against elktours' picker.
- **Done when:**
  - The channel-harness `library`/`lightbox` pages render byte-identical in items mode.
  - A new harness page shows remote mode, the files view, and the pick and pickMany modes.
  - Elktours' media field works unchanged, checked signed in with a test account.
  - `check-types` passes for every app that imports the package.

### Step 3: First host, art-auction (in step with the market lane's slices 4–5)
- **Work:**
  - Wiring:
    - Add `@elkdonis/content` and `@elkdonis/hub` to `package.json` and
      `transpilePackages`. cms-ui is already a dependency but is not listed there.
    - Add the `@source` lines and the CSS imports (`content.css`, `hub-cards.css`).
    - Mount `contentRoutes(marketHost)`.
  - **/center, "My work":** `ContentLibrary` with scope `mine` (artwork plus writing,
    Published | Files | All). Lead action: Edit or Open piece.
  - **Keepers:** the Content hub card with scope `site` and the Hide/Show actions. It
    replaces the `/admin/artworks` table, or sits beside it until /hub ships.
  - New registry entries `artwork-hide`/`artwork-show` (the atlas row already exists at
    `atlas/areas/apps.art-auction.admin.ts:49`).
- **Sync:**
  - The market lane owns the page frames, bands and faces. This lane owns the library
    face, the card and the data.
  - Build timing: art-auction runs from a built image, and the build picks up every
    session's uncommitted tree.
- **Done when:**
  - The build follows `docs/reference/ops.md` (back up `.next`, build in the container,
    restart) and has **Justin's go for the deploy**.
  - Signed-in checks pass with a seller test account and a keeper test account: each sees
    the right set, search and paging work, and Hide/Show round-trips.

### Step 4: Shared hub-card mounts (Content + Channel)
- **Work:**
  - Generalise Sunjay's `SiteBuilderCardMount` (`apps/sunjay/src/components/hub/hub-card-host.tsx`)
    into one `HubCardMount` in `@elkdonis/hub`.
  - Lift the Channel tile into `packages/channel` as a `defineHubCard` card. Its parts
    today are `ChannelFace`, `ChannelSurface`, `/api/hub/channel` and `lib/hub-channel.ts`,
    about 150 lines of app glue. The card gets a `channelHubRoutes(door)` factory, so an
    app supplies only its loader and door (about 20 lines).
  - Switch Sunjay to the lifted card first, with no change in behaviour. Then add it to
    art-auction with an artwork-centred market channel loader.
  - The Content card's face can also host the review queue later
    (`packages/hub/src/review/model.ts:7`).
- **Sync:**
  - The Channel lane: the lifted card must match Sunjay's harness output.
  - The market lane: the "Publishing and people" band uses these cards.
- **Done when:**
  - Sunjay's hub looks identical before and after.
  - Art-auction shows both cards, checked signed in.
  - Sunjay's app-local glue files are deleted.

### Step 5: Files join the index (the `file` store)
- **Work:**
  - Give `media` `owner_kind/owner_id` and visibility. This resolves MEDIA_OWNERSHIP's
    open question.
  - The `registerLibraryItem` seam (`services/src/uploads.ts:183`) writes `media` and
    `content_index` rows for every upload.
  - A scheduled reconcile indexes existing Nextcloud folders per principal with
    `davListDeep` (capped, incremental), because live WebDAV cannot be searched.
  - File rights: express `canReadMedia`'s path rules as index columns (principal,
    visibility, `site_org_ids`) so the SQL predicate covers files too. `serveMedia` stays
    the gate for the bytes themselves.
  - Fix or remove the `listFiles` stub (`nextcloud.ts:175`, which always returns `[]`).
- **Sync:** the media lane owns the upload paths (UPLOADS_ONE_PATH) and reviews the
  reconcile job.
- **Done when:**
  - Search finds a test account's uploaded file by name and caption under Files and All.
  - Private files never appear for a stranger, which the check script proves.
  - Folder browsing (the files view) still reads live folders.

### Step 6: More faces on the same contract
- **Work:**
  - **Puck/canvas picker:** a `piece` source in `RecordSources`
    (`packages/direct-edit/src/canvas/records.ts`, `page-builder/.../record-sources.ts`)
    backed by `/api/content/search`, with a compact pick layout for Puck's side panel.
    This is House-editor row H.
  - **Assistant:** an MCP read tool `content.search` (org-locked, untrusted-text fence,
    audit row) in `packages/mcp/src/server/tools.ts`, plus a registry status entry
    (`agent:'read'`) for the dock. Add the `content-passport` read here if pass 2 of the
    detail lands.
  - **Network search:** a Content tab on arts-collective (scope Yours | Org | Whole
    network), beside People, Sites and Forum, per `channel-handoff/README.md:170`.
  - **/center section type** `content` in `cms-ui/center/layout.ts:8` *and*
    `services/src/center-layout.ts:18`. Both lists must change together, or stored layouts
    drop the section. Every app's /center can then show "My work".
- **Sync:** the House-editor PM (picker), the MCP/dock atlas JOURNAL, and the apps that
  adopt the center section.
- **Done when:** each face is checked signed in on one pilot app, and the atlas entries
  have their hosts claimed.

### Step 7: Retire the copies
- Switch Channel's `LibrarySurface` (arts-collective) to `ContentLibrary` remote mode, and
  delete `lib/channel/content-list.ts` and the client filter.
- Replace the five `components/manage/content-row-actions.tsx` with lightbox and detail
  actions through the registry (`thread-publish`, unpublish and archive as new entries).
- Remove the `MediaLibrary` wrapper once elktours uses `ContentLibrary` directly.
- Delete `packages/studio/src/channel/` once `/studio/channel` is retired.
- Optional: move forum search onto `content_index` so the forum shares the one search.
- **Done when:** a grep shows no second list-item mapping, library component or row-action
  copy, and each retired surface was checked signed in before it was deleted.

---

## Cross-cutting

- **Gates that need Justin's go:**
  - production rebuilds and deploys (art-auction in Step 3, Sunjay and art-auction in
    Step 4)
  - the snapshot commit and the new branch
  - any emails

  Migrations on eris are pre-approved; they are still noted in the LEDGER.
- **Build memory:** builds use `NODE_OPTIONS=--max-old-space-size=3584` and bump the
  container's memory for the build only (ops.md:110-116). Keep `./ui` free of tiptap and
  three. Keep `./server` out of client bundles: add `server-only` as a dependency of the
  package.
- **Performance budget:** search p95 under 150 ms on dev data, one query per page plus the
  hydration reads, and no WebDAV calls on the search path.
- **Accessibility:** keyboard navigation through the bricks and rows, focus returning from
  the lightbox (exists today), labelled scope and view toggles, and `aria-live` on result
  counts.
- **Security:** a signed-out visitor sees `network` scope only. No hidden or private item
  leaks through counts or facets. Facet counts use the same predicate as the results.
- **Docs:** each step appends to `LEDGER.md`. Update the CONTENT_LIBRARY_COMPONENT doc's
  status, the market plan's open items, and the memory index (a new
  `project_content_cornerstone.md`).

## Critical files
- `packages/content/src/{model.ts, registry.ts, server/list.ts, server/access.ts, ui/ContentLibrary.tsx, ui/MediaLibrary.tsx, ui/PieceLightbox.tsx}`
- `packages/db/migrations/` (new `content_index`; `media` owner columns), and `114_forum_search.sql` as the full-text pattern
- `packages/services/src/{uploads.ts, media-library.ts, media-authz.ts, dav.ts, center-layout.ts, thread-audience.ts}`, and `packages/commerce/src/queries/index.ts` with the artwork write paths
- `packages/hub/src/contract.ts`, `apps/sunjay/src/components/hub/{hub-card-host.tsx, ChannelFace.tsx, ChannelSurface.tsx}`, `apps/sunjay/src/lib/hub-channel.ts`, `packages/channel/src/hub/*`
- `apps/art-auction/{package.json, next.config.ts, src/app/globals.css, src/lib/marketplace-auth.ts, src/app/admin/artworks/page.tsx}`
- `packages/cms-ui/src/center/layout.ts`, `packages/direct-edit/src/canvas/records.ts`, `packages/mcp/src/server/tools.ts`, `packages/actions/src/catalogue.ts`

## Verification (end to end)
1. `packages/content/src/model.check.ts` plus the new `scripts/check-search.mts`, run in a
   throwaway container against `elkdonis_dev` with test accounts for each role.
2. Channel-harness screenshots: byte-identical for the existing pages, and new pages for
   remote, files, pick and pickMany.
3. `pnpm check-types` in every app that imports `@elkdonis/content` or `@elkdonis/hub`,
   in a throwaway container.
4. Signed-in headless-Chrome checks on art-auction (seller, keeper), Sunjay (hub
   unchanged) and elktours (picker unchanged): search, paging, the scope toggle, the files
   view and Hide/Show.
5. Each claim in the LEDGER is labelled verified, assumed or unknown
   (`.claude/rules/03-verification.md`).
