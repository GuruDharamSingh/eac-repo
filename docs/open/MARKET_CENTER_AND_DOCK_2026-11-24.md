# Market Center, store course and dock (2026-11-24)

Covers the market's `/center` (replacing art-auction `/studio`, "My art"), the dock on
market.arts-collective.com, the course a new store gets ("Finish your store"), the
directory-page branch, auctions as series, and the live close. Mock-ups: canvas
https://claude.ai/artifact/P9Xzy875cX9rNvye6szovt (page "Round 1": first layout and atlas
wiring; page "Round 2": faces → frames → pages, dock course flow, live close, store front).
Status on 2026-11-24: slice 1 (dock mount) is live; nothing else is built.

## Current state

- **Dock on the market, live** since the 2026-11-24 19:52 EST rebuild, `BUILD_ID`
  `vsrrp5L75Ltw2HKvaF54Y`. The previous build is backed up at
  `~/eac-backups/next/art-auction-20261124-1951.tgz`. The rebuild also deployed other
  sessions' uncommitted art-auction work in the tree.
  - Verified through the edge: `/` 200; `/api/actions/dock` 401 signed out and 200 signed in.
    The signed-in check used a test account enrolled in `elkdonis-path`, whose step link
    points at `https://arts-collective.com/learn/...`.
  - Verified in headless Chrome signed in: the dock's "Your next step" tab, and the open box
    ("The Elkdonis Path · Next step · 1 of 4 done"), with no page exceptions.
  - Not verified: a real member's account, or "Take me there" from the market.
  - `apps/art-auction/src/app/layout.tsx`: `<Dock run trail />`.
  - `apps/art-auction/src/lib/dock-actions.ts`: runDockAction (isDockAction allow-list, confirm
    rule, `performAction` with an `onPerformed` that settles course steps), dockDepart,
    dockReturn, dockChooseCourse, dockAckDone.
  - `apps/art-auction/src/app/api/actions/dock/route.ts`: GET, the shared `dockData` reader.
    Lessons link to arts-collective `/learn` (`stepHref`).
  - `apps/art-auction/src/lib/dock-links.ts`: `hub` is the arts-collective origin.
  - Deps `@elkdonis/actions`, `@elkdonis/dock`, `@elkdonis/lms` added to `package.json` and
    `transpilePackages`; installed with `docker compose run --rm install`.
  - `pnpm check-types` in art-auction: 0 errors (verified 2026-11-24, throwaway container).
  - Atlas hosts claimed on `run-registry-action` and the three `dock.state` rows; JOURNAL
    entry 2026-11-24.
- **What the mount shows once built:** the person's chosen trail, else `getting-started`, else
  other enrolments (`packages/actions/src/server/dock.ts:226`). Every task address in use
  today points at the hub (`packages/actions/atlas/entries.ts:20-36`), so "Take me there"
  leaves the market.
- **Market entries:** `store`, `artwork`, `payouts` exist. Their addresses open
  `journey:auction` or `artwork` surfaces on the hub (`entries.ts:28-30`, `present.ts`).
  art-auction mounts no SurfaceProvider, so those surfaces cannot open on the market.
- **Status checks:** `store` and `artwork` (published market artwork) and `payouts` are in
  `packages/actions/src/server/status.ts:200-216`.
- **Dock forms:** one exists, `profile-basics` (`packages/dock/src/forms.tsx`). A step is `do`
  (run in the dock after a confirm card) only when its entry is runnable and not money
  (`dock.ts:287`).
- **Confirm wording:** until wording is approved, a live dock shows a generic text,
  "<label>. This runs now, on your account." (`packages/actions/src/confirm.ts:34`). Draft
  wording shows only to admins and in development.
- **Return path:** a "Take me there" return path is local to the host that stored it
  (`isLocalPath`, `dock-state.ts:84`). A trip from the market to a hub address therefore comes
  back to a hub path.
- **Live close today:**
  - `/series/[slug]/live` (`live-board.tsx`) shows the open lot closing next by its end time,
    a countdown, what is coming up, closed lots and a bid feed, by polling. There is no
    presenter-chosen lot.
  - Soft close exists (`anti_snipe_minutes`, default 5; `packages/commerce/src/server/bidding.ts:15`).
  - The relay takes RTMP and WHIP in. HLS and WebRTC playback are off
    (`docs/reference/nextcloud.md` "Stream relay").
- **Series phase:** Publish is the only manual move. After it, silent bidding and the live close
  follow the series dates (`phaseOf`, `packages/commerce/src/queries/series.ts:74`).

## Plan

### Slice 2: course "Finish your store" (`market-store`)

State on 2026-11-24: written in source and type-checked (actions, dock, art-auction and
arts-collective: 0 errors). `check:registry` reports 51 entries, consistent. `atlas:check
--strict` shows only the unclaimed `createThreadOrder` that was there before. ~~The seed has been
run `--dry` only.~~

2026-11-24 23:43 EST: seeded on the live DB (course `TFrfgOX9TbH_EKsyDOa1w`, default run
`aI-1NsB71KaoK1Si-_EvS`, org `market`, area `publishing`, builds on `getting-started`).
art-auction rebuilt, `BUILD_ID` `RmtWnWsZijZLJYjsu0ZUJ` (built 23:46 EST; backup
`~/eac-backups/next/art-auction-20261124-2344.tgz`). The first build attempt failed on the Google
Fonts kit-URL glitch (Jost, `docs/reference/ops.md`); the backup was restored before any restart and
the rerun passed. Verified: home 200 and `/api/actions/dock` 401 through the edge signed out; signed in
(test account enrolled for the check), the dock route returned step `describe-your-store`, kind
`do`, `dockForm` `store-front`, generic confirm line, 0 of 3 required done; headless Chrome on `/studio`
showed the open dock with the description box and Save, no page exceptions. The test enrolment was
deleted and the account's dock row restored afterwards; one `registered` row stays in `lms_events`
(append-only). Not verified: a real store opening (the enrol trigger), a save through the dock form,
"Fill from my directory bio". ~~Not done: the arts-collective rebuild, so its
`/learn/market-store` lesson pages do not yet know `store-front` and `ship-from`.~~

2026-11-24 23:52 EST: arts-collective rebuilt by the Channel → Comments session (`BUILD_ID`
`Uz7GJEoAOL3wbWiHl-VGe`, container recreated; the developer had also asked this session for the
rebuild, so it did not run a second build). Verified: tenant-smoke 9/9; signed out, all five
`/learn/market-store` pages 200; signed in (test account, not enrolled; session revoked after),
`describe-your-store` shows "Not yet · Open a store first." with the description box and "Save to my
store", and `where-you-ship-from` shows "Not yet · No ship-from address yet." with the seven address
fields; neither shows "not known to this site". Backups: `arts-collective-20261124-2350.tgz` is
damaged (two sessions' tars wrote the same name); the last complete backup before this build is
`arts-collective-20261122-2223.tgz`.

- Shared code:
  - `ActionAddress.market` and `ActionLinks.market` (`packages/actions/src/types.ts`);
    `routeFor` picks the market address when the host passes `links.market`
    (`packages/actions/src/route.ts`).
  - Catalogue entries `store-front` and `ship-from`, with status checks (`server/status.ts`),
    runners (`server/run.ts`) and present cases (`present.ts`).
  - Dock form `store-front`, a textarea plus "Fill from my directory bio"
    (`packages/dock/src/forms.tsx`), and a textarea rule in `dock.css`.
  - `atlas/entries.ts`: market addresses for `artwork` (`/studio`, anchor `artwork`) and
    `payouts` (`/studio/payouts`, anchor `payouts`). New atlas area `apps.art-auction.dock.ts`
    with rows `store-front` and `ship-from` (draft wording, wave 5).
- art-auction:
  - `DOCK_LINKS.market = ''` (`src/lib/dock-links.ts`).
  - `src/lib/store-course.ts` (`startStoreCourse`), called from `applyArtistAction`.
  - `data-eac-anchor` on New artwork (`studio/layout.tsx`) and on the Payouts section.
  - A "Start here" badge while the dock outlines New artwork (`globals.css`, market only).
- Seed `packages/lms/scripts/seed-market-store.mts`: owner org `market` (default taken), public,
  area `publishing`, builds on `getting-started`, payouts optional.

Course steps:

| # | Entry | Kind | Done when | Control |
|---|---|---|---|---|
| 1 | `store-front` (new) | do, dock form: textarea + "Fill from my directory bio" | `store.bio_html` not empty on the person's market store | runner → the store profile save (`market-store-profile-save`) |
| 2 | `ship-from` (new) | do, dock form: street, city, province, postal code, country | `users.ship_from` set | runner → `setShipFrom` (`ship-from-save`) |
| 3 | `artwork` (exists) | go | a published market artwork (`status.ts:207`) | market address `/studio` (later `/center`), anchor `artwork` on the New artwork button |
| 4 | `payouts` (exists) | go, money, link only | Stripe onboarded | market address `/studio/payouts` (later `/center/payouts`), with the disclosure block |

Trigger: when `applyArtistAction` opens a person's store (`market-store-apply`; stores open at
once since 2026-11-24), enrol in `market-store` and `dockChoose(userId, 'market-store')`. The
dock then opens on the welcome card. Org stores are not enrolled.

Shared changes this needs:

- `ActionLinks` gains a market origin, and `routeFor` (`packages/actions/src/route.ts`) picks
  the origin by `address.host`/`app` instead of always `hub`. On the market itself the origin
  is `''`, which keeps return paths local.
- `presentAction` cases for `store-front` and `ship-from`. The `artwork` and `payouts` cases on
  the market become links, not hub surfaces.
- Two dock forms in `packages/dock/src/forms.tsx`.
- Catalogue rows and `ENTRIES` entries, then `atlas-emit` and `check:registry`. Atlas rows get
  the new entry ids and draft confirm text, gathered into the next wording wave.
- The tutorial badge: the dock already outlines `data-eac-anchor` on arrival. The page adds a
  badge on the New artwork button while the `?eac-step` ticket matches.
- Seed script `packages/lms/scripts/seed-market-store.mts`, on the pattern of
  `seed-getting-started.mts`. It writes `lms_courses` on the live DB.

### Slice 3: course "Your directory page" (`directory-page`), a branch of Getting started

- Offered after `market-store` when `gain-space` or `listing` is not done. Steps: `profile`
  (dock form; bio prefilled from the store front description when the bio is empty, marked
  "from your store front, for now"), `gain-space` (run: folder and listing), `listing`.
- Steps done on another site show ticked, because status is read from platform state.
- Lesson text explains the separation: the directory page is the person's own space, apart from
  any store or organisation, and taking the space gives a cloud folder. Draft wording is in the
  canvas, board R2DockFlow F.

### Slice 4: `/center` on the market

**2026-11-26: phase 2 (popups) live, and `/hub` phase 1** (art-auction `IQlFvc03NaqDZVsg73hBb`, restarted about
20:38 EST; backup `~/eac-backups/next/art-auction-20261126-2031-hub.tgz`, which holds `Rq-HLEaBo7nvgpDg3mCEn`;
uncommitted).

- `/center` popups use cms-ui surfaces (one `<dialog>` with stacked layers):
  - `center/layout.tsx` mounts `CenterSurfaces`.
  - Custom keys `market-store`, `market-artwork`, `market-piece`, `market-entry`, `market-money` are drawn in
    `center/_components/frames.tsx`.
  - They load through `center/frames.ts` and save through /studio's own forms and actions:
    - Store: Store front and Shipping tabs.
    - Add or edit a work: `ArtworkForm` gained an `onCreated` prop, and the edit mapping moved to
      `studio/artwork-initial.ts`.
    - A piece: Publish, Re-list and Unlist; Edit stacks a layer; Write and Post link to arts-collective.
    - Series entry: `enterSeriesAction`, the first caller of commerce `enterSeries`, claimed in the atlas as
      `center-series-entry`.
    - Money.
  - The surface is a modal `<dialog>`, so each popup carries its own sonner toaster.
  - Studio's radix confirm dialogs (orders, lots) would sit behind the dialog, so Sales and Auctions stay links.
  - `surface.css` and the token and kind colours are in `globals.css`. They add only `.eac-*` rules and
    variables.
- `/hub` (keepers only, `requireKeeper`, replacing `/admin`):
  - Bands are drawn as in round 6.
  - Orders (admins): `hub-orders` → `hub-order` → `hub-order-confirm`. Refund and cancel are a stacked compact
    layer, calling /admin's actions.
  - Stores (keepers): `hub-stores`, with Pause and Make active.
  - The content lane's Artworks, Content library and Channel cards, with "Open page" to `/hub/content` and
    `/hub/channel`.
  - Series, Applications, Money, Members, Visitors, Pages and Loft still link to `/admin/*`.
  - The header's admin link reads "Hub". `/admin` is unchanged.
- Verified 2026-11-26 in headless Chrome at 1440, signed in, with test accounts created for the check and then
  deleted, with no exceptions, no 5xx and no horizontal overflow:
  - Seller:
    - Store opened with both tabs.
    - Add a work drew the artwork form.
    - The piece opened; Edit stacked a layer with its crumb, and Back returned.
    - Unlist ran (the test piece showed Taken down, then Re-list).
    - Series entry showed its empty state (the account is in no series).
    - Money opened.
  - Keeper (owner of org `market`, not an admin): `/hub` showed Stores and the three content cards; the Stores
    popup opened (Pause not pressed).
- Not verified:
  - the Orders popups and their actions (they need a network admin);
  - a real series entry;
  - the content lane's card popups under `/hub`;
  - phone widths for the popups.
- Known: signed out, `/hub` sends you to `/login?next=/admin/stores`, because `requireKeeper` uses
  `signInPath("/admin/stores")`.


**2026-11-26: phase 1 built and live** (art-auction `Rq-HLEaBo7nvgpDg3mCEn`, built 19:38 and restarted about 19:43 EST; backup
`~/eac-backups/next/art-auction-20261126-1937-center.tgz`, which holds `PKZjPuX_-0bGWkONrnB79`; uncommitted).

- Files:
  - `apps/art-auction/src/app/center/page.tsx`: the cards, laid out as round 5.
  - `center/_components/center-client.tsx`: the profile flip card, the two-tab lists and the rows.
  - `center/actions.ts`: `chooseCenterStore`, the "Acting for" switch. It uses the same cookie as /studio and is
    recorded as ignored in the atlas.
  - `center/work/page.tsx`: the content lane's "My work" library, moved from `/center`.
  - `components/site-header.tsx`: signed in, the header button reads "Center" and goes to `/center`; signed out
    it still reads "Sell your work".
- Cards read the queries /studio uses and link to the /studio, /orders, /lots and /messages pages. The popups
  (store tabs; listing → write / post / series entry) are phase 2.
- A card with nothing to show is left out, and its row's widths are respread so no gap is left.
- Next shows LMS trails only. Ongoing series shows auction series only; showcases and events wait on their models.
- Verified 2026-11-26:
  - Signed out, through the edge: `/center` and `/center/work` answer 307 to `/login?next=…`.
  - Signed in, in headless Chrome at 1440 and 390, with no exceptions, no 5xx and no horizontal overflow:
    - a no-store test account (`claude-studio-1009@test.invalid`): profile, Open a store, Ongoing series;
    - a test seller created for the check, then deleted: profile, store, publish, listings, ongoing series,
      money and the Drafts chip; the flip card and the Past tab respond;
    - `/center/work` for the same test seller.
- Not checked:
  - a seller with bids, orders, messages, trails or desk series (those cards have not rendered with data);
  - the "Acting for" switch with two stores.


- Replaces `/studio`, which redirects. It is built from faces (cards) that open frames (dialogs
  with tabs), and a frame opens as a page ("Open as page", `/center/store` and so on).
- Faces:
  - Profile: flips, using the `ProfileFlipCard` look.
  - Store: frame tabs Store front, Shipping, Look, Listings, Gallery, Articles, with a preview
    link.
  - Auctions: the network's running series, not the person's.
  - Listings: Current and Past tabs, with actions on past pieces.
  - Messages, Money, Series you help run, Installations.
- Messages leaves the header.
- art-auction would need `SurfaceProvider` (from `@elkdonis/cms-ui/surface`), or its own dialog
  frames, because it compiles no Tailwind over cms-ui (`docs/reference/frontend-ui.md:53`).
- The store front (`/artists/<slug>`) gains optional Gallery (pictures from the person's cloud
  folder) and Writing (Studio pieces picked by the person) sections, and a cover. See board
  R2Storefront.
- Developer's review of round 2 (2026-11-24), applied on board R2Center. Each item lists what it
  needs underneath:
  - **Publish is the third face again.** A drop zone ("Drop pictures to start an artwork")
    opens a library frame (cloud folder, this store, upload; the pictures picked, in order,
    the first as cover), plus Artwork, Article and Series entry, and the drafts.
  - **A listing opens a piece frame.** The piece, its facts and its counts: page views
    (`artwork.view_count`), favourites, messages, bids. When sold, the order panel shows the
    buyer's city, the courier chosen at checkout, ship-from, "Download label (PDF)" (platform
    labels, `shipping-label-buy`), packing slip and "Mark handed to courier".
  - **The piece frame's side panel** follows the Studio's Board sheet
    (`packages/studio/src/board.tsx`): Next for this piece, Write about it (a draft linked to
    the piece; the Channel piece key `artwork:<id>` exists), Where it has gone, Make into.
  - **Store Look:** one colour gives three, with Triadic, Split and Analogous harmonies, a hue
    slider and presets. Roles are Primary (buttons, links, cover), Second (badges, bands) and
    Accent (highlights), with a white-on-primary contrast check (AA 4.5:1) and a live preview.
    Storage is open: the store table has no theme or settings column (`\d store`, 2026-11-24),
    so this needs a migration or a `site_config` / `site_themes` key per store.
  - **Store Links: "Inspiring" links** (title, address, a note), shown as a section on the
    store front, kept apart from the shop links under Store front. Storage is open in the same
    way.
- Round 3 (2026-11-25, canvas page "Round 3", boards R3Center and R3Phone). The developer asked
  for `/center` refined and a `/hub` for the site's admins; `/center` is taken as the name for the
  person's page (assumed from "how about /center"):
  - Account menu holds Center, Hub (keepers only), directory page, Studio, Log out. The Center
    button carries the count of to-dos; Messages is not in the header.
  - The strip: "Acting for" (own store, organisation stores where the person is on the team,
    "Just me") and "Network" pull-downs, then to-do chips that open the matching frame.
  - Faces depend on the person. With a store: Profile, Store, Publish; Listings, Auctions;
    Messages, Money, Trails, and Installations or Series. Collector without a store: Profile,
    Collecting (Bids, Orders), an "Open a store" door with the three course steps and the 5%;
    Auctions, Messages; Trails and "Your directory page". The Series face shows only for people
    who help run a series.
  - The store course shows on the Store face while it runs (phone board, 2 of 3, New artwork
    outlined with "Start here"), then moves to the Trails face.
  - Each face names its page: `/center/store`, `/center/publish`, `/center/listings`,
    `/center/collecting`, `/center/messages`, `/center/money`, `/center/series`,
    `/center/installations`.

### Slice 5: `/hub` on the market (round 3 board R3Hub, R3HubPhone)

- `/hub` is the market's console for its keepers and replaces `/admin`, which redirects. Keepers
  are owners of the `market` org and network admins (`requireKeeper`,
  `apps/art-auction/src/lib/marketplace-auth.ts:217`; `isMarketKeeper` checks `role = 'owner'`
  only).
- Faces map today's ten `/admin` tabs (`apps/art-auction/src/app/admin/layout.tsx`): Overview and
  Visitors → Pulse; Orders (To pay, To ship, Shipped, Problems; a row opens the order frame with
  the split, label state, refund and cancel behind a second confirm, and a timeline); Stores
  (with Applications, and each new store's progress in Finish your store); Artworks; Series
  (Publish as the one manual move); Money (held amounts; release stays on the network ledger,
  admins only); Members; Pages and Loft → Site. New faces: Shipping (labels bought, failed) and
  Trails (the `market-store` funnel by step, with "Message the people stopped at a step").
- Scope: today a non-admin owner gets Stores and Artworks only. The board proposes Stores,
  Artworks, Site and Trails for owners; Orders, Money, Series, Shipping and Members stay with
  network admins. Developer's call.
- Data that exists for the Trails face: `lms_enrolments` and `lms_step_state` for the course.
  Data that does not exist yet: a "failed label" state is assumed from the Easyship flow, not
  checked.

### Surfaces for both pages (round 4, 2026-11-25)

The developer asked for the cards' surface level "as the surface patterns would have it", after
looking at other org hubs. Boards R4Hub, R4Center, R4Phone and R4Map (canvas page "Round 4";
published 2026-11-25). The table on R4Map lists every card's face, surface,
pushes, page and gate.

- Survey of the other hubs (2026-11-25, read from code): three card systems are in use.
  - cms-ui `SurfaceCard` faces that open a surface in the app's one `<dialog>`
    (innergathering and sunjay classic, elktours Office band).
  - `HubLinkCard` link cards to pages with "Hub › X" crumbs (`cms-ui/hubsite`; innergathering
    and ifac "Cards 2", katie-the-potter, elktours).
  - `@elkdonis/hub` `defineHubCard` cards with Face, Popup and Detail and a gate (ifac Members
    and Review, sunjay Site builder).
- Drawn with the first system. Faces sit in bands (`--lead` of three, then three, then a pair,
  then errand links). Each face opens a `custom market-*` surface (orders, series, stores,
  artworks, pulse, trails, money, shipping on /hub; store, listings, auctions, messages,
  collecting on /center). Existing descriptors are reused where they fit: `artwork` (Add a work),
  `write`, `profile` tab `payouts`, `me`, and `journey:auction`, which IFAC's hub card already
  opens as "Sell your art on the market".
- Stacks shown: Orders → Order → Refund (compact, danger primary); Stores → Store;
  Series → Series → Publish; Shipping → Label; Listings → Piece → Write (full).
- Needed in code: `SurfaceProvider` and `surface.css` in art-auction; the `custom` surfaces
  registered under `connectors.custom`. `custom` does not serialise to `?surface=`
  (`packages/cms-ui/src/surface/url.ts`), so deep links need a `?hub=` parameter like elktours'
  `?office=`, or first-class descriptors. Six new kinds would also be needed (order, store,
  ledger, shipping, pulse, trail).
- Open: which card system (above); owner scope on /hub; the journey's three steps ("publish,
  show your store, set up payout") differ from Finish your store's; kind colours; whether the
  market's Overview and Visitors tabs read the shared analytics beacon (not checked).

### Round 5 (2026-11-26)

Developer's response to round 4 (2026-11-26), with the published boards (canvas page "Round 5": R5Center,
R5Storefront, R5Hub, R5Map).

- **/center:** round 3's layout is preferred over round 4's bands, keeping round 4's frames:
  - Listings → piece, and the store frame.
  - "Auctions on the market" becomes "Ongoing series". A series can be an auction, a curation of
    content or an events series, and the market org itself can present one.
  - Gentle Channel-style suggestions; the Trail card belongs on /center too.
  - The store page gets an optional writing section and the series site's add buttons.
  - Drawn as follows:
    - The Store face's buttons open the store frame at their tab, which now has a Writing tab with
      "+ Add article".
    - A "Next" card replaces Trails: the trail line, then at most two moves worded as in
      `packages/channel/src/next.ts` ("Gap · Facebook", "Add to the queue"), each with "Not now".
    - Ongoing series filters All | Auctions | Showcases | Events.
    - The store front board has an owner bar and section-head buttons "+ Add artwork" and
      "+ Add article".
- **/hub:** round 4 is preferred. It also gets the general hub cards (Publish, Content library,
  Calendar, Profile, Email, Forum), plus:
  - Artworks listing every artwork on the site, by recent or by store.
  - Auction series, plus the series planner from IFAC.
  - Members, from IFAC's card.
  - The Channel card from sunjay.
  - Drawn as a band "Publishing and people" of eight faces, taking the existing faces' strings.
- **Survey of the code (2026-11-26, read-only; citations on R5Map):**
  - The auction series page has no artist entry button. Editors get "+ Add artwork" and editors
    and contributors get "+ Add article" (`apps/art-auction/src/app/series/[slug]/page.tsx:87`).
    `enterSeries` / `listEnterableSeries` exist (`packages/commerce/src/server/series.ts:255-306`)
    with no caller.
  - Auction series (`auction_series`, migration 190) and meeting series (`threads.kind='series'`)
    share no kind field. No curated showcase kind exists.
  - The store front (`apps/art-auction/src/app/artists/[id]/page.tsx`) has no writing section.
  - `/admin/artworks` has no sort or filter; the query takes an unused status filter and no store
    filter.
  - No hub has a Content library card. The only library is `channel:library` on arts-collective.
  - IFAC's Members card (`@elkdonis/hub`, gate guide) is in its classic layout only.
  - The series planner's tabs are "Sessions", "Manage" and "+ New series".
- Open (also on R5Map):
  - Model a showcase as its own table, as a flag on `auction_series`, or as a meeting series
    without sessions.
  - One Series list over two models.
  - Source of /center Next: Channel moves exist per site, not per person.
  - Whether to lift `channel:library` into a package.
  - Where store writing is stored.
  - Kind colours for the eight general cards.
  - The non-admin owner's scope.

### Round 6 (2026-11-26)

On the developer's go, the round 5 cards are redrawn against the content cornerstone contract v1 plus its v1.1
additions (`docs/open/CONTENT_CORNERSTONE_2026-11-26/CONTRACT.md` §10). Those additions answer the market lane's
seven ledger points. Boards R6Center, R6Hub and R6Map are on canvas page "Round 6" (published 2026-11-26).

- **/center:**
  - "My work" replaces Listings. It is `ContentLibrary` scoped to the viewer's own work, with
    Published | Files | All and sale chips; Current | Past becomes the sale chips.
  - A row opens the market's piece frame through `onOpen` instead of the library's lightbox, so Write, Post and
    Series entry still stack on it.
  - The Publish drop zone opens `ContentLibrary` in the files view (locked to files), picking several
    `image/*` files, with folders and upload.
  - "+ Add article" picks from the viewer's writing.
  - Series entry picks from the viewer's artworks that are for sale.
- **/hub:**
  - "Artworks" and "Content library" are two mounts of one `contentCard`:
    - Artworks: preset types `[artwork]`, scope `site`, grouped by store. It has sale chips, a store
      picker and "Show hidden" for keepers, and its lightbox has Hide/Show.
    - Content library: every type, with the Files view over the market org's folders.
  - Channel is the lifted `channelCard`. A piece opens inside its one popup.
  - Orders, Stores, Series, Money and Shipping keep stacked cms-ui surfaces.
  - "Landing picks +" is a market frame. It picks artworks for sale through `ContentLibrary`.
  - The auction frame has "See the lots", which lists the series' pieces filtered by `seriesId`.
- Nothing is wired into art-auction. That waits for the content lane's Step 3.
- Reuse (contract v1.2 §11, the developer's decision recorded there 2026-11-26): any published public piece can
  be referenced in a post, a listing or a store, with the user's own caption. A reference stores the key and the
  chosen image URL, and renders the credit (owner · site · link back). Board R6Reuse draws four things:
  - the network picker, using `pickPart: "image"`;
  - a borrowed image in a post;
  - a referenced article and image on a store front;
  - the artist's work across the network (`person:<userId>`).

  The content lane adopted these as contract text on 2026-11-26 (§11.7–11.8):
  - References are resolved when the page renders (`resolveContentRefs`). A gone piece shows
    "No longer shared by its owner", and its stored image is no longer shown.
  - The credit is appended to Instagram and Facebook captions; the poster can reword it but not remove it.
  - The credit wording is the default until the developer settles it.

  An owner opt-out from reuse is open (contract §11.6).
- Still open (R6Map):
  - The showcase kind.
  - The source of /center Next.
  - Where a store's chosen articles are stored.
  - ~~Which file roots `host.fileSources` gives a seller.~~ Settled 2026-11-26 in CONTRACT.md §10.8 (content
    lane):
    - `mine` is the seller's own folder, `Private/` included.
    - Each org behind a store they can act for, and hold a role in, adds one `org:<orgId>` root, with
      that org's `Private/` hidden.
    - There are no network-wide roots.
  - Kind colours.
  - What a market owner who is not a network admin sees.

### Auctions run as series (developer, 2026-11-24)

- The Center offers "Enter a series" in place of "Put a piece up for auction". Standalone lots
  (`lot-create` without a series) stay in code and are not offered.
- Course step 6 of round 1 ("Put a piece up for auction") is dropped from `market-store`. A later
  course covers "Enter a piece in a series".

### Live close

- Page: extend `/series/[slug]/live` rather than adding a `/liveclose` base. The page already has
  the lot data, polling and bid feed.
- Add a video band on top, and a desk strip for the series team: "Show next lot", "Extend",
  stream state.
- Video, option A (recommended first): the booth streams through the relay to YouTube Live or
  Facebook Live (both exist: Go live card, `stream_destinations`). The series stores the watch
  URL and the page embeds it. Viewer load stays off the server.
- Video, option B (later, small rooms): turn on MediaMTX WebRTC/HLS playback of `program`
  behind an edge location. Bandwidth then comes from the server's uplink.
- Lot on the block: time-driven as today, plus a desk pointer ("now showing", a series field the
  desk writes) so the lot shown follows what is being talked about. The pointer changes nothing
  about closing times; soft close still governs them.

## Open items (developer)

1. ~~Rebuild art-auction to put the dock live.~~ Done 2026-11-24 19:52 EST on the developer's
   word (`vsrrp5L75Ltw2HKvaF54Y`).
2. ~~Slice 2 seeding: owner org of `market-store` (`market` or `elkdonis`), and the go-ahead to
   write it on the live DB.~~ Seeded under `market` and art-auction rebuilt 2026-11-24 on the
   developer's word ("Seed + rebuild market"). arts-collective rebuilt 23:52 EST
   (`Uz7GJEoAOL3wbWiHl-VGe`); lesson pages know both steps.
3. Confirm wording for `store-front` and `ship-from` (wave after wave 4).
4. ~~Naming: `/center` (assumed) or `/hub`.~~ 2026-11-25: both. `/center` for the person,
   `/hub` for the market's keepers (replacing `/admin`). Open: which faces a non-admin owner
   sees on `/hub` (slice 5).
5. Live close video: option A first?

## Cornerstone note (PM, session system32-43, 2026-11-26 18:10)

The content library is now the platform's one search and one component (`docs/open/CONTENT_CORNERSTONE_2026-11-26/`; read CONTRACT.md). Answers to round 5's open items:
- **Lift `channel:library` into a package?** Yes, as `ContentLibrary` in remote mode, served by `/api/content/search`.
- **Which card system?** `defineHubCard`. A Content card (`@elkdonis/content/hub`) and the lifted Channel card (`@elkdonis/channel/hub`) both mount with one `HubCardMount` (`@elkdonis/hub/mount`), so the market needs no SurfaceProvider for them.
- **"Artworks … by recent or by store" on /hub** is the Content card with scope `site`, keeper-gated, with Hide/Show as registry actions.
- **/center Listings and the Publish face's library frame** are `ContentLibrary` with scope `mine` and Published | Files | All.

The market lane owns the pages, frames and bands, and builds against CONTRACT.md. The cornerstone lane owns the library, the card and the data, and is building them now. Please hold the art-auction wiring for these packages (deps, `transpilePackages`, the content routes) for cornerstone Step 3.
