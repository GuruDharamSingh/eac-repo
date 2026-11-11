# Network serving architecture: where the central services live (2026-11-08)

Integration architect, PM board lane "Integration architect" (`docs/open/PM_BOARD_2026-11-08.md`).
This doc covers how Channel, dock/MCP/LMS, Studio, `@elkdonis/content` and the hub cards are served across
the network apps today, and what they should become. It ends with the checklist used to negotiate
each incoming Claude Design handoff. Read-only work: no code, builds or migrations were touched. The facts
come from a code sweep (2026-11-08, branch `work/2026-11-08`), read-only queries on `elkdonis_dev`,
and the docs cited inline. It builds on the claude.ai Doc "Arts Collective: One App Reform Review"
(2026-11-01, https://claude.ai/artifact/X4UzFg2UffJTnbpDCko1DU), referred to below as **Reform**, and
on `ORG_SITE_KIT_BRIEF_2026-11-06.md`, referred to as **Kit**.

## 0. The answer in one paragraph

There are already **two serving planes**, and the design should name them instead of fighting them.
The **network plane** is `arts-collective` (container `eac-arts-network`, :3007). It is the SSO broker,
and it hosts Channel, the Studio, `/learn`, the action registry and the dock. It is also the
multi-tenant **shell**: `middleware.ts` rewrites `<slug>.arts-collective.com` and `org_domains` hosts to
`/sites/<slug>/…`. The shell already serves about 14 of the 24 orgs, with no app of their own. The
**site plane** is the per-org apps. Recommended target:
1. Deep, cross-org consoles (**Channel, full Studio, LMS learner and authoring, MCP**) are served **once**, from the network plane. Sites link into them through the SSO handoff, with `?org=`.
2. Everything an org touches **on its own site** is a **shared package rendered in-host** and mounted through the **org-site kit**: hub cards, content detail and library, inline compose forms, the dock, and the registry's same-origin API. The shell is simply the kit's host-resolved mount.
3. **The registry is the only write path.** No card, form or panel calls app-local `lib/cms/*-actions.ts` for a shared kind.

As the clone family folds into the shell (Reform decision 7), "in-host" and "network" become the same
process for most orgs. The custom apps keep consuming the same packages through one contract (§5).

---

## 1. Today's serving map

### 1.1 Per service
| Service | Code home | Mounted (routes) | Serving mode today |
|---|---|---|---|
| **Channel** | app-local: `apps/arts-collective/src/{app,components,lib}/channel/` (load.ts 885 lines); shared: `@elkdonis/services/channel`, `channel-plan-md`, `packages/actions/src/channel.ts` | arts-collective `/channel`, `/channel/{queue,new,outlets,routines,piece/[kind]/[id]}`; old `packages/studio/src/channel` (superseded) at `/studio/channel` | **Central.** katie-the-potter and hidden-enneagram `app/channel/page.tsx` redirect through `handoffUrl` to `<network>/channel?org=<org>`. No other app links to it. |
| **Action registry** | `packages/actions` (`catalogue.ts`, `server/{run,routes,dock,status,schema}.ts`) | arts-collective `api/actions`, `api/actions/[id]`, `api/actions/dock`; `lib/actions/run.ts` (`runAction`) | **Central, same-origin only.** No CORS (`Access-Control-*` absent). Sophia imports the catalogue only. |
| **Dock** | `packages/dock` (UI); data from `packages/actions/src/server/dock.ts` | `<Dock>` in arts-collective `app/layout.tsx:55` only | **Central only.** Cookies are host-only, so no org site gets a dock (LMS brief §5g). |
| **MCP / assistant** | none (design in LMS brief §7.2 and Routines plan §2.4); delegated tokens in `apps/admin/src/lib/oidc.ts:259` | no `/api/mcp` anywhere | **Not built.** |
| **LMS** | `packages/lms`, `packages/lms-ui` | learner side: arts-collective `/learn/[[...segments]]`, `api/lms/[action]`; authoring: Sophia `/studio/{guides,workshops,[course]/pool}`, `/courses` | **Central, split across two apps.** Sophia runs in dev mode with no proxy host (`docs/reference/ops.md`); its task steps link out to `arts-collective.com/learn`. |
| **Studio** (creation CMS) | `packages/studio` (StudioShell, extensions), `packages/studio-ui` | arts-collective `/studio`, `/studio/{video,broadcast}`, `api/studio/*`; **hidden-enneagram `/publish`** mounts `StudioShell` with its own writing actions (`components/publish/publish-app.tsx`) | **Central, plus one embedded copy.** Elsewhere "studio" is the Puck editor (sunjay, katie, danamccool, innergathering, elktours), the seller back office (art-auction) or astro tooling (elastrocal). Per-app compose: `manage/compose` in amrit, sunjay, elktours, innergathering; `hub/compose` in ifac and innergathering. |
| **`@elkdonis/content`** | being built (pass 1: lift `PieceSurface`) | Channel piece pop-up, at first | **Shared package.** Its `ContentHost` still has per-app URL facts (`OWN_APP_SITES`, `load.ts:89`). |
| **Hub** (faces) | `packages/cms-ui/src/hub/*` (faces), `cms-ui/hubsite`, `cms-ui/surface`; `hubCards(caps)` in `hub/cards.ts:20` takes availability **from the host** | per-app `/hub/*` pages in amrit, sunjay, elktours, HE, innergathering, ifac, katie (index), fourthway, danamccool. Network: arts-collective `/hub/(tabs)/{organization,network,arts-collective}`, `/hub/sites/[slug]/{design,cards,classifieds}` | **Shared package, per-app pages.** `hub/calendar/page.tsx` is byte-identical in 4 apps. |
| **/manage** | `cms-ui/manage` = primitives only | hand-rolled in amrit, sunjay, elktours, innergathering, ifac, fourthway, pigeonshoot; cms-ui-based in katie and HE; none in arts-collective or danamccool | **App-local copies** (§3). |
| **Center** | `cms-ui/center`; `centerRoutes()` (`services/src/center-routes.ts:13`, connections only) | `/center` in 8 apps is a handoff to the network host; arts-collective `/sites/[slug]/center` | **Central**, reached by handoff. |

### 1.2 Identity, SSO, org→domain
- **One GoTrue and one `users` table, with host-only cookies.** `deriveCookieDomain` (`packages/auth-server/src/index.ts:19`) sets a Domain only when `EAC_COOKIE_DOMAIN` is set, and it is set nowhere. Every host holds its own session. `getServerSession` now verifies the token (`index.ts:274-284`, `verify-session.ts`). That closes the Reform "session security" item.
- **Handoff.** arts-collective is the broker (`packages/auth-server/src/handoff.ts`). `/api/auth/handoff?to=&next=` signs a 60-second HS256 token; `/handoff/accept` mints a session on the destination host and records `network_arrivals` (`createHandoffAcceptHandler({orgId})`). `ssoProxy` (`sso-proxy.ts`) runs once per visit from each app's `src/proxy.ts`: amrit, art-auction, artdirect, elktours, forum, fourthway, ifac, innergathering, katie, sunjay. **hidden-enneagram has no `proxy.ts`**, so it gets no arrival check or mirror even though its `/channel` hands off.
- **Host → org.** Per-app apps fix the org at build time (`config/site.ts` `siteConfig.orgId`; Reform counted 1,214 call sites). Only arts-collective resolves the host: subdomain, or `org_domains` via `/api/domains` with a 60 s cache. `/sites/<other>` typed on an org host returns 404. `PASSTHROUGH_PATHS` (`middleware.ts:22-40`) still renders `hub`, `sites`, `directory`, `learn` and others on tenant hosts.
- **`org_domains`** (mig. 081) has 12 rows: amritcanada.ca, hiddenenneagram.com, ifacgroup.com, elkdonis-arts.org (+www, meetings.) → `inner_group`, danamccool.com, paratheater.arts-collective.com → sunjay. There are no rows for katie, elktours, fourthway, art-auction or elastrocal. **`OWN_APP_SITES`** (`apps/arts-collective/src/lib/channel/load.ts:89`) has one entry, katie → `pottery.arts-collective.com` plus her `/manage/*` paths. That is the only record anywhere of "this org has its own app, and its back office is at X".
- `organizations`: 24 rows. Tier is display-only (free 18, supported 2, partner 3+1 test). No `org_capabilities` or features table exists. `pg_policies` now counts 33 (Reform found 0).
- Edge: Nginx Proxy Manager (ops.md "Edge"); a wildcard `*.arts-collective.com` → 3007 (Reform). Which container `paratheater.arts-collective.com` reaches is unverified: sunjay :3001, or the shell.

## 2. The two site classes

| Class | Apps / orgs | Evidence | Target |
|---|---|---|---|
| **Shell orgs** (already single-app) | tara, justing, BuddhasEngines, bonpo, astromonarch, oad, saw, stonebalancing, surrealistwriting, guru-dharam, elkdonis, market… | served by `/sites/[slug]/*` (9 page files) plus the `hub/sites/[slug]/design` console | stay; they get the hub cards natively |
| **Clone family** (fold into the shell) | amrit-canada, sunjay, danamccool, hidden-enneagram, **katie-the-potter** | the same `[feed] about account center forum hub login manage` shape; `lib/auth.ts` byte-identical in amrit, elktours, HE, innergathering, sunjay; Kit §1: 82 files byte-identical across amrit, sunjay, elktours. katie is the smallest (3.3k app lines) but has a whole-site Puck route `[[...path]]` and a shop | Reform order: amrit → sunjay → danamccool → HE; katie after Kit phase 6 (Puck) |
| **Template + vertical** | elktours (tours/places/experiences, 25k non-route lines), innergathering (Nextcloud OIDC provider, meetings/workshops, 31 unique routes) | the vertical is real product code | **custom on the kit** for now; fold elktours only once tours is a package; innergathering stays (it is an IdP) |
| **Products** | ifac (series, email, manage reference), art-auction (auction, Stripe webhooks), fourthwayBookreaders (Akhand Path, `/books` basePath), elastrocal (astro API), pigeonshoot, artdirect (classifieds), forum, Sophia (LMS authoring) | own tables, own route trees; 147k of 177k app lines are unique to one app (Reform) | **custom forever**; consume the contract (§5) |

What actually differs between a clone and the shell is small and listable:
1. the org id baked in at compile time;
2. the header, footer, fonts and CSS;
3. the site's own blocks (Puck catalogue);
4. the home-page model (code + `puck:landing`, or a whole-site Puck document);
5. domain pages (amrit's sadhana and writer redirect `page.tsx:34-43`; HE's readings, music and ÆON);
6. process-scoped secrets: one `STRIPE_SECRET_KEY` and the email identity per container.

Items 1, 2 and 6 become data: `site` from the DB, theme, and org-scoped Stripe Connect and email rows (Reform decision 8). Items 3 and 5 become a block or vertical package plus a capability flag. Item 4 is Kit phase 6.

## 3. Costs today

| Cost | Evidence |
|---|---|
| **N builds per shared change** | Packages export source (`cms-ui` `exports: ./src/*.ts`), so every app recompiles them. arts-collective has 32 `@elkdonis/*` deps and 26 `transpilePackages`; its build needs `--max-old-space-size=3584` (`docker-compose.yml:777`) **and** a temporary `docker update --memory 9g` (ops.md; handover 2026-11-07 §4: one OOM build). Every production app container is capped at 5g (`docker-compose.yml`), one container per app. A shared fix is not live until each app is rebuilt: the 2026-11-06 `/manage` gate fix touched 80 pages on 8 sites (Kit §1). |
| **Duplicated code** | `components/manage/content-row-actions.tsx` ×5 (amrit = elktours 222 lines; sunjay and innergathering 202 lines, different; HE a 91-line fork). `manage/people/page.tsx` ×6 (amrit = elktours; sunjay differs only by arrivals; ifac has its own `people-table.tsx` and `lib/manage.ts` duplicating `services/org-people.ts`). **Editors for `org_site_sections`**: `manage/pages` in amrit, elktours, innergathering, sunjay, pigeonshoot; `sections-editor.tsx` in ifac; `section-form.tsx` in fourthway; `manage/site` in katie and HE. `manage/compose` ×4 identical. `hub/calendar` ×4 identical. `lib/puck/store.ts` ×8 and `page-editor.tsx` ×5, all different. Email compose: ifac and innergathering near-forks. |
| **Duplicated auth helpers** | `ownerFor`/`mayTouch` in `apps/arts-collective/src/lib/channel/actions.ts` **and** `packages/actions/src/server/channel.ts` (must change together). Per-app `lib/cms/*-actions.ts` wrappers (ifac vs arts-collective `journey-actions.ts`: 89 diff lines). |
| **Drift risk** | Kit §1: drifted routes in all three clones (`account`, `center`, `hub`, `manage/*`, `api/auth/*`, `api/rsvp`…). Security drift: sunjay's `setMemberRoleAction` lets an owner grant owner, looser than the shared guard (PM board). HE lacks `ssoProxy`. |
| **Hidden coupling** | `OWN_APP_SITES` and Channel URL builders hard-code app topology; `HubCapabilities` is filled per app from code; `STUDIO_KINDS.ready` and `createCatalogue` are code-only. **Three capability seams, none from the DB** (Reform decision 5). |

## 4. Target: where each service is served from

### 4.1 Decision per service
| Service | Mode | Served from | Why | What a site does |
|---|---|---|---|---|
| **Channel** (console) | **(b) central** | `arts-collective.com/channel?org=` | cross-org by nature (artist under org, presented-by); 15-read loader; one build to tune; already shipped this way | link via `handoffUrl` (katie/HE pattern); the hub Content card's "Open in Channel" is a hop |
| **Channel pieces inside cards** | (c) | `@elkdonis/content/ui` in host + `./server` loader in host | the content detail must open over the site's own pages (pop-up/sheet) | render `ContentDetail` locally; plan writes via registry |
| **Action registry (execution)** | **(c) shared server package, run in every host** | `@elkdonis/actions/server` mounted by the kit at `/api/actions/*` on each host (same-origin, local session) | host-only cookies make a central API unusable from custom domains without CORS + tokens; the package is already host-agnostic (`routes.ts`, actor from session) | mount `actionRoutes()` via the kit; never write shared kinds any other way |
| **MCP endpoint** | **(b) central, single mount** | `arts-collective.com/api/mcp` (later), OAuth 2.1 with RFC 8693 delegated tokens | one door to audit (openclaw-bridge principle); tools generated from the same catalogue | nothing; org scope comes from the token + `org` argument |
| **Dock** | **(c)** | UI `@elkdonis/dock` in every root layout; data from the host's own `/api/actions/dock` | the dock must follow the person to org domains (LMS decision 4); the same-origin data route is the only way under host-only cookies | mount `<Dock>` beside the analytics beacon (kit layout helper) |
| **LMS learner** | **(b) central** | `arts-collective.com/learn` | courses are network-first; one progress store | task steps open in-place via surfaces; dock carries the step to sites |
| **LMS authoring** | (b), **fold into the Studio** (owner decision D-5) | today Sophia (no public host) | Sophia is 478 route lines of lms-ui wrappers; one creation CMS | n/a |
| **Studio (full / focus mode)** | **(b) central** | `arts-collective.com/studio?kind=&about=&delivery=&preset=&org=` (content doc §3 contract) | heavy (tiptap, video, broadcast); same build that already needs 9g; one place for presets and brand kit | the Publish card's kind tiles **hop** with `handoffUrl`; return via `next=` back to the site's `/content` |
| **Publication forms** (Prompt 4 family) | **(a) shared package** | `@elkdonis/studio/forms` (new subpath, no tiptap in the essentials variant) rendered in 3 hosts: Studio focus (full), site inline compose (essentials), hub (launch only) | inline compose must run on the site; one schema per kind | render inline variant; submit through registry entries per kind (`thread-create`, `series-create`, `artwork-create`…) |
| **`@elkdonis/content`** | **(c)** | `./ui` + `./server` in every host; passport also as a registry read entry (dock, MCP) | detail opens in hub pop-ups on every site; server-only loader avoids a cross-origin API | supply `ContentHost` **from the site record** (§4.3), not constants |
| **Hub cards** (Site Builder, Members, Publish/Content, Calendar, Email, Business, app cards) | **(a+c) one card package, rendered per host through the kit** | `@elkdonis/hub` (or `cms-ui/hub` grown): card definitions, faces, pop-ups, detail pages; detail routes `/hub/<card>` served by kit entries | see 4.2 | mount the kit's `/hub` and `/hub/[...kit]`; switch sections on with capabilities; add app-specific cards (elktours Tours) as local registry entries |
| **Center** | (b) central (as today) | network `/center` / shell `/sites/[slug]/center` | already converged | handoff link |

### 4.2 Hub cards: embedded per host, not a central hub domain (decisive)
**Recommendation: the hub is one shared package, and each host renders it as its own `/hub`.** The shell
serves it natively for shell orgs, and custom apps serve it through the kit. Cards whose deep work is
central (Channel, Studio, `/learn`) keep a local face and pop-up, and their "Open" is an SSO hop.

Why not a central `hub.arts-collective.com/<org>`:
1. Cookies are host-only, and custom domains can never share one (Reform cross-examination). Every pop-up over the site would need a hop or a cross-origin frame, and Safari and Firefox block third-party cookies in frames.
2. **Site Builder** edits pages with the site's own block catalogue (`lib/puck/*` per app; Kit: "the app keeps its own blocks"). The editor must run where the blocks are.
3. The "same card, different sections on" requirement (HUB_CARD_PROMPTS) is a **capability lookup**, not a hosting question. It works identically in-host.
4. It converges anyway. As the clone family folds, "per host" collapses to the shell, and the remaining per-host renders are the ~6 custom apps.

The cost we accept is that a card change ships on rebuilds. Mitigation: the kit makes every app a thin
mount; the card package is additive (new sections behind capabilities, connectors stable); and a
**release train** (one script, apps in order, backup + edge check) replaces ad-hoc rebuilds.

Card contract (proposal for Lane B):
```ts
defineHubCard({
  id: "members",                       // stable; also the /hub/<id> route
  capability: "members",               // org_capabilities key (null = always)
  gate: "guide",                       // public | signed-in | member | guide | owner
  sections: { visitors: { gate: "owner" }, storage: { gate: "owner", capability: "cloud" } },
  Face, Popup,                         // client; data via connectors only
  detail: () => import("./members/detail"), // server page, kit-served
  load: (site, viewer) => Promise<FaceData>, // server, takes site, never imports app config
  actions: ["org-person-role", "org-person-listed", "org-person-remove"], // registry ids it may call
  central?: { href: (site) => string }       // set for Channel/Studio-backed cards: Open = handoff hop
})
```

### 4.3 The site record (new data, prerequisite for 4.1 and 4.2)
One place answers "who is this org's site, where is it served, and what is switched on":
- `org_domains` (exists) gives host → org. Add rows for katie (`pottery.arts-collective.com`), elktours (`elkdonisexperiences.com`) and fourthway (path-based: needs a `base_path`).
- **`org_capabilities`** (new; Reform decision 5) holds `org_id, key, enabled, config jsonb`. It feeds `HubCapabilities`, `createCatalogue` availability and `STUDIO_KINDS.ready`, **and the Site Builder "site profile flags"** (has store, has practices). Code declares the catalogue and the ceiling; the table says on or off.
- **Serving fields** (on `organizations` or a small `org_sites` row) hold `served_by: 'shell' | '<app-name>'`, `base_url` and `manage_paths`. These replace `OWN_APP_SITES` and become `ContentHost.siteUrlFor`/`manageUrl`. Channel, content, the dock and email all read it.

## 5. The contract for a custom app

A custom app (ifac, innergathering, elktours, art-auction, fourthway, katie until it folds) gets the
central services by doing exactly this, and nothing app-local for a shared concern:

| # | Contract item | Concrete |
|---|---|---|
| 1 | **Site object** | `site.ts` `defineSite({ orgId, names, timeZone, features })`. `features` is the **ceiling**; runtime on/off comes from `org_capabilities`. Kit rule: modules take `site`, never import app config. |
| 2 | **Kit mounts** | `app/api/[...kit]/route.ts`, `app/hub/{page,[...kit]/page}.tsx`, `app/manage → redirect /hub`, `app/{login,account,center}`. A real file overrides a kit entry (Kit §2.3). |
| 3 | **Registry as the write path** | All shared-kind writes go through `performAction(id, input, {actor from session, via:'app'})` behind the kit's `/api/actions/*` and server actions. App verticals register **their own** entries (elktours `tour-*`) in the same catalogue shape, so the dock, cards and MCP see them. |
| 4 | **Shell chrome in root layout** | `<Dock>`, analytics beacon, `ArrivalNotice`, `SurfaceProvider` with `contentSurfaces(connectors)` + hub card surfaces. One kit helper: `<NetworkChrome site={site} />`. |
| 5 | **SSO** | `src/proxy.ts` with `ssoProxy`; `api/auth/{handoff,handoff/accept,callback,…}` via kit; domain in GoTrue `ADDITIONAL_REDIRECT_URLS`, `isAllowedHandoffOrigin` and the Turnstile widget; `org_domains` row. |
| 6 | **Central hops** | `handoffUrl(networkHost, '/channel?org=')`, `/studio?…&org=`, `/learn/<course>/<step>`; `next=` returns to the site. |
| 7 | **Data seams** | `ContentHost` from the site record; theme via `resolveTheme`; no `OWN_APP_SITES`-style constants. |
| 8 | **Money and mail** | org-scoped Stripe Connect account + email identity rows before the app relies on network checkout or sending (Reform decision 8). |

**The single app gets the same things natively.** Its middleware resolves the host to `site` from the DB
(`loadSiteContext(host)`), and the same kit entries run under `/sites/[slug]/…`. Channel, the Studio,
`/learn` and the dock are same-origin for apex users. For `*.arts-collective.com` orgs they are a hop
too, unless D-4 below is taken. **The kit must be written so that `site` can come from either
`defineSite` or `loadSiteContext`.** That one rule makes Kit option B (per-app catch-alls) the road to
option C (one host-resolved app), not a detour.

## 6. Migration order, matched to today's lanes

| Step | Lane | Move | Gate |
|---|---|---|---|
| 1 | — (now, cheap) | HE: add `src/proxy.ts` with `ssoProxy` (it already hands off). Fix sunjay `setMemberRoleAction` to the shared guard. Delete `packages/studio/src/channel` when content pass 1 lands. | one HE + sunjay rebuild, done when either app is next rebuilt |
| 2 | B + content | **Card contract (§4.2) first, cards second.** Lane B's shared hub component is `defineHubCard` + a kit-served `/hub/<card>`. Pilot the **Publish/Content card** (content pass 3) on **sunjay through the kit** *and* render the same card for one shell org in `scripts/channel-harness`: proves both mounts in one pass. | card renders identically in both; signed-out `/hub/*` redirects without data |
| 3 | B | **Site record migration**: `org_capabilities` + serving fields; backfill from `siteConfig.features`, `HubCapabilities` callers and `OWN_APP_SITES`; `org_domains` rows for katie, elktours. Site Builder's flags design writes here. | `OWN_APP_SITES` deleted; `ContentHost` reads the table |
| 4 | content pass 2 | `loadContentDetail` with `ContentHost` from step 3; `ownerFor`/`mayTouch`/`mayView` into `@elkdonis/content/server/access.ts` (ends the duplicate in `packages/actions`); `content-passport` registry read entry. | piece route on ≤8 reads; `check:registry` green |
| 5 | Kit phase 0-1 (11-09 → 11-13) | `packages/org-site` with `actionRoutes()` and `/api/actions/dock` as kit entries + `<NetworkChrome>`; dock appears on sunjay (dock slice 2). | dock follows a signed-in person from arts-collective to paratheater |
| 6 | B, per card | Members (ifac reference: move `apps/ifac/src/lib/manage.ts` onto `services/org-people.ts`), Site Builder (one `org_site_sections` editor replaces 8), Calendar, Email, Business. Each card retires that app's `/manage` tab group. | per app: `/manage/*` → `/hub/<card>` redirects; the 5 `content-row-actions` copies deleted |
| 7 | C | Form family as `@elkdonis/studio/forms` (essentials variant has no tiptap); Studio focus mode reads `about/delivery/preset`; `manage/compose` and `hub/compose` copies replaced by the inline variant. HE `/publish` becomes the focus-mode hop, or stays embedded until HE folds (D-3). | Studio publish closes the Channel delivery |
| 8 | E (Reform phase 3) | Fold amrit → sunjay → danamccool → HE → katie into the shell, one NPM flip each, old container warm 2 weeks. Each fold deletes one app from the release train. | Reform parity checklist; `/sites/<other>` 404 on each new tenant host |

Prerequisites that stay true from Reform: invert `PASSTHROUGH_PATHS` (at least `sites`, `hub/admin`,
`directory` on tenant hosts) before the first fold, Playwright characterization snapshots per org, and
org-scoped Stripe before a paying org (amrit, HE are "supported") moves.

## 7. Owner decisions

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| **D-1** | Hub cards: embedded per host via the kit, or one central hub domain every org visits | **Per host via the kit** (§4.2) | Lane B build shape |
| **D-2** | Commit the clone family (amrit, sunjay, danamccool, HE, **katie**) to folding into the arts-collective shell, which means writing the kit host-resolvable from day one; elktours and innergathering stay custom on the kit | **Yes.** It costs nothing extra now and avoids a second rewrite | Kit phase 0 shape; step 3 table |
| **D-3** | From a custom-domain site, does the full Studio open by **hop** to the network, or **embedded** per app (HE `/publish` precedent)? | **Hop** for focus mode; **embed only the inline form variant**. Keep HE's embed until HE folds, then delete it | Prompts 3/4 integration, Lane C |
| D-4 | Set `EAC_COOKIE_DOMAIN=.arts-collective.com`, so the network and every `*.arts-collective.com` org (shell + katie + paratheater) share one session and Channel/Studio/dock need no hop there | Yes, after the passthrough inversion; custom domains still hop | dock and Studio UX on subdomains |
| D-5 | LMS authoring: keep Sophia as its own app, or make it a Studio kind ("Course") | Fold into the Studio; Sophia becomes retired or read-only | Lane A routines-as-courses |
| D-6 | Capabilities: table rows (`org_capabilities`) edited in Site Builder, or code-only `features` | Table, with code as the ceiling | step 3 |
| D-7 | MCP door: first consumer and scope (Routines plan §2.4 options A-D) | B (remote MCP on arts-collective) read-only first; A later | nothing today |

## 8. Integration checklist for incoming designs

Ask these of every Claude Design handoff before any code is written. Record the answers at the top of
that design's integration note.

1. **Which service and which card?** Channel, Studio, content, LMS/dock, or hub card X. Is it a new card, or a section of an existing one? (Avoid a seventh card; prefer a section behind a capability.)
2. **Which plane?** In-host (the site's own pages, hub pop-ups) or central (network console). If central, what is the hop: entry URL, `?org=`, the `next=` return, and what shows on the site before the hop (face, pop-up)?
3. **Which package owns it?** `@elkdonis/content/ui`, the hub card package, `studio/forms`, `dock`, or `cms-ui/surface`. If the design needs `next/*` or an app action inside the component, it is wrong: connectors only.
4. **Data contract.** Which existing model does it read (`ContentDetailModel`, `ContentSummary`, `FaceData`, `DockData`, registry `status.values`)? Which new fields does it need, and which tables, migrations and indexes? Does each source have a `missing` path?
5. **Writes.** Which registry entries does each button call? Do they exist (`check:registry`)? Which doors (`via` app, dock, http, mcp)? Does anything send, publish, charge or overwrite text? If so, it is 'app'-only behind a confirm step.
6. **Per-site variation slot.** What changes per org: capability flag (`org_capabilities` key), section on/off, theme tokens (`--eac-area-*`), copy, an app-specific card or section injected by a custom app, presets/brand kit (`content_prefs` cascade item → org → person → default)? Is the small-org state (3 people, 2 pages) designed?
7. **Auth and roles.** The gate per card, section and action (owner, guide, member, viewer; owner-only visitors and storage). Is `can.*` computed on the server? What happens to an arrival (`network_arrivals`)? What does the cross-domain hop show signed out?
8. **Hosts it must render in.** Shell (`/sites/[slug]`), kit apps (sunjay first), custom apps (ifac reference), and phone. Containers: pop-up, page or sheet (`SurfaceFrame`/`SurfacePage`). Is it deep-linkable (`?surface=`)?
9. **What it retires.** Which `/manage` tabs, compose pages or copies (§3) it replaces, and the redirect for each old URL.
10. **Build and ship cost.** Which apps must rebuild, and the bundle weight it adds (no tiptap/three in faces; `server-only` on loaders)? Does it touch Lane A files (`apps/arts-collective/src/{app,components,lib}/channel/`, `services/channel.ts`), so that it needs a slot?
11. **Agent surface.** Should the assistant/MCP see it? Then it needs a registry read entry, and its writes are drafts-only from non-app doors.

---
Sources: `docs/open/PM_BOARD_2026-11-08.md`, `HUB_CARD_PROMPTS_2026-11-08.md`,
`CONTENT_LIBRARY_COMPONENT_2026-11-08.md`, `ORG_SITE_KIT_BRIEF_2026-11-06.md`,
`LMS_ACTION_LAYER_BRIEF_2026-11-06.md` §5-7, `CHANNEL_ROUTINES_AS_COURSES_PLAN_2026-11-07.md` §2.3-2.4,
`STUDIO_PIPELINE_DESIGN_2026-11-06.md` §0, `docs/sessions/2026-11-07_channel.md`,
`docs/reference/{ops,identity-and-tenancy}.md`, the Reform doc (claude.ai), `docker-compose.yml`,
`apps/arts-collective/src/middleware.ts`, `packages/auth-server/src/{index,handoff,sso-proxy}.ts`,
`packages/cms-ui/src/hub/cards.ts`, `apps/hidden-enneagram/src/components/publish/publish-app.tsx`.
