# @elkdonis/analytics

First-party, cookieless visit analytics for the network. Written 2026-10-01.
Source-exported (no build step). Tables: migration 180 (`analytics_events`,
`user_site_visits`).

## How it works
1. `<AnalyticsBeacon />` (`./beacon`, client) in a site's root layout posts a page view for
   every route and, on leave, the visible time. It sends nothing for Do Not Track / Global
   Privacy Control and sets no cookie or storage.
2. `createCollectHandler()` (`./route`) mounted at `src/app/api/pulse/route.ts` receives it,
   drops bots, other origins and ignored paths (`/manage`, `/login`, `/hub/admin`, `/studio`…),
   and writes one row. Always answers 204.
3. `getDashboardData()` (`./server`) reads it, scoped to one org or the network;
   `<AnalyticsDashboard />` (`./dashboard` + `./dashboard.css`) renders it (Recharts).
   Host pages authorise the viewer with `getAnalyticsAccess()` / `chooseScope()`.

## Adding it to a site
- `package.json`: `"@elkdonis/analytics": "workspace:*"`, then `docker compose run --rm install`.
- `src/app/api/pulse/route.ts`: `export const POST = createCollectHandler({ defaultOrgId: "<org id>" })`.
  `defaultOrgId` is used for hosts with no `org_domains` row and no org subdomain.
- Root layout: `<AnalyticsBeacon />` (basePath apps: `endpoint="/<basePath>/api/pulse"`).
- Post pages: `threadId={thread.id}` on `ArticleView`, or `<AnalyticsThread id=… />`
  (`./thread`), so the view is credited to the post.
- A dashboard page: see `apps/amrit-canada/src/app/manage/analytics/page.tsx` (owner of one
  org) and `apps/arts-collective/src/app/hub/analytics/page.tsx` (admin + owners).
- Named actions: `trackEvent("rsvp", { seats: 2 })` from `./beacon` for client-only actions; from a server action use `trackServerEvent(name, props, options)` (`./events`) after the outcome is known, so the event joins the visitor's session. Share one `CollectOptions` object between the route and the actions (art-auction: `src/lib/analytics.ts`).
- Progression: `getFunnel()` (ordered steps over sessions, each a path regex or event name), `getJourneys()` (common page sequences) and `getProgression()` in `./server`; render with `./journey` (`ProgressionPanel`, `FunnelCard`). Example: `apps/art-auction/src/app/admin/visitors/page.tsx`.
- Author insights: `getAuthorInsights()` (`./server`) and `AuthorInsightsView` (`./insights`); mounted at `/insights` in `@elkdonis/forum-ui` for the signed-in author only.
- The collector needs `INTER_APP_JWT_SECRET` (or `ANALYTICS_SECRET`) in the app's
  environment; without it nothing is recorded.

## Rules and constraints
- Visitor id = HMAC(day, ip, user agent, host) under a key derived daily from the server
  secret. The IP is never stored; ids cannot be joined across days or sites. "Visitors" is
  therefore unique-per-day summed over the range. Returning visitors are known only when
  signed in (`user_id`, `user_site_visits`).
- Rows for non-public threads, and for orgs in `ANALYTICS_PRIVATE_ORGS` (default
  `inner_group`) with no public thread, keep org, time, device and country but no path,
  thread, referrer or UTM: counted in totals, never named.
- `org_id` is the org that owns the page (the thread's org for a post, else the host's org);
  `host` is where it was read.
- Viewers: network admins (`users.is_admin`) see the network and any org; org owners see the
  orgs they own; guides, members and followers see nothing (`src/access.ts`).
- `user_id` comes from `getServerSession()`, which does not verify the token (open item in
  CLAUDE.md): a forged cookie could attribute visits to another user's last-seen and visit
  counts.
- Geography needs `var/geoip/GeoLite2-City.mmdb` (`scripts/update-geoip.sh`, MaxMind account
  required) or `GEOIP_DB_PATH`. Without it rows have no country/region.

## Verification
`DATABASE_URL=<scratch db> pnpm --filter @elkdonis/analytics check:collector` drives the
collector, queries and access rules; it refuses a database whose name lacks "scratch".
2026-10-01: 12 checks passed against a schema copy; beacon exercised in headless Chrome
against a dev preview of amrit-canada on that copy; dashboard rendered at 1280 and 390 px
from the real query output.

## Open items
- 2026-10-02: migration 180 applied (by another session's `db:migrate`, checksums verified); amrit-canada and arts-collective rebuilt and restarted. `POST /api/pulse` verified through the edge on both (rows written, probe rows deleted); `/manage/analytics` and `/hub/analytics` redirect when signed out. Not verified: the signed-in dashboard pages in production, and the beacon in a browser against production.
- GeoLite2 download untried; raw rows are never pruned (consider 400-day retention).
- 2026-10-03, source only (not built or deployed): beacon and collector added to sunjay, ifac, art-auction, hidden-enneagram, artdirect, innergathering, danamccool, fourthwayBookreaders and forum; author insights page in forum-ui; art-auction events (`add_to_cart`, `remove_from_cart`, `favourite_added/removed`, `order_placed`, `pay_card_started`, `pay_etransfer_chosen`, `bid_placed/rejected`, `artist_messaged`) and `/admin/visitors`.
- Visits are anonymous and daily-hashed, so a buyer's browsing cannot be tied to their order; orders are summarised separately from `commerce_order`. Linking them would need a per-person id (a decision, not built).
