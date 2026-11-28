# Content library as the free-tier pay path: look-ahead (2026-11-27)

Read-only findings by a search agent for Manjushri. Nothing was changed, built or run. Every bug below was found by reading the code, not by running it; "inference" marks what was worked out rather than seen. Verify before acting.

## Short answer

The content library (`packages/content`) already has a pay route that takes signed-out buyers with an email. It cannot be the offer page's pay path yet: four bugs, one missing setting, and no public per-org scope for the offers search.

## Blocking, before any real sale

1. **Paid services can never be bought.** Checkout's rights check `resolveContentRefs` (`server/search.ts:280`) calls `contentReadSql` without the `offers` option, which adds `ci.type <> 'service'` (`server/access.ts:160`). A service key comes back "gone". The test script stubs this check (`scripts/check-checkout.mts:29-31`), so it was never exercised.
2. **The Done layer never opens after payment.** The return hop writes `surface=<kind>-offer/done` (`server/checkout.ts:91-93`, `:384`). The surface URL parser only knows `offer:<layer>:<key>[:flow]` (`cms-ui/src/surface/url.ts:179-191`) and drops it. It also overwrites the correct value the client put in `returnTo`.
3. **Cancelling payment lands on Done.** The cancel address is `returnTo` plus `payment=cancelled`; `returnTo` already carries the done surface, and nothing reads `payment=cancelled`.
4. **Page price can differ from the charge.** `loadSurfaceSite` (`apps/arts-collective/src/lib/offer-site.ts:115`, `:130`) prices from `threads.price`, default USD. Commerce charges `workshop_pages.price_member` first, default CAD.
5. **No Stripe key on arts-collective.** The live container has no `STRIPE_*` variables, so checkout answers "Card payments are not switched on yet." ArtDirect and Sunjay have the key. Needs a container recreate, with Justin's go (live keys).

Fixes 1 to 3 are in `packages/content`, which the offer-surfaces lane may not change (handoff README section 3): they go to the content library PM.

## The docs disagree

`OFFER_SURFACES/README.md:39`, `:73` say checkout is mounted nowhere. The cornerstone LEDGER (`:530`, `:535`) says it was mounted on arts-collective, then Sunjay and ArtDirect, and a rebuild went out. The route files are in the tree. No real Stripe session has ever run.

## How it works today

- One search over `content_index`; keys `thread:<id>`, `artwork:<uuid>`. Views: published, files, all, people, offers.
- The offers view (`server/offers.ts`) gives each item `offer = { kind, price, sliding?, takeUp, checkout, when, capacity }`. Take-up: artwork → order, series → subscribe, priced service/workshop/event → pay, else rsvp or enquire.
- `POST /api/content/checkout` body matches cms-ui `CheckoutRequest`. Guards: own host, JSON + Origin, rate limits (10 per IP, 5 per email per 10 minutes), server-side price, sliding amount only inside the stored range.
- Sold through the network org `oad`; the thread's author (or the artwork's maker) is paid; the org's cut comes only from an accepted agreement and is a ledger row. Destination charge when the maker has a connected Stripe account.
- A paid service also writes a `bookings` row (`packages/booking/src/server/network.ts`). Artwork orders get none.
- Not built: slot choice (a `slotId` is refused, and so is any thread with open booking slots), series subscribe, seller refunds for thread orders.

## Gaps for the offer page

- **No public org scope.** Signed out, search allows only `network` and `person`. The page cannot list an org's offers through the library for visitors. Needs a rights-rule decision and leak tests.
- **Field gaps** from a library item to `SurfaceOffer`: no description body, venue, duration, tags, slots, artwork details (medium, size, edition, shipping), host user id, co-hosts, time zone or end time. Kind names differ (`workshop` there, `writing` here).
- **Guest RSVP and follow** answer 401 on arts-collective. A guest door exists (`services/src/rsvp-handler.ts:937`, `guestRsvpRoutes`) but is built for one fixed org.
- **Subscribe** has no action in `SurfaceActions` and no table or service behind it.
- **Artworks** are not loaded on the page.

## Resurfacing the ContentLibrary inside the surface system

Closest today: `<ContentLibrary source={{endpoint:"/api/content/search"}} scope={{kind:"org",…}} view="offers" lockView density="compact" onOpen={…} />`, with `onOpen` returning `true` to skip its own lightbox and push an offer layer instead. It would register as another custom descriptor beside the offer layers (inference).

In the way:
1. Sign-in: default scope is `mine`; no public org scope.
2. The component has no offer support: no offers toggle, no offer filters in its query, no price or take-up on rows; its lightbox is an owner tool (Coverage, Timeline, "Open in Studio" shown even to strangers).
3. Its lightbox is its own dialog; the rule is one dialog system.
4. Two token sets: `--ec-*` there, `--os-*` here. A bridge inside `.eac-offer` looks possible (inference); its `prefers-color-scheme` block may fight the kit's fixed dark palette.
5. Opening a piece in place needs the missing fields above.

## Decisions for Justin

1. Who fixes bugs 1 to 3 (content library PM) and when the Stripe key goes onto arts-collective.
2. Decision "F" from the cornerstone is still open: visibility and refunds for network-sold thread orders.
3. The public org scope's rights rule.
4. Booked-at-a-time services: booking module's own path, or a slot-aware checkout.
5. A model for series subscribe; whether a priced series is payable.
6. A many-org guest RSVP and follow door for arts-collective.
7. How to test with live Stripe keys without a real charge.
8. The rate limiter fails open when Redis is down: confirm that is acceptable for live money.
