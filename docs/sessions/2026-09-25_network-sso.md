# Handoff: network SSO on arrival, network sign-out, arrivals (2026-09-25)

Code for one sign-in across the network sites is written and type-checked.
Nothing is applied or deployed: this session had no Docker socket and no
database access. The next session needs Docker to apply migration 164,
rebuild six production-mode apps, restart two dev-mode apps, and verify through
the edge. Design notes: `docs/reference/identity-and-tenancy.md`, section
"Arrival check, network sign-out, arrivals (claude, 2026-09-25)".

## Problem reported (developer, 2026-09-25)

Signed in on IFAC (a Google account), following a link to market.arts-collective.com,
elkdonis-arts.org or amritcanada.ca asked for a login again. The developer wants
one sign-in for all sites, one sign-out, and on arrival: a note of where the
person is and came from, an offer to follow the org, and the org's manage page
showing who arrived from where and when.

## Causes found (code read, 2026-09-25)

1. A sign-in crossed sites only via links built on `/api/auth/handoff`, or when
   the destination's `/login` page asked the network host. Plain links, typed
   addresses and bookmarks arrived signed out.
2. Google sign-in never mirrored the session to arts-collective.com
   (`apps/ifac/src/components/login-form.tsx:38` returned straight to `/hub`),
   so the `/login` check on the destination found no session.
3. Many cross-site links were plain (e.g. `packages/cms-ui/src/compose/ArtPieceComposer.tsx:179`).
4. art-auction received `INTER_APP_JWT_SECRET`, `NEXT_PUBLIC_NETWORK_HOST`,
   `ADDITIONAL_REDIRECT_URLS` only in another session's uncommitted
   `docker-compose.yml` change (2026-09-24); whether its container was recreated
   is unknown.

## What changed (uncommitted)

Shared:
- `packages/auth-server/src/sso-state.ts` (new): `eac_sso` cookie format,
  `markSignedOutEverywhere` / `isSignedOutEverywhere` (Redis
  `sso:signed-out:<authUserId>`, 30-day TTL).
- `packages/auth-server/src/sso-proxy.ts` (new, export `@elkdonis/auth-server/sso-proxy`,
  second tsup entry, `package.json` exports): `ssoProxy(req)` for each app's `proxy.ts`.
- `packages/auth-server/src/handoff.ts`: `plain=1`, `via` claim,
  `createHandoffAcceptHandler({ orgId })`, accept reuses an existing same-user
  session, sets `eac_sso=m`, records arrivals (`recordArrival`), sets readable
  `eac_arrival`. Header TTL comment corrected to 60 s.
- `packages/auth-server/src/arrival.ts` (new): `loadArrivalNotice`,
  `createArrivalHandler({ orgId })` → `{ GET, POST }`.
- `packages/auth-server/src/api-routes.ts`: `handleLogout` now signs out with
  global scope plus the Redis mark; new `handleLogoutRedirect` (GET).
- `packages/auth-server/src/index.ts`: `getServerSession` refuses tokens issued
  before a network sign-out; exports.
- `packages/auth-server/dist/` rebuilt on the host with tsup (2026-09-25 19:43).
  Previous dist backed up in this session's scratchpad (not durable).
- `packages/services/src/network-arrivals.ts` (new) `listOrgArrivals`; one export
  block added to `packages/services/src/index.ts`.
- `packages/cms-ui/src/network/` (new, export `@elkdonis/cms-ui/network`):
  `ArrivalNotice` (client, self-loading), `ArrivalsTable`.
- `packages/db/migrations/164_network_arrivals.sql` (new, not applied).

Apps:
- ifac, innergathering, amrit-canada: new `src/proxy.ts`; accept route →
  `createHandoffAcceptHandler`; new `src/app/api/network/arrival/route.ts`;
  `ArrivalNotice` in `src/app/layout.tsx`; `ArrivalsTable` on `manage/people/page.tsx`.
- art-auction: same, merged into the existing `src/proxy.ts`; org is
  `siteConfig.marketplaceOrgId` (`market`); table on `admin/users/page.tsx`.
- ifac: `api/auth/logout/route.ts` gains GET (the hub drawer's plain link got 405).
- sunjay, fourthwayBookreaders: `src/proxy.ts` + org-bound accept only.
- forum: `src/proxy.ts` only.

Not wired: danamccool (own `middleware.ts`, no accept route), hidden-enneagram and
artdirect (no `NEXT_PUBLIC_NETWORK_HOST`; the proxy is a no-op without it).

## Verified

- `tsc --noEmit` clean for auth-server, ifac, art-auction, fourthwayBookreaders,
  forum. amrit-canada, innergathering and sunjay each show one error at
  `src/lib/cms/actions.ts:343` (`RemoveResult.error`), in a file this change
  does not touch.
- `ssoProxy` run against 14 simulated requests (signed out, just checked,
  arriving from another site, the return trip, signed in unmirrored/mirrored,
  chunked cookie, RSC, API, `/login`, crawler, prefetch, image, network host):
  expected redirect or pass in each.
- `/api/auth/handoff/accept` answers on market, ifacgroup.com, elkdonis-arts.org,
  amritcanada.ca and arts-collective.com through the edge (old code).

Not verified: anything with a real session, the Redis sign-out path, the
arrival insert, the notice UI, the people-page tables.

Observed 2026-09-25 ~19:45: nothing listens on ports 3003 (forum) and 3013
(artdirect); both edge hosts give 502. artdirect was not touched, so it is
assumed both containers were down already. Check `docker compose ps`.

## Deploy (second session, 2026-09-25 ~19:55–20:50)

Done:
- auth-server dist rebuilt in the `admin` container.
- Migration 164 applied through the container runner; `\d network_arrivals`
  shows 8 columns, 2 indexes, 3 foreign keys.
- art-auction already had the three SSO variables; not recreated.
- innergathering and amrit-canada had no `REDIS_URL`, so the network sign-out
  mark could be neither written nor read there. Added
  `REDIS_URL: redis://redis:6379` to both services in `docker-compose.yml`
  (uncommitted) and recreated them.
- `.next` backups: `~/eac-backups/next/<app>-20260925-1959.tgz` (all six pass `gzip -t`).
- Rebuilt and restarted, BUILD_IDs: arts-collective `nP4H48Ud…`, ifac `H7wco81t…`,
  art-auction `5KJQeiur…`, innergathering `R3wUhD4z…`, amrit-canada `d5V1H2C7…`,
  sunjay `XMeRmlvT…`. Logs in `~/eac-backups/build-<app>-20260925.log`.
- innergathering's first build failed on `src/lib/cms/actions.ts:343`
  (`res.error` on `RemoveResult`: `!res.ok` does not narrow under these apps'
  compiler settings). Line changed in innergathering, amrit-canada and sunjay to
  `error: "error" in res ? res.error : "Could not remove."` (uncommitted); `tsc
  --noEmit` clean for all three; then built.

Verified through the edge (curl, browser UA, `sec-fetch-dest: document`):
- Signed-out `/` on market, ifacgroup.com, elkdonis-arts.org, amritcanada.ca,
  paratheater: 307 to `https://arts-collective.com/api/auth/handoff?to=…&next=%2F`,
  sets `eac_sso=a.<epoch>`. arts-collective.com: 200, no redirect.
- The handoff hop while signed out: 307 back to the target.
- With `eac_sso=a.<now>`: 200 and the site's own `<title>`. Googlebot UA: 200.
- `/api/network/arrival`: 200 on market, ifac, innergathering, amrit-canada;
  404 on sunjay and arts-collective (not wired, as intended).
- No `[handoff]`, `[sso]` or unhandled errors in the six apps' logs (15 min).

Not done:
- `docker compose restart fourthway-bookreaders` and `docker compose up -d forum`:
  refused by the session's permission check; left to the developer.
- Signed-in browser test (step 7 below) and the Redis sign-out path.

## Next steps (need Docker)

Follow `docs/reference/ops.md` "Build and deploy a production-mode app".
The builds deploy every session's uncommitted work: ifac, art-auction and shared
packages have many modified files from other sessions (see `git status`).

1. Rebuild the auth-server dist in a container, so it is not the host-built copy:
   `docker compose exec -T admin sh -c 'cd /app/packages/auth-server && pnpm build'`.
2. Apply the migration and check it:
   `docker compose exec admin pnpm --filter @elkdonis/db db:migrate`, then
   `db:migrate:status`, then `\d network_arrivals`.
3. `docker compose up -d art-auction` (picks up the 2026-09-24 env change);
   confirm `INTER_APP_JWT_SECRET` is set inside it.
4. Back up `.next`, build, restart, in this order (network host first):
   arts-collective (`NODE_OPTIONS=--max-old-space-size=3584 NEXT_BUILD_CPUS=2`),
   ifac, art-auction, innergathering, amrit-canada, sunjay.
5. `docker compose restart fourthway-bookreaders forum` (dev mode; the new
   `proxy.ts` was not picked up: `/books` returned 200 without a redirect).
6. Verify through the edge (`curl -k --resolve <host>:30022:127.0.0.1 ...` with
   `-H 'sec-fetch-dest: document'` and a browser UA): a signed-out request to
   market should 307 to `https://arts-collective.com/api/auth/handoff?to=...`
   and set `eac_sso=a.<epoch>`; a second request with that cookie should 200.
7. Browser test with a test account (not the developer's): sign in on IFAC with
   Google → open market via a plain link → should be signed in, notice shows
   "arriving from ifacgroup.com" with Follow → Follow adds a `viewer` row →
   market `/admin/users` lists the arrival. Sign out on market → IFAC shows
   signed out on the next load. Watch `docker compose logs` for `[handoff] refused`.
8. If anything fails in production, restore the `.next` backup per ops.md; the
   code change itself is backward-compatible with un-rebuilt apps.

## Open

- Decide whether IFAC should keep auto-enrolling signers-in as viewers
  (`joinOrgsOnSignIn`, other session's uncommitted work) now that arrivals
  offer Follow instead.
- Wire danamccool, hidden-enneagram, artdirect.
- Update the "Current work" section of `CLAUDE.md` once deployed.
