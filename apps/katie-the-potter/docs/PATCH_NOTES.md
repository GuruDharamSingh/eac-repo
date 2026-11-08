# Patch notes: Katie the Potter

A running log, newest at the bottom. One entry per patch, written as it lands,
so whoever picks this up next knows exactly where things stand.
Format: **Spotted** / **Fixed** / **Where** / **Left for you**.

Round 5 (2026-11-06) is summarised in `docs/editor.md`; this log starts at round 6.

---

## 2026-11-06 · Round 6 opens

**Spotted:** the client asked for the three design directions (Ember, Glaze Lab,
Profile) as looks the shop can switch, plus a sweep of loose ends from round 5.
**Fixed:** nothing yet; plan below, ticked off as entries land.
- [x] Look presets: `look` on ktp-piece / ktp-artwork-grid / ktp-piece-row + a site-wide default
- [x] Site style button vs Studio block list
- [x] Sample pictures re-rendered with transparent grounds
- [x] Re-verify column gutter and button placement on a published page
- [x] Edit-look popup on hero + grid; Site style header/footer tabs
- [x] Shared look-panel quirks (one fixed, two noted)
**Where:** this file.
**Left for you:** nothing yet.

## 2026-11-06 · Looks: the mechanism

**Spotted:** the three client directions lived only on a design canvas (the
claude.ai artifact could not be opened from this session, so they were ported
from the direction notes: Ember, Glaze Lab, Profile).
**Fixed:** a `look` select (house | ember | glaze-lab | profile, "" = as around
it) on ktp-piece, ktp-artwork-grid and ktp-piece-row, plus a shop-wide
default. All of it is scoped CSS: one selector per look, three arms (the card's
own block, its row, the site), and the arms never match the same card twice,
so the nearest choice always wins and the editor, the popup and the published
page agree live. Morph and Tweaks still go on top.
**Where:** `src/blocks/looks.ts` (the list, `lookProp`), `src/blocks/looks.css`
(everything visual), `piece-card.tsx` (`data-look`, swatches, the picture as
`--ktp-pic-src`, the record's dimensions on the plinth), `piece-block.tsx`,
`piece-row.tsx`, `artwork-grid*.tsx`, `popup-host.client.tsx`, `swatch.ts`
(the glaze pour). Site default: `lib/site-style-schema.ts` (Shop, Card look),
`app/layout.tsx` (`data-site-look` on body), the studio canvas root
(`config.client.ts` `setCanvasSiteLook`, `page-editor.tsx`, studio route).
`/preview?look=` and `/preview/pieces/<slug>?look=` show any look on samples.
**Left for you:** the site-wide look shows once saved (a variable cannot switch
selectors, so the layout writes it as markup on the next render). Every card
with 2+ pictures now carries a hidden swatch strip; that is a small markup
addition on the live home, invisible in House.

## 2026-11-06 · Shared: a "choice" kind for Site style

**Spotted:** Site style could hold colours, lengths, fonts and backgrounds, but
not "one of these presets".
**Fixed:** `kind: "choice"` with `options`, validated against the list (plain
words only) and drawn as a select in the drawer. Additive: no existing kind
changed.
**Where:** `packages/direct-edit/src/site/style.ts` (SiteVarKind, SiteVar.options,
cleanVar), `packages/direct-edit/src/site/SiteStyleEditor.tsx` (the select).
**Left for you:** elktours (the other Site style user) gets it on its next
rebuild; nothing there uses it.

## 2026-11-06 · Sample pictures, now cut out

**Spotted:** the samples had their beige ground baked in, so tints, Ember's
kiln glow and Profile's line drawing could not show around the pot.
**Fixed:** re-rendered all seven with transparent grounds (same shapes and
colours; the backdrop rect and the baked ground shadow removed, the card draws
its own). Uploaded over the same Nextcloud paths, so no URL changed. The
server's `?w=` derivatives are keyed by the master's ETag, so they renewed
themselves. The hero keeps its shadow and mouth; its old backdrop is now a CSS
ground behind the picture (`quick-landing.css`), so the live hero looks the same
and now follows Site style tints.
**Where:** `scripts/rerender-samples.ts` (rerunnable, `DRY=1`), `public/samples/*.svg`,
`.seed-images/*.png`, backup of the originals in `~/ktp-samples-backup-r6/` on eris.
**Left for you:** public media is served `immutable` for a year, so a browser
that already saw the old samples keeps them until its cache clears (only
testers have; no CDN in front).

## 2026-11-06 · Oops, and fixed: a build broke for ~4 minutes

**Spotted:** the production build type-checks `scripts/` too; the new script
typed `sharp` from a module the app cannot resolve, so `next build` failed and
the site was down for about four minutes.
**Fixed:** a local minimal type for the bit of sharp used. Back up, 200 on `/`.
**Where:** `scripts/rerender-samples.ts`.
**Left for you:** lesson logged: run `pnpm check-types` after touching
`scripts/` as well, before the sentinel rebuild.

## 2026-11-06 · The Site style button stays out of the Studio

**Spotted:** the floating "Site style" button sat on top of the Studio block list (bottom left).
**Fixed:** it no longer shows on `/studio/**`. The drawer styles the public pages, so it lives there; `/manage/site` points to it.
**Where:** `src/components/site-style/SiteStyleButton.tsx` (`usePathname`).
**Left for you:** if you would rather have it inside the Studio, the place is the editor header bar (a page-builder slot), a shared change.

## 2026-11-06 · Looks, second pass

**Spotted:** in Ember the arch clipped a Sold/Reserved badge at the corner; the Glaze Lab wheel read as a doily.
**Fixed:** the Ember badge hangs centred in the kiln mouth; the wheel is three turned rings with a few faint ticks that turn on hover.
**Where:** `src/blocks/looks.css`.
**Left for you:** nothing.

## 2026-11-06 · Ember, legible in the dark

**Spotted:** a dark glaze (the tenmoku) went muddy on the char interior; the soft orange drop-shadow fogged its edge.
**Fixed:** a crisp 1px rim of firelight and a back-glow behind the piece, so dark glazes read as a silhouette against the firing.
**Where:** `src/blocks/looks.css` (Ember).
**Left for you:** Ember is meant for dark, wood-fired work; very dark pieces will still be moody by design.

## 2026-11-06 · Compact cards drop the badge

**Spotted:** in a column (compact layout) the Sold/Reserved badge covered most of the small picture.
**Fixed:** hidden in compact layouts; the line under a compact card already says sold / reserved / enquire.
**Where:** `src/blocks/piece-block.css` (end of file).
**Left for you:** nothing.

## 2026-11-06 · Re-verified on a published page: placements, gutters, buttons

**Spotted:** round 5's last fixes (column gutter, button under the words) were only checked before the page was deleted.
**Fixed:** nothing needed. Throwaway `/looks-test` (hero slot, a Glaze Lab row with one Profile piece, a column, a top-level Ember piece) checked at 1440 and 390: column gutter 32px / 16px, buttons 12px under the words, row look inherited, a piece's own look wins.
**Where:** screenshots `katie-r6/placements-published-1440.png`, `-390.png`; the page was written by a one-off and deleted afterwards (see the next entry).
**Left for you:** nothing.

## 2026-11-06 · Edit-look popup on the hero and the grid; Site style tabs

**Spotted:** these were only read in round 5.
**Fixed:** nothing needed. The hero opens with its slot's Piece drawn (Ember) and its parts listed; the grid opens with its repeat parts (Cards x6, Titles x6, Badges x2...) and the transparent samples. Site style Theme shows the new Shop / Card look select; Header and Footer tabs outline the region and offer their parts. Nothing saved.
**Where:** `katie-r6/edit-look-popup-hero.png`, `edit-look-popup-grid.png`, `site-style-shop-look.png`, `site-style-header-tab.png`, `site-style-footer-tab.png`.
**Left for you:** the header tab shows black swatches for unset colours (shared drawer cosmetics).

## 2026-11-06 · Shared: Tweaks no longer jumps back to Properties

**Spotted:** after setting a token in Tweaks, the part panel came back on Properties. Measured: Puck remounts the fields column when a block's props change, so the look panel (and its tab state) was rebuilt.
**Fixed:** the look panel remembers the open tab per block part across mounts and restores it. Verified live: after a Card ground change the visible tab is still Tweaks.
**Where:** `packages/direct-edit/src/puck/look-panel.ts` (`openTab`, `shownTab`, the click listener, the restore after render).
**Left for you:** sunjay (the other look-panel user) gets it on its next rebuild; elktours and innergathering also compile direct-edit and pick it up then.

## 2026-11-06 · Shared quirks, two left as notes

**Spotted:** (1) setting a text size once also left a `min-height` on the part; (2) the popup's floating Italic only formats a selection.
**Fixed:** neither. (1) Height is only ever written by the Height row (`hpx` / `hmode` in `canvas/box-panel.ts` applyKey); the stray value came from a re-render or measurement path I could not pin down cheaply, so a guessed fix would not be clearly right. (2) Not a bug: the toolbar formats the words you select; whole-part italic is Text / Style / Italic in the panel.
**Where:** `packages/direct-edit/src/canvas/box-panel.ts` for (1).
**Left for you:** (1) repro: select a part's Text, set Size and press Enter, then look at Height (shows Fixed with a reset arrow). Also seen: Puck keeps a hidden duplicate of the fields column (two panels, two sets of selects), which is why remounts swap panels.

## 2026-11-06 · Oops, and fixed: the live hero went pale for a while

**Spotted:** after the transparent re-render, the live home hero showed a pale arch instead of its warm studio-wall ground (for roughly half an hour, between two rebuilds). The new CSS ground was in the right rule, but an older `background: var(--blk-bg-soft)` further down the same rule won.
**Fixed:** the older line removed; the hero again draws the studio-wall gradient (now CSS, mixed toward the site tokens) behind the cut-out vase. Checked live, signed out.
**Where:** `src/blocks/quick-landing.css` (`.ktp-hero-figure .ktp-hero-img`).
**Left for you:** nothing. Lesson: compare a live screenshot right after any change that touches what the live page draws.

## 2026-11-06 · Looks delivered; checks

**Spotted:** the look presets were the round's main ask.
**Fixed:** Ember, Glaze Lab and Profile work on cards, the feature card, compact and row layouts, the visitor popup, the detail template and in the Studio canvas and Edit-look popup. The live site stays on House (no stored Card look; no `data-site-look` on the live body).
Type-checks after the shared changes (`packages/direct-edit` site/style.ts, site/SiteStyleEditor.tsx, puck/look-panel.ts): katie-the-potter, sunjay, elktours, innergathering, danamccool all exit 0. No other app was rebuilt.
Cleanup: the throwaway `puck:looks-test` row deleted (`/looks-test` 404), its one-off script removed, site style still zero rows, `puck:home` never touched, no session file left, browser signed out.
**Where:** screenshots in `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\katie-r6\` (per look: grid 1440/390, card hover, popup, detail 1440/390; plus placements, popups, site style, tab fix, live home).
**Left for you:** choose the shop's look (Site style, Theme, Shop, Card look) when Katie picks a direction; until then House.

## 2026-11-06 · The smart piece and the back office, now shared kits

**Spotted:** two things this site built for itself are needed by the other sites too: the smart record block (it lays itself out by where it sits and how wide it is) and the /manage page anatomy (headers, empty states, notices, tabs, toasts).
**Fixed:** both moved into shared packages and this site now uses them; nothing looks or behaves differently. `ktp-piece` draws its root, frame, placeholder and "why" line through `RecordFrame`; the auto-layout rules, the layout select, the editing flags, resolver-key stripping and the look list come from `@elkdonis/blocks/record`. Every /manage page and the console layout use `@elkdonis/cms-ui/manage` (and `/manage/client` for the tabs and toasts); five hand-written banners became `<Notice>`. Block ids, prop names and part names are unchanged, so saved pages are untouched. Published markup differs only by two added classes (`blk-rec`, `blk-rec-frame`); screenshots of the home page, the tenmoku bowl and `/preview?look=ember` at 1440 and 390 match pixel for pixel, except a faint re-encode inside one product photo on the home grid (max 10/255, same layout).
**Where:** `src/blocks/{piece-block.tsx,piece-block.css,piece-layout.ts,looks.ts,resolved-keys.ts}`, `src/lib/puck/actions.ts`, `src/app/globals.css` (imports `record.css`), `src/app/manage/{layout.tsx,manage.css,*/page.tsx}`, `src/components/manage/*`; removed `src/components/manage/{ui,toast,manage-nav}.tsx`. Shared: `packages/blocks/src/record/`, `packages/cms-ui/src/manage/`; guides `docs/reference/record-blocks.md`, `docs/reference/manage-ui.md`. Screenshots: `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\extract-r1\` (`before-*`, `after-*`).
**Left for you:** the /manage pages were type-checked and built but not looked at signed in this time; a quick look at Orders and Pieces (tabs, a toast after an action) would close it. Tabs and the toast's dismiss button now show a focus ring when reached by keyboard.

## 2026-11-06 · Checked signed in: the console and the Studio on the shared kits

**Spotted:** the previous entry left /manage and the Studio unchecked after the move to the shared kits.
**Fixed:** nothing needed. Signed in as the placeholder owner (a minted test session, deleted afterwards; browser cookies cleared): Overview, Pieces, Orders and People at 1440 and 390 draw as in round 4 (`katie-r4/manage-overview-1440.png`, `pieces-1440.png`). The only differences are the newer Site style button and today's numbers. The current tab is marked on each page, titles are Fraunces 400, and on a phone the tabs scroll on one line. One toast: "Save and put on sale" on an empty new-piece form fails validation ("A title is required.") before anything is written. It shows in the assertive region, bottom right, and the × dismisses it. In the Studio, /studio/home has no Piece; the piece-detail template's Piece shows its line ("Sample piece · Layout: feature"). Nothing was saved or published.
**Where:** `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\extract-r1\after-manage-{overview,pieces,orders,people}-{1440,390}.png`, `after-manage-toast-{1440,390}.png`, `after-studio-home-1440.png`, `after-studio-piece-detail-why-1440.png`.
**Left for you:** nothing.

## 2026-11-06 · Review fixes in the shared kits (toasts, tabs, layout rules)

**Spotted:** an independent review of the two shared kits found a handful of small faults. Toasts: a fourth success could push an unread failure off the screen, the empty toast corner swallowed clicks, and success vs failure was told apart by colour only. Tabs: a tab with `?status=` or a trailing slash never matched. Layout: an unknown layout value drew one thing and said another in the editor line. The doc example did not compile.
**Fixed:**
- Failures now stay until you dismiss them; only successes are capped (three at a time).
- The toast corner lets clicks through, and each toast has a small ✓ or ! mark (screen readers hear "Done:" or "Problem:").
- Tabs compare paths only, and the most specific tab wins.
- One reader for the layout choice, so the card, its "why" line and the CSS agree.
- Every action's result goes straight to the toast; the kit handles a missing result itself.
- "Add a piece" and a piece's edit page use the same page header as the other /manage pages. The Orders filter is announced once, not twice.
- Old unused CSS removed (`.ktp-m-bar`, `.ktp-m-h2`). The space above the tabs moved into this site's own CSS, so nothing shifted.
- Permanent tests added for both kits.
**Where:** `src/blocks/{piece-block.tsx,piece-layout.ts}`, `src/lib/puck/config.{client,server}.ts` (no more cast on `metadata.placement`), `src/components/manage/{hand-over,order-actions,piece-form,piece-row-actions}.tsx`, `src/app/manage/{manage.css,orders/page.tsx,pieces/new/page.tsx,pieces/[id]/page.tsx}`, `docs/editor.md`. Shared: `packages/blocks/src/record/*`, `packages/cms-ui/src/manage/*`, tests `packages/blocks/scripts/record.mts` and `packages/cms-ui/scripts/manage.test.mts`, guides `docs/reference/record-blocks.md` and `manage-ui.md`. Screenshots: `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\extract-r2\`.
**Left for you:** two small visible changes. Tab corners follow the site's corner size (10px instead of 8px; you only see it on hover). The two piece pages sit a little higher under their title.

## 2026-11-06 · Onboarding: the site follows its store, not "the first owner"

**Spotted:** "the artist" was the earliest-joined `owner` of the org. Once Katie claims the shop, the placeholder drops to viewer and Guru Dharam (also an owner, since migration 249) becomes the earliest owner. The grid, the upload folder and the picture library would then have pointed at his account: his store (none) and his folder.
**Fixed:** the site's **store** is now the source of truth. It is pinned in `site_config` (org `katie-the-potter`, key `shop:store` = `{ storeId }`), written by the first request after deploy (store `632bb16f…`). "The artist" is `store.owner_user_id`. A claim moves the owner, never the store id, so the pin stays right. The claim itself now hands over the pinned store's owner rather than "an owner who holds a store". Site editing is still role-based (owner/guide).
**Where:** new `src/lib/site-store.ts`; `src/lib/auth.ts` (`getSiteArtistUserId`; `getSiteOwnerUserId` kept as an alias, so `lib/manage.ts` follows without an edit), `src/lib/artworks.ts`, `src/lib/manage-claim.ts`, `src/app/api/media/upload/route.ts`, `src/app/api/media/library/mine/route.ts`. No migration.
**Left for you:** nothing.

## 2026-11-06 · Onboarding: her picture folder is made for her

**Spotted:** a brand-new account gets a `storage_folder` name on sign-up, but no folder in Nextcloud, so her first upload would have failed.
**Fixed:** right after the claim commits, `gainSpace(her id)` runs (collective membership, artist profile, `users/<folder>/Media/*`). If it fails, the claim still stands and the Overview shows **Finish setting up your picture folder**, which runs it again. The upload route also heals itself: no folder means gainSpace runs once and the upload is retried. Upload errors are now short enough to read on a phone tile: "HEIC photo: please send a JPEG.", "Too large: 47 MB (limit 25 MB).".
**Where:** `src/lib/claim-actions.ts` (`finishPictureFolderAction`), `src/lib/site-store.ts`, new `src/components/picture-folder-{notice,button}.tsx`, one line in `src/app/manage/page.tsx`, `src/app/api/media/upload/route.ts`.
**Left for you:** a HEIC file whose browser gives it no type (Chrome on Windows) is skipped silently by the shared uploader (`packages/studio-ui` filters on `image/*`). Phones send JPEG or `image/heic`, which get the message.

## 2026-11-06 · Onboarding: order emails switched on

**Spotted:** the service had no `SENDGRID_API_KEY` or sender, so neither buyers nor Katie got order emails from orders placed on this site.
**Fixed:** the same three lines art-auction uses (`SENDGRID_API_KEY`, `EMAIL_AUTHENTICATED_DOMAINS`, `EMAIL_FROM`) were added to the katie service in `docker-compose.yml`, and the service was recreated. `.env` was not touched.
**Where:** `docker-compose.yml` (katie-the-potter service).
**Left for you:** nothing.

## 2026-11-06 · Onboarding: small things found in the dress rehearsal

**Spotted / Fixed:**
- Editing a piece that is on sale said "Saved as a draft." although it stayed on sale. It now says "Saved. It is still on sale." (`src/lib/manage-actions.ts`).
- On a phone, the floating **Site style** button covered the toasts and the buttons at the bottom left of /manage. It is now hidden on /manage, as it already was in the Studio. It is still on every public page, and /manage/site says so (`src/components/site-style/SiteStyleButton.tsx`, `src/app/manage/site/page.tsx`).
- The claim page and People page showed the link's expiry in UTC ("3:55 a.m."). They now use Eastern time (`src/app/claim/[token]/page.tsx`, `src/app/manage/people/page.tsx`).
**Left for you:** **the sign-up button does not work on this domain.** The Turnstile widget answers 110200 ("domain not allowed") for pottery.arts-collective.com, so **Join the Collective** never lights up. Add the hostname to the widget in Cloudflare, or turn Turnstile off for this service. See `docs/ONBOARDING.md`.

## 2026-11-06 · Onboarding: dress rehearsal (passed, then reverted)

A throwaway `rehearsal+…@example.com` went through the real UI with Guru Dharam's owner row in place. The owner made the link at /manage/people. Signed out, the throwaway opened it, signed in, claimed and landed on /manage. The Overview showed her store, the grid was unchanged and her folder existed. She uploaded two photos plus a 17 MB one, and a 47 MB file and a HEIC got clear errors. Save draft kept it hidden (grid and detail 404, Collect Art 404). **Save and put on sale** put it on the grid, the popup, `/pieces/<slug>` and Collect Art, and the images served. A price edit showed. **Hidden** took it off everywhere. A second piece was created at 390 px, and eTransfer payouts were saved with no Stripe call.
Cleanup: `scripts/onboarding-rehearsal.ts` (MODE `cleanup-piece`, then `revert`). The before and after snapshots match (sha256 `0a51c3d2…`). Only the consumed token count differs.
One slip, fixed within two minutes: the browser tool accepted the native "Retire 4 samples?" confirm by itself, so the four available samples were archived. They were set back to `available` (status was the only field that changed; their `updated_at` moved).

## 2026-11-07 · Buy now: cards go to the piece's page, Stripe straight from there

**Spotted:** the owner asked for cards to open the piece's own page instead of the popup, a "Buy now" there that goes straight to Stripe (Google Pay / Apple Pay included), "continue shopping" via the cart, and shipping agreed after the sale (Phase 2, EasyPost).
**Fixed:**
- **Cards go to the page.** Grid, Piece, Row and "More pieces" cards link straight to `/pieces/<slug>`. The popup is still there as a choice: **Clicking a card / Clicking the card** on the Artwork grid and the Piece block (`cardClick`: page, the default, or popup). On a piece's own page its own picture opens the popup (bigger pictures), never a link to itself. New Piece blocks default to a "View" button; Add to cart is still a choice.
- **The piece's page:** **Buy now** (an order for just this piece, straight to Stripe, which asks for the email and the shipping address; the visitor's cart is left alone), **Add to cart · continue shopping**, and one line: "Pay with card, Google Pay or Apple Pay. Shipping is arranged after you buy — you'll choose the carrier and pay for the label." Sold, reserved and price-on-request pieces read as before. The words of both buttons and the line are fields on the Piece block (Studio, piece-detail template: Button words, Buy now words, Line under Buy now).
- **Cart:** **Checkout** (our form: card or eTransfer), **Pay now with card / Google Pay** (straight to Stripe, which collects email and address), **Continue shopping**.
- **Order page after payment:** "What happens next": Katie will write, and "Shipping: you'll get a link to choose a carrier and pay for the label. Until that link is ready, Katie will be in touch", plus the Ship-to address. A Buy-now order without an email is not offered the eTransfer switch (nobody could reach the buyer).
- **/manage/orders** shows each order's Ship-to address and phone (from our form or from Stripe).
- **Shared, additive (default unchanged):** `packages/payments` provider gets an optional `collect` (`email`, `shippingAddress.allowedCountries`, `phone`), a pure `buildCheckoutSessionParams` (what would be sent) and `collectedFromSession` (reads `collected_information.shipping_details`, or legacy `shipping_details` for an older webhook API version; never the billing address). `startStripeCheckout` passes `collect` through. `syncStripeOrder` and `handleStripeWebhook` write what Stripe collected onto the order before confirming it, via new `recordCheckoutCustomer` (commerce; fills blanks only, never overwrites what a buyer typed). An empty `customerEmail` is no longer sent to Stripe (Stripe then asks for it). Every existing caller sends exactly the params it sent before (checked key by key).
- Small: the grid popup no longer throws in the Studio canvas (`history.replaceState` in an `about:srcdoc` frame).
**Wallets:** no `payment_method_types` is set, so Checkout uses the Dashboard's payment methods. Google Pay (Chrome/Android with a saved card) and Apple Pay (Safari with a card in Wallet) appear by themselves **if they are switched on** in Stripe Dashboard → Settings → Payment methods (platform account). The hosted page needs no domain registration. Not checked from here.
**Checked:** type-checks exit 0 for katie-the-potter, art-auction, artdirect, sunjay, elktours, innergathering, hidden-enneagram, arts-collective, ifac, danamccool; elastrocal fails on 3 errors in files this round did not touch (`api/mobile/v1/deck/scenarios/route.ts`, `packages/services/src/gather.ts`). `scripts/buy-now-params.ts` builds the Stripe params from a real piece without sending them (15 checks pass). Live, signed out: card click goes to the page (home grid, "More pieces"), the page's own picture opens the popup, Add to cart, cart buttons, an eTransfer order through Checkout, its paid confirmation page, then cancelled (piece back to available). The fill-blanks path ran on that test order with a made-up Stripe session. Signed in: /manage/orders shows the Ship-to; Studio shows the new fields, the grid's popup choice still intercepts and "page" does not. Nothing published. **Not done:** no Buy now or Pay now was clicked and no Stripe object was created (live keys).
**Where:** `src/components/buy-actions.tsx` (new), `src/components/add-to-cart.tsx` (`ghost`), `src/lib/shop-actions.ts` (`buyPieceNow`, `expressCheckoutCart`, `collect` on retries), `src/blocks/{piece-block.tsx,popup-host.client.tsx,artwork-grid.tsx,artwork-grid.client.tsx,artwork-grid.css,resolved-keys.ts}`, `src/lib/puck/config.{server,client}.ts` (`ownPiece`, `cardOn`), `src/lib/{piece-template.ts,default-home.ts,address.ts}`, `src/app/{cart/page.tsx,orders/[id]/page.tsx,manage/orders/page.tsx,shop.css}`, `src/config/site.ts` (`shipToCountries`), `scripts/buy-now-params.ts`. Shared: `packages/payments/src/{providers/stripe.ts,index.ts}`, `packages/checkout/src/server/stripe.ts`, `packages/commerce/src/server/{orders.ts,index.ts}`. Plan: `docs/SHIPPING_PLAN.md`. Screenshots: `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\buy-now\`.
**Left for you:**
- Switch on Apple Pay / Google Pay in the Stripe Dashboard if they are not on.
- **Rebuild art-auction** (it runs the network's webhook) so the webhook also writes Stripe's email and address onto the order before confirming. Until then katie's return hop does it, but if the webhook confirms first, Katie's sale email shows no buyer email (the order page and /manage/orders still get it on the return visit).
- A Buy-now piece is held 75 minutes while the buyer is on Stripe's page (as card checkout already was); backing out leaves it reserved until Stripe expires the session.
- Not from this test: card order ART-20261107-2895 (Pair of cups, 23:42, gurudharamsingh@gmail.com) was pending on Stripe while this was checked; it holds the piece until paid or expired.
- Phase 2 (shipping with EasyPost): `docs/SHIPPING_PLAN.md`, with questions for you at the end.

## 2026-11-07 · Channel card on /hub

**Spotted:** the developer asked for a Channel on the hub: one place for posting pieces to Facebook, Instagram and Threads, following up with video or writing, and the newsletter.
**Fixed:** `/channel` (signed-in redirect through the SSO hand-off, like `/center`) to the network console at `arts-collective.com/studio/channel?org=katie-the-potter`, and a Channel card on `/hub`. The console itself is shared (`@elkdonis/studio/channel`, hosted by arts-collective).
**Where:** `src/app/channel/page.tsx`, `src/app/hub/page.tsx`; console and status in `docs/open/CHANNEL_CONSOLE_DESIGN_2026-11-07.md` §0 (repo root).
**Left for you:** this site and arts-collective both need a rebuild before the card works; the console's Site links for this shop (Pages → /manage/site, People, Store → /manage/pieces) are set in arts-collective `src/lib/channel-data.ts` `SITE_PATHS`.

## 2026-11-07 · Sign-up check: still blocked

**Spotted:** the morning check of last night's sign-up blocker.
**Fixed:** nothing (Turnstile settings are the owner's). In a fresh browser, `/login?mode=signup` still shows Turnstile error **110200** and **Join the Collective** stays greyed out. The site key the page serves matches `.env` and the container (same hash), so the widget's hostname list in Cloudflare still lacks `pottery.arts-collective.com`. The katie service does pass `TURNSTILE_SECRET_KEY`, but `.env` only has `TURNSTILE_SECRET_KEY_PENDING`, so the server checks no token.
**Where:** `docs/ONBOARDING.md` ("Status on 2026-11-07"). Screenshot `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\shipping\turnstile-signup.png`.
**Left for you:** add the hostname to the widget in Cloudflare (no rebuild), or create Katie's account by hand (ONBOARDING fallback).

## 2026-11-07 · Shipping labels after the sale (Easyship), switched Off

**Spotted:** the owner wants buyers to agree on shipping after they buy: choose the carrier and pay for the label. The provider in `.env` is Easyship, not EasyPost.
**Fixed:**
- **/manage/shipping** (new tab): **Off / Test / Live**; ship-from address; packing (padding, box weight, extra %); **Try it** (one piece to a Montréal or New York example: the options a buyer would get). Live opens only for the shop's owner, once the ship-from is saved and a quote from it has worked.
- **Piece form:** **Weight (kg)** next to the size. While shipping is Test or Live, putting a piece on sale needs height, width and weight (a friendly message says so). The sample pieces were not changed.
- **Buyer:** after paying, the order page shows **Choose shipping** → `/orders/<id>/shipping`: up to three carriers (cheapest, fastest, best value) plus "Show all carriers", insurance ticked, duty estimate for the US, "Edit address" when a carrier can't use it, then **Pay for shipping** (a second, small Stripe page; the label is bought only after that payment is confirmed). A failed label is retried once, then refunded in full and Katie is emailed. Tracking shows on the order page.
- **Katie, /manage/orders:** "Label bought: Canpar - Ground, tracking …", what the buyer paid and what the label cost, **Download label (PDF)**, and **Mark shipped (tracking filled in)**.
- **Test mode** (editors only): sandbox rates and labels, **Buy test label** with no payment at all, a typed weight for pieces without one, no emails (the shipment's log records what would have gone).
- Stripe's Buy now / Pay now pages now also ask for a **phone** (carriers want one). Our checkout form already had it.
- **Off** (as deployed): everything reads and works exactly as before.
**Checked:** type-checks exit 0 for katie-the-potter, art-auction, artdirect, sunjay, elktours, innergathering, hidden-enneagram, arts-collective, ifac, danamccool; elastrocal still fails on the same 3 errors as before. Sandbox, signed in as the placeholder owner: ship-from saved, Test on, Try it Canada (Canpar Ground $38.68 insured / $37.73 not, Express, Select), Try it US (the sandbox has no Canada→US couriers; one read-only production quote showed DHL and FedEx, so the US request is right), an eTransfer test order, Choose shipping, Buy test label (label PDF downloads, tracking TEST12345678), /manage/orders line, signed webhook simulation (10 checks: unsigned, wrong secret and tampered tokens refused; In transit → Delivered; never backwards). Signed out, the test order showed nothing new. `scripts/shipping-label-params.ts` built the live label session without sending it (17 checks: platform charge, one line, metadata, URLs; Buy now asks for a phone; an existing session is unchanged).
Found and fixed in testing: Easyship refuses a contact name over 22 characters, so the ship-from name is limited to 22 and a buyer's name is shortened on the label.
Cleanup: sandbox label cancelled with Easyship, test shipment row deleted (none left), test order ART-20261107-1886 cancelled (Tenmoku tea bowl available, no reservation, still no weight), shipping **Off**, ship-from cleared, no packing saved, session files deleted, browser context closed. **Not done:** no Stripe session or object was created, no production shipment or label.
**Where:** `src/lib/shipping/*`, `src/app/manage/shipping/page.tsx`, `src/components/manage/shipping-forms.tsx`, `src/app/orders/[id]/shipping/page.tsx`, `src/components/shipping-picker.tsx`, `src/app/api/shipping/{return,webhook,label/[id]}/route.ts`; edits in `src/app/orders/[id]/page.tsx`, `src/app/manage/{layout.tsx,orders/page.tsx,pieces/*}`, `src/components/manage/{order-actions,piece-form}.tsx`, `src/lib/{manage-actions,shop-actions}.ts`, `src/app/{shop.css,manage/manage.css}`; scripts `scripts/shipping-label-params.ts`, `scripts/shipping-rehearsal.ts`. Shared (additive): `packages/checkout/src/server/shipping-label.ts` + a `shipping_label` branch in `handleStripeWebhook`; `packages/commerce/src/server/shipping-label.ts`. Migration `251_katie_order_shipment.sql`. `docker-compose.yml` katie service: four `EASYSHIP_*` lines. Design: `docs/SHIPPING_PLAN.md`. Screenshots: `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\shipping\`.
**Left for you:**
- Defaults chosen for the six questions (change any): box in the weight rule, no handling fee; Canada and the US, with customs; insurance offered and ticked; the collective's Easyship account, label paid to the platform; three options plus "show all"; phone asked on Stripe's page.
- Fund the production Easyship account, then Katie fills /manage/shipping and the weights and switches Live.
- Easyship webhook: add `https://pottery.arts-collective.com/api/shipping/webhook` in the Easyship dashboard and put its `webh_…` secret in `.env` as `EASYSHIP_WEBHOOK_SECRET` (then recreate the service). Until then tracking stays at "label bought".
- Rebuild art-auction so the network's Stripe webhook records label payments too (until then the return hop and /manage/orders do it).
- Migration 250 (art-auction's Easyship model, another session's) was applied together with 251.

## 2026-11-07 · Channel moves to arts-collective.com/channel

**Spotted:** the owner's Claude Design handoff for Channel replaces the first console (`/studio/channel`) with its own pages at `arts-collective.com/channel`.
**Fixed:** `/channel` here now hands off to `<network>/channel?org=katie-the-potter` instead of `/studio/channel`. The Channel card on `/hub` is unchanged.
**Where:** `src/app/channel/page.tsx`; the console and its status in `docs/open/channel.md` (repo root).
**Left for you:** nothing to build: both sites were rebuilt at 12:58 EST and the hand-off is in this site's build. Not yet followed signed in.

## 2026-11-07 · Shipping is now quote-only: buyers pay Katie, Katie buys the label

**Spotted:** the owner's new direction: "keep it quote only for now, but offering the choice of shipper that they follow up with in parallel checkout. no fund production for now from platform stripe."
**Fixed:**
- **Quote only.** The collective buys no labels and the Easyship account needs no money: it only gives quotes (read-only `POST /rates`; no shipment, no label).
- **Buyers still choose the carrier** after paying (up to three, "Show all carriers"), then pay that amount on a second, small Stripe page linked to the order.
- **The shipping money is Katie's**, like her sale money, no commission: straight to her Stripe account once she has finished connecting it (destination charge, no application fee), otherwise the collective holds it for her in the ledger (one entry owed to her, less the usual card-fee estimate). Written at the same moment the payment is recorded, once only.
- **Everyone sees the same choice:** the quote (courier, service, days, price, when it was quoted, the parcel, the addresses) is kept on the shipment, written on the Stripe line and its metadata, shown to the buyer ("Shipping paid: Canpar - Ground, est. 1 business day, $38.68. Katie will send tracking."), emailed to Katie ("Ship this order: …", with the address, box size and weight, and customs details for the US), and shown on a **Ship this** card in Orders with **Carrier + Tracking number → Mark shipped**. The buyer then gets the tracking by email.
- **Insurance is Katie's setting** (she buys the label): "I'll insure parcels" (on to start) folds it into the price; "Let buyers choose" gives them a tick box instead.
- **A note for Katie** on Shipping, the card and the email: the label may cost a little more or less than the quote; small differences are hers, buyers are never charged again.
- **Switch:** Off / Test / On. The first label-buying design is kept but hidden behind a developer flag, labelled "Label buying — not enabled".
- Found on the way: "Choose a different option" had a broken database update in the label flow (unquoted status); fixed.
**Checked:** type-checks exit 0 for katie-the-potter, art-auction, artdirect, sunjay, elktours, innergathering, hidden-enneagram, arts-collective, ifac, danamccool (elastrocal: the same 3 old errors). Sandbox walkthrough signed in as the placeholder owner: Try it, an eTransfer test order, Choose shipping (desktop and phone), the parallel Stripe page's settings built for both money routes without sending (28 checks), the payment simulated with a made-up session through the return hop's own path (16 checks: shipment paid, Katie's ledger entry 3726 = 3868 less the 142 fee estimate; the onboarded route's accrual + payout checked inside a rolled-back transaction; no double recording), the Ship-this card, tracking entered, both emails composed (test mode logs them, sends nothing). No Stripe session or object, no production Easyship call.
**Cleanup:** the test ledger entry and shipment row deleted (ledger and payout fingerprints identical before and after), test order ART-20261107-6749 cancelled (Tenmoku tea bowl available, no reservation), shipping Off, ship-from cleared, session deleted.
**Where:** `src/lib/shipping/{settings,access,shipments,actions,notices}.ts`, `src/app/manage/shipping/page.tsx`, `src/app/manage/orders/page.tsx`, `src/components/manage/{ship-this,shipping-forms,order-actions}.tsx`, `src/app/orders/[id]/{page,shipping/page}.tsx`, `src/components/shipping-picker.tsx`, `src/app/api/shipping/return/route.ts`, `src/app/{shop.css,manage/manage.css}`, `scripts/shipping-quote-check.ts`. Shared, additive: `packages/checkout/src/server/shipping-label.ts` (+ new exports in `stripe.ts`, comment on the webhook branch), `packages/commerce/src/server/shipping-label.ts` (`recordShippingPaymentPaid`, `accrueShippingPayment`) + `index.ts` export. No migration. Design: `docs/SHIPPING_PLAN.md`. Screenshots: `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\shipping-quote\`.
**Left for you:**
- Katie switches it On herself (owner only): Shipping → ship-from → Try it → **On**. Her steps: `docs/ONBOARDING.md`, step 7.
- Rebuild **art-auction** at a quiet moment so the network's Stripe webhook records shipping payments too; katie's return hop already does, and today's webhook ignores them harmlessly.
- Refunding a shipping payment is by hand for now (Stripe dashboard plus a ledger reversal).

## 2026-11-07 · Sharing card on Manage

**Spotted:** onboarding Katie needs a way into connecting Instagram and Facebook from her own site.
**Fixed:** Manage overview has a **Sharing** card: **Connect Instagram and Facebook** (hands off to Channel's Outlets on arts-collective.com, where she connects her accounts and makes her Page the shop's channel) and **Open Channel**. `/channel?to=outlets` lands on Outlets; `/channel` still lands on Channel Home.
**Where:** `src/app/manage/page.tsx`, `src/app/channel/page.tsx`. Channel's side: `docs/open/channel.md` "Onboarders like Katie" (repo root).
**Left for you:** nothing to build: live since the 18:20 EST rebuild of both sites. Her Channel shows her as `pottery.arts-collective.com` until her own domain is listed. Her sign-up still needs the Turnstile hostname.

