# B. Package families and separable services (2026-11-16)

Lane `families`, read-only research. Question: which package families and separable services should the codebase re-order into, for some but not all apps, so that each domain (directory, profiles, business) has one home that sites consume at different weights, and the MCP's tool groups map onto those homes. Branch `work/2026-11-16`, measured on eris 2026-11-16. Paths are relative to `~/eac`. "Heuristic" marks a number from my own bucketing, not from a tool the repo owns.

## 0. Summary

- **The repo is already two layers deep, but only by habit.** 21 apps and 58 packages: 337 app-to-package and 138 package-to-package workspace edges, no cycles. Half the packages already follow a split name (`lms`/`lms-ui`, `auth-client`/`auth-server`, `blog-client`/`blog-server`, `forum-ui`, `studio-ui`, `sky-ui`). Naming that split as a rule (`<domain>` server, `<domain>-ui` client) is nearly free.
- **Two packages hold most of the domain code.** `services` is 44,122 lines in 123 flat files and 20 subpath exports; `cms-ui` is 39,121 lines in 49 subpaths and holds domain UI (hub, store, profile, center, email). `commerce` (15,992 lines) carries the auction engine to every shop site: auctions, bidding, series and the clock are 2,674 of its 9,108 server lines.
- **Directory and business are not yet duplicated; profiles are.** Atlas, by my bucketing: directory plus business is 48 capabilities in 4 apps with none shared across apps. Profiles and people are 44 capabilities in 18 apps with 19 spanning two or more apps. The directory/business home can be built before copies appear. Profiles need a lift now (the `onelogic` lane is doing the byte-identical part).
- **Recommended families:** `profiles` (people, orgs, claims, person pages), `business` (listings, offerings, booking, payouts), `directory` (listing, search, classifieds feed) with artdirect as the app on top, `market` (auctions, split out of commerce), `studio` in three tiers, `rails` (actions, dock, LMS, mcp). Each family is a server package plus a `-ui` package. UI weight is a subpath (`/lean`, `/standard`, `/full`), not a separate copy.
- **A directory Node service: not yet.** The registry already ran this decision (`docs/open/NETWORK_SERVING_ARCHITECTURE_2026-11-08.md` §4.1): host-only cookies and custom domains make a central API worse than a shared package mounted in every host. Make each family's server entry a route factory (five packages already do this) so it can be mounted as a service later.
- **A GPU tier is a worker, not a service.** Three render queues already exist as Postgres tables claimed with `FOR UPDATE SKIP LOCKED` (`video_jobs`, `reel_renders`, `reel_transcripts`). A remote worker attaches by claiming from the same table. The app side keeps enqueue, status and results through Nextcloud.
- **Of the close-knit options:** do family naming and layering rules, a package-level boundary check, subpath weights, and a MCP tag on capabilities. Do a shared Next config preset only if `siteform` agrees. Skip changesets and publishing, a per-family Turborepo graph, and `create-site` for now (reasons in §4).
- **The four MCP groups (`directory.*`, `market.*`, `studio.*`, `rails.*`) cover about half of the capabilities** (heuristic: ~410 of 784). Meetings, threads, forum, writing, booking, site and email are the rest. Add `network.*`, `business.*` and `site.*`.

## 1. Today's map, measured

### 1.1 Apps (workspace deps declared, TypeScript lines under `src`)

| App | Workspace deps | Lines | | App | Workspace deps | Lines |
|---|--:|--:|---|---|--:|--:|
| arts-collective | 37 | 46,966 | | art-auction | 19 | 25,109 |
| sunjay | 26 | 22,614 | | amrit-canada | 18 | 13,816 |
| ifac | 25 | 21,747 | | elastrocal | 12 | 19,390 |
| hidden-enneagram | 24 | 18,976 | | danamccool | 11 | 12,204 |
| innergathering | 22 | 24,191 | | fourthwayBookreaders | 11 | 9,884 |
| elktours | 21 | 46,351 | | admin | 11 | 9,536 |
| katie-the-potter | 20 | 14,030 | | forum | 8 | 994 |
| artdirect | 19 | 22,474 | | sophia | 9 | 700 |

Source: `apps/*/package.json`, `wc -l` over `*.ts`/`*.tsx` outside `node_modules` and `.next`. Method: declared deps are not imports; an import scan exists at `scripts/workspace-graph/build.mjs` (last run 2026-10-16: 0 cycles, 43 declarations with no import).

### 1.2 Packages by size and fan-in

Fan-in = how many workspaces declare it (apps among them). Lines = TS/TSX.

| Package | Lines | Fan-in (apps) | Package | Lines | Fan-in (apps) |
|---|--:|--:|---|--:|--:|
| services | 44,122 | 35 (19) | studio | 7,389 | 4 (3) |
| cms-ui | 39,121 | 27 (16) | ui (legacy Mantine) | 6,562 | 6 (5) |
| actions | 30,272 | 8 (5) | page-builder | 6,175 | 10 (10) |
| studio-forms | 17,368 | 11 (9) | hub | 5,976 | 3 (3) |
| commerce | 15,992 | 19 (13) | series-site | 5,464 | 2 (2) |
| astro-corpus | 13,569 | 1 (1) | channel | 4,890 | 3 (3) |
| direct-edit | 13,019 | 6 (6) | db | 1,033 | 43 (21) |
| three | 11,361 | 2 (2) | auth-server | 2,186 | 26 (21) |
| blocks | 10,491 | 13 (12) | email | 7,724 | 21 (13) |
| reels | 9,215 | 1 (1) | nextcloud | 3,860 | 17 (13) |

Highest fan-in: `db` 43, `utils` 37, `services` 35, `cms-ui` 27, `auth-server` 26, `types` 26, `auth-client` 22, `email` 21, `commerce` 19. `actions` is 30,272 lines mostly because `atlas/` (26,521 lines of curated area files) lives in it; the shipped code is small.

### 1.3 God packages, by domain

**`services`** (`packages/services/src`, 123 files). Lines by domain (my bucketing by file name; the rest, about 2,000, is `index.ts`, auth, bytes, data-deletion):

| Domain | Lines | Files that matter |
|---|--:|---|
| Meetings, series, calendar | 7,942 | `meeting-series.ts` 2,355; `org-calendar*`; `series-*` |
| Forum, wiki, threads, writing | 7,901 | `wiki.ts` 1,145; `forum.ts` 1,010; `nc-forum.ts` 956; `thread-*` |
| Studio, media, video | 5,329 | `reels.ts` 803; `video-pipeline.ts` 631; `video-render.ts` 532; `obs.ts`; `relay.ts` |
| Profiles, people, directory | 4,988 | `profiles.ts` 1,494; `person-page.ts` 463; `galleries.ts` 499; `identities.ts` 294 |
| Nextcloud, org infrastructure | 4,516 | `nextcloud.ts` 706; `org-*`; `uploads.ts` 496 |
| Channel, publish, social | 3,647 | `connections.ts` 1,040; `channel.ts` 827 |
| Booking, offerings, agreements | 3,407 | `workshop-offerings.ts` 942; `service-offerings.ts` 511; `artist-offerings.ts` 451 |
| Reading circles, center, gather | 3,185 | `reading-circle.ts` 955; `center.ts` 836 |
| Business listings | 692 | `businesses.ts` |
| Site theme, portfolio | 516 | `themes.ts`, `site-portfolio.ts` |

The root `src/index.ts` is 1,387 lines and re-exports nothing with `export *`. Only 20 files have a subpath export (`package.json` exports). `profiles.ts` has no imports from other services files; `identities.ts`, `businesses.ts` and `galleries.ts` import only `profiles` (and `themes`). So the profile core can be lifted without untangling: 9 services files import `./profiles`, 402 intra-services imports in all (verified `grep` 2026-11-16). `person-page.ts` and `user-pages.ts` reach into threads (`writing`, `thread-listing`, `moderation`) and stay behind at first.

**`cms-ui`** (`packages/cms-ui/src`): `surface` 15,652; `hub` 7,607; `center` 4,068; `compose` 3,888; `email` 3,757; `hubsite` 3,427; `wizard` 1,850; `gallery` 1,588; `writing` 1,496; `files` 1,493; `profile` 1,051; `store` 612. It depends only on `auth-client` and `utils`, so domain UI sits at the bottom of the graph and gets domain behaviour injected by the host (the pattern is already named: `StudioActions`, `HubCardHost`, `FormHost`).

**`commerce`** (`packages/commerce/src/server`, 9,108 lines): `orders` 1,271; `series` 961; `tours` 773; `ledger` 609; `service-bookings` 521; `series-social` 510; `series-orders` 459; `auctions` 334; `bidding` 320; `payees` 271; `auction-clock` 90. Auctions, bidding, series (three files) and the clock total 2,674. At least five apps other than art-auction import commerce (katie 25 files, ifac 13, innergathering 8, sunjay 7, hidden-enneagram 5) and so ship the auction engine. Whether they call any of it is not measured (text grep for "auction" hits 3 to 13 files per app, including store-publish helpers).

### 1.4 Layering today

Where the graph points up instead of down (declared deps):

- `commerce` -> `services`, while `services` -> `booking` and `commerce` -> `booking`: domain packages depend on the flat `services` bag, not on a lower core.
- `blocks` -> `services`, `commerce`, `cms-ui` (a catalogue package that reaches into two domains).
- `actions` -> `cms-ui`, `commerce`, `services`; `channel` -> `actions`; `dock` -> `actions`; `mcp` -> `actions`, `db`, `services`.
- `studio-forms` -> `booking` (booking UI lives inside the forms package).
- `checkout` -> `booking`, `commerce`, `payments`; `payments` -> `commerce`.

No cycles. Source-export versus built-dist: 10 packages have `main` pointing at `dist/` (`auth-server`, `db`, `email`, `hooks`, `openclaw-bridge`, `reading-wizard`, `three`, `types`, `ui`; `redis` is dist-mode per `docs/reference/packages.md`); the rest export source and every app lists them in `transpilePackages` (12 of 21 `next.config.ts` carry the same `NEXT_BUILD_CPUS` block; `arts-collective` names 32 `@elkdonis/*` packages in its config, `sunjay` 25).

### 1.5 Atlas, by domain (784 capabilities)

Source: `packages/actions/atlas/areas/*.ts` loaded with `loadAreas()` in a throwaway container (2026-11-16; the script was a temporary file in `~/eac/scratchpad`, removed). `inventory.json` holds 1,987 write hosts (sa 879, api 537, sql 571); coverage is 100% per app. Of 784 capabilities: 526 have hosts in exactly one app, 142 in two or more, 70 in four or more, 116 in no app (package-only rows).

Domain buckets are mine (regex over area name and capability id; a capability lands in the first bucket that matches, so edges are fuzzy):

| Domain bucket | Caps | Hosts | In apps | In packages | Person-class | Money risk | Apps touched | Caps spanning 2+ apps |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| Directory + business | 48 | 68 | 68 | 0 | 45 | 0 | 4 | 0 |
| Profiles and people | 44 | 156 | 154 | 2 | 34 | 0 | 18 | 19 |
| Market, commerce, money | 197 | 411 | 280 | 131 | 134 | 99 | 13 | 11 |
| Booking, offerings, tours | 64 | 109 | 109 | 0 | 57 | 11 | 6 | 2 |
| Studio, channel, media | 59 | 105 | 105 | 0 | 45 | 0 | 6 | 4 |
| LMS, learn | 61 | 93 | 63 | 30 | 23 | 0 | 4 | 1 |
| Site, editing | 58 | 211 | 207 | 4 | 42 | 3 | 14 | 28 |
| Email, newsletter | 20 | 53 | 40 | 13 | 10 | 0 | 6 | 11 |
| Network, meetings, forum, and the rest | 195 | 563 | 561 | 2 | 148 | 4 | 18 | 66 |
| dock, messaging, series-site, package-only | 38 | 57 | 4 | 53 | 0 | 0 | 1 | 0 |

Reading:

- Hosts live in apps, not packages: 1,591 of the bucketed hosts sit in app files against 235 in packages. The shared logic is in `services`/`commerce` (sql writes there are not hosts: 311 in services, 10 in db), but every app has its own action wrapper, which is the duplication `drift.md` lists.
- The worklist in `reports/drift.md` groups hosts by canonical target. The widest: sign-up 18 apps; profile update 8; profile sections 7; RSVP route 7; upload route 7; org-site kit actions 7; payouts 7 (start and disconnect). Nearly all point at a `services` function plus a "kit action", i.e. the fix is placement of a shared action, not new logic.
- Byte-identical source across apps (>300 bytes): 241 groups, 715 files (md5 over `apps/**/*.ts(x)`, 2026-11-16). Lane `onelogic` is lifting these.
- The atlas is organised by app and area (`apps.*`, `orgapps.*`, `arts-collective.*`, `pkg.*`), not by domain. `Capability` in `atlas/types.ts` has `area`, `scope`, `hosts`, `canonical`, `risk` but no family or domain field.

### 1.6 Existing precedents to build on

- Route factories in packages: `centerRoutes()` (`packages/services/src/center-routes.ts`), `createChatApi`, `createPipelineApi`, `connectionsHandlers`, the `series-site` factories, `@elkdonis/forum-ui` `handleForumAction`.
- Subpath exports as weight: `cms-ui` 49, `studio` 19, `commerce` 12, `services` 20.
- A homegrown boundary check: `scripts/check-client-barrels.mjs` (fails when a client barrel reaches `db`/`services`), run from root `pnpm check-types`.
- A planned kit: `docs/open/ORG_SITE_KIT_BRIEF_2026-11-06.md` (`@elkdonis/org-site`, not present in `packages/` on 2026-11-16) and `@elkdonis/hub` (exists, 5,976 lines; hub cards).
- Per-app tool surface is already central: the MCP is one mount on arts-collective (`docs/open/mcp-foundations/DECISIONS.md` D-1), 893 lines in `packages/mcp/src/server`, read-only slice 1.

## 2. artdirect as the directory and business source

### 2.1 What artdirect holds (`apps/artdirect`, 22,474 lines)

| Part | Lines | What |
|---|--:|---|
| `src/components/oad` | 3,076 | dossier UI: drawer, form, sidebar, gallery, credited work, manage space |
| `src/classifieds` + `src/app/classifieds` | 2,992 + 646 | microfiche classifieds engine (rng, catalog 155 templates, style, plane, sheets) |
| `src/lib` | 2,333 | `oad.ts` 684, dossier/offering/booking/profile/writing actions |
| `src/app/[slug]` | 1,438 | public person page, `/design`, `/edit`, `/featured`, `/services/[service]`, `/writing` |
| `src/components/design`, `business`, `booking`, `site` | 435, 325, 130, 116 | person-page designer, business shell page, booking settings |
| `src/app/api` | 295 | `auth`, `checkout`, `geo`, `media`, `pulse`, `silex`, `upload` |

The data and rules are not in the app. Profiles, claims, vouches and directory queries are `services/profiles.ts`; businesses (shells, claims, removal, place links) are `services/businesses.ts` (692 lines, migration 242, `@elkdonis/services/businesses`); dossier rendering is `@elkdonis/cms-bindings/dossier` (6 of artdirect's files, plus the Silex connector); profile UI is `@elkdonis/cms-ui/profile` (1,051 lines, 13 consumers). artdirect's own dependency list is 19 workspace packages. Its atlas area is `apps.artdirect.dossier`: 19 capabilities, all person-class, 50 inventory hosts (47 claimed, 3 ignored).

Classifieds are a visual generator, not listings (`apps/artdirect/classifieds/HANDOFF.md`; `docs/open/ASSOCIATED_BUSINESSES_2026-11-04.md` §1.C). They have one consumer and no write path to share.

### 2.2 What other apps duplicate or already consume

- Profile surfaces: `cms-ui/profile` is imported by 10 of 21 apps; profile reads (`getProfileBySlug`, `listPublicProfiles`, `updateProfile`) appear in 10 apps' source (artdirect 14 files, sunjay 6, innergathering 6, arts-collective 6, amrit-canada 5).
- `/people` pages in elastrocal and elktours; `/directory` in arts-collective (its data comes from `cms-bindings/dossier`, per a comment at `docker-compose.yml` near line 758); `[slug]` person page in art-auction and artdirect.
- Account and profile write wrappers, copied per app: `account-actions.ts` (3 identical-but-for-log-prefix), profile-section toggles (7 apps, 20 hosts), `center/profile` route (7 apps; 4 byte-identical at 125 lines), featured people (sunjay, elktours, 6 caps each).
- Businesses: `services/businesses` is used by artdirect (3 files) and elktours (5 files). elktours has its own `places` layer (12 capabilities) that links to the network-wide business record by design (`ASSOCIATED_BUSINESSES` §2).
- Booking, offerings and money UI is spread over `studio-forms/booking`, `checkout/booking`, `commerce/components` (2,787 lines), `cms-ui/store`, `hub`, and per-app files in elktours, katie, sunjay.

### 2.3 Target split

Layering rule for the family (lowest first): `core` (types, db) -> `profiles` -> `business` -> `directory` -> app. A package may import only lower layers.

| Package | Holds | Lines moved (from) |
|---|---|---|
| `@elkdonis/profiles` | users/org profiles, claims, vouches, identities, org membership, artist membership, galleries, featured people, profile sections; route factories (`profileHandlers`) | about 3,300 (`services` profiles 1,494, identities 294, featured-people 255, galleries 499, org-people 302, org-membership 230, artist-* 147, user-pages later) |
| `@elkdonis/profiles-ui` | profile card, person page render, edit-my-profile pop-up, person-page designer, dossier forms | `cms-ui/profile` 1,051 + artdirect `components/oad`, `design` 3,500 |
| `@elkdonis/business` | business shells and claims, place links, offerings, booking, payouts; route factories | `services/businesses` 692, booking/offering services 3,407 (partly), `booking`, commerce payees 271 |
| `@elkdonis/business-ui` | public business page, booking button, manage offerings/booking/payouts, claim and steward screens | artdirect `components/business`, `booking`; `studio-forms/booking`; `checkout/booking` UI |
| `@elkdonis/directory` | listing and search queries, geo, dossier listing, feed adapter for classifieds | `profiles.ts` listing half, artdirect `geo.ts`, `oad.ts` reads |
| apps/artdirect | routes only, plus classifieds engine until a second consumer exists | stays |

`profiles-ui`, `business-ui` and `directory` UI subpaths carry the weights:

| Weight | Subpath | Contents | Consumers |
|---|---|---|---|
| Lean | `/lean` | read-only profile card, person page, business page, directory block for Puck, "claim" and "manage" hops (links to arts-collective via `handoffUrl`) | sites that only show people or businesses: danamccool, katie, elastrocal, fourthwayBookreaders, hidden-enneagram |
| Standard | `/standard` | lean + edit-my-profile pop-up, profile sections, featured people, galleries | org sites with members: ifac, sunjay, innergathering, amrit-canada, elktours |
| Medium-large | `/full` minus admin | standard + manage business (offerings, booking, payouts), claim and stewardship cards, dossier create/vouch/review, designer | arts-collective |
| Full | the app | all + classifieds + public dossier flows + steward admin | artdirect |

Weights are enforced by one rule: `/lean` may import nothing from `/standard` or `/full`. A lean site pays in client JS and server-action surface, not install size, because the workspace exports source and an import graph decides what compiles. **Guess:** the real saving is build memory (`arts-collective` already needs a 9 GB cap, `DECISIONS.md` D-1) and the attack surface of exported server actions.

### 2.4 Separate Node service for the directory?

| | Package in each host (recommended now) | Directory API service |
|---|---|---|
| Fix reach | each host rebuilds to get a fix; the 2026-11-06 `/manage` fix touched 80 pages in 8 sites and none was live until each rebuilt (`ORG_SITE_KIT_BRIEF` §1) | one deploy fixes all |
| Sessions | each host reads its own session cookie and resolves the actor in-process | host-only cookies and custom domains force a token or CORS design (`NETWORK_SERVING_ARCHITECTURE` §4.1, registry row); `INTER_APP_JWT_SECRET` exists for server-to-server |
| Data | same Postgres either way (`elkdonis_dev`, one database); a service adds no isolation | same |
| Latency and failure | in-process | an extra hop per page, a new failure point |
| Ops | none new; there are no tests and no CI | new container, port, proxy host, health check |
| MCP | tools register from the family's capabilities, central mount | service could own `directory.*`, but then the MCP proxies to it |

Recommendation: no service now. Write the family's server entry as route factories so the same handlers can be mounted in a small app later. Triggers to revisit: a site that runs off the box (the "custom app" contract, `NETWORK_SERVING_ARCHITECTURE` §5), or a second fix that has to wait on eight rebuilds.

### 2.5 `art-auction` and "selling artwork shouldn't require art-auction"

Selling code is already outside the app (`commerce`, `checkout`, `payments`; katie, ifac, innergathering, sunjay, hidden-enneagram use it). The auction engine travels with it. Proposal: split `commerce` into `commerce` (stores, artworks, orders, payees, ledger, settlement, shipping, tours, service bookings) and `market` (auctions, bidding, series, clock, series social/orders), with `art-auction` as the only app that imports `market`. First step with no new package: move the auction files behind subpath exports (`@elkdonis/commerce/auctions`) and see which apps break. **Unknown:** how many of the 3 to 13 "auction" hits per app are real engine calls; a typecheck after the move answers it.

## 3. Studio tiers and GPU

### 3.1 What exists

| Piece | Where | Lines | Notes |
|---|---|--:|---|
| Forms (essentials) | `packages/studio-forms` | 17,368 | 120 files; 11 dependents, 9 apps; `booking`, `canvas`, `forms`, `meeting` subfolders |
| Studio frame and kinds | `packages/studio` | 7,389 | 19 subpath exports; 3 app consumers (arts-collective, katie, hidden-enneagram) |
| Reels (Remotion templates) | `packages/reels` | 9,215 | 1 app consumer (arts-collective) |
| Service-layer pieces | `services` `reels`, `recordings`, `obs`, `relay`, `video-*`, `studio-items` | 5,329 | domain bucket above |
| Studio UI primitives | `packages/studio-ui` | 343 | Tailwind and Tiptap; art-auction, pigeonshoot, katie |
| Workers (compose services) | `docker-compose.yml` | | `video-worker` (8 CPU, 4 GB, polls `video_jobs`), `reel-render` (`--worker`, 8 CPU, 6 GB, concurrency 4, polls `reel_renders`), `obs` (iGPU, 8 CPU, 6 GB), `auction-clock` |

The queue is Postgres. `video-pipeline.ts:519` claims the oldest queued job with `FOR UPDATE OF j SKIP LOCKED` ("so a second worker would never share it"); `packages/reels/render/render.mjs:945` does the same for renders and `:397` for transcripts. Job input and output are files in Nextcloud over WebDAV (`NEXTCLOUD_URL`, admin credentials in env), plus `DATABASE_URL`. Only the worker image has ffmpeg (`docs/reference/nextcloud.md` ~line 269).

GPU on the host: Intel/AMD iGPU through `/dev/dri`, used for VA-API encode and the OBS compositor; no CUDA, no `nvidia-smi` (`docs/open/STUDIO_PIPELINE_DESIGN_2026-11-06.md` §2.6, checked 2026-11-06). The same doc lists "a training worker on a GPU machine elsewhere" as an unchosen option for splat making. Justin's own notes describe a WSL2 GPU box and scan3d/hunyuan3d pipelines (from memory notes, not verified in the repo).

### 3.2 Three tiers

| Tier | Package surface | Runs where | Does |
|---|---|---|---|
| 1. Site studio | `studio-forms` essentials plus `studio/forms` essentials (forms for post, meeting, offering; no tiptap-heavy canvas, no video) | in each site | author and publish a post, meeting, offering |
| 2. Network studio | full `studio` (canvas, Video, Recordings, Broadcast, Channel) | arts-collective, plus CPU workers on eris | writing canvas, reels, clips, OBS booth, transcripts |
| 3. Heavy studio | no new UI: new job kinds in tier 2's Video/3D screens | a GPU machine running a worker | splat/3D from video, large-model transcription, upscaling, generation (examples are guesses) |

`studio-forms` is the "lean" tier and is already 17,368 lines with a `booking` subfolder; the weight split of §2.3 applies: move `studio-forms/booking` into `business-ui`, then check that tier 1 does not import `canvas`.

### 3.3 How a GPU tier attaches

1. **Job class on the existing tables.** Add `needs text not null default 'cpu'` (a migration; lead's call) to `video_jobs` and `reel_renders`, or one new table for GPU kinds. The CPU workers claim `needs = 'cpu'`; the GPU worker claims `needs = 'gpu'`. Same `SKIP LOCKED` claim.
2. **App side keeps:** enqueue, status/progress/heartbeat columns (already there: `heartbeat_at`, `progress`), the Studio screens, authorisation. Nothing else changes.
3. **Worker side:** a copy of `reel-render` or `video-worker` image with CUDA, configured by env (`DATABASE_URL`, `NEXTCLOUD_URL`, `REEL_WORK_DIR`). Postgres listens on 127.0.0.1 only (CLAUDE.md), so the worker needs either a Tailscale route to a limited role, or an HTTP job API in front (claim, heartbeat, finish).
4. **Which of the two:** direct Postgres with a role limited to the job tables is the smaller change (zero new service) and reuses the claim queries. A job API is the safer choice if the GPU machine is ever off the tailnet or shared. **Recommendation:** direct, limited role over Tailscale first; a job API only when a second remote machine appears.
5. **Failure handling:** `reel-render` marks renders left running by a restart as failed (`render.mjs:929-934`) and `video-pipeline.ts:537` requeues a job; a PC that sleeps is the realistic failure, so requeue rather than fail for GPU jobs and show "waiting for the GPU machine" in the UI when a `gpu` job is older than N minutes.

## 4. "Close-knit family" options

| Option | Cost here | What it buys | Recommend |
|---|---|---|---|
| **Package families with layering rules** (core -> domain -> ui -> app) | a naming and import rule in `docs/reference/packages.md`; moves are the work (§6). The split names already exist in 8 packages | one home per domain; "where does this go" has an answer; MCP groups follow | **Yes** |
| **Enforced import boundaries** | Package-level: extend the `check-client-barrels.mjs` style script with a layers table, no dependency, ~100 lines; `eslint-plugin-boundaries` needs an ESLint setup the root does not have (no root eslint config; only `apps/admin` declares eslint); `dependency-cruiser` is not installed, needs a container install (`docker compose run --rm install`) | stops new inversions (those in §1.4); file-level rules (lean may not import full) need depcruise or a script over subpaths | **Yes: script first**, run from `check-types`, with the current violations as an allowed baseline. Depcruise only if file-level rules outgrow the script |
| **Family barrels and exports maps** | one `exports` map per package, weights as `./lean`, `./standard`, `./full`; the server entry stays separate (`./server`), as `check-client-barrels.mjs` already requires | weights without copies; tree stays compile-on-import | **Yes**, it is the weight mechanism |
| **Turborepo task graph per family** | `turbo.json` has 5 tasks and CLAUDE.md says only `check-types` is run through turbo; apps build in compose containers, there is no CI | `turbo run check-types --filter=...profiles` impact checks, caching of type checks | **Later**: free if the dependency graph is clean; no work now |
| **Shared Next config preset** | a `@elkdonis/next-config` function returning `transpilePackages` for a family list plus the `NEXT_BUILD_CPUS` block (12 of 21 apps carry it; 898 lines of config in all) | one place to add a family to a site; no 32-line lists | **Yes if `siteform` wants it**: overlaps their clone-site work; I defer to them |
| **`create-site` generator from a clone template** | amrit-canada is called the template; the org-site kit brief (not built) is the larger answer | a new site in minutes | **Not before the kit**: the generator would copy the same duplication the kit removes; it belongs to `siteform` and the kit |
| **Changesets and publishing** | needs versions, a registry, release steps; every package is `private`, source-exported, built into one image | semver for outside consumers | **No.** All consumers are in this workspace and rebuild together; nothing is published |
| **Separate Node services for heavy domains** | new container, proxy host, secrets; no CI | independent deploy and scaling | **Only the workers** (they exist); directory, profiles and business stay packages (§2.4); consider media/ffmpeg and astro (`sweph` native addon) as candidates later (guess) |
| **MCP tag on capabilities** (not in your list) | add `family` to `Capability` in `atlas/types.ts`, backfill 784 rows by file and heuristic | tool groups become a filter; counts per family are exact | **Yes**; see §5 |
| **Per-app `turbo prune` images** (not in your list) | `Dockerfile.prod` is stale (still names inner-gathering); prod runs in the dev image with a `.next` volume | smaller per-app images and builds | **No** until prod images are rebuilt on their own terms |

## 5. Target map

Family names are proposals. "Weight" is the subpath of the `-ui` package. Consumers are by current dependency, not decided assignments.

| Domain | Package family (server / ui) | Service | MCP group | Consumers and weight |
|---|---|---|---|---|
| Profiles, people, orgs, claims, person pages | `profiles` / `profiles-ui` | none | `directory.person.*`, `directory.org.*` | standard: ifac, sunjay, innergathering, amrit-canada, elktours; lean: danamccool, katie, elastrocal, fourthwayBookreaders, hidden-enneagram; medium-large: arts-collective; full: artdirect |
| Businesses, listings, place links | `business` / `business-ui` (listing half) | none | `directory.business.*` | lean page: elktours; medium-large: arts-collective; full: artdirect |
| Directory, search, dossiers | `directory` / (subpath of `profiles-ui`) | none (route factories) | `directory.list.*`, `directory.search.*` | arts-collective `/directory`, artdirect, `elastrocal`/`elktours` `/people` pages at lean |
| Classifieds | stays in `apps/artdirect/src/classifieds` | none | `directory.classifieds.*` (read) | artdirect only |
| Booking, offerings, payouts (business suite) | `business` / `business-ui` (manage half), plus `checkout`, `payments`, `booking` below it | none | `business.*` | standard: elktours, katie, ifac, sunjay; medium-large: arts-collective |
| Shop, stores, orders, ledger | `commerce` / `commerce` components | none | `business.store.*` (selling) | katie, ifac, innergathering, sunjay, hidden-enneagram, art-auction, arts-collective |
| Auctions, bidding, series | `market` / `market-ui` (new, split from `commerce`) | `auction-clock` (exists) | `market.*` | art-auction only (plus an arts-collective hub card that opens a store) |
| Studio tier 1 | `studio-forms` essentials | none | `studio.forms.*` | 9 apps today |
| Studio tier 2 | `studio`, `reels`, `channel` / `studio` ui | `video-worker`, `reel-render`, `obs` (exist) | `studio.*` | arts-collective; katie and hidden-enneagram (partial) |
| Studio tier 3 | none new; job kinds | GPU worker (new) | `studio.jobs.*` | arts-collective |
| Actions, dock, LMS, MCP | `actions`, `dock`, `lms`, `lms-ui`, `mcp` | MCP mount (arts-collective, D-1) | `rails.*` | arts-collective, sophia; dock in every root layout (NETWORK_SERVING §4.1) |
| Meetings, threads, forum, wiki, writing | `network` (new, from `services`) / `forum-ui`, `series-site` | none | `network.*` | most org apps |
| Site editing, themes, page builder, hub cards | `blocks`, `page-builder`, `hub`, planned `org-site` | none | `site.*` | all org apps (lane `siteform`) |
| Email, newsletter | `email`, `newsletter` | none | `network.email.*` | 13 apps |

MCP mapping rule: a capability's `family` field picks the tool group; the dock and MCP read the same list (`DOCK_RAILS_PLAN.md` §5b says broad areas are tags that map to atlas areas). Each family package exports its own capability rows (or atlas file); `packages/mcp` registers tools by filtering on family. This is the "decide at P6" item in `RECOMMENDATIONS_2026-11-16.md` ("ideas ahead"); a single endpoint with groups is the lower-cost reading, since per-domain servers repeat the grant, audit and limit code in `packages/mcp/src/server` (893 lines).

### Order of moves

Each is one session or less. Nothing here is a production action; each app that consumes a moved package needs its normal rebuild afterwards, held until Justin says go.

| # | Move | Size | What can go wrong |
|---|---|---|---|
| 1 | Write the layers table and the `family` field for `Capability`; add `family` to area files by heuristic. No code moves | small | the heuristic puts caps in the wrong group; edges (profile vs business vs directory) are fuzzy, so Justin reviews the table once |
| 2 | Package-level boundary script with the known violations as baseline, wired into root `check-types` | small | false alarms from dist packages and devDependencies; keep the baseline explicit |
| 3 | Subpath weights on `cms-ui/profile` and `studio-forms` (`/lean`, `/standard`) with the "lean imports nothing heavier" rule; no moves | small | a hidden import from a lean component into a heavy one; the script from move 2 catches it |
| 4 | Lift `profiles` out of `services` (profiles.ts, identities, featured-people, org-membership, artist-membership, galleries). `services` re-exports for one cycle | medium | 9 services files import `./profiles` and 14 artdirect files plus six other apps import the functions; a missed re-export breaks type checks in all apps (CLAUDE.md: "one broken file fails every app's type check"); do after `onelogic` finishes to avoid merging into moving files |
| 5 | `business` package: `businesses.ts` plus the offering and booking services; move `studio-forms/booking` and artdirect `components/business` into `business-ui` | medium | `studio-forms` has 11 dependents; booking UI is imported through `studio-forms/booking` by artdirect and others; keep a re-export |
| 6 | Split `commerce` into `commerce` + `market` (start with subpath `./auctions`) | medium | auction code shares `orders` and `ledger` internals; some of the 3 to 13 "auction" hits per app may be real; typecheck all 7 consumer apps |
| 7 | artdirect rewrite on top of the three families: routes only, `profiles-ui/full`, `business-ui/full` | medium | live app on `directory.arts-collective.com`; rebuild is a production action; its `.next` volume rule applies |
| 8 | MCP groups: register `directory.*` read tools from family capabilities; the others follow | medium | tool count and context cost for the AI client; read-only first (slice 1 is read-only) |
| 9 | GPU worker: `needs` column, a worker image with CUDA, a limited DB role over Tailscale | medium | migration number and applied order; a sleeping PC leaves jobs queued; the role's grants must be only the job tables |
| 10 | `network` family out of `services` (meetings, threads, forum, writing: about 15,800 lines) | large, split over sessions | the largest and most-imported part of `services`; `person-page` and `user-pages` tie into it; do last |

## 6. Open items

For Justin (see the final report in the hand-off): family names; directory service yes or no; whether `market` is its own package; where the business suite lives; the GPU worker's DB access.

Overlap with other lanes:
- `siteform` (single-app clone site): the shared Next preset, `create-site`, `@elkdonis/org-site` and house editor belong there; this doc only fixes which family each site pulls and at what weight.
- `onelogic` (byte-identical lifts): move 4 depends on its output, because the profile wrappers are among the 241 identical groups.

Open questions (guesses, not verified):
- Whether `person-page` and `user-pages` belong in `profiles` or in `network` (they read threads).
- Whether `directory` earns its own package or is a subpath of `profiles` plus `business`; with no second consumer besides arts-collective and artdirect it may stay a subpath.
- Which apps really call auction functions (move 6 settles it).
- Whether the lean sites want the claim and manage hops as links or as an embedded pop-up (siteform decides the surface).

Method notes: dependency data from `package.json` files read with a short Python script (read-only); line counts with `wc -l`; atlas counts from `loadAreas()` in a throwaway container with a temporary script in `~/eac/scratchpad` (deleted); drift and coverage from `packages/actions/atlas/reports`. No production action, no migration, no code edit, no commit.
