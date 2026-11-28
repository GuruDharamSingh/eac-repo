# Content cornerstone: contract v1 (2026-11-26)

This is the one contract that every face of the content library builds on: the library,
the file browser, the pickers, the hub card, the /center section and the assistant tool.
**Changes are additive only.** A change that breaks a type or route here needs a v2 note
in LEDGER.md and the PM's sign-off. The plan is in PLAN.md and the decisions are in
LEDGER.md.

## 0. Who owns what (as of 2026-11-26)

| Layer | Where | Owner |
|---|---|---|
| The index table and indexer | `packages/db/migrations/<next>_content_index.sql`, `packages/services/src/content-index.ts` | Cornerstone, agent A |
| Search, rights and hydration | `packages/content/src/server/{search.ts, access.ts, list.ts}` | Cornerstone, agent A |
| The unified UI (library, files, pick) | `packages/content/src/ui/{ContentLibrary.tsx, MediaLibrary.tsx, library/*}` | Cornerstone, agent B |
| Host adapter, route factory, hub cards | `packages/content/src/{host.ts, routes.ts, hub/*}`, `packages/hub/src/mount/*`, `packages/channel/src/hub/*` | Cornerstone, agent C |
| Pages, frames and bands on market /center and /hub | `apps/art-auction/src/app/{center,hub}/**` | Market lane (UI), which consumes this contract |
| Upload paths, Nextcloud moves, elktours attach | `packages/services/src/{uploads.ts, media-copy.ts, dav.ts}`, `apps/elktours/**` | Media lane; it may not add MediaLibrary features (fold-in below) |

**Why the indexer lives in `services`:** `@elkdonis/content` depends on `services` and
`commerce`, and `commerce` depends on `services`. The write paths in both packages
therefore call `services/content-index`, and `content` only reads the index. There is no
import cycle.

## 1. Identity

```ts
export type ContentStore = "thread" | "artwork" | "file";          // v1 adds "file"
export interface ContentRef { store: ContentStore; id: string }       // key = `${store}:${id}`
```
- A `file:` id is the `media.id` uuid once Step 5 lands. Until then file items come only
  from the folder listing (§5) and carry no key into the index.
- `parseContentKey` accepts all three stores.
- Picker values, deep links (`?piece=`), registry inputs and index rows all use the key.

## 2. Types and views

```ts
// kept: artwork | product | writing | video | series | meeting | event | workshop | questionnaire | poll
// v1 adds the file families:
export type ContentType = /* existing */ | "image" | "audio" | "document" | "file";
export type ContentView = "published" | "files" | "all";              // the scope toggle Published | Files | All
```
- `published` means the stores thread and artwork. `files` means the store file. `all`
  means every store.
- Video stays one type. Its store (thread or file) tells a published video from a raw file.

## 3. Query and result

```ts
export type ContentScope =
  | { kind: "mine" }                       // the viewer plus every live pseudonym (getIdentityIds)
  | { kind: "org"; orgId: string }         // one org's pieces
  | { kind: "site" }                       // what the host's site covers (ContentHost.site)
  | { kind: "network" };                   // public, published only; the only scope open to signed-out visitors

export type ContentSort = "recent" | "next" | "title" | "relevance";

export interface ContentQuery {
  q?: string;                               // websearch_to_tsquery plus trigram on title; empty means browse
  scope: ContentScope;
  view?: ContentView;                       // default "published"
  types?: ContentType[];
  statuses?: ContentStatus[];               // default: draft, scheduled, live, published (archived only when asked)
  seriesId?: string;
  sort?: ContentSort;                       // default "relevance" when q is set, else "recent"
  cursor?: string | null;                   // opaque keyset cursor; never an offset
  limit?: number;                           // default 40, max 100
}

export interface ContentSearchResult {
  items: ContentListItem[];
  nextCursor: string | null;
  /** Counts under the SAME rights predicate as `items` (never leaks hidden or private rows). */
  facets: { types: Partial<Record<ContentType, number>>; statuses: Partial<Record<ContentStatus, number>> };
  /** Sources not read or failed; the UI shows them, never drops them silently. */
  missing: string[];
}

export function searchContent(viewer: ContentViewer | null, query: ContentQuery, host: ContentHost): Promise<ContentSearchResult>;
```
- **Search for keys, then hydrate.** One SQL query over `content_index` returns the page of
  keys, already ordered. The hydration reads fill those items only: the thread and artwork
  rows, and the owner-only marks (social posts, letters, deliveries).
- `viewer = null` is allowed for the `network` scope only. Any other scope throws.
- **`listContent` stays exported, with the same signature.** It becomes a wrapper:
  `orgId` maps to scope org and `ownerUserId` maps to scope mine. Both current callers must
  get the same items as before.

### `ContentListItem` v1 (additive to `model.ts:193`)
```ts
interface ContentListItem {
  /* every existing field unchanged */
  store?: ContentStore;                     // filled by searchContent; derive from key when absent
  file?: { source: string; path: string; mime: string | null; size: number | null; folder: string } | null;
  /** From the server only (never inferred client-side). The host's action allow-list narrows it further. */
  can?: { edit: boolean; hide: boolean; publish: boolean; archive: boolean; pick: boolean };
}
```

## 4. Rights (one predicate)

`contentReadSql(rights, scope, host)` in `packages/content/src/server/access.ts` over the
alias `ci` (content_index):
- **Admin** (`users.is_admin`): every row.
- **Site keeper:** a role of `owner` on `host.site.orgId`, which generalises
  `isMarketKeeper`. Every row in the site scope, including hidden and draft rows.
- **Owner:** `ci.owner_user_id = viewer`, or `ci.owner_identity_id = ANY(identityIds)`.
  Every row of their own.
- **Org manager** (owner or guide of `ci.org_id`, excluding `oad`): every unpublished row
  of that org, subject to `min_role`. This is the same as `threadReadSql`.
- **Everyone else:** published rows with `visibility = 'PUBLIC'`; ORGANIZATION rows for
  members; INVITE_ONLY rows where the viewer meets `min_role`; and never a row with
  `hidden = true`.
- **Files** (Step 5): `ci.visibility` mirrors the path rule in `canReadMedia`. A private
  file is visible to its owner, an affiliate of its org, or an admin. The bytes are still
  gated by `serveMedia`.
- **Facets use the same predicate.**

`threadReadSql` stays as it is (it has callers). `contentReadSql` must agree with it on
threads, and the check script proves this.

## 5. Routes (mounted by each app through one factory)

```ts
export function contentRoutes(host: ContentHost): {
  search: (req: Request) => Promise<Response>;   // GET  /api/content/search
  folders: (req: Request) => Promise<Response>;  // GET  /api/content/folders
  upload?: (req: Request) => Promise<Response>;  // POST /api/content/upload (Step 5; via storeUpload)
};
```
- `GET /api/content/search?q=&scope=mine|org:<id>|site|network&view=&types=a,b&statuses=&series=&sort=&cursor=&limit=`
  returns `ContentSearchResult`. The viewer comes from `host.viewer(req)`, which is the
  session. Rights never come from parameters. Responses are `Cache-Control: no-store`.
- `GET /api/content/folders?source=<key>&path=&q=` returns the browsable listing
  that MediaLibrary already reads:
  `{ path, browsable: true, items: [{ name, path, isFolder, url?, thumb?, mimeType?, size?, lastModified?, shortcut?: { source, path } }] }`.
  It is built on `listMediaSource` (`packages/services/src/media-source.ts:103`), with roots
  from `host.fileSources(viewer)`.

## 6. Host adapter

```ts
export interface ContentHost {
  /** The session's viewer, or null. */
  viewer(req?: Request): Promise<ContentViewer | null>;
  site: { orgId: string; name: string; domain: string; timeZone: string;
          /** Extra orgs or stores the site scope spans (market: stores with org_id='market'). */
          storeOrgIds?: string[] };
  urls: {
    piece(ref: ContentRef, item: { orgId: string | null }): string | null;   // the public page on THIS host if it serves it, else the owning site
    studio(ref: ContentRef | null, ctx?: { kind?: string; org?: string }): string | null; // StudioHandoff.href
    manage?(ref: ContentRef): string | null;
    siteHome(orgId: string): string | null;                                   // org_domains, replacing OWN_APP_SITES and the hard-coded constants
  };
  /** Registry action ids the lightbox may offer on this host (e.g. ["artwork-hide","artwork-show"]). */
  actions: string[];
  /** File roots by source key for the folders route (e.g. { mine: users/<f>/, org: <org root> }). */
  fileSources?(viewer: ContentViewer): Promise<Array<{ key: string; label: string; root: string; showPrivate?: boolean }>>;
}
```
- `list.ts`'s `MARKET`, `ARTDIRECT`, `NETWORK_HOST` and the relative `/studio?id=` all move
  behind `host.urls`. Until callers pass a host, a `defaultHost()` keeps today's behaviour.

## 7. UI: one component

`ContentLibrary` is the single component. The existing props stay valid, and these are
added:
```ts
interface ContentLibraryProps {
  /* existing: items, identities, timeZone, now, initial, onStateChange, groupBySite, currentKey, primaryAction, header, empty, … */
  /** Remote mode: the component calls this instead of filtering `items` (debounced q, cursor "Show more", facets). */
  source?: { search(q: ContentQuery): Promise<ContentSearchResult> } | { endpoint: string };
  /** Published | Files | All, with `lockView` for a files-only browser. */
  view?: ContentView; lockView?: boolean;
  /** From MediaLibrary. */
  mode?: "browse" | "pick" | "pickMany";
  value?: string; picked?: string[];
  onPick?(item: ContentListItem): void; onToggle?(item: ContentListItem): void;
  /** Files view: folder navigation (Back, Forward, Up, crumbs, folder chips) through the folders route. */
  folders?: { endpoint: string; sources: Array<{ key: string; label: string; startPath?: string }> };
  accept?: string;                          // file filter, e.g. "image/*"
  upload?: { endpoint: string; fields?: Record<string, string>; label?: string };
  density?: "full" | "compact";             // compact = the Puck side panel and sheets
}
```
- **The file browser is not a separate component.** It is
  `<ContentLibrary view="files" lockView folders={…} />`.
- **`MediaLibrary` stays exported with the same props.** It becomes a thin wrapper that
  maps its props onto `ContentLibrary` (files view, locked), so elktours'
  `media-field.tsx` keeps working. `MediaLibraryFile` stays the value reported to its
  `onPick`. It is removed in Step 7.
- **Styles:** `content.css` (`eac-c-*` plus the restated `chn-*`).

## 8. Hub cards

- `contentCard` / `contentServer` come from `defineHubCard` / `defineHubCardServer`
  (`packages/hub/src/contract.ts`), at `@elkdonis/content/hub` and
  `@elkdonis/content/hub/server`.
  - Face: counts and the latest few.
  - Popup: `ContentLibrary`, remote mode.
  - Detail: the full page.
  - Gate: editor/keeper for the `site` scope; any member for `mine`.
  - The `actions` allow-list comes from `host.actions`.
- `HubCardMount` (`@elkdonis/hub/mount`) is generalised from sunjay's
  `SiteBuilderCardMount`/`useHost` (`apps/sunjay/src/components/hub/hub-card-host.tsx`).
  It is one mount for any card, and needs no SurfaceProvider.
- `channelCard` / `channelServer` (`@elkdonis/channel/hub`) are the lifted Sunjay Channel
  tile, as a `defineHubCard`. An app supplies its loader and door through
  `channelHubRoutes(door)`.

## 9. Rules for every change in this lane

- **The tree is shared and builds ship uncommitted work.** Every edit must leave all
  existing exports working and type-clean at every step. Add new files and exports; do not
  rename or remove. Deletions wait for Step 7.
- No builds, deploys, container restarts, commits or pushes without the PM, who asks
  Justin.
- Run `check-types` in throwaway containers only (`docker compose run --rm --no-deps …`),
  never in a live container.
- Test accounts only, never a real account. Label each claim as verified, assumed or
  unknown.

## 10. v1.1 additions (2026-11-26, answering the market lane's 7 needs in LEDGER.md)

All of these are additive.

1. **By store.** `ContentQuery.storeIds?: string[]`, `facets.stores: Array<{ id, name, count }>` (site and org scopes), and `ContentLibraryProps.groupBy?: "site" | "store" | "none"` (`groupBySite` stays as an alias). The index carries `store_id` for artwork.
2. **Sale state.** `ContentListItem.sale?: { state: "for_sale" | "in_auction" | "sold" | "reserved" | "passed" | "withdrawn" | "not_for_sale"; price: string | null }`, `ContentQuery.saleStates?`, and `facets.sale`. Hidden rows are excluded for everyone. A keeper can pass `includeHidden: true`, which is checked against rights on the server. The item carries `hidden?: boolean` for keepers only.
3. **Landing picks** stay a market frame outside the card for now. A registry action (`landing-pick`) is a later entry, logged as an open item.
4. **Opening a piece.** `ContentLibraryProps.onOpen?(item): boolean | void`. When it returns `true`, the host has opened its own frame (the market's piece → write / post / series stack) and the lightbox is skipped. The lightbox also gets `railSlot?: (item) => React.ReactNode`.
5. **Layers.** `HubCardMount`'s popup is one layer and does not own a stack. A host that needs stacked frames (Orders → Order → Refund) keeps cms-ui's `SurfaceProvider` for them. The card hands off through `host.navigate` / `onOpen`. The two can coexist on one page.
6. **Auction series** are not a ContentStore in v1. The market reads them itself. Their pieces are filtered with the existing `seriesId`. Indexing series becomes a v2 question if a search across them is wanted.
7. **One card, mounted twice.** The Content card takes `preset?: { title?: string; scope?: ContentScope; types?: ContentType[]; view?: ContentView; groupBy?: "site" | "store" | "none" }`, so "Artworks" (types [artwork], scope site, groupBy store) and "Content library" (every type) are two mounts of `contentCard`.
8. **A seller's file roots** (the market's `host.fileSources`; the market lane asked this in round 6).
   - `{ key: "mine", label: "My files", root: users/<storage_folder>/, showPrivate: true }`. A person's own `Private/` is theirs, which matches `canReadMedia`.
   - Then one `{ key: "org:<orgId>", label: <org name>, root: <org storage root>, showPrivate: false }` for each org behind a store the person can act for (`listActableStores`, `marketplace-auth.ts:90`), where the person also has a role in that org. Org `Private/` stays hidden in the picker, following the media lane's proposal (ELKTOURS_MEDIA §7).
   - No network-wide roots. The server builds these from the session, and a `source` key from the client only selects among them.
9. **Lightbox actions from the host.** `ContentLibraryProps.itemActions?: (item: ContentListItem) => PieceLightboxAction[]` gives the secondary actions after `primaryAction`. The host builds them from its registry allow-list (`host.actions`) and the server's `item.can`, e.g. Hide/Show for keepers. When it is absent, the lightbox is unchanged.
10. **Grouping by store.** `ContentListItem.storefront?: { id, name } | null` is filled by `searchContent` for artwork, from the index's `store_id` and the store's name. `groupBy="store"` groups by it; items without one fall back to the site grouping. It is named `storefront` because `store` already means the table (§1).

## 11. v1.2 (2026-11-26, Justin): public content is searchable and reusable across the network

Justin: people can network-search public content beyond what they published. As long as it is published, an image from a post can be used, or the article referenced, in a post, a listing page or a store, and shared with the listing's caption.

1. **`network` scope:** every published PUBLIC item on the platform, from every person and org. Any signed-in viewer, or a signed-out one, may search it. Files join once Step 5 gives them a public visibility.
2. **New scope `{ kind: "person"; userId: string }`:** one person's work under the normal rights predicate. A stranger sees that person's published public items; the person themself sees everything (the same as `mine`). It is used for an artist's pieces on a store or listing page.
   - `listContent({ ownerUserId })` for someone else no longer throws. It returns this person scope.
3. **Picking someone else's content is a reference, never a copy.**
   - `can.pick` is true for any signed-in viewer on published public items, and always true on the viewer's own items.
   - The consuming block stores the item's key (`thread:<id>`, `artwork:<id>`) and, for an image, the chosen public URL. It renders attribution from the item: owner, site and a link back.
   - Copying stays limited to files the viewer or org already holds (the media lane's decision 3). A cross-owner pick never copies bytes, so the credit and the owner's later edits or unpublishing carry through.
4. **Picking an image from a piece.**
   - `ContentListItem.images?: string[]` is filled by hydration: a thread's public media and an artwork's images, cover first.
   - `ContentLibraryProps.pickPart?: "item" | "image"`. With `"image"`, the lightbox shows the piece's images and `onPick(item, { image })` reports the item together with the chosen image.
5. **Unpublished or private stays out.** Drafts, hidden items, and ORGANIZATION or INVITE_ONLY items never appear to others in the network or person scope. The rights predicate decides this, unchanged.
6. **Open:** an owner opt-out from reuse (for example "don't let others use this"). The natural home is `content_prefs.never` (the CONTENT_LIBRARY_COMPONENT doc, §4). It is not built.

## 12. Index freshness: triggers feed a queue (2026-11-26, Justin approved)

- Table `content_index_queue (key text PRIMARY KEY, queued_at timestamptz)`.
- AFTER INSERT, UPDATE and DELETE triggers on `threads`, `artwork` and `auction_lot` (lot → its artwork). Each one only does `INSERT … ON CONFLICT DO NOTHING` of the affected key. There is no indexing logic in SQL; the one mapping stays in `services/content-index.ts`.
- **Draining:**
  - `searchContent` drains a small batch (≤ 25 keys, oldest first) before it queries.
  - `content-reindex.mts` drains everything.
  - A key is deleted only after its re-index succeeds.
- The direct write-path hooks stay; the queue catches every path they miss (app-local writes, order transactions, auction transitions, bulk SQL).
7. **References are resolved when the page renders, never trusted as stored.**
   - `resolveContentRefs(viewer, keys[], host)` in `@elkdonis/content/server` returns, per key, either the current `ContentListItem` (title, images, attribution, link) or `{ key, gone: true }` when the item is unpublished, hidden, deleted or no longer PUBLIC.
   - Blocks that show a borrowed image or essay call it, and render "No longer shared by its owner" for `gone`. That is the market lane's proposed wording, kept until Justin changes it.
   - A stored image URL is shown only while its piece resolves.
8. **Credit travels into text-only outlets.** When a post that carries a reference goes to an outlet with no link field (an Instagram or Facebook caption), the composer appends the credit line to the caption: "Photo: <owner> · <site>", plus the link where the outlet allows one. The poster can edit the wording but cannot remove the credit.
   - The default wording is the market's proposal, "Photo: owner · site · see the piece ↗" and "By owner · site · Read it there ↗", until Justin settles it.

## 13. v1.2 fixes from the Step 3 signed-in check (2026-11-26)

- **§10.2, amended.** An item's owner also gets `hidden: true` on their own hidden pieces. The `mine` scope, and the `person` scope for the owner, include them so the owner sees "Hidden from the site". Everyone else still never sees hidden rows.
- **`missing` is for real failed or absent reads only.** By-design gaps move to `ContentSearchResult.notes?: string[]`, which the UI does not show.
- **Facets apply the query's hard filters** (types, storeIds, saleStates, statuses, seriesId, q), so every facet count sits inside the selection.
- **Store names never show a raw id.** The fallback chain is the display name, then the store name or slug, then the owner's public name, then "Store".
- **Query-string name:** `includeHidden` is sent as `hidden=1` (`query-string.ts`).

## 14. Files are not network-discoverable (2026-11-26, PM, from Justin's s11 rule)

- Published content is what the network searches. An image is reusable because it belongs to a published piece (`images` on that item), not because a file sits outside `Private/` in a cloud folder. Reachable by URL is not discoverable.
- `store='file'` rows never appear in the `network` scope, nor in the `person` scope for anyone but the owner, whatever their visibility.
- Files are searchable by their owner (`mine`, and `person` for the owner), by affiliates of the file's org in the `org` scope (public and private files of that org), by site keepers in the `site` scope for the site's orgs, and by admins. Workshop files: managers of the org.
- `can.pick` on a file: the owner and the org's affiliates only. The personal-file sharing rule of s4 (people sharing an org with the owner) is dropped.
- Implemented in `contentReadSql` (`access.ts`), checked by `check-files.mts`.

## 15. v1.3: directory identities are a store (2026-11-26, ArtDirect session; approved by the PM with conditions)

The directory and the library are one search. Additive throughout; `published`, `files` and `all` return what they did.

1. **Store `person`** (migration 298), key `person:<identityId>`. One row per public identity: a `users` row with a slug and `directory_listed`, either `entity_type`. A pseudonym is its own row. The row's owner, org and site columns stay NULL; `identity_control` and email are never read. An identity that stops being listed loses its row (indexer and hydration both re-check). The CHECK also allows `org` for a later org indexer; no org rows exist yet.
2. **Index columns** (nullable, identity rows only): `place_city`, `place_region`, `place_country`, `entity_type`, `verified`, `rank_key` (verified first, then vouches, then name).
3. **Freshness:** queue triggers on `users` (insert, delete, and updates of the directory columns only) and `profile_vouches`. `indexPerson`, the drain, `reindexAll` (`--stores=person`) and `reconcileContentIndex` (`person` drift, present once 298 is applied) in `services/content-index.ts`.
4. **Types** (model.ts): `ContentStore` and `ContentType` gain `"person"`, `ContentView` gains `"people"`, `ContentListItem.person?: ContentPerson` (slug, entityType, headline, city, region, country, location, verified, vouches, claimStatus). `parseContentKey` and `resolveContentRefs` (KEY_RE) do not accept person keys yet.
5. **Rights:** `contentReadSql` never admits identity rows unless `opts.people` is set, and then by its own clause only: published, PUBLIC, not hidden, the same for every viewer (no owner, keeper or admin widening). Facets use the same predicate. `can` on a person item is `pick` for signed-in viewers, nothing else.
6. **Search:** `view: "people"` reads store person. Sort `"listed"` (rank_key; default in that view without q; elsewhere it reads as `"recent"`). Query filters `city`, `region`, `country`, `entityTypes`, `verified`, applied in the people view only. `facets.people` (entityTypes, regions, countries, cities with counts, plus a verified count) in the people view only; each dimension is counted under every filter except its own. Stores and sale facets are empty there.
7. **Host:** `urls.person?({ id, slug, entityType })`; a host without it gets `links.public = null`.
8. **Not changed:** `suggestContent`'s people query (moving it onto the index is a later change), the routes' `view` parser (`query-string.ts` VIEWS), MCP `content.search`.

## 16. One row per real entity: orgs and their profile users (PM ruling, 2026-11-26 ~23:50)

The link is `organizations.profile_user_id → users.id` (migration 099). On 2026-11-26, 16 of the 46 org-type directory profiles had an organizations row behind them. The other 30 are directory-only (places, venues, groups with no org site).

- **One row per real entity.** An org with an `organizations` row is indexed once, as `org:<orgId>`. Its profile user gets **no** `person` row: the person indexer skips users that are any org's `profile_user_id`. Directory-only org profiles (no organizations row) stay `person` rows, as today.
- **The directory reads both stores.** The `people` view spans `person` and `org` rows, with `entity_type` as a facet, so ArtDirect keeps all 73 profiles in one list.
- **Aliases resolve.** `resolveContentRefs` and the `person:` scope treat `person:<profile_user_id>` as an alias of `org:<orgId>`. Old keys stored in blocks or threads (e.g. an org posting as its identity) therefore still resolve, and a `person:<profile_user_id>` scope means that org's work.
- **Suggest de-duplicates** on the same rule: an org appears once, under Orgs.
- **Order:** this lands together with the org indexer, in one copy-in, after its migration (if any) is applied alone. Until then, today's 16 person rows stay as they are. No change is needed now.
- **The directory card must survive (ArtDirect dependency).** ArtDirect's directory (`apps/artdirect/src/app/page.tsx`, `toDossier`) draws only items that carry `item.person`, and links to `/<slug>` of the profile user. In the people view, an `org` row whose org has a `profile_user_id` must hydrate `person` from that profile user: slug, `entityType: 'organization'`, headline, place, verified, vouches, claimStatus. Its `links.public` comes from `host.urls.person(slug)`. **Acceptance:** a check-search G test where the people view still pages exactly the slugs of the listed identities (73 on 2026-11-26), so no org card drops off the directory.

> **§16 is ON HOLD (2026-11-26 ~23:59).** Justin, relayed by the ArtDirect session: *"theres artist, organizations (just the org-user stewarded thing) then associated business which include places or business beyond the collective also being stewarded … that we list the org-user not the org itself… paid work would be the other part of this. and if we include that it should include ability to carry with it the booking/payout mechanism"*.
> That points the other way: the **org-user** (a `users` row that is an `organizations.profile_user_id`, 16 on the live DB) is what gets listed, as a `person`-store row with `entity_type 'organization'`, and the org itself is not a separate listed row. Three kinds of listing: artists (27), org-users (16), associated businesses and places (30, entity_type 'organization' with no organizations row).
> The likely revision once he confirms: no listed `org` store; `org:<orgId>` stays a **scope** (an org's pieces) and resolves to its org-user's `person:` row for display; suggest's Orgs group shows org-users. Paid-work rows must carry their booking and payout references (offer → booking/checkout) so a listing can be acted on. Do not build an org indexer until this is settled.

## 16 (revised; supersedes the §16 text above). Orgs are listed through their org-users (Justin: "Yes, list org-users", 2026-11-27)

- **No listed `org` store.** The directory lists **identities**, in three kinds Justin named:
  - **artists:** 27 on 2026-11-27
  - **organizations:** org-users, i.e. `users` rows that are some `organizations.profile_user_id`; 16
  - **associated businesses and places:** `entity_type 'organization'` with no organizations row, stewarded beyond the collective; 30

  All three stay `person`-store rows, exactly as today. The 73 rows and ArtDirect's cards (`toDossier`, `/<slug>`) are unchanged.
- **Kind facet.** `listing_kind` = `artist` | `organization` | `associated`, derived at index time:
  - `organization` when EXISTS an `organizations.profile_user_id = users.id`
  - `associated` when `entity_type = 'organization'` without one
  - `artist` otherwise

  It is a people-view facet only.
- **`org:<orgId>` stays a scope** (an org's pieces: threads, artwork, its files for affiliates). For display, an org shows as its org-user's `person:` row: name, avatar, slug, link. `resolveContentRefs` maps `org:<orgId>` to that person row where one exists.
- **Suggest's Orgs group** lists org-users (and may list associated businesses under their own heading). Each org appears once.
- **Paid work** (time offers are threads; objects are artwork) carries its **booking and payout references** in the index and on the hydrated item: the offer id, booking mode (rsvp, booked, paid) and checkout or booking link, so a listing found in search can be booked or bought through the existing booking and checkout mechanism. It never computes money itself.
- **Order:** the `listing_kind` column (if stored) is one migration applied alone, plus a reindex of person rows. The paid-work fields follow EXTENDING.md §1 (thread kinds plus offer columns).

## 17. v1.4: paid work and checkout through the library (2026-11-27, ArtDirect session's team; approved by the PM with conditions)

Justin: "can we not put the stripe pay button on the ad its self … org agnostic as long as its through the library/search? essentially going through the non-org org oad … funds divied to orgs if in agreements with user about sale".

1. **Offers view.** `searchContent` `view: "offers"`, filters `offerKinds` (event | service | series | artwork | workshop; meetings count as event), `priced`, `upcoming`; `facets.offers` in that view only; `item.offer` = { kind, price, sliding, takeUp, checkout, when, capacity } (`model.ts` ContentOffer / ContentTakeUp; the takeUp strings equal cms-ui `offer-surface/types.ts`). Threads now carry `price_minor` / `currency` (workshop_pages.price_member first, then threads.price). Published, files, all and people return what they did (check-search part H).
2. **Services** are type `service`; `contentReadSql` hides them unless `opts.offers`. Service rows are written only when `CONTENT_INDEX_SERVICES=1` (off on 2026-11-27): apps built before v1.4 do not hide them.
3. **Checkout.** `contentRoutes(host, { payments, limiter })` adds `checkout` (POST /api/content/checkout, body `CheckoutRequest`) and `checkoutReturn` (GET /api/content/checkout/return) only when `payments` is passed. `server/checkout.ts` is a thin adapter: commerce `createThreadOrder({ orgId: 'oad', networkSale: true })` for threads (settlement and the order line use the thread's own org; metadata records `sellerOrgId`), the market's `createOrder` for artwork (hand-off to the market page for shipping or more than one variant), and the injected Stripe functions from `@elkdonis/checkout/stripe` with an idempotency key `order-<id>`.
4. **Guards.** The price is the server's; a client amount only within a stored sliding range. `returnTo` and the success URL come only from a verified host (site domain, `org_domains`, `<org slug>.<network host>`), else 400. POST requires `application/json` and an Origin, when present, must be a verified host (403). Rate limits 10/10 min per IP (last X-Forwarded-For entry) and 5/10 min per email; a host passes `redisRateLimiter(client)`.
5. **Enabling** on any app needs Justin's go for that app, and waits on his call about order visibility: network-sold orders appear in the thread org's `listOrdersForOrg`, but sellers and managers cannot refund thread orders (no `store_id`; admin refund works), and no booking row is created, so `/hub/bookings` and ArtDirect `/bookings` do not list a network-sold service.
