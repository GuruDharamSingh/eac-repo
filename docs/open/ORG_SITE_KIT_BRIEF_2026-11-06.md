# Org site kit: shared routes for the template sites (brief, 2026-11-06)

This brief covers `@elkdonis/org-site`, a package that serves the routes that amrit-canada, sunjay, elktours and
katie-the-potter carry as copies: `/manage`, `/hub`, `/center`, `/login`, `/account`, the shared `/api` routes, and
(later) the Puck pages. Each app mounts the package through a few catch-all routes that look the request up in a table
(option B, chosen by the developer 2026-11-06). sunjay moves first; katie-the-potter stays out of the kit for now
(developer, 2026-11-07). The app keeps its `site.ts`, its own blocks and its domain pages. The
brief ends in a timeline of phases, one app rebuild each. Nothing is built yet.

## 1. Current state (2026-11-06, verified by reading the tree)

| | amrit-canada | sunjay | elktours | katie-the-potter |
|---|---|---|---|---|
| Source files / lines (`src/**/*.{ts,tsx,css}`) | 150 / 14,394 | 224 / 20,756 | 302 / 33,281 | 117 / 10,970 |
| Route files (`page.tsx` + `route.ts`) | 83 | 105 | 111 | 39 |
| Run mode (`docs/reference/ops.md`) | prod | prod | prod (since 11-03) | new; not in ops.md |
| Uncommitted paths (`git status --short apps/<app>`) | 9 | 63 | 116 | whole app untracked |
| Puck | none | Studio pages, code home + `puck:landing` | `puck:landing`, Studio templates, builder | whole site: `[[...path]]`, `/studio/[...path]`, Site style |

- 82 files (5,177 lines) are byte-identical in amrit-canada, sunjay and elktours; 132 paths exist in all three. Method:
  md5 of every source file per app, compared by path.
- The identical set is mostly `app/api/pipeline/*` (16), `app/api/hub/*` (7), `app/api/center/*` (5),
  `app/api/chat/*` (3), `app/api/threads/*` (3), `components/manage/*` (6), `lib/cms/*` (4), `lib/auth.ts`,
  `lib/pipeline.ts`, and the pages `/hub/{calendar,chat,pipeline,whiteboard}`, `/login`, `/forum/[[...segments]]`,
  `/manage/{pages,compose,analytics}`.
- Files that differ only by a constant: `lib/pipeline-api.ts` and `lib/chat-api.ts` (`logLabel`), `lib/gather.ts` (the org
  id written as a literal in amrit-canada and elktours, `siteConfig.orgId` in sunjay).
- Routes present in all three that have drifted (needs a comparison before one version becomes canonical):
  `account`, `center`, `hub`, `manage`, `manage/layout.tsx`, `manage/people`, `manage/feeds`, `manage/content/[id]`,
  `api/auth/{callback,login,signup,handoff/accept}`, `api/inquiry`, `api/media/[...path]`, `api/pulse`, `api/rsvp`,
  `api/threads/[id]/{rsvp,trigger-email}`.
- katie-the-potter shares only `api/auth/{logout,session,handoff}` byte for byte. It has no pipeline, chat, forum or hub
  API, and its `/manage` is pieces, orders, payouts and site. Its files were changed until 21:34 on 2026-11-06
  (another session).
- Existing shared route factories: `centerRoutes()` (`packages/services/src/center-routes.ts:13`), the series factories in
  `@elkdonis/series-site/routes` (`rsvpRoutes`, `subscribeRoutes`, `hubSeriesRoutes`…). Each app mounts them through a
  hand-copied 3–10 line file per route.
- Cost of the copies, observed: the 2026-11-06 fix for `/manage` pages that streamed data to signed-out visitors changed
  80 pages on eight sites, none of it live until each app is rebuilt (`docs/open/HOUSEKEEPING_2026-10-18.md`).
- `manage/layout.tsx` gates every `/manage` route, but Next renders a layout and its page in parallel, so the layout's
  gate alone does not stop the page's data (same note).

## 2. Design

### 2.1 What an app holds after the move

```
apps/<site>/src/
  site.ts                          defineSite({...}): the one object every kit route receives
  app/layout.tsx                   the site's own shell (header, footer, fonts)
  app/api/[...kit]/route.ts        export const { GET, POST, PUT, PATCH, DELETE } = apiHandlers(site)
  app/manage/page.tsx              index; renders the kit's manage index
  app/manage/layout.tsx            kit layout (gate + tabs from the table)
  app/manage/[...kit]/page.tsx     <KitPage site={site} area="manage" {...props} /> + generateMetadata
  app/hub/page.tsx, app/hub/[...kit]/page.tsx       same shape
  app/center/page.tsx, app/login/page.tsx, app/account/page.tsx   one line each
  app/<domain>/...                 pages only this site has (tours, pieces, sadhana); real files
```

```ts
// site.ts (shape, not final)
export const site = defineSite({
  orgId: "amrit_canada",
  names: { org: "Amrit Canada", short: "Amrit" },
  timeZone: "America/Toronto",
  features: { pipeline: true, chat: true, forum: true, series: false, puck: false, shop: false },
  manageTabs: [],              // extra tabs for the site's own /manage pages
  fallbackNotifyEmail: process.env.AMRIT_CANADA_OWNER_EMAIL,
});
```

The constants that make today's copies differ (`logLabel`, the org id literal in `gather.ts`, `siteConfig.orgName`) come
from `site`.

### 2.2 The table

One entry per URL under a kit area:

```ts
{ area: "api", path: "pipeline/cards/:cardId/comments/:commentId", methods: ["PATCH", "DELETE"],
  gate: "member", feature: "pipeline", load: () => import("./api/pipeline/comment") }
{ area: "manage", path: "people", gate: "editor", tab: { label: "People", order: 40 },
  load: () => import("./manage/people"), metadata: { title: "People" } }
```

- `gate` is one of `public | signed-in | member | editor | owner`. The dispatcher checks it before `load()` runs, so a page
  or handler never starts without it. The layout's gate stays as a second check.
- `feature` hides an entry unless `site.features[feature]` is on; a site without `pipeline` answers 404 on those paths.
- `load()` is a dynamic import, so each entry stays its own server chunk.
- `path` uses `:param` segments; the dispatcher passes params as a plain object.

### 2.3 Override and gradual migration

Next serves a static route before a dynamic one and a dynamic one before a catch-all (`next/dist/shared/lib/router/utils/
sorted-routes.js`, Next 16.1.6, verified by reading). So:

- A copied file that is still present wins over the catch-all. Deleting it hands that URL to the kit. Each copy can be
  deleted on its own, group by group.
- A site overrides a kit route by keeping or adding a real file at that path.
- `scripts/kit-coverage.ts <app>` lists, for one app: every URL the app served before the move (from the route list taken
  in phase 0), whether a real file or a kit entry now serves it, and any URL served by neither. A rebuild goes ahead only
  with zero unserved URLs.

### 2.4 Rules

- Use a required catch-all (`[...kit]`) next to a real `page.tsx`, not an optional one: Next 16.1.6 throws "You cannot
  define a route with the same specificity as a optional catch-all route" for `manage/page.tsx` beside `manage/[[...kit]]`.
- Take the org from the `site` argument, never from an import: a module that imports one app's config can serve only that
  app (the reasoning in `packages/page-builder/src/store.ts`).
- Kit API handlers take a `Request` and return a `Response`: that keeps them independent of Next and runnable elsewhere.
- Call `redirect` and `notFound` only through `packages/org-site/src/nav.ts`: one module to change if the rendering layer
  changes.
- Keep the kit in its own package, not in `@elkdonis/services`: services exports source, and one broken file there fails
  every app's type check.
- A table path is a public URL: do not rename one without a redirect entry.
- Move one version of a drifted route (§1) only after comparing all three; record which app's version became canonical
  and what the others lose, in the phase's notes below.

## 3. Timeline

Dates are targets assuming one working session per phase. Each phase ends in one rebuild of the named app, following
`docs/reference/ops.md` (back up `.next`, read `git status` and recent mtimes first). A rebuild deploys every session's
uncommitted work in that app: sunjay has 71 uncommitted paths (some changed 2026-11-07 00:40–00:42) and elktours 116,
so their phases start by asking which of that work may go live. sunjay also carries the canvas experiment (CLAUDE.md
"Canvas framework"); its go-live script `packages/direct-edit/harness/sunjay-go-live.sh` compares 80 signed-out pages and
is rerun after each sunjay rebuild in this plan.

| Phase | Target | App rebuilt | Scope | Done when |
|---|---|---|---|---|
| 0 | 11-09 – 11-10 | none | `packages/org-site`: `defineSite`, viewer and gates from `site` (today's `lib/auth.ts`), matcher, `apiHandlers`, `KitPage`, `nav.ts`, `kit-coverage.ts`; route lists of sunjay, amrit-canada and elktours saved as the coverage baseline | check-types 0 in the package; unit check of the matcher on every path in the baseline |
| 1 | 11-11 – 11-13 | sunjay | API: `pipeline` (16), `chat` (3), `hub` (7), `center` (6), `forum`, `threads/[id]/{cycle,reminder,email-settings,gather}`, `upload`, `media/library`. Delete the copies and `lib/{pipeline,pipeline-api,chat-api}.ts` | coverage 0 unserved; each moved endpoint answers signed out as before (status and body, through the edge); hub board, chat and calendar used signed in |
| 2 | 11-16 – 11-18 | amrit-canada, then elktours; sunjay again | Same API groups on amrit-canada and elktours. sunjay's series routes become table entries behind `features.series`, built from the `@elkdonis/series-site` factories | as phase 1, per app |
| 3 | 11-19 – 11-24 | sunjay, then amrit-canada and elktours | Pages: `/hub/{calendar,chat,pipeline,whiteboard}`, `/center`, `/forum`; `/hub` index after comparing the three versions | signed-out HTML of each moved URL compared before/after; signed-in render of each page |
| 4 | 11-25 – 12-02 | sunjay, then amrit-canada and elktours | `/manage`: index, `people`, `analytics`, `pages`, `feeds`, `content/{new,[id],[id]/attendees}`, `compose`; kit layout with tabs from the table plus `site.manageTabs`; elktours keeps its tours, places, experiences and bookings pages as files | signed-out request to every `/manage` URL redirects without page data in the response; editor and owner renders checked |
| 5 | 12-03 – 12-04 | sunjay, amrit-canada, elktours | `/login`, `/account`, `api/auth/*` | sign-in, sign-out and network SSO arrival through the edge on each app |
| 6 | 12-07 – 12-18 | sunjay, then elktours | Puck, starting from sunjay's wiring: page store and actions, editor mount, `puck:landing` home editor, Studio pages, public renderer; Site style from elktours. Root routing must serve both `[feed]` and Puck pages: `[feed]` takes every single-segment URL before a root catch-all, so one root dispatcher decides feed or page | a page saved in the Studio renders at its URL on both apps; home page edit and Site style save checked signed in |
| 7 | 12-21 – 12-23 | new app | `scripts/new-org-site.sh <org> <port>`: app skeleton with `site.ts`, the catch-alls, layout, compose service, proxy host | a new site from nothing serves sign-in, `/manage`, `/hub`, `/center` and one Puck page |
| later | 2027-01 | — | Review option C (one app, site resolved from the Host header). The `site` object is already the only input, so the kit itself would not change; the open part is domain features and per-site layouts | written review, no code |

Measured at the end of each phase: route files and source lines per app, against §1.

## 4. Open items

- Home page model: with sunjay first, the kit starts from sunjay's (a home page in code, edited through `puck:landing`)
  (assumed default, 2026-11-07). katie-the-potter's model (a Puck document `home` with a code fallback) is left for when
  that app joins.
- katie-the-potter: out of the kit for now (developer, 2026-11-07). When it joins: its `/manage` (pieces, orders, payouts,
  site) as kit entries behind `features.shop` or as real files, and its `[[...path]]` Puck routing against phase 6.
- Which version of each drifted route becomes canonical (§1 list); decided per phase.
- The 80-page gate fix (2026-11-06) is in source and not rebuilt. Phases 1–4 rebuild amrit-canada, sunjay and elktours,
  which puts it live on those three.
  - Correction 2026-11-06 22:20 EST (editor-house session): elktours was rebuilt at 21:20 and 21:59 EST with the page-level gate in its `/manage` pages. Verified through the edge: signed-out `/manage/feeds`, `/manage/people` and `/manage/bookings` answer 307 with only the redirect shell, and no names or addresses in the body. amrit-canada and sunjay not checked.
