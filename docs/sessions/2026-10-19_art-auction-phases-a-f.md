# Art auction: org stores, money, bidding, series, My art (2026-10-18/19)

Handover for the session that explored the marketplace (`apps/art-auction`,
org `market`), recorded twenty design decisions with the developer, and built
phases A–F of the resulting plan. Everything below is uncommitted on
`elastrocal-and-network-work` (about 100 files of this session's among
~400 modified or untracked files from several sessions). Decisions:
`docs/open/ORG_STORE_BRIEF_2026-10-15.md`; plan with per-phase status:
`docs/open/ART_AUCTION_PLAN_2026-10-18.md`.

## Current state (verified 2026-10-19 unless marked)

- **Migration 209 applied** (`209_art_auction_credit_payees_series.sql`;
  208 `elktours`, another session's, was applied in the same run): artwork
  credit (`credited_artist_user_id`, `credit_status`), estimates,
  `artwork_provenance`, `payee` + `org_beneficiaries`, listing and order
  beneficiary columns, `payout_ledger.party_payee_id` (constraint widened),
  `auction_lot.series_id/lot_number/closes_at_override`, series bidding
  settings, `auction_series_slot.focus`, `bidder_registration`,
  `marketplace_settings` (one row for `market`: 5%, the ladder, 5 min, 72 h).
  Seeded org payees for `market`, `ifac`, `inner_group`.
- **Org stores** (`@elkdonis/commerce`): `openOrgStore` accepts owners and
  guides and seats every owner (store owner) and guide (manager);
  `canManageStoreTeam` / `addStoreMemberByEmail` (`server/store-team.ts`);
  payee registry (`server/payees.ts`). Panels `StoreTeamPanel` and
  `BeneficiariesPanel` in `@elkdonis/cms-ui/store` (+ `store.css`), mounted at
  IFAC `/manage/store` (new tab) and arts-collective `/hub/store?org=` (linked
  from the Organization tab). IFAC's hub "Art piece" composer offers "List in
  IFAC's store" to store-team members (`orgStoreName` prop on cms-ui
  `ArtPieceComposer`).
- **Artwork form** (art-auction): credited-artist search, "This piece was
  donated" (by / to / date), beneficiary (all proceeds or commission),
  estimate. `createArtwork`/`updateArtwork` take `actorUserId` and check
  `canActForStore`. ArtDirect shows "Also credited on" / "Work credited to
  them" with a "Decline credit" button for the person (`rejectArtworkCredit`).
  `asPortfolio` keeps `artworkId`.
- **Money**: `resolveSettlement` uses a flat commission
  (`store.commission_rate`, default `marketplace_settings`, 5%) whenever a
  `storeId` is given; services and workshops keep `org_agreements`. Listing
  beneficiaries: `all_proceeds` zeroes maker and commission; `commission`
  redirects the commission. `confirmOrderPaid` deducts an estimated card fee
  (2.9% + $0.30) from the maker on the Stripe rail (`processor_fee_minor`),
  books the commission to the buyer's support split (org payees → org party,
  charities → `payee` party, hold `dispute_window`), beneficiary shares with
  `pending_beneficiary` while a suggested charity is unapproved.
  `resolveDestination` keeps everything but the maker's share on the
  platform. Checkout: "Where this money goes" notices and a "Support" choice
  (The Collective Market, IFAC, Elkdonis, half split). Emails:
  `sendProceedsStatementEmail` (statement, then a paid-over follow-up from
  `sendPaidProceedsStatements`), `sendOutbidEmail`. Admin → Money: settings,
  Owed (record payout), suggested beneficiaries (approve), Release on holds.
- **Bidding** (`server/bidding.ts`): ladder (`money/index.ts`
  `incrementAt`; copied onto the lot as `metadata.ladder`, or flat), proxy
  bids (one increment over the next highest maximum, ties to the earlier
  bid), soft close, buy-now until the first bid (`buyNowLot`), card-on-file
  gate (`AUCTION_REQUIRE_CARD=false` disables). Registration: Stripe hosted
  setup session (`createSetupSession` in `@elkdonis/payments`;
  `startBidderRegistration` / `completeBidderRegistration` in
  `@elkdonis/checkout/stripe`; return route `/api/bidders/return`).
  `BidWidget` shows ladder minimum, buy-now, "Register to bid", estimate,
  "your maximum", reserve met/not met.
- **Clock**: compose service `auction-clock` (container
  `eac-auction-clock`, `packages/commerce/scripts/auction-clock.mts`, every
  30 s): series schedule, open scheduled lots, settle, release unpaid orders.
  Running since 2026-10-19 01:23.
- **Series**: `server/series.ts` and `queries/series.ts`; Admin → Series
  (create; manage page tabs Details, Weeks, Lots, Team, Help); public
  `/series/[slug]`, presenter `/series/[slug]/live` polling
  `/api/series/[slug]/live` (paddles only); series card on the home page;
  `auction-hosts.ts` names `inner_group` as host. No series exists in
  production yet.
- **My art**: `/studio` relabelled; a no-store account gets in (credited
  pieces, bids, "Open a store"); tabs My art · Sales · Auctions · Payouts ·
  Auction series (`/studio/series`: series the person is in, lots, attach a
  published piece or write in the network Studio) · Profile
  (`/studio/presence`). Overview adds "Credited to you elsewhere" and "Your
  bids"; earnings lines itemise price − commission − card fee.
- **Builds**: art-auction rebuilt five times (last 2026-10-19 ~01:55), ifac
  and arts-collective once each on 2026-10-18. artdirect runs `next dev`
  (ops.md mode table), so its source changes were live without a build; the
  two `next build` runs made for it were unnecessary, and the second failed on
  a pre-existing production-only type error in `api/auth/signup/route.ts`
  (route handler's second parameter vs Next 16's `RouteHandlerConfig`). Its
  dev cache was restored from `artdirect-20261018-2145.tgz` after a restore
  attempt with a wrong backup name had emptied it; the container is up and
  `/danamccool` renders (02:15). Backups in
  `~/eac-backups/next/*-20261018-*.tgz` and `-20261019-*.tgz`.
  `@elkdonis/email` was rebuilt (`dist/`) for the new senders.
- **Verification**: type checks on commerce, checkout, payments, email,
  cms-ui(store), services, art-auction, ifac, arts-collective, artdirect
  (ignoring the pre-existing `cms-ui/src/surface/surfaces/ArtworkSurface.tsx`
  error from another session's untracked file). Service-level scripts on
  production data (read-only or self-cleaning) for Phase B and C; bidding
  (14 steps) and series (9 steps) on `elkdonis_scratch` (rebuilt from the live
  schema with triggers disabled; still holds test lots and series). Server
  renders signed in via minted throwaway accounts (all removed) for IFAC
  `/manage/store`, `/hub/store`, the artwork form on IFAC's store, ArtDirect
  credited work, `/admin/money`, `/admin/series`, and My art in both states.
  Not run in a browser; the Stripe registration redirect not exercised (live
  keys).

## Rules and constraints added this session

- Check `canActForStore` (or pass `actorUserId`) on every new call to
  `createArtwork`/`updateArtwork`: the functions trusted their caller before.
- A `"use server"` file exports async functions only: constants such as
  `MARKETPLACE_ORG` live in a sibling module (`lib/cms/marketplace.ts`,
  `hub/store/marketplace.ts`).
- `@elkdonis/email` is consumed from `dist/`: rebuild it
  (`pnpm --filter @elkdonis/email build`) before a dependant type-checks a
  new export.
- `tsx` is not on commerce's path; run scratch scripts with
  `/app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs` from
  `packages/commerce`, or `node_modules/.bin/tsx` from `packages/services`.
- Postgres `date` columns come back as `Date`; format with a local-day helper
  (`localDay` in `queries/index.ts`), not `String().slice`.
- A scratch copy of production: `pg_dump -s` then `pg_dump -a
  --disable-triggers -t …` for the reference tables; set `DATABASE_URL` to
  `elkdonis_scratch` and `SENDGRID_API_KEY=` empty for the script.

## Open items

- **Series data**: create the IFAC series from Admin → Series and set
  announce, bidding-opens and live-close dates; add lots from pieces put up
  for auction (plan §5: dates and desk members still to come from the
  developer).
- **Phase G**: PayPal (buyer payments, then PayPal Giving Fund for receipted
  charity proceeds; needs the organisation's PayPal business account), the
  live call with floor bids by mid-November, a shipping-rate API.
- **Not built**: offering the under-bidder after an unpaid win (the piece is
  relisted); the actual Stripe fee from the balance transaction (an estimate
  is used); IFAC's landing slide still links to the marketplace home.
- **Docs out of date**: `docs/reference/commerce.md` (store, order and Stripe
  counts; settlement now has two regimes; payee party; clock worker) and
  `docs/reference/apps.md` (art-auction routes: `/series`, `/admin/series`,
  `/studio/series`, `/studio/presence`, `/api/bidders/return`,
  `/api/series/*/live`; the `auction-clock` service); `PM_BOARD_2026-10-07.md`
  lot `e61caa91` status.
- **Housekeeping**: drop `elkdonis_scratch` when no longer needed; the lot
  page 404s for lot `e61caa91` because its artwork is archived (pre-existing).
  The `apps/artdirect` signup route type error blocks any future production
  build of artdirect; harmless while it runs dev.
- **Commit**: nothing committed; this session's files are interleaved with
  other sessions' (the Center redesign touched `journeys.ts`, migration 207
  and small diffs in `commerce/server/index.ts` and `checkout/server/stripe.ts`
  the same day). Commit by path, not `git add -A`.
