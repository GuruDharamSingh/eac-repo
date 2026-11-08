# Art auction: implementation plan (2026-10-18)

Plan for the work decided in `docs/open/ORG_STORE_BRIEF_2026-10-15.md` (D1-D10, R1-R10, all answered 2026-10-18): organisation stores, artist credit and donation tags, beneficiaries, a flat commission with money pages on art-auction, auction mechanics, the auction series, and the "My art" hub. Target: a silent auction opening in November 2026, a live close in its last week. Status 2026-10-18 (night): Phase A applied (migration 209). Phase B built and deployed on art-auction, ifac, arts-collective and artdirect (builds backed up to `~/eac-backups/next/*-20261018-2039.tgz`). Verified: IFAC `/manage/store` and arts-collective `/hub/store?org=ifac` render both panels signed in as an IFAC guide; art-auction `/studio/artworks/new` on the IFAC store shows the credited-artist, donation, beneficiary and estimate blocks; a service-level smoke run (stranger refused, credited piece listed, shown artist = credited name, provenance and beneficiary stored, decline removes the name and the piece stays available) passed; ArtDirect shows a credited piece under "Also credited on". Not checked in a browser (no screenshot, client-side errors unknown); the add/remove actions in the panels were not exercised. The `occurredOn` date fix in `mapProvenance` is source-only until art-auction's next rebuild. Phases C-F deployed on art-auction by 2026-10-19 02:00 (see each section); the `auction-clock` service runs. Phase G (PayPal, live call with floor bids, shipping rates) not started. artdirect runs dev mode; its changes are live without a build.

Concurrent work, same day: another session is building the Center's "sell in the Art Auction" journey (`packages/commerce/src/server/journeys.ts`, untracked; migration 207 sets `store.commission_rate` default to 5.00; small diffs in `commerce/src/server/index.ts` and `checkout/src/server/stripe.ts`). This plan builds on that: the commission is `store.commission_rate`, not `org_agreements`. Check `git status` on those files before editing them.

## 1. Decisions this plan implements

| # | Decision | Source |
|---|---|---|
| 1 | `market` is the auction's administrative org; its owners are the desk. Elkdonis (`inner_group`) hosts the one Stripe account; the `elkdonis` row stays as is. | D1, R1 |
| 2 | Org owners and guides can open the org store; `store_member` stays the access list, edited from one shared Store team panel on the org manage page and `/hub` Organization. | D2, R9 |
| 3 | The store is the payee. `credited_artist_user_id` credits without paying; no consent; the artist can reject the credit from ArtDirect. | D3, D4 |
| 4 | Provenance events: "donated by X to Y". | D3 |
| 5 | Beneficiaries: a `payee` registry (org or charity), per-org lists, buyer may suggest, owner approves before release. Listing-level "proceeds to charity"; buyer-level "support" choice for the commission (market default, IFAC, Elkdonis, or a split). | D5, D6, R2, R3 |
| 6 | Commission: flat 5% (`store.commission_rate`), editable in the art-auction admin. Artist receives price − commission − Stripe fee. Pass-through for charity listings, proceeds statement, no tax receipt. | R2, R3 |
| 7 | Money pages on art-auction: owed, paid, release, record payout. Network ledger stays the global view. | R3 |
| 8 | Auction: increment ladder, 5-minute soft close, 72-hour payment window, staggered closes with a presenter page, card on file before bidding, proxy bids, buy-now. | R4-R7 |
| 9 | Series on migration 190: description, card, landing page, weekly focus, manage page with a Help tab; participants attach or create publications; no obligations, no blocking. | D10, R8 |
| 10 | `/studio` is labelled "My art" (path kept): My art · org store tabs · Auction series · Profile. One artwork editor. | D8, D9, R10 |
| 11 | Later sessions: PayPal (buyer payments, then PayPal Giving Fund), the live call with floor bids (design by mid-November), a shipping-rate API. | D7, R5, R8 |

## 2. Phases

Order is by what November needs first. Each phase ends deployable on its own. Migrations: take the next number with `/new-migration` at the moment of writing (concurrent sessions claim numbers); 207 is the latest as of 2026-10-18.

### Phase A. Schema (one migration, applied before any rebuild)

- `artwork`: `credited_artist_user_id uuid NULL REFERENCES users`, `credit_status text CHECK (credited | rejected) DEFAULT 'credited'`, `estimate_low_minor`, `estimate_high_minor`.
- `artwork_provenance` (id, artwork_id, org_id, kind `donated | consigned | acquired | commissioned`, from_user_id NULL, from_text NULL, to_org_id NULL, occurred_on date NULL, note, created_by, created_at).
- `payee` (id, kind `org | charity`, org_id NULL, name, registration_no NULL, website NULL, blurb, receipting `none | intermediary | self` DEFAULT 'none', status `active | suggested | retired`, suggested_by NULL, managed_by_org_id, created_at). Seed rows: org payees for `market`, `ifac`, `inner_group`.
- `org_beneficiaries` (org_id, payee_id, position, PRIMARY KEY (org_id, payee_id)).
- `artwork_variant`: `beneficiary_payee_id NULL`, `beneficiary_scope text CHECK (all_proceeds | commission) NULL`.
- `commerce_order`: `support jsonb` (`{"split": {"<payee_id>": 100}}` or two keys summing to 100), `beneficiary_payee_id NULL`.
- `commerce_order_line`: `beneficiary_payee_id NULL`, `beneficiary_share_minor bigint DEFAULT 0`, `processor_fee_minor bigint DEFAULT 0`.
- `payout_ledger`: extend the party constraint with `party_kind = 'payee'` + `party_payee_id`; `hold_reason` gains `pending_beneficiary`.
- `auction_lot`: `series_id uuid NULL REFERENCES auction_series`, `closes_at_override`, `lot_number int NULL`; `buy_now_minor` already exists.
- `auction_series`: `description_html`, `card jsonb` (eyebrow, image, blurb), `close_mode text CHECK (single | staggered) DEFAULT 'staggered'`, `stagger_seconds int DEFAULT 90`, `increment_ladder jsonb`, `soft_close_minutes int DEFAULT 5`, `payment_window_hours int DEFAULT 72`.
- `auction_series_slot`: `focus text` (the week's key focus). `auction_series_slot_artwork` stays.
- `bidder_registration` (user_id, org_id, phone, stripe_customer_id, stripe_payment_method_id, registered_at, PRIMARY KEY (user_id, org_id)).
- `marketplace_settings` (org_id PRIMARY KEY, default_commission_rate numeric DEFAULT 5, increment_ladder jsonb, soft_close_minutes, payment_window_hours). One row for `market`; the admin edits it.

### Phase B. Org stores and the artwork form

Written 2026-10-18, unbuilt. What landed: `openOrgStore` accepts guides and seats every owner/guide; `canManageStoreTeam` + `addStoreMemberByEmail` (`packages/commerce/src/server/store-team.ts`); payee registry functions (`server/payees.ts`); `createArtwork`/`updateArtwork` take `actorUserId`, credit, estimate, provenance and beneficiary; `rejectArtworkCredit`; queries resolve the shown artist from maker → credited → org, `listArtworks({personUserId})`, `listArtworksForPerson`, `listProvenance`; cms-ui `StoreTeamPanel` + `BeneficiariesPanel` (`@elkdonis/cms-ui/store`, `store.css`); art-auction form blocks (credited artist search, donation, beneficiary, estimate) via `studio/listing-context.ts`; IFAC `/manage/store` tab and the "List in IFAC's store" switch on the hub composer (`orgStoreName` prop on cms-ui `ArtPieceComposer`); arts-collective `/hub/store?org=`; ArtDirect `CreditedWork` with "Decline credit"; `asPortfolio` keeps `artworkId`.

Files: `packages/commerce/src/server/index.ts` (`openOrgStore :652`, `canOrgSell :515`, `createArtwork :1013`, `updateArtwork :1067`), `packages/commerce/src/server/access.ts`, `apps/art-auction/src/app/studio/_components/artwork-form.tsx`, `apps/art-auction/src/app/studio/actions.ts`, `apps/ifac/src/lib/cms/art-piece-actions.ts`, new `packages/cms-ui/src/store/StoreTeamPanel.tsx`.

1. `openOrgStore`: accept `owner | guide`; add every current owner as `store_member.owner` on open.
2. Store team panel (cms-ui): list, add by email, remove, role. Server actions in `@elkdonis/commerce/server` (`addStoreMember :716`, `removeStoreMember :733`) behind `canActForStore` or org owner/guide. Mount in IFAC `/manage` (new tab `store`, `components/manage/manage-tabs.tsx:11-21`) and in `/hub` Organization (a Store band in `apps/arts-collective/src/lib/org-console.ts`).
3. Artwork form, org-store context: replace "Credit me" with a credited-artist picker (search `users` by email or name; org members first), a "Donated" block (donor: a user or free text; to: the org; date), and a Beneficiary block (from the org's list; scope all proceeds or commission). Personal stores keep "Credit me" and get the same Beneficiary block.
4. `createArtwork` / `updateArtwork`: write credit, provenance and beneficiary; both now take `actorUserId` and call `canActForStore` themselves (closes the gap noted in the brief §2.2).
5. IFAC "Art piece" composer: when the acting identity is the org (`listActingIdentities`, `packages/services/src/identities.ts:141`), list into the org store (`getStoreForOrg`); otherwise into the member's store, as today.
6. ArtDirect: the Store section lists own-store work plus work credited to the person (`listArtworks({artistUserId})` extended to `credited_artist_user_id`); each credited card has "Reject credit" → `credit_status = 'rejected'`. Fix `asPortfolio` dropping `artworkId` (`packages/services/src/profiles.ts:195-212`).

Verify: open the IFAC store as a guide; add a member from `/manage/store`; list a donated piece credited to a member; see it on the member's ArtDirect page; reject the credit; piece stays listed with no artist shown.

### Phase C. Money

Written 2026-10-18 (night). `resolveSettlement` has two regimes: with a `storeId` (artwork) a flat commission from `store.commission_rate` (default `marketplace_settings.default_commission_rate`, 5%), no agreement; without one (services, workshops) the agreement path as before. A listing beneficiary with scope `all_proceeds` zeroes the maker and commission; `commission` sends the commission to the beneficiary. `createOrder` stores the buyer's `support` split and the line's beneficiary share; `confirmOrderPaid` deducts an estimated card fee (2.9% + $0.30) from the maker on the Stripe rail (recorded in `processor_fee_minor`), books the commission to the support payees (org payees to the org party, charities to the new `payee` party) under `dispute_window`, and books beneficiary shares with `pending_beneficiary` when the payee is still a suggestion; `resolveDestination` keeps everything but the maker's share as the application fee. Checkout shows "Where this money goes" notices and a "Support" choice (market, IFAC, Elkdonis, or a half split); the buyer's statement of proceeds is `sendProceedsStatementEmail`, with a paid-over follow-up when a payee's payout is recorded. Admin `/admin/money` gains Settings (commission, soft close, payment window), Owed (record payout), Suggested beneficiaries (approve) and Release on held rows. Dry run of the five settlement cases passed (read-only script); art-auction rebuilt and `/admin/money` renders the new sections as an admin (backup `art-auction-20261018-2054.tgz`). Not done: the seller's `/studio/payouts` itemisation of commission and fee; the actual Stripe fee from the balance transaction; a browser test of checkout.

Files: `packages/commerce/src/server/settlement.ts`, `orders.ts` (`createOrder :173`, `confirmOrderPaid :543`), `ledger.ts`, `packages/checkout/src/components/CheckoutForm.tsx`, `packages/checkout/src/server/stripe.ts`, `apps/art-auction/src/app/admin/money/*`, `apps/art-auction/src/app/checkout/*`.

1. `resolveSettlement`: commission = `store.commission_rate` (default from `marketplace_settings`); processor fee = Stripe's actual fee from `balance_transaction` on confirmation (estimate 2.9% + $0.30 before); artist share = price − commission − fee. `org_agreements` is no longer consulted for artwork (leave the code path for services).
2. Beneficiary: a line with `beneficiary_scope = all_proceeds` sets artist share 0, commission 0, beneficiary share = price − fee. `commission` scope sends the commission to the beneficiary. Order-level `support` splits the commission between payees.
3. Checkout: a "Where the commission goes" choice (market default, IFAC, Elkdonis, split 50/50) with blurbs from `payee.blurb`; a "Proceeds go to <charity>" notice on charity listings; a "Suggest a charity" field that creates a `payee` with status `suggested` and holds the beneficiary share as `pending_beneficiary`.
4. `confirmOrderPaid`: write ledger rows per party incl. `payee`; destination charges keep the beneficiary and commission in `application_fee_amount`.
5. Money pages on art-auction `/admin/money`: owed by party (user, org, payee), holds and their reasons, release, record payout (`recordPayout`, `listPayable`, `ledger.ts:373,454`), settings (default commission, ladder, windows), suggested payees to approve. Store-level: `/studio/payouts` shows the seller's own lines with commission and fee itemised.
6. Proceeds statement: email to the buyer on confirmation for charity listings; a second email when the payout to the charity is recorded (`packages/email`).

Verify: dry-run `resolveSettlement` for the three cases (ordinary, charity, split) in a `BEGIN … ROLLBACK`; a test card order through the edge; ledger rows match; admin page shows and releases them.

### Phase D. Auction mechanics

Written 2026-10-18 (night). `packages/commerce/src/server/bidding.ts` replaces `placeBid`: increment ladder (`money/index.ts` `incrementAt`/`DEFAULT_INCREMENT_LADDER`; a lot copies the marketplace ladder into `metadata.ladder` at creation, or uses its flat increment), proxy bids (one increment over the next highest maximum, ties to the earlier bid, outbid email `sendOutbidEmail`), soft close on a change of price inside the window, registration gate (`bidder_registration` with a card; `AUCTION_REQUIRE_CARD=false` disables), `buyNowLot` (until the first bid; creates the order, lot `sold`). `auction-clock.ts` + `scripts/auction-clock.mts` + compose service `auction-clock` (container `eac-auction-clock`, every 30 s): series schedule (`applySeriesSchedule`: start at `silent_opens_at`, close at `live_at` or staggered by `lot_number × stagger_seconds` unless `closes_at_override`), open scheduled lots, settle, release unpaid orders (lot → `passed`, piece back on sale). Registration flow: Stripe hosted setup session (`createSetupSession` in `@elkdonis/payments`, `startBidderRegistration`/`completeBidderRegistration` in `@elkdonis/checkout/stripe`, return route `/api/bidders/return`), no charge. UI: `BidWidget` (ladder minimum, buy-now button, "Register to bid", estimate, "your maximum", reserve met/not met, outbid message), lot form (ladder or flat, buy-now price). Scratch test on `elkdonis_scratch` (14 steps: registration gate, proxy outbid to 130 on a 150 max, below-minimum refusal, lead changes, soft close to 5 min, buy-now refused after bids and accepted on a fresh lot, clock opening a scheduled lot, settlement to a 72-hour order, release after the window) passed. Not done: offering the under-bidder after an unpaid win (the piece is relisted instead); a browser run of the registration redirect (live Stripe keys; not exercised).

Files: `packages/commerce/src/server/auctions.ts`, `index.ts` (`placeBid :323`), new `packages/commerce/src/server/auction-clock.ts`, new worker service in `docker-compose.yml` (pattern: `video-worker` :1069), `apps/art-auction/src/app/lots/[id]/*`, `apps/art-auction/src/app/studio/artworks/[id]/auction/*`.

1. Increment ladder: `nextMinimumBid(current, ladder)`; the lot form shows the ladder, allows a flat override.
2. Proxy bids: `placeBid` takes `maxAmountMinor`; the engine raises the leading bid by one increment above the second-highest maximum; ties go to the earlier bid; outbid notification by email.
3. Buy-now: lot form field; the button is shown until the first bid; a buy-now creates the order and closes the lot.
4. Clock worker (`auction-clock`): every 30 s, open lots whose `starts_at` passed (`scheduled → live`), close lots whose `ends_at` passed (`settleExpiredLots`), extend on soft close, and release unpaid orders after the payment window (`releaseExpiredOrders`), offering the under-bidder before relisting.
5. Staggered close: when a series has `close_mode = staggered`, lot `ends_at = live_at + lot_number × stagger_seconds`, recomputed when lots are added or renumbered.
6. Bidder registration: before the first bid, a modal collects phone and a card (Stripe SetupIntent, `stripe.customers` + `paymentMethods`); stored in `bidder_registration`; no automatic charge.
7. Lot page: live countdown, current bid, next minimum, "your maximum", reserve-met marker, estimate.

Verify: two test users bid on a scratch lot in `elkdonis_scratch` (or a draft artwork in `market`); proxy outbids as expected; the clock closes it; the order appears with 72 h; the unpaid path offers the under-bidder.

### Phase E. Auction series

Written and deployed 2026-10-18 (night). `packages/commerce/src/server/series.ts` (create/update/status, week focus, lots in/out/renumber, members, participant attach/detach of publications; access = `market` owner, series editor, or network admin) and `queries/series.ts` (series, weeks, lots with paddles, members, bid feed, publications, `listSeriesForUser`, `getFeaturedSeries`). Dates drive the lots through `applySeriesSchedule`. art-auction: Admin → Series (list, create) and `/admin/series/[id]?tab=details|weeks|lots|team|help` (the Help tab reads the live ladder and commission); public `/series/[slug]` (card, phase, weeks, lots once bidding opens; drafts visible to editors only), presenter `/series/[slug]/live` polling `/api/series/[slug]/live` every 4 s (paddles only); a series card on the home page; `auction-hosts.ts` now names `inner_group` as host. Scratch test (create, dates, three lots numbered and staggered 90 s after `live_at`, renumber, publish → `announced`, clock reschedule and open, participant visibility, non-editor refused) passed; the admin list renders signed in. Not done: IFAC's landing slide still links to the marketplace home (the series card is there); forum discussions (forum app stopped); no series exists in production yet — the desk creates the IFAC series from Admin → Series and sets the three dates.

Files: new `packages/commerce/src/server/series.ts` + `queries/series.ts` over migration 190, `apps/art-auction/src/app/series/[slug]/*` (public), `apps/art-auction/src/app/admin/series/*` (manage), `apps/art-auction/src/lib/auction-hosts.ts` (host = `inner_group`, named explicitly), new `apps/art-auction/src/app/series/[slug]/live/page.tsx` (presenter).

1. Service: create/update series, members, slots (weeks with `focus`), slot artworks, `addLotToSeries`, phase transitions (`announce_at`, `silent_opens_at`, `live_at` drive `auction_lot.starts_at/ends_at` for member lots).
2. Manage page (market owners and series editors): Details (title, subtitle, description, card, dates, close mode), Weeks (focus per week, featured artworks, articles), Lots (number, order, open or hold), Team, **Help** (what a series is; the parts of a lot; which parameters the artist sets, which the desk sets; the money rules in plain words; the phase timeline).
3. Public landing `/series/[slug]`: card, description, phase state, weeks and their focus, the lots grid (hidden before `silent_opens_at`), articles. Series card on the art-auction home and the IFAC landing slide (`apps/ifac/src/app/page.tsx:83-93`).
4. Presenter page `/series/[slug]/live`: the current lot (next to close), countdown, bid feed, the next three lots; auto-advances as lots close.
5. The brief's forum discussions (`forum_feed_slug`) wait for the forum app (stopped); omit for November.

Verify: create the IFAC series with phase dates, add three lots, watch phase transitions on the clock worker in scratch, render the landing and presenter pages signed in and anonymous.

### Phase F. "My art" hub

Written and deployed 2026-10-19 (art-auction rebuilt; renders checked signed in: a no-store account sees My art, Auction series and Profile and is sent from Sales to /studio/apply; the same account seated on IFAC's store sees the full tab set). `/studio` keeps its path and is labelled "My art" (layout, page titles, "Back to My art"; ArtDirect's `DossierSidebar`/`ProfileEditorPanel` labels changed; artdirect runs dev mode so they are live). A signed-in person with no active store now gets in: the overview shows pieces credited to them elsewhere and their bids with an "Open a store" button; the store tabs still require a store. Tabs: My art · Sales · Auctions · Payouts/Money · Auction series (`/studio/series`: the series they are in via `listSeriesForUser`, its lots, attached publications, attach one of their published pieces to a week or a link to write in the network Studio; no obligations, no blocking) · Profile (`/studio/presence`: ArtDirect page, own and org stores with counts, series, and a sample of their cards). The overview also shows "Credited to you elsewhere" and "Your bids" (`listBidsForUser`: leading/outbid/won with the order link). Earnings lines itemise price − commission − card fee (`getEarningsStatement`, `EarningsStatement`). Org stores stay reachable through the store switcher rather than one tab each.

Files: `apps/art-auction/src/app/studio/layout.tsx:27-80`, `page.tsx`, new tab routes under `studio/`, `apps/art-auction/src/lib/marketplace-auth.ts:117-131`, `apps/artdirect/src/components/oad/PersonDrawer.tsx:113-119`.

1. Entry without a store: `requireStudioStore` becomes `requireViewer`; a person with no store sees My art with "Open a store" instead of a redirect to `/studio/apply`.
2. Tabs: **My art** (own-store listings plus credited pieces across stores, with status and where each is shown) · one tab per org store the person can act for (the existing store back office, scoped) · **Auction series** (series they are in, their lots and slots, attach existing publications or create new via the Studio compose links) · **Profile** (where their cards appear: ArtDirect sections, org showcases, series pages; a quick link to each).
3. Queries: `listArtworksForPerson(userId)` (owned ∪ credited), `listBidsForUser`, `listLotsWonByUser`, `listSeriesForUser` (member, slot assignee, lot artist).
4. Labels: "My art" everywhere `/studio` is linked (ArtDirect drawer, IFAC person view "Edit your store", Center); paths unchanged.

Verify: a member with no store, a member with a personal store, an IFAC guide with the org store; each sees the right tabs.

### Phase G. Later sessions (not in this plan's scope)

- PayPal: buyer payments as a `PaymentProvider` (`packages/payments/src/types.ts:104`), its own webhook route, then PayPal Giving Fund for receipted charity proceeds. Needs the organisation's PayPal business account. Until then the checkout shows "PayPal: coming".
- Live call with floor bids: a floor-bid role, a live bidding channel, the call embed; design by mid-November.
- Shipping-rate API on listings and checkout. Provider: Easyship (developer, 2026-11-07). Tokens in `.env` as `EASYSHIP_SANDBOX_TOKEN` / `EASYSHIP_PRODUCTION_TOKEN`, passed to the art-auction service in compose (2026-11-07, container not recreated). Sandbox host is `https://public-api-sandbox.easyship.com`, production `https://public-api.easyship.com` (a sandbox token returns 401 on the production host); both tokens verified 2026-11-07 with `GET /2024-09/account` (200, account "Elkdonis Arts Collective", company CCA1059361 on sandbox). The production token buys real labels: develop against sandbox. ~~Nothing built yet.~~ 2026-11-07: built in source (migration 250, unapplied); see docs/reference/commerce.md "Shipping". Sandbox probe 2026-11-07 (claude): requests need `Accept: application/json` (else 406) and a non-default User-Agent (Python's default gets Cloudflare 403 "1010"); the sandbox allows only a few requests per second and per minute (429). `POST /2024-09/rates` from Toronto returned only Canpar (3 services to Montreal, CAD 50-58 for a 70x60x10 cm 5 kg painting; one "International" rate to Paris with implausible 1-day transit and duty above declared value) and 422 "No shipping solutions" to New York; sandbox figures are demo data. Rates carry `total_charge`, transit days, surcharge breakdown and import duty/tax estimates. No `art` item category (25 categories); an `hs_code` (97011000 paintings) is accepted instead. Account has no payment source, boxes, webhooks or shipments yet. Production quote 2026-11-07 (claude; `POST /rates` only, nothing bought; origin Toronto M4C 4Y7): painting 70x60x10 cm 5 kg CAD 800 → Montreal 14 rates, CAD 22.70 (Canada Post Regular, 4-10 d) to 104.41 (FedEx); → New York 3 rates, FedEx Ground 82.66 (5 d), DHL Express 120.37 (1 d), FedEx Connect Plus 147.62; → Paris 4 rates, Canada Post Xpresspost Intl 138.42 (4-7 d) to Canpar 861.20. Print 40x30x5 cm 1 kg CAD 150: Montreal from 8.72 (UniUni) / 14.81 (Canada Post Expedited); New York from 44.36; Paris from 29.20 (28-60 d) / 40.60 (6-10 d). Estimates: US duty 10% of declared value (80.00 on the painting; HS 9701 is normally duty-free into the US, so this estimate is unverified), France import VAT ~20-25%. Canada Post offers nothing to the US for these parcels in Easyship. Non-Canadian origins also quote on the Canadian account (2026-11-07, prices in CAD): San Francisco → Austin painting 13 rates, USPS Ground Advantage 48.33 (2-5 d), FedEx Ground 32.73 (6 d), USPS Priority 85.04; print from 12.53 (USPS Ground Advantage). Paris → London painting 5 rates, Colissimo 47.96 (3-13 d), Chronopost Classic 53.37, DHL Express 247.24 (1-2 d), UK import VAT ~170; print from 36.32. USPS Media Mail is returned (17.66 / 8.28) but is restricted to books and recorded media, so filter it out for art. Unknown: whether labels can be bought for a US or French origin on this account (Easyship may require an account in the origin country). Easyship's help centre describes "Global Accounts" (origin addresses in several countries on one account, couriers per origin, some needing a linked courier account) and per-account bearer tokens; no OAuth or marketplace-connect flow was found (web search, 2026-11-07). Context (developer, 2026-11-07): the collective is a Canadian not-for-profit on Stripe Express; market.arts-collective.com sales are often to US buyers and shipped within the US. ~~Who buys the label (platform account vs seller) is open.~~ Decided 2026-11-07 (developer): quote mode first (seller buys label, collective holds shipping until tracking), platform-label mode built alongside, set per store by a network admin; ship-from per maker; rate chosen on the order page.
- Receipting path with an intermediary.

## 3. Sequence and effort (claude, assumed)

| Week | Phases | Notes |
|---|---|---|
| 2026-10-19 → 10-25 | A, B, start C | Migration applied first; art-auction and IFAC rebuilt once B lands |
| 10-26 → 11-01 | C, D | Clock worker added to compose; test bids in scratch |
| 11-02 → 11-08 | E | Series created; `announce_at` can be set once E's landing page is live |
| 11-09 → 11-15 | F, polish | Silent bidding opens when the desk sets `silent_opens_at` |
| 11-16 → 11-22 | live-call design (G) | staggered close is the fallback |
| last week of November | live close | |

## 4. Rules for this work

- art-auction runs in production mode: rebuild before verifying, after backing up `.next` and reading `git status` (`docs/reference/ops.md`). IFAC likewise.
- Every new write path checks the actor (`canActForStore`, org role, series membership); `createArtwork` gains its own check in Phase B.
- Money never moves automatically to an org or payee: ledger rows plus a manual release, as today. Only makers with Stripe onboarding are paid by destination charge.
- Test bids and lots in `elkdonis_scratch` or on draft artwork; never on a live listing.
- Keep "donation" apart from "price" in the ledger (brief §6.4), so a later receipting path can read it.

## 5. Open questions

- The silent-auction opening date (`silent_opens_at`) and the live-close date; who sits on the desk (`auction_series_member`).
- Does bidder registration also apply to fixed-price purchases? Assumed no.
- Split choices at checkout: 50/50 only, or a slider? Assumed 50/50.
- Whether the commission applies to org-store listings (`openOrgStore` writes 0 today). Assumed: yes at 5% to `market`, unless the listing's beneficiary scope is `all_proceeds`.
- The Stripe fee shown to the artist before publishing: estimate (2.9% + $0.30) or "actual fee, shown after the sale"? Assumed estimate before, actual after.

## Series workspace, phase 1 (2026-10-28, deployed)

- `/series/[slug]/manage` (art-auction): Overview, Lots & artworks, Add a lot, Weeks, Page & look, Team,
  Dates & bidding, Help. Access is `canEditSeries` (series editors, `market` owners, admins), not `/admin`'s
  is_admin gate. `/admin/series/[id]` redirects there. Mock-ups: https://claude.ai/artifact/JJaM9ksambaDQXAZiuQsEX.
- Add a lot (`addSeriesLot`, `packages/commerce/src/server/series.ts`): artwork in the presenting org's store,
  published, lot on the series clock, optional week feature. Proceeds "to the artist" makes the artist
  `artist_user_id` (payee); "donated" credits them. An artist without an account is a name in
  `artwork.metadata.artistName` (no placeholder `users` row); the org is then the payee.
- Series desk access: `seriesDeskClause` (`server/access.ts`) lets whoever may edit a series act for the
  presenting org's store (`canActForStore`, `requireArtworkAccess`). `/api/upload` accepts store members and
  series editors; `/api/series/media` takes hero images and videos (250 MB) for editors.
- Team search `searchSeriesPeople`: name, `users.slug`, email, pg_trgm word similarity > 0.4.
- `/artists/<username>` falls back to a person's market work when they have no store; My art lists pieces
  where the person is maker in another store.
- Verified 2026-10-28: check-types (art-auction, commerce); signed-in renders of every workspace route in a
  dev preview and through the edge after the rebuild (throwaway account, removed). Not exercised: the
  add-lot write (the series has no live-close date), uploads, the people-search action in a browser.
- Open (phase 2/3): series Orders & fulfilment (hand-over, received, artist paid), series Money and Visitors,
  week content and themes, claim invitations for name-only artists.

### Rework to the mock-ups (2026-10-28, deployed 18:58)
- Workspace has its own chrome (mock 1; `manage/workspace.css`, `sw-` classes); SiteChrome (`components/site-chrome.tsx`) hides
  the market header/footer on `/series/<slug>` and `/series/<slug>/manage/*`. Added Artists, Orders & fulfilment, Money,
  Visitors, Live close (`server/series-orders.ts`); weeks board with themes, colour, question, content items, featured lots
  (`listWeekBoards` etc. in `server/series.ts`; week data in the position-0 slot's `content`).
- Series page follows the developer's template (`docs/open/collect-art-mockups-2026-10-28/pages/Series.html`;
  `series-template.tsx/.css`); editors edit in place (`page-editor.tsx`). Do not name a route-folder file `template.tsx`:
  Next mounts it as the segment template (it 500ed every series route).
- Not exercised: every write (add lot, uploads, weeks, page edits). Discussion and "Follow this series" are not built.

### Mirror thread, participating orgs, lot sources (2026-10-28 evening; migration 212 applied 21:55, deployed 22:08)
- Migration 212 (applied 2026-10-28 21:55): `auction_series.thread_id` (the series' forum thread: kind `post`, feed `auction-series` of the
  series' org, created on publish by `ensureSeriesThread`) and `auction_series_org` (invited/accepted/declined).
  Apply before rebuilding art-auction: the series page selects both.
- Series page: Discussion (the thread's replies, posted through the forum's `postReply`) and Follow (thread_rsvps
  `subscribed`, as IFAC series use); `series-social.tsx`, `series/[slug]/actions.ts`. Service: `server/series-social.ts`.
- Workspace → Organisations: add any org; auto-accepted when the adder owns/guides it, otherwise a messaging
  conversation with the org's owners (`context series_org`) + email (`emailSeriesOrgInvitation`) linking to
  `/series/<slug>/invitations`, where owners accept or decline. Accepted orgs' `Media/Images` folders become
  libraries in Add a lot ("Choose from a library…"), as does the artist's own folder.
- Add a lot: "One of the artist's listings" puts an existing listing up for auction on the artist's own store
  (`createLot` `onBehalfOfSeriesId`, `requireArtworkForSeriesDesk`); the artist dropdown shows the collective's
  artists (market store owners, presenter and host org members) before anything is typed.
- Not built: a Messages surface outside art-auction (arts-collective hub, org hubs, /center org card); the
  invitation reaches owners by email and the marketplace inbox only.
