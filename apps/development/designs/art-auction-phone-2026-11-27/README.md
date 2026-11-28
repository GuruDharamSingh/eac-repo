# Art-auction on a phone: sheets (design prototype, 2026-11-27)

This prototype shows patterns for showing, buying, bidding on and launching an artwork on market.arts-collective.com at phone width. `index.html` is self-contained: plain JavaScript, Google Fonts only. At 390 px it draws the phone alone. At 900 px and wider, the pattern rules and the open decisions appear beside it. All pieces, people and prices are placeholders, and nothing talks to the market.

## Sources
- Sheet rules: `../publication-surfaces-2026-11-27/README.md` (core rules 2–6, phone sheets, done layer, names open profiles).
- What the market does today: read from `apps/art-auction` on 2026-11-27 (source, not a signed-in walk-through):
  - Artwork page: `app/artworks/[id]/page.tsx:170-207`. Buy now calls `addArtworkToCart` and goes to `/cart` (`app/actions.ts:43,76`).
  - Checkout: `packages/checkout/src/components/CheckoutForm.tsx` handles contact, address, card or Interac, beneficiary notices, Support and notes. It sends the buyer to Stripe's hosted page (`actions.ts:161-168`).
  - Shipping is quoted after the order exists, on `/orders/[id]` (`orders/[id]/shipping-picker.tsx`).
  - Bidding: `packages/commerce/src/components/BidWidget.tsx`. Register to bid asks for a phone number and runs a Stripe setup-mode page (`actions.ts:236`). The return goes to `/lots/[id]?registration=done`, and the page does not read that parameter. Buy now on a lot uses `window.confirm`.
  - On phones there is no sticky buy bar and no sheets. Pages are one column until `lg:`. `SurfaceProvider` wraps `/artworks` and `/artists` only, and opens the artist popup.
- Look: `apps/art-auction/src/app/globals.css:85-122` (light), plus Fraunces and Inter (`app/layout.tsx:20-30`).

## Flows drawn
- Buy: piece → delivery → pay → Stripe (simulated) → done.
- Bid: lot → register → done ("You can bid") → back to the lot → bid on the ladder or set a maximum → done. About 7 s after a bid, a simulated outbid notice appears; it reopens the lot.
- Lot buy-now: lot → buy now → pay.
- Artist: any name → artist sheet (follow, message, works) → piece.
- Launch, the seller's path, from the Center tab: photos → details → price and where (store, price on request, or enter a series) → preview → published → share.

## Open decisions (also listed on the page)
- D1: quote shipping before payment, or after the order as today.
- D2: keep the basket on a phone.
- D3: offer Interac on every store.
- D4: where the Support choice sits.
- D5: light market look or the handoff's dark shell.

## Not done
- Not built in art-auction. The market session owns that app, and the build would go through `packages/cms-ui/src/offer-surface/` (another session's kit, in progress 2026-11-27).
- Not checked against real lot data or with a signed-in buyer.
