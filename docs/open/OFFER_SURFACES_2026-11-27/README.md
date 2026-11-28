# Offer surfaces: handoff for a design/code agent (2026-11-27)

The free-tier single-offer site (`<org>.arts-collective.com`) is being redrawn from the design packet "Single page publication template mockups". A first pass exists in code. Justin's verdict on its screenshots: it does not follow the laid-out templates closely enough. This page gives a new agent the direction, what exists, the rules, and the work: make the implementation match the packet.

## 1. Direction (Justin, 2026-11-26/27)

- ArtDirect and arts-collective form a small social network. An org or person publishes from the arts-collective hub and **features one offer** on their free-tier subdomain site, choosing one of the packet's templates (font template, icons, kind tint) and filling in the media.
- Visitors act in **surfaces** (popup on desktop, bottom sheet on phones): RSVP (free; also makes them a follower), follow, pay for a service, order an artwork. Followers can be made guides who help manage the page.
- The **profile** on the page is ArtDirect's: the org's identity user (`organizations.profile_user_id`). The directory lists artists, organizations (org-users) and associated businesses (ArtDirect `/`, live).
- **Checkout is on the ad itself, through the content library**, org-agnostic, sold through the network org `oad`; the author is paid and the offer's org gets its cut only under an existing agreement. ArtDirect holds the bookings list; a central all-sales view lives in arts-collective `/hub/admin/sales` (admins).
- First-pass kinds: **event + RSVP + follow, service + pay, artwork + order.** Writing, series, talk and member profiles come next.

## 2. The packet (source of truth for the look)

`apps/development/designs/publication-surfaces-2026-11-27/`:
- `README.md`: the system rules, every layer's head/body/foot, tokens, type templates, icons. Read all of it.
- `Offer Surface.dc.html`: the surface component, every layer and both shells. **Main implementation reference.**
- `Flyer Pages Wireframes.dc.html`: pan/zoom canvas, rounds 7 (top) to 1. Section B (profile page with featured offer: 3a desktop, 4b phone) is the page. Its `<helmet>` holds the exact `[data-ft]` font-template values.
- `Surface Icon.dc.html`: icon sets.
- Open the `.dc.html` files in a browser with `support.js` beside them, or screenshot them headless (section 6) to compare side by side.

Earlier surface documentation from another session: `apps/development/designs/elktours-surface-2026-11-20/docs/01-06` and its screenshots (cms-ui `SurfaceStage`, docked and phone layouts).

## 3. What exists (all uncommitted, in the main checkout)

**Surface kit**, `packages/cms-ui/src/offer-surface/` (exports `@elkdonis/cms-ui/offer-surface` and `@elkdonis/cms-ui/offer-surface.css`):
- `types.ts`: the contract (`SurfaceSiteData`, `SurfaceOffer`, `SurfaceProfile`, `SurfaceLook`, `SurfaceActions`, `CheckoutRequest`, `TakeUp`). Additive changes only; other lanes depend on it.
- `look.css`: tokens (`--os-*` under `.eac-offer`) and the six font templates (`[data-ft=para|gazette|quiet|marquee|ledger|rite]`), kind tint (`[data-tint=off]`). Contrast table in its header.
- `icons.tsx`: `SurfaceIcon` (things, marks, stamps, glyph), paths generated from the packet's `build()`.
- `offer.css` (imports look.css), `OfferFrame.tsx` (head/body/foot shell), `parts.tsx`, `layers.tsx` + `layers-flow.tsx` (layers evt-offer, evt-rsvp, svc-offer, art-offer, art-order, pay, done, pf-owner, pf-guest, follow, share), `page.tsx` (OfferTopBar, OfferProfileHeader, OnNowCard, AlsoOffered, WritingShelf, OfferProfilePage), `OfferSurfaceRoot.tsx` (registers the layers as `custom` descriptors with key "offer" on the existing cms-ui surface system), `descriptor.ts`, `env.tsx`, `format.ts`.
- `packages/cms-ui/src/surface/url.ts`: additive `offer:<layer>:<key>[:flow]` in `?surface=`.
- Builder's notes, with measured contrasts and the reasons for choices: `/tmp/claude-3003/-mnt-pool1-home-guru-eac/095fcaed-70ce-4fb0-bbc6-79e134cebcb1/scratchpad/team/notes-S.md` (scratch; may be cleared).

**Free-tier site**, `apps/arts-collective`:
- `src/app/sites/[slug]/page.tsx`: draws the new page only when site_config `offer:look` has `enabled: true` (or `?look=preview` when NODE_ENV is development); otherwise today's `OfferingPage`.
- `src/components/sites/OfferSitePage.tsx` (client mount), `src/components/sites/offer-actions.ts` (SurfaceActions: RSVP via `/api/threads/[id]/rsvp-and-follow`, follow via `/api/org/[slug]/follow`, checkout via `/api/content/checkout`, which is not mounted yet).
- `src/lib/offer-site.ts` (`loadSurfaceSite`: owner, featured, offers, writing, followers, look), `src/lib/offer-look-actions.ts` + `src/app/hub/sites/[slug]/look/` (the hub Look page: owners and guides).

**Not in this lane, do not change:** content-library checkout (`packages/content/src/server/checkout.ts`, wired in `routes.ts`, approved by the content library PM, not mounted on any app), the offers search view, bookings for network sales (agent B, in progress), `/hub/admin/sales` (agent G, in progress), commerce/payments/checkout packages.

## 4. Known gaps against the packet (start here)

Seen in the first screenshots (ifac, amrit-canada; desktop 1280 and phone 390) and the builder's notes:
- Page (section B, 3a/4b): the follow button's bronze sweep, the pulsing live dot, card hover lift, `+` circle behaviour, header grid `112px | 1fr | auto`, the 800px page width, Profile tab with inset bronze underline, writing shelf (lead piece with cover beside a list, "All writing (n) →") all need checking against the canvas, not the README alone.
- Surfaces: never seen in a browser yet. Check every layer against `Offer Surface.dc.html`: head grid and mark box, kicker row and crumb, title size `calc(20px*var(--fhx))`, the one head button rule, foot status + quiet + primary, phone sheet (grab handle, full-width primary, mark modes inline/thumb/box), push and pop animations (`dcPush`, `dcPop`), scrim.
- The URL holds only the top layer (the existing surface system's behaviour), not the packet's `a/b/c` stack.
- Data the contract lacks, so the kit omits it: the event running order, the avatar stack, "replies within a day", service slot time zones.
- Not built: wr-read (reading popup and the docked writing stage, section C), talk, ser-offer/ser-sub/ser-session, pf-member, the hover profile card (5d), share's Embed.
- Fonts: `look.css` imports Google Fonts by `@import`; confirm the CSS chunk after a build.
- Other data gaps: signed-out visitors cannot RSVP or follow on arts-collective (no guest door; sign-in link instead); artworks are not loaded on the page; the offers search cannot be used for an org's page signed out (needs a public org scope in `packages/content`).

## 5. Rules

- The main checkout is live and shared; several sessions build from it. Keep every file type-clean at every save; new files first, wiring last; additive only. No builds, restarts, installs or commits without Justin. Read `CLAUDE.md`, `.claude/rules/00-working-style.md`, `.claude/rules/areas/css-ui.md` (surface rules: build on `packages/cms-ui/src/surface/`, no new dialog primitive; plain CSS on namespaced tokens; measure contrast).
- Existing sites must not change: the new page shows only with `offer:look.enabled` or `?look=preview` in a dev preview.
- Type check: `sg docker -c "docker run --rm --user 3003:3003 -v /mnt/pool1/home/guru/eac:/app:ro -w /app/<workspace> eac-dev node --max-old-space-size=6144 /app/node_modules/typescript/bin/tsc --noEmit --incremental false -p ."` for packages/cms-ui, apps/arts-collective, apps/sunjay, apps/ifac, apps/innergathering (arts-collective's tsconfig is not strict: write `r.ok === false`, not `!r.ok`, to narrow `ActionResult`).
- Stripe keys are live: never press Pay or create orders in a preview.

## 6. Preview and screenshots

Dev preview of arts-collective (read-only tree, own `.next` volume, no payment/mail/social secrets):
1. Env file from the live container: `docker inspect eac-arts-network --format '{{range .Config.Env}}{{println .}}{{end}}'`, drop `NODE_ENV PORT HOSTNAME PATH NODE_OPTIONS STRIPE_SECRET_KEY SENDGRID_API_KEY INSTAGRAM_APP_SECRET YOUTUBE_CLIENT_SECRET CONNECTIONS_KEY METIS_NEWS_TOKEN`, add `NODE_ENV=development DISABLE_REMINDER_SCHEDULER=1 DISABLE_CALENDAR_SYNC=1 DISABLE_NC_FORUM_SYNC=1 NODE_OPTIONS=--max-old-space-size=4096`; `chmod 600`.
2. `docker volume create ac-os-next && docker run --rm -v ac-os-next:/n alpine chown 3003:3003 /n`
3. `docker run -d --name ac-os-preview --user 3003:3003 --network guru-eac_eac-network -p 127.0.0.1:3123:3123 --env-file <env> -v /mnt/pool1/home/guru/eac:/app:ro -v ac-os-next:/app/apps/arts-collective/.next -v <a writable copy of apps/arts-collective/next-env.d.ts>:/app/apps/arts-collective/next-env.d.ts -w /app/apps/arts-collective eac-dev node node_modules/next/dist/bin/next dev --port 3123 --turbopack` (without the writable `next-env.d.ts` the server hangs on EROFS).
4. Request with a Host header: `curl -H "Host: ifac.arts-collective.com" "http://127.0.0.1:3123/?look=preview"` (fetch twice; the first compile can be stale).
5. Screenshots: headless Chrome on the same network, `docker run -d --rm --name os-shot --network guru-eac_eac-network zenika/alpine-chrome --no-sandbox --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222 --host-resolver-rules='MAP *.arts-collective.com <preview container IP>' about:blank`, then `docker run --rm --network guru-eac_eac-network -v <folder with shot.mjs and jobs.json>:/w -w /w node:24-alpine node shot.mjs <chrome IP> jobs.json`. `shot.mjs` (this folder) takes jobs `{ url, out, width, height, full, waitMs, click, probe }`; `click` matches a button's exact text (or `re:<regex>`), so a job can open a surface. Compare against screenshots of the packet's `.dc.html` files taken the same way (serve the packet folder with `npx http-server` or open by `file://` in the container).
6. Remove the containers, the volume and the env file when done. Justin works remotely: send screenshots, not URLs.

## 7. Open items

- Match the page and every built layer to the packet (section 4), at 1280 and 390, then the remaining layers.
- Guest RSVP and follow on arts-collective; artworks on the page; a public org scope for the offers search.
- Mounting checkout on arts-collective needs Justin's go and `redisRateLimiter`; the content library PM's conditions are in `docs/open/CONTENT_CORNERSTONE_2026-11-26/CONTRACT.md` §17.
- Before any arts-collective rebuild: back up `.next` and follow `docs/reference/ops.md`.
