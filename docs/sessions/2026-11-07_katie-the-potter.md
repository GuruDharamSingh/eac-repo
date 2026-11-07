# Katie the Potter storefront — handover, 2026-11-07
Summary: a new seller site, `apps/katie-the-potter` (https://pottery.arts-collective.com, port 3023,
container `eac-katie-the-potter`, production mode), was built over 2026-11-06/07 by a PM session
directing designer/explorer agents. It has Puck pages with the look layer, smart record blocks, look
presets, on-site cart/Buy now/checkout, a `/manage` back office, an owner claim link and quote-only
Easyship shipping. Two patterns were extracted to shared packages. Katie (the artist) onboards
2026-11-07; sign-up on her host is blocked by Cloudflare Turnstile (Open items 1).

## Changed
- `apps/katie-the-potter/**` — new app (copied shell from `apps/sunjay`, Puck/artwork plumbing from
  `apps/danamccool`). Guides: `docs/editor.md` (blocks, look layer, looks), `docs/ONBOARDING.md`
  (steps for Justin and for Katie), `docs/SHIPPING_PLAN.md` (as built), `docs/PATCH_NOTES.md`
  (dated log of every fix), `scripts/seed-katie.md` (what was seeded). (verified: live checks and
  screenshots each round; signed-in checks with `scripts/mint-session.ts`)
- Blocks `src/blocks/`: `ktp-quick-landing` (+ `feature` slot), `ktp-artwork-grid`, `ktp-piece`
  (layout auto|card|compact|row|feature from placement + container width), `ktp-piece-row`,
  `ktp-piece-details`; `look` prop house|ember|glaze-lab|profile (`looks.ts/.css`); `cardClick`
  page|popup (default page). Block ids, prop and part names are stored in page JSON: never rename.
- Routes: `/`, `/pieces/[slug]` (Puck route template `piece-detail`), `/preview` (noindex, sample
  pieces, `?variant=&look=` knobs), `/cart`, `/checkout`, `/orders/[id]`, `/orders/[id]/shipping`,
  `/manage/**` (Overview, Pieces + editor, Orders, Payouts, Shipping, Site, People, Visitors),
  `/account`, `/hub` (cards), `/center` (handoff to arts-collective `/hub/network`), `/claim/[token]`,
  `/studio/**`, `robots.ts`.
- Commerce on the site's own domain: `src/lib/shop-actions.ts` (cart, `placeOrder`, `buyPieceNow`,
  `expressCheckoutCart`), return hop `src/app/api/checkout/return`. `src/lib/sample-guard.ts`
  `SAMPLE_CARD_GUARD=false` (card allowed for sample pieces, per Justin).
- Store pin: `src/lib/site-store.ts`, `site_config` (`katie-the-potter`, `shop:store`) =
  `632bb16f-fe37-45e9-9611-2de298bed2ad`; "the artist" = `store.owner_user_id` (fixes owner
  resolution when the site has several owners).
- Shipping (quote only): `src/lib/shipping/*`, Easyship API v2024-09; modes `off | quote_test |
  quote` in `site_config shipping:mode` (now `off`); label buying parked behind env
  `SHIPPING_LABEL_BUYING=on` (unset). (verified: sandbox walkthrough; Stripe params built, not sent)
- Migrations (mine): 243 org `katie-the-potter`; 244 placeholder owner row; 247 `org_claim_tokens`;
  249 gurudharamsingh@gmail.com = site owner (Justin's request); 251 `order_shipment`. Running them
  also applied other sessions' pending 248 `studio_items` and 250 `easyship_shipping`. Status:
  252 total, 0 pending.
- `docker-compose.yml` katie service: STRIPE_SECRET/PUBLISHABLE, SENDGRID_API_KEY +
  EMAIL_AUTHENTICATED_DOMAINS + EMAIL_FROM, EASYSHIP_SANDBOX/PRODUCTION_TOKEN,
  EASYSHIP_(SANDBOX_)WEBHOOK_SECRET, `NEXT_PUBLIC_APP_URL` default `https://pottery.arts-collective.com`.
  `.env` was never edited.
- Shared, additive (other apps unchanged unless they opt in):
  - `packages/page-builder/src/config.tsx` — `placementOf`/`BlockPlacement` passed to resolvers as
    `metadata.placement`; optional `morph`.
  - `packages/blocks/src/record/` → `@elkdonis/blocks/record` (+ `record.css`): `placementRules`,
    `layoutChoice`, `effectiveLayout`, `describeLayout`, `RecordFrame`, `editingOf`,
    `stripResolvedKeys`, `defineLooks`. Tests `packages/blocks/scripts/record.mts` (in `pnpm test`).
  - `packages/cms-ui/src/manage/` → `@elkdonis/cms-ui/manage` (+ `/client`, `manage.css`):
    PageHeader, Toolbar, EmptyState, Notice, ManageTabs, ToastProvider (`sink` via app-side client
    wrapper), `normaliseResult`. Tests `packages/cms-ui/scripts/manage.test.mts`.
  - `packages/direct-edit`: site style `choice` value kind; look panel keeps the open tab.
  - `packages/payments` provider: optional `collect` (email, shipping address, phone),
    `buildCheckoutSessionParams`, `collectedFromSession`.
  - `packages/checkout/src/server/stripe.ts`: `collect` pass-through; sync/webhook record buyer
    details; `shipping_payment` branch. `shipping-label.ts`: shipping payment session + recorder.
  - `packages/commerce`: `recordCheckoutCustomer`, `recordShippingPaymentPaid`,
    `accrueShippingPayment` (ledger via `writeEntry`).
  - Docs: `docs/reference/record-blocks.md`, `docs/reference/manage-ui.md`, pointer in
    `docs/reference/frontend-ui.md`.
  (verified: check-types exit 0 for katie, art-auction, artdirect, sunjay, elktours, innergathering,
  hidden-enneagram, arts-collective, ifac, danamccool; elastrocal has 3 pre-existing errors in
  `src/app/api/mobile/v1/deck/scenarios/route.ts` and `packages/services/src/gather.ts`)

## State at handover
- Deployed: katie only (rebuilt many times via two-file sentinel; `/` = 200 at handover).
  Not rebuilt: art-auction, sunjay, elktours, innergathering, danamccool (shared changes reach them on
  their next rebuild).
- Git: katie was included in another session's snapshot commit `21a78f2`; another session added
  `src/app/channel/page.tsx` (`30aa615`). About 25 katie files are modified since; shared changes
  above are uncommitted. Nothing was committed by this session.
- Data: Katie's account does not exist yet. The placeholder `katie@katiethepotter.example` owns the
  org and the store; six sample artworks (`metadata.sample=true`) are on sale, also on Collect Art.
  Sample images in Nextcloud `EAC_Network/users/katie/Media/Images/katie-sample-*.png`
  (originals backed up in `~/ktp-samples-backup-r6/`). Site look: House. Shipping: Off.
- Rebuild lock for parallel agents: `mkdir /tmp/katie-rebuild.lock` / `rmdir` (convention only).

## Open items
1. Sign-up blocked: Turnstile answers 110200 on `pottery.arts-collective.com` — add the hostname to
   the widget in Cloudflare. `TURNSTILE_SECRET_KEY` is empty (`.env` has `TURNSTILE_SECRET_KEY_PENDING`),
   so tokens are not verified server-side. Fallback: create her account via GoTrue admin, she uses Sign in.
2. Google sign-in from this host untested; host not in GoTrue `URI_ALLOW_LIST`. Use email + password.
3. Hand-over: an owner (Guru Dharam's account works) creates the link at `/manage/people` and sends it
   (steps in `docs/ONBOARDING.md`). The claim moves org ownership, the store and pieces, runs `gainSpace`.
4. Retire the six samples before real buyers (Manage → Pieces → Retire all samples).
5. Stripe Dashboard: confirm Google Pay / Apple Pay are enabled (sessions set no payment_method_types).
6. Rebuild art-auction (runs the network Stripe webhook) so the webhook stores Stripe-collected buyer
   details and records shipping payments; katie's return hop covers both meanwhile.
7. Shipping on: Katie fills `/manage/shipping`, weighs pieces, Try it, On. Optional Easyship tracking
   webhook → `https://pottery.arts-collective.com/api/shipping/webhook`, secret in `.env`.
   Shipping-payment refunds are manual (Stripe dashboard + ledger reversal). Not built: void label,
   combined boxes, pickup.
8. Reconcile with another session's Easyship work for art-auction (`packages/commerce/src/shipping/`,
   migration 250, shipping paid with the piece) — two models now exist.
9. elktours export (plan delivered, not started): smart blocks elk-tour/experience/place on
   `@elkdonis/blocks/record`, templates onto the shared adapter, looks, manage kit, business hand-over
   via `business_claims`. Blocked on Justin's go-ahead: another session ("Opens") is editing elktours
   and shared Puck files; four questions pending (looks, claim method, public /places, landing canvas).
   Claim-links extraction to `@elkdonis/services/claim-links` is on hold for the same answers.
10. Known rough edges: HEIC with no MIME type is skipped silently by `packages/studio-ui` uploader;
    React #418 hydration error seen twice (not reproduced); stray `min-height` from the look panel
    text size (repro in PATCH_NOTES); public media cached 1 year immutable (re-uploads at the same
    URL stay stale in browsers); Profile look needs cut-out photos.

## Round log (what each round delivered)
| Round | Delivered | Screenshots (Windows PC, `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\`) |
|---|---|---|
| 1 | App scaffold, compose service :3023, migration 243, `ktp-quick-landing` + `ktp-artwork-grid` with Puck CSS props, `<dialog>` popup | `katie-landing.png` |
| 2 | Card design (arch/rounded), `/pieces/[slug]`, `/preview`; seeded placeholder account, store, 6 sample pieces + images | `katie-r2\`, `katie-final\` |
| 3 | On-site cart/checkout/orders (card + eTransfer), return hop, sample guard | `katie-r3\` |
| 4 | `/manage/**`, `/account`, `/hub`, `/center`, header menu, claim link (mig 247), card checkout on | `katie-r4\` |
| 5 | Look layer in Studio, `ktp-piece`/row/details, placement in page-builder, Site style, `piece-detail` template | `katie-r5\` |
| 6 | Looks ember/glaze-lab/profile, transparent sample re-render, `PATCH_NOTES.md` started | `katie-r6\` |
| Export | `@elkdonis/blocks/record`, `@elkdonis/cms-ui/manage`; katie migrated; independent review → 8 fixes | `extract-r1\`, `extract-r2\` |
| Onboarding | Store pin, `gainSpace` after claim, email env, dress rehearsal + exact revert | `onboarding\` |
| Buy now | `cardClick`, Buy now, cart express pay, Stripe `collect` | `buy-now\` |
| Shipping | Easyship labels (built, then parked), quote-only flow | `shipping\`, `shipping-quote\` |

## How it works (for the next session)
- Layout of a record block: resolver reads `metadata.placement` (`{parentType, slot, index,
  siblingTypes}`) → `placementRules` in `src/blocks/piece-layout.ts` (hero slot → feature; split-row /
  flow-column → compact; row/grid → card; page → card at page measure) → container queries on
  `.blk-rec-frame` refine by width. An explicit `layout` skips placement. The editor shows a "why"
  line. Parents must give the block a definite inline size (frame is `container-type: inline-size`).
- Looks: nearest choice wins (piece → row/grid → site `Site style → Shop → Card look`); scoped CSS
  under `[data-look]`; morph/Tweaks still apply on top.
- Sale money: `createOrderFromCart`/`createOrder` → `startStripeCheckout` (or eTransfer) →
  `confirmOrderPaid` via katie's return hop and the shared webhook (art-auction). Destination charge
  only when the maker has finished Express onboarding; otherwise platform charge + ledger payable.
- Shipping money: after payment the buyer picks an Easyship quote at `/orders/<id>/shipping` → second
  Checkout (`metadata.kind="shipping_payment"`) → `applyShippingPaymentSession` records payment and
  one ledger entry for Katie (no commission; card-fee estimate deducted on platform charges) → Katie
  emailed "Ship this order" → she buys the label herself, enters carrier + tracking, Mark shipped →
  buyer emailed tracking.
- Hand-over: `src/lib/manage-claim.ts` — 32-byte token, SHA-256 stored, 7-day expiry, single use;
  one transaction moves org owner, `store.owner_user_id`, `store_member`, `artwork.artist_user_id`,
  drops the placeholder to viewer; `gainSpace` after commit.

## How to work on it
- Rebuild katie: `sudo -n docker exec eac-katie-the-potter rm -f /app/apps/katie-the-potter/.next/BUILD_ID`
  then `cd ~/eac && sudo -n docker compose restart katie-the-potter` (`up -d` after compose env
  changes). Type-check first in a one-off container:
  `sudo -n docker compose run --rm --no-deps -w /app/apps/katie-the-potter admin pnpm check-types`.
  The production build also type-checks `scripts/` (a bad script took the site down ~4 min on 11-06).
- Signed-in testing: `scripts/mint-session.ts` (placeholder owner); never print the cookie; delete after.
- Test helpers: `scripts/claim-test.ts` and `scripts/onboarding-rehearsal.ts` (snapshot / revert),
  `scripts/buy-now-params.ts`, `scripts/shipping-label-params.ts`, `scripts/shipping-quote-check.ts`
  (build Stripe params without sending), `scripts/rerender-samples.ts` (`DRY=1`).
- Cleaning up test rows: snapshot before/after (the rehearsal script hashes the relevant tables) and
  prove they match. Leftover `users` rows with a slug show in public rosters.

## Decisions
- Own seller console in the app, not a deep link to market `/studio` — PM, Justin asked for "the usual back end".
- `/hub` = cards to `/manage`; `/center` = handoff to network — community hub does not fit a one-artist shop.
- Purchases on the site's domain; Buy now straight to Stripe; cards open the detail page — Justin.
- Card checkout on for everyone, samples included — Justin ("let people checkout with stripe").
- Shipping quote only; buyer pays shipping to Katie (destination charge when onboarded, else ledger
  payable); platform buys no labels and does not fund Easyship — Justin.
- Shipping defaults: padding in weight, CA+US with customs, insurance Katie's setting default on,
  3 options, phone collected — PM, changeable in `/manage/shipping` and code.
- Per-org app despite `docs/open/SOCIALS_DEBATE_2026-10-31.md` — Justin ("don't let one app block you").
- Testing rule: no live Stripe objects; Easyship sandbox only; Playwright auto-accepts `window.confirm`
  (once archived 4 samples for ~2 min; restored) — never click destructive buttons on real rows.
