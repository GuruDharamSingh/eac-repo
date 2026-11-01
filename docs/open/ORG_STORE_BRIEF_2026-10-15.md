# Organisation stores, donated work, beneficiaries and the user studio (brief, 2026-10-15)

Exploration brief for the next round of art-auction work (market.arts-collective.com,
org `market`). It covers six goals:
- organisation stores that an org's owners and admins fill with artwork;
- artwork credited to an artist user and tagged as donated by someone to an org;
- a purchaser choosing which organisation or charity receives the proceeds;
- PayPal as a payment option;
- a per-user studio hub in art-auction;
- auction seasons.

Status 2026-10-18: findings and decisions only; nothing is built, and no code or data was changed. Findings come from code reading and read-only queries on `elkdonis_dev` (2026-10-15 and 2026-10-18). §4 holds the first round of decisions, answered by the developer on 2026-10-18; §6 proposes the model and names; §7 is an auction primer; §8 covers donation handling; §9 holds the second round, answered 2026-10-18. Implementation plan: `docs/open/ART_AUCTION_PLAN_2026-10-18.md`. Target: a silent auction in November 2026 with a live close in its last week.

## 1. Goals (developer, 2026-10-15)

1. **Organisation stores.** The owner of an organisation such as IFAC or the Elkdonis Arts Collective, and possibly its admins, can upload artwork to the organisation's store. The work can be a fixed-price listing or an auction piece.
2. **Artist credit.** A piece may be linked to an artist user.
3. **Donation tag.** A piece may carry a "donated by X to organisation Y" tag. The credit and donation fields are optional fields on the artwork form.
4. **Buyer's choice.** The purchaser may choose which organisation receives the proceeds (IFAC, Elkdonis, or a charity). The brief should also cover how charitable donations work when they pass through the not-for-profit's Stripe account.
5. **PayPal** as a payment option.
6. **User studio in art-auction.** A hub where a user can:
   - see their art and add artwork;
   - manage their store;
   - see what they take part in, such as an auction season or series.

   Organisation owners also get a tab to manage the organisation's storefront. Working name: "Store" or "Listings".

## 2. Current state

### 2.1 Stores and listings

- **What a store is.** A store is a storefront owned by either a user or an org, never both (`owner_user_id` xor `owner_org_id`, generated `owner_kind`; migration 094). `store.org_id` is the marketplace it trades in, always `market` today.
- **Live data (query, 2026-10-15).** There are 6 stores:
  - 4 user stores: Dana, Eric, Guru and Justin.
  - 2 org stores: `ifac` (`store_member`: Eric, owner) and `inner_group`, displayed as "Elkdonis Arts Collective" (`store_member`: Justin, owner).
  - Both org stores own 0 artworks. IFAC presents 14 pieces from other stores through `store_presentation` (migration 112).
- **What a listing is.** There is no listing table. A listing is `artwork.status = 'available'` with one default `artwork_variant`, which holds the price; 0 means price on request. `publishArtwork` requires at least one image (`packages/commerce/src/server/index.ts:1176`).
- **Opening an org store.** `openOrgStore` requires `user_organizations.role = 'owner'` (`packages/commerce/src/server/index.ts:652-713`). A guide, shown as "Admin" in the UI, cannot open it. Only the person who opens it is added to `store_member`.
- **Acting for a store.** This depends on `store_member` (roles owner, manager, staff) and is independent of org roles (`packages/commerce/src/server/access.ts:21-53`). Example: Justin is an IFAC owner but is not on the IFAC store's member list.
- **The IFAC composer.** The IFAC hub's "Art piece" composer lists into the member's own store, never IFAC's store (`apps/ifac/src/lib/cms/art-piece-actions.ts:61-118`). IFAC never calls `getStoreForOrg` or `openOrgStore`.

### 2.2 Artwork attribution

- **Seller and maker are separate columns** (migration 095):
  - `artwork.store_id` (NOT NULL) is the seller.
  - `artwork.artist_user_id` (nullable since 095) is the maker. Verified by reading `095_*.sql:6-35`.
- **The maker is the payee** (`packages/commerce/src/server/settlement.ts:19-24`). Setting an artist on a piece routes the sale proceeds to that artist. If the artist has no payout setup, Stripe falls back to a platform charge and the artist's share is recorded as owed.
- **The artwork form** offers only "Credit me as the maker" (`apps/art-auction/src/app/studio/_components/artwork-form.tsx:364`; `studio/actions.ts:202-223`). With that unticked, the piece has no maker. There is no way to pick another artist, and no consent or claim step for the credited artist.
- **No donor or provenance-event fields exist.** Provenance is the free-text `artwork.provenance_notes` (migration 042). `artwork.metadata` jsonb is the only unstructured slot.
- **`createArtwork` does no permission check of its own.** It trusts the `storeId` and `artistUserId` its caller passes (`packages/commerce/src/server/index.ts:965,1013`). A new caller must check `canActForStore` first.
- **No artwork has a null maker** (query, 2026-10-15).

### 2.3 Money routing

- **Stripe accounts.** There is one platform account, the not-for-profit's. Connect Express connected accounts exist for people only, never for orgs (`packages/payments/src/providers/stripe.ts:8-24`; `.claude/rules/areas/commerce.md`). The account ids are stored on `users` (migration 096).
- **Charge types** (`resolveDestination`, `packages/checkout/src/server/stripe.ts:61-77`):
  - A destination charge to the maker is used when every line has the same onboarded maker. The org's cut is taken as `application_fee_amount`.
  - Otherwise the charge stays on the platform account and the ledger records what is owed.
  - There is no separate-charges-and-transfers path.
- **The org's cut** exists only under an accepted `org_agreement` (`resolveOrgShare`, `packages/services/src/agreements.ts:365-384`). There are 0 agreements and 0 acceptances, so every org share is 0% today (query, 2026-10-15).
- **Work with no maker** sends 100% to the counterparty org (`settlement.ts:84-101`). The counterparty is derived from the storefront and never chosen by the buyer: the presenting store's owner, else the selling store's `owner_org_id`, else the marketplace org (`packages/commerce/src/server/orders.ts:85-121`).
- **Org money.** It exists only as `payout_ledger` accruals (`party_kind='org'`) held under `dispute_window` (`orders.ts:678-698`; migration 098). A network admin releases it by hand at arts-collective `/hub/admin/ledger`. `recordPayout` and `listPayable` have no UI callers (`packages/commerce/src/server/ledger.ts:373,454`).
- **Webhook.** One webhook serves the whole network: art-auction `/api/stripe/webhook`, which calls `handleStripeWebhook` (`packages/checkout/src/server/stripe.ts:233-305`). `confirmOrderPaid` (`orders.ts:543-743`) marks the order paid and writes the ledger rows.
- **The platform fee** (10% / 5%, `docs/open/ARTIST_FUNNEL_BRIEF_2026-09-27.md:118-153`) is not built.

### 2.4 Charities and donations

- **No charity concept exists.** `organizations` and `org_profiles` have no charity, registration or tax columns. There is no donations table, no tax-receipt code and no "beneficiary" concept (schema and grep, 2026-10-15).
- **"Not-for-profit"** appears only in copy, for example `apps/elkdonis-arts-collective/src/app/about/page.tsx:44` ("Canadian not-for-profit").
- **Two orgs are both named "Elkdonis Arts Collective":** `elkdonis` (tier free, `steward_org_id = inner_group`) and `inner_group` (tier partner). The 2026-10-03 auction-series brief uses `elkdonis` as the host. The existing org store belongs to `inner_group`.
- **Receipting (assumed, not verified; needs an accountant).** In Canada a not-for-profit corporation that is not a registered charity cannot issue official donation receipts. The rules for passing a buyer's money on to a third-party registered charity need checking before a "proceeds to charity" option is offered.

### 2.5 PayPal

- **Nothing exists.** There is no PayPal code, no SDK and no `PAYPAL_*` variables in `.env`, `.env.example` or `docker-compose.yml`.
- **Unbacked promise.** The onboarding copy promises a PayPal payout to makers, and nothing implements it (`packages/checkout/src/server/stripe.ts:380`).
- **An unused provider interface exists:** `PaymentProvider` and `PaymentProviderRegistry` (`packages/payments/src/types.ts:104-116`, `registry.ts`). Checkout calls the Stripe functions directly instead.
- **Places hard-coded to the current methods** (`etransfer | stripe | manual`), each needing a change for PayPal:
  - `commerce_order_payment_method_check` (DB constraint);
  - `OrderRail` (`orders.ts:29`);
  - `PaymentMethod` and `PayoutMethod` (`packages/commerce/src/types/index.ts:44,443`);
  - `ConfirmOrderPaidInput.method` (`orders.ts:517`);
  - `CheckoutForm` (`packages/checkout/src/components/CheckoutForm.tsx:12,17`);
  - `placeOrder` (`apps/art-auction/src/app/actions.ts:108`);
  - the order page (`apps/art-auction/src/app/orders/[id]/page.tsx:69`);
  - admin refund (`apps/art-auction/src/app/admin/actions.ts:77`);
  - the per-rail ledger logic in `confirmOrderPaid` (`orders.ts:596-675`).

### 2.6 Studios and the user hub

- **art-auction `/studio` is one store's back office.**
  - Tabs: Overview, Sales, Auctions, Money, plus Profile and the artwork new/edit/auction pages (`apps/art-auction/src/app/studio/layout.tsx:27-80`).
  - Access: `requireStudioStore` redirects to `/studio/apply` without an active store. The active store is chosen by the cookie `ea_studio_store`, with a switcher (`apps/art-auction/src/lib/marketplace-auth.ts:117-131`).
  - Its artwork form is the only working artwork editor in the network.
- **arts-collective `/studio` (`packages/studio`) is the network authoring Studio.**
  - Ready kinds: writing and video. Artwork is a planned kind (`packages/studio/src/kinds.ts:8-18`; `docs/open/STUDIO_BRIEF_2026-09-27.md` §3.1, §4.3).
  - It has a "Making as" org switch and an extension contract (`packages/studio/src/frame.tsx:26-103`).
  - The two products share the name "Studio".
- **Nothing gathers a user's activity across stores and auctions.** No view shows:
  - "my art across stores";
  - "auctions or seasons I take part in";
  - "my bids and won lots".

  No query lists a bidder's bids. `/account` shows orders and favourites only.
- **ArtDirect** shows only a person's own store, not artwork credited to them in another store. `listArtworks({artistUserId})` (`packages/commerce/src/queries/index.ts:194`) and `listLotsForArtist` (`:955`) exist and could supply that.
- **`asPortfolio` bug.** It drops `artworkId` from portfolio items (`packages/services/src/profiles.ts:195-212`).
- **Three places hold artwork images:** `users.portfolio`, `user_galleries.items` (migration 124) and `artwork` + `artwork_media` (migration 042).

### 2.7 Auctions and seasons

- **Lots.** `auction_lot` holds one lot per artwork variant, with reserve, increment and anti-snipe (`packages/commerce/src/server/auctions.ts:68`).
- **Missing auction features:**
  - Proxy bidding is not implemented (`max_amount_minor` is stored but unused).
  - Nothing sets the buy-now price (`buy_now_minor` is displayed only).
  - No scheduler: lots move from scheduled to live on the first bid, and settle when a page loads (`settleExpiredLots`, `auctions.ts:180`).
- **Grouping into seasons** uses only the free-text `auction_lot.metadata.event` (`apps/art-auction/src/app/studio/actions.ts:321-353`; `apps/art-auction/src/lib/auction-data.ts:18-31`).
- **Migration 190 defines season tables:** `auction_series` (presenter org, host org, phase dates), `_member`, `_slot` (with `artist_user_id`) and `_slot_artwork`. They have 0 rows, and no TypeScript references them (grep, 2026-10-15). Design: `docs/open/AUCTION_SERIES_BRIEF_2026-10-03.md`, open questions Q2 and Q7.
- **IFAC's `series` thread kind** (migrations 201-205) is meeting-shaped: recurrence, hosts, RSVP. It has no lots, close time or artwork link.

### 2.8 Org roles

- **Roles:** `owner | guide | member | viewer` (`packages/services/src/org-membership.ts:15`). There is no "admin" org role; "Admin" in the UI means `guide`.
- **Role helpers:** `getOrgRole` (`:44`), `hasOrgRole` (`:53`), `hasAnyOrgRole` (`:66`), `getOwnedOrgId`.
- **IFAC editors** are owner and guide (`apps/ifac/src/lib/auth.ts:16`). IFAC `/manage` also still accepts `NEXT_PUBLIC_IFAC_OWNER_EMAIL` (`apps/ifac/src/lib/data.ts:120-140`).

## 3. Constraints

- Do not give an org a Stripe connected account: org money is held in the platform account as ledger rows (`.claude/rules/areas/commerce.md`).
- Do not create Stripe objects or run probe scripts: the keys in `.env` are live (`docs/reference/commerce.md`).
- Check `canActForStore` before any new call to `createArtwork` or `updateArtwork`: those functions do not check the actor.
- Keep cross-org capability in shared packages (`@elkdonis/commerce`, `@elkdonis/checkout`, `@elkdonis/studio`), not in `apps/ifac`: other orgs will use the same store features (`.claude/rules/00-working-style.md`).
- Keep one Stripe webhook endpoint, and give any PayPal webhook the same single-route shape: one endpoint per provider keeps order confirmation in one place.

## 4. Decisions for the developer

Answer under each item; date the answer.

**D1. Which org is "Elkdonis".** `elkdonis` and `inner_group` both display as "Elkdonis Arts Collective". The existing org store is `inner_group`'s; the auction-series brief names `elkdonis` as host. Which org sells and receives proceeds?

> Answer (developer, 2026-10-18): the auction should have its own organisation, a coalition of IFAC and Elkdonis, whose members come from both. That org administers the auction (accounting, Stripe, a second payment account if one is added) from an art-auction administrative centre that does not exist yet. Elkdonis stays the Stripe host for now.
>
> Note (claude, 2026-10-18): that org already exists. `market` ("The Collective Market", tier free) is the org art-auction runs as, every store trades in it, and it has 3 owners (query, 2026-10-18). No new org is needed: `market` is the administrative org, its owners are the auction desk, and the platform share of each sale is booked to `market` in the ledger. The Stripe platform account belongs to the legal entity (the not-for-profit), not to a DB org, so "Elkdonis hosts Stripe" and "market administers" are compatible. Remaining choice for the "support Elkdonis" option in D5: present `inner_group` (tier partner, live site elkdonis-arts.org, owns the existing org store) and treat the `elkdonis` row (tier free, 0 owners, retired app) as legacy. Confirm in R1.

**D2. Who acts for an org store.** The options are:
- (a) every owner and guide of the org acts for its store automatically;
- (b) owners only, automatically, with guides added by hand;
- (c) keep the hand-kept `store_member` list.

Should a guide also be able to open the store?

> Answer (developer, 2026-10-18): owner or admin (guide). The owner keeps a hand-kept list of who can act for the org store, so `store_member` stays. The list is assigned from the org site's manage page or from the hub console.
>
> Note (claude): so (c), with two additions: a guide can open the store, and `store_member` is edited on each org's manage page and in `/hub` Organization, through one shared panel.

**D3. Payee of a donated or org-owned piece.** The proposed model: the store, and so the org, is the payee, and the artist is credited but not paid. This needs a credit field separate from the payee, for example `artwork.credited_artist_user_id` or an `artwork_credit` table with roles. It also needs structured donation fields: donor (user or free text), recipient org, date. Confirm, or describe a different split, for example a share to the artist.

> Answer (developer, 2026-10-18): confirmed. The store (the org) is the payee; `credited_artist_user_id` credits the artist without paying them. The donation layer is bigger than art-auction: it is platform-wide (funnelling donations to several places, kept transparent). Seed it here with a note that it is a larger project; look up how donation handling is usually done, and consider a page of favourite charities or donation options per org. See §8.

**D4. Should the credited artist consent?** Should a credit appear only after the artist confirms it, or immediately? Should credited work appear on the artist's ArtDirect page?

> Answer (developer, 2026-10-18): no consent needed. An artist can be tagged without consent and may later refute the tag: on their ArtDirect page, a credited piece offers "Reject credit". Credited work appears on the artist's ArtDirect page.

**D5. What the buyer's choice redirects.** The options are:
- (a) all the proceeds of org-owned or donated pieces, chosen from a list of beneficiaries the store allows;
- (b) an optional donation on top of the price, with the beneficiary chosen;
- (c) a share the artist opts into, with the buyer choosing its destination.

(a) and (b) can be combined.

> Answer (developer, 2026-10-18): the beneficiary is baked into the listing. When a piece is listed as "proceeds to charity", the listing carries that, chosen from a list of beneficiaries the org keeps. The buyer may also be offered the choice at checkout: pick from the list, or name a charity themselves (open-ended). Open: how a free-text charity gives the buyer assurance and eventually a tax receipt (see §8). For pieces not marked for donation, the buyer chooses which org the commission supports, IFAC or Elkdonis, each with a short blurb.
>
> Note (claude): so (a) at listing level plus a buyer choice at checkout, and separately a "support" choice for the commission on ordinary sales.

**D6. Charities as beneficiaries.** The options are:
- (a) a charity is an `organizations` row with a charity flag and registration number;
- (b) a new payee kind outside `organizations`;
- (c) no outside charities at first, only network orgs.

Is the Elkdonis Arts Collective a registered charity, or a not-for-profit only? This decides whether the platform can issue receipts.

> Answer (developer, 2026-10-18): (b), a new payee kind outside `organizations`. Elkdonis is a not-for-profit, not a registered charity.

**D7. PayPal's role.** The options are:
- (a) a buyer payment method only, settled to the platform account like a Stripe platform charge;
- (b) a payout method to makers only, matching the existing copy;
- (c) both.

Is there a PayPal business account for the not-for-profit?

> Answer (developer, 2026-10-18): (a), buyer payment only, settled to the platform account, so the org keeps oversight of what is owed and follows up with the seller before money moves.

**D8. Where the user hub lives.** The options are:
- (a) widen art-auction `/studio` into a per-user hub ("My art", "My store(s)", "Taking part", with org stores as tabs), as described in the goals, and rename the network authoring Studio or keep the two apart by context;
- (b) build it as an Artwork extension and an overview inside the network Studio (arts-collective `/studio`), and rename art-auction's back office to something like "Store desk".

Either way, keep one artwork editor, not two.

> Answer (developer, 2026-10-18): (a). Widen art-auction `/studio` into the per-user hub and rename it, because the network authoring package keeps the name Studio. Keep one artwork editor. Tabs include any auction series the user takes part in, with the things they are obliged to do there (an article, attendance at the live auction); brainstorm those, the series round comes later.

**D9. Name of the org tab.** "Store", "Listings", or another name?

> Answer (developer, 2026-10-18): the hub is called "My art". Its tabs: **My art** (the user's own listings, what `/studio` shows today) · one tab per **org store** they manage · **Auction series** (a live look at the series they are in) · **Profile** (a cross-platform view like the Center: where their product cards appear, how the stores look, so connections across stores, orgs and donated work can be checked).

**D10. Seasons.** Build seasons on migration 190 (`auction_series` and its slots) and the 2026-10-03 auction-series brief, or start smaller with a typed link from `auction_lot` to a season? Should proxy bidding, the buy-now price and a scheduler be in scope for the first season?

> Answer (developer, 2026-10-18): go big on the auction series; it drives the site to completion. A silent auction starts in November 2026 with a live portion in the last week of November. The series needs a description field, a card, a landing page, and a focus per week. Each series gets a manage page with a Help tab explaining what a series is, the parts of an auction listing, and which parameters the artist or the series manager can change. Also wanted: a primer on auction controls (listing length, minimum bid, increments) and more questions along the way. See §7 and §9.

## 5. Open items

- Write an implementation plan once D1-D10 are answered.
- Update `docs/reference/commerce.md`, which is out of date:
  - it says 5 stores with 1 org-owned; there are 6 with 2;
  - it says 4 orders; there are 6;
  - it says 3 users have a Stripe account and 2 are onboarded; the figures are 2 and 1;
  - it says `service_bookings` (migration 174) is not applied; the table exists, with 0 rows.
- `docs/open/PM_BOARD_2026-10-07.md:142-144` lists lot `e61caa91` as sold and its order as awaiting payment; the lot is `passed` and the order `cancelled` (query, 2026-10-15).
- The arts-collective Studio canvas links artwork to `${orgHome}/artwork/<slug>`; art-auction serves `/artworks/[id]` (`apps/arts-collective/src/lib/studio-actions.ts:187-225`). The link is probably broken; not checked.
- Confirm the receipting rules in §2.4 with an accountant before any charity option is offered.

## 6. Fresh look: the model and its names (claude, 2026-10-18)

The developer asked for a fresh look at the vocabulary and structure, not bound to what was built before. The schema is sound: seller and maker are separate, stores can belong to orgs, lots and bids exist, and the series tables are drawn. What is unclear is the naming, and three things the schema cannot yet say. The proposal below keeps the tables and renames the concepts in the UI and in new code; column renames are listed where a name actively misleads.

### 6.1 Seven nouns

| Noun | What it is | Today | Proposed name |
|---|---|---|---|
| **Artwork** | The object: title, medium, dimensions, images, provenance. One row for the life of the piece. | `artwork` | keep |
| **Artist** | The person who made it. Credit only; not a money role. | `artwork.artist_user_id`, which also makes them the payee | **credit**: `credited_artist_user_id` (new). `artist_user_id` stays as "maker who is paid" and is renamed in code to `payee_user_id` when touched |
| **Store** | A seller's front, owned by a person or an org. The store is the payee of its listings. | `store`, `store_member` | keep ("store" in the UI; "org store" when org-owned) |
| **Listing** | The offer: a price (fixed) or a lot (auction), with a status. One artwork has at most one open listing. | `artwork.status` + `artwork_variant` + `auction_lot` | **listing** in the UI; "lot" only for the auction form. No new table yet: a listing is the variant plus optional lot |
| **Series** | A campaign: phases, weeks, a desk team, a landing page. Lots belong to a series. | `auction_series` (no code), free-text `lot.metadata.event` | **series** (UI: "auction series"); add `auction_lot.series_id` |
| **Beneficiary** | Where money goes: a network org, or an outside charity. | `commerce_order_line.payee_org_id` derived from the store | **beneficiary**: a payee table (§6.3) referenced from listing and order |
| **Organisation** | A network org and its people (owner, guide, member). Owns stores, keeps beneficiary lists, presents series. | `organizations`, `user_organizations` | keep |

Two names to retire in the UI: "studio" in art-auction (becomes "My art", D9) and "artists" for the `/artists/[id]` store pages (they are stores, and an org store is not an artist).

### 6.2 Roles, in one table

| Role | Grants | Where set |
|---|---|---|
| org owner / guide | opens the org store; edits the store member list; keeps the beneficiary list | org manage page; `/hub` Organization |
| store member (owner / manager / staff) | creates and edits listings and lots in that store; manager+ handles money | store settings, from the org manage page or the hub (D2) |
| credited artist | shown as the maker; may reject the credit; sees the piece under "My art" | set by the lister (D4) |
| series editor / contributor | runs the desk: slots, articles, assignments, opens lots for series pieces (open Q2 of the series brief) | series manage page; chosen by `market` owners |
| bidder | any signed-in user | — |

### 6.3 Three things the schema cannot say yet

1. **Credit apart from payment.** `artwork.credited_artist_user_id` (nullable) plus `credit_status` (`credited` | `rejected`). The payee stays the store, or the maker when `artist_user_id` is set.
2. **Provenance as events.** `artwork_provenance` (artwork_id, kind `donated` | `consigned` | `acquired` | `commissioned`, from_user_id or from_text, to_org_id, occurred_on, note). "Donated by X to Y" is one row; `provenance_notes` stays as free text.
3. **A beneficiary that is not an org.** `payee` (id, kind `org` | `charity`, org_id, name, registration_no, website, blurb, receipting `none` | `intermediary` | `self`, managed_by_org_id). Each org keeps its list (`org_beneficiaries`: org_id, payee_id, position). A listing carries `beneficiary_payee_id` and `beneficiary_scope` (`all_proceeds` | `commission`). An order line carries the resolved `beneficiary_payee_id`; `payout_ledger` gains `party_kind = 'payee'`.

### 6.4 Money, in one sentence each

- **Price / hammer price**: what the buyer pays for the piece.
- **Artist share**: the maker's part, paid to their Stripe account or recorded as owed.
- **Commission (org share)**: the org's part under an agreement; 0% today because no agreements exist.
- **Platform share**: `market`'s part (the 10% / 5% in the artist-funnel brief; not built). Booked to `market`.
- **Donation**: money the buyer gives beyond, or instead of, the above, to a beneficiary. Never mixed with price in the ledger.
- **Beneficiary share**: the part of commission or proceeds a listing or a buyer directs to a beneficiary.

A listing marked "all proceeds to charity" has artist share 0, commission 0 and beneficiary share = price less card fees. A listing marked "commission supports Elkdonis" is an ordinary sale with the org share booked to the chosen org.

## 7. Auction primer: the controls and the conventions (claude, 2026-10-18)

What each control does, what the code does today, and the usual convention. Durations and amounts are conventions from online art auctions (eBay, Invaluable, Artsy, charity-auction tools such as 32auctions), not rules.

| Control | Today (`packages/commerce/src/server/auctions.ts`) | Convention | Who sets it |
|---|---|---|---|
| **Starting bid** (opening bid) | required, per lot | 30-50% of estimate for timed sales; charity auctions often 40-50% of value | lister, within series limits |
| **Reserve** | optional, must be ≥ starting bid, hidden; lot passes if unmet | hidden; "reserve met" shown once reached; many charity auctions run no reserve | lister |
| **Estimate** (low-high) | not stored | shown as a range; the CRA receipting rules need a posted value (§8) | lister |
| **Bid increment** | one fixed amount per lot, default $10 (:88) | a ladder: $5 to $99 → $1-5; $100-499 → $10-25; $500-999 → $25-50; $1,000-4,999 → $100; $5,000+ → $250-500 | series default, overridable per lot |
| **Duration** | 1 hour to 60 days (:79); live on first bid; closes on page load | timed sales 7-14 days; silent auctions 1-3 weeks; all lots in a series share the close day | series (phases); lot inherits |
| **Close time** | per lot | series-wide (`live_at`), either all at once or **staggered** (lot n closes 1-2 minutes after lot n-1) so one person can follow | series |
| **Anti-snipe** (soft close) | default 5 minutes (:90) | 2-5 minutes; a late bid extends that lot only | series default |
| **Proxy (max) bid** | `max_amount_minor` stored, not used | the bidder sets a maximum; the system bids one increment above the next bidder up to it | bidder |
| **Buy now** | displayed, never set | available until the first bid, usually 2-3× starting bid; removed once bidding starts | lister |
| **Bidder registration** | any signed-in user | charity sales: name, phone, card on file before bidding; some take a deposit above a threshold | series |
| **Payment window** | 72 hours after close, as an order (:171-173) | 48-72 hours; then offer to the under-bidder or relist | series |
| **Relisting** | allowed after a pass (migration 111) | after a pass, relist at a lower start or move to fixed price | lister |
| **Buyer's premium** | none | 0-25% on top of hammer; charity sales usually none | series |

Three mechanics that need building for a November sale: proxy bidding, a scheduler (lots must open and close on the clock, not on a page load), and the series-wide close with anti-snipe per lot. Buy-now and the increment ladder are small. Bidder registration and a buyer's premium are policy decisions (§9).

**Silent then live, as it maps to the series phases** (migration 190): `announce_at` opens the landing page with no lots; `silent_opens_at` opens bidding on every lot (the "silent auction": open, timed bidding, bids visible); `live_at` is the close. For the live portion the options are (a) staggered closes on the site with a presenter page, or (b) a real-time call with the site showing current bids and a desk member entering floor bids. (a) is buildable; (b) needs a live bidding socket and a floor-bid role.

## 8. Donation patterns and receipting (claude, 2026-10-18)

How platforms usually handle "proceeds to charity", and what applies to a not-for-profit that is not a registered charity. Sources are listed at the end; the Canadian receipting rules should be confirmed with an accountant before any receipt is promised.

**The pattern on marketplaces.** eBay for Charity and similar sites do not move the money to the charity themselves. The seller marks a listing with a charity and a percentage; the marketplace collects the sale; a **registered intermediary charity** (PayPal Giving Fund in eBay's case) receives the designated part, issues the donor's receipt, and grants the money to the chosen charity monthly. The marketplace never holds charitable funds and never issues receipts.

**Canadian intermediaries.**
- *PayPal Giving Fund Canada* is a CRA-registered charity (812867752RR0001). Donations go to it; the donor recommends a registered charity; it issues the receipt and grants monthly, around the 25th, 15-45 days after receipt. The donation pages are fee-free for charities; a checkout integration shows a 1.60% + $0.30 processing deduction on one third-party page. It grants unrestricted funds only, and if it cannot grant to the chosen charity it asks the donor for another.
- *CanadaHelps* accepts only CRA-registered charities as account holders, issues receipts itself, and charges 3.75-5.5% depending on the form. It is not available to Elkdonis as a recipient.

**What Elkdonis can and cannot do.** As a not-for-profit without charity registration it cannot issue official donation receipts, and the CRA warns that lending a registration number to an event organiser risks the charity's registration. So a "donate" option on the site can be one of:
1. **Intermediary**: the beneficiary share goes to PayPal Giving Fund Canada (or a similar body) naming the charity; the buyer gets that body's receipt. This is the only path to a receipt without Elkdonis becoming a charity. It needs a PayPal business account and the Giving Fund integration, and it ties the receipt path to PayPal.
2. **Pass-through without receipt**: Elkdonis collects, books the beneficiary share in the ledger, pays the charity, and gives the buyer a *proceeds statement* (not a tax receipt) and a later confirmation of the transfer. Transparent, no tax value to the buyer.
3. **Direct**: the charity's own donation page is linked; the buyer donates there and reports back. Simple, but the site cannot verify it.

**Receipt rules for auction purchases (CRA, for registered charities).** A receipt can be issued only for the part of the winning bid above the item's fair market value; that value must be posted before bidding; and no receipt is possible if the posted value exceeds 80% of the winning bid. Practically: an auction purchase is mostly not a donation, which is another reason to keep "donation" separate from "price" (§6.4).

**Open-ended charity names** (D5). A free-text charity cannot give assurance. The workable shape: the buyer may *suggest* a charity (name and website); the org adds it to its beneficiary list after checking the CRA registry; the buyer is told the share is held until then. Until the list has it, the money is in the ledger under a `pending_beneficiary` hold.

**Favourite charities page** (D3). Each org's manage page gets a Beneficiaries section: its list, each with a blurb and a link, and an order. The same list feeds the listing form, the checkout choice, and a public "Where the money goes" page per org. Platform-wide, the `payee` table (§6.3) is the registry.

Sources: [PayPal Giving Fund Canada delivery policy](https://www.paypal.com/ca/non-profit/paypal-giving-fund/policies/delivery), [PayPal fundraiser terms](https://www.paypal.com/ca/webapps/mpp/ua/pp-fundraisers-tnc), [PayPal Giving Fund Canada launch](https://newsroom.ca.paypal-corp.com/PayPal-Giving-Fund-Canada-launches-partners-with-Facebook), [CanadaHelps fees](https://canadahelps.org/en/why-canadahelps/our-fees), [CanadaHelps charity accounts](https://www.canadahelps.org/en/your-canadahelps-charity-account), [CRA: fundraising events, issuing receipts](https://www.cra-arc.gc.ca/chrts-gvng/chrts/prtng/rcpts/fndrsng-eng.html), [Charity Law Group: fundraising event guidelines](https://www.charitylawgroup.ca/charity-law-questions/legal-guidelines-for-fundraising-events-for-canadian-charities).

## 9. Round 2: decisions for the developer

Answer under each item; date the answer.

**R1. The "Elkdonis" row.** Present `inner_group` as Elkdonis in the buyer's support choice and treat `elkdonis` as legacy (§4 D1 note)?

> Answer (developer, 2026-10-18): leave both rows as they are. Checked 2026-10-18: `elkdonis` holds 11 members (no owner), 4 wiki pages, 6 posts, 7 feeds, the Sophia LMS courses, and 8 site-config rows for the retired app; live code reads it as the network-wide org in arts-collective `network.ts`, `elkdonis-hub.ts`, the amrit/sunjay Center config, ArtDirect `oad.ts` and art-auction `auction-hosts.ts`. `inner_group` owns elkdonis-arts.org, the org store and the Nextcloud folder. For the auction, the host org is `inner_group`; `auction-hosts.ts` is changed to name it explicitly.

**R2. Receipt path.** For "proceeds to charity" listings, which of §8's three paths for the first season: intermediary (PayPal Giving Fund, receipts, PayPal dependency), pass-through with a proceeds statement, or direct link? Pass-through is the one that works with the existing ledger and no new account.

> Answer (developer, 2026-10-18): pass-through with a proceeds statement for November; the intermediary (PayPal Giving Fund) later, with the PayPal session. Beneficiaries: each org keeps its list; the buyer may suggest one, which an org owner approves before the money is released.

**R3. Commission and platform share.** No agreement exists, so every org's share is 0% and `market` takes nothing. For the November series: what percentage of the hammer price goes to the org the buyer supports, and what to `market`? Does the artist pay it, or is it added as a buyer's premium?

> Answer (developer, 2026-10-18): a flat 5% commission, editable from the art-auction admin. Default recipient is the auction org (`market`); at checkout the buyer may direct it to IFAC, Elkdonis, or a split. The artist receives the price less 5% less the Stripe fee. Everything passes through the one host Stripe account (Elkdonis, the not-for-profit); artists who onboard are paid directly, the rest are held and paid out by hand. A second host account later would attach to an org and change nothing else. The `org_agreements` layer is not used: the commission is one setting on `market`. Money pages (what is owed, to whom, what was paid) must be viewable on art-auction, with the network admin ledger as the global view.

**R4. Increment ladder and defaults.** Accept the ladder in §7 as the series default (lots may override), 5-minute anti-snipe, 72-hour payment window?

> Answer (developer, 2026-10-18): accept the defaults: the §7 ladder, 5-minute soft close per lot, 72-hour payment window.

**R5. Live close.** Staggered closes on the site with a presenter page (a), or a real-time call with floor bids entered by the desk (b)?

> Answer (developer, 2026-10-18): staggered closes on the site with a presenter page for now. The real-time call with floor bids, a floor-bid role and the adjacent measures is needed by mid-November 2026 and is to be designed before then.

**R6. Bidder registration.** Any signed-in user, or name + phone + card on file before the first bid? A card on file (Stripe SetupIntent) is the usual protection against unpaid wins.

> Answer (developer, 2026-10-18): card on file (name, phone, saved card) before the first bid; the card is not charged automatically.

**R7. Proxy bidding and buy-now** in scope for November?

> Answer (developer, 2026-10-18): both proxy bidding and buy-now in scope for November.

**R8. Series obligations tab.** For the "Auction series" tab of My art, the obligations a participant can be given: supply photos and a statement for their slot; write an article; confirm attendance at the live close; confirm shipping terms; accept the series agreement (share percentages). Which of these, and should the desk be able to block a lot from opening until they are done?

> Answer (developer, 2026-10-18): no assigned obligations and no blocking for now; the desk direct-messages participants. The Auction series tab lets a participant attach publications they already have or create new ones for the event. Shipping: a shipping-rate API is wanted later to suggest rates.

**R9. Store member assignment.** One shared "Store team" panel used by both the org manage page and `/hub` Organization, or the hub only for now?

> Answer (developer, 2026-10-18): one shared Store team panel, mounted on the org manage page and in /hub Organization.

**R10. Rename.** art-auction `/studio` becomes `/my-art` (with a redirect), and `/artists/[id]` becomes `/stores/[id]` (with a redirect)?

> Answer (developer, 2026-10-18): keep both paths; change the labels only ("My art" for /studio).

