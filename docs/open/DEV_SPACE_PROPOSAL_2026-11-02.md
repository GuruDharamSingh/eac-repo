# Developer space: proposal

Proposal, 2026-11-02. Nothing is built. It covers a place in the monorepo where
developers prototype, play with and catalogue UI and components, replacing
per-org routes such as `/hub/sites/ifac/cards` as the prototyping surface. A
platform-wide block and template catalogue for members is a separate matter and
out of scope. Status labels: **verified** (how), **assumed**, **unknown**.

## Current state

### Where prototypes live now
- Two editor routes sit under an org: `apps/arts-collective/src/app/hub/sites/[slug]/cards/page.tsx` and `.../classifieds/page.tsx`. Each calls `requireUser`, resolves the org with `getOrgBySlug`, gates on `canEditOrgSite`, loads the org's saved document and feed (`getOrgFeed`), and mounts `CardsEditor` / `ClassifiedsEditor`. Verified (read 2026-11-02). A prototype therefore needs an org, an owner/guide role, and (for the live site) a rebuild of arts-collective, which is production mode on port 3007 (`docs/reference/ops.md`, services table).
- `docs/open/DIRECT_EDITING_PANEL_PLAN_2026-11-01.md` records the working alternative: an esbuild bundle of the real engine and panel with a sample doc and a fake `onSave`, driven by Playwright in an isolated Chromium (drive1 64/64, drive2 197/197, drive3 141/141), plus `renderToStaticMarkup` over the real components in a container. No DB writes were made. Its own "Known limits" list that the feed-card surface was never run through a Next dev container or a real org row. The harness scripts live in a Windows scratchpad (`harness3\`), not in the repo. Verified (read plan lines 271, 592-621).
- Playwright's Chromium is installed for this user (`~/.cache/ms-playwright/chromium-1228`). Verified (ls).

### Existing preview or gallery routes
- `apps/arts-collective/src/app/preview/workshop/` renders a workshop template from a hard-coded `PLACEHOLDER` object (`force-dynamic`, imports `@/lib/org`). Verified (read). It is the only fixture-driven preview route found; it is tied to one template and one app.
- Other `gallery`/`preview` directories (danamccool, art-auction, ifac, inner-gathering) are product features (image galleries, email-template preview), not component catalogues. Verified (find).
- No Storybook, `.stories.*` or equivalent exists in the tree. Assumed from `find` for directory names only; a content grep for `stories` was not run.

### Component sources a lab would show
- `@elkdonis/blocks`: 45 block files in `packages/blocks/src/blocks`, declared as data with `defineBlock(propDefs, Component)`; a registry (`registry.ts`) is read by Puck, the editor and server resolvers. `packages/blocks/scripts/smoke.mts` is the only test. Verified (ls, read registry.ts).
- `@elkdonis/primitives`: token-driven plain CSS plus Radix; `src/components`, `primitives.css`, `scripts/` with a `tsx` smoke test. Verified.
- `@elkdonis/cms-ui`: 38 subpaths of authoring UI. `src/pens/` holds React twins of the Silex pens (`FoldCard`, `FeedList`, `MoonPhase`), each sharing a stylesheet with the block of the same name (`pens/index.ts`). The Silex pens library is `packages/silex-nextcloud-connector/src/pens`; the pens' `react` pointer is read by nothing (`docs/reference/authoring.md:34`). `cms-ui` must not import `primitives` (`docs/reference/packages.md:134`). `packages/silex-render` has its own table `components.ts` / `components.data.json`. Verified (read).
- `@elkdonis/direct-edit`: plain-DOM canvas/panel, exports `.`, `./richtext`, `./block`, `./direct-edit.css`; its only scripts entry is `check-types`. Source-exported, so any Next app can import it with `transpilePackages`. Verified (package.json).

### Run modes, ports, access
- Apps run from one image `eac-dev`; dev-mode apps run `next dev` against the live tree and need no build; production-mode apps serve a prebuilt `.next` (`docs/reference/ops.md`, "Services, ports and modes"). `admin` (3000) is the precedent for an internal, LAN-only, dev-mode app with no proxy host.
- Listening host ports 3020 and 3021 are bound now; compose maps 3000-3009, 3011-3016, 3018-3021; 3010 and 3017 belong to other containers; 3030 has an unknown owner. 3022 appears in none of these. Verified (`ss -ltn`, compose grep, 2026-11-02). Edge exposure needs a human running `scripts/add-proxy-host.sh`; without a proxy host a service is unreachable from outside the LAN. Router forwarding of other ports is unknown.
- `packages/db/src/client.ts` throws at import if `DATABASE_URL` is unset, so any app that imports `@elkdonis/db` (directly or through `@elkdonis/services`) needs a URL, even if it never queries. Verified (read).
- `elkdonis_scratch` exists on the same Postgres: 205 public tables, 0 threads, against 219 tables and 191 threads in `elkdonis_dev`. It lags production's schema by about 14 tables, and nothing keeps it in step. Verified (psql count, 2026-11-02). `docs/open/IFAC_SERIES_PLAN_2026-10-10.md:131,141` records it as approved for series tests and due to be dropped.
- Row-level security: migration 227 added role `eac_tenant` and `withOrg(orgId, fn)` (`packages/db/src/tenant.ts`); `eac_tenant` exists. The role is not read-only across orgs; it is org-scoped. Verified (pg_roles, read).
- `getServerSession()` verifies the session JWT using `JWT_SECRET` (`packages/auth-server/src/verify-session.ts`, per CLAUDE.md). The platform-admin flag is `users.is_admin` (`packages/auth-server/src/index.ts:183`). GoTrue cookies are scoped to the network's domains, so a bare LAN address (`192.168.0.11:3022`) will probably not carry a session. Assumed, not tested.

## Requirements taken from the request
1. A home that is not tied to an org and needs no production rebuild.
2. Developer-only reach; absent from public hosts.
3. Registering a component costs a file and a few lines.
4. Server components and live-shaped data work without risk to `elkdonis_dev`.
5. Editor harnesses (direct-edit) mount in it and are testable by Playwright, replacing the Windows-scratchpad harness.

## Options

### A. New app `apps/lab` (dev mode, port 3022, LAN only)
A Next 16 app on the shared `eac-dev` image, started as a compose service that is not started by default, no proxy host, no `org_domains` row.
- Cost: one compose service, one app skeleton, one port; the CLAUDE.md apps table and `docs/reference/apps.md` gain a row. No effect on any live app. Hot reload through `next dev`, so no `.next` back-ups or rebuild procedure; its `.next` volume is its own (CLAUDE.md "Operating rules").
- Server components: runs natively (RSC), so it can render the real arts-collective-style components. Package source imports work through `transpilePackages`.
- Gating: three layers (below).
- Risk: another app to keep green on `@elkdonis/services` type errors ("one broken file fails every app's type check"); mitigated by importing `services` only in entries that need it.

### B. A route inside an existing app (for example `arts-collective /hub/lab`)
- Cost: lowest startup cost; reuses `/hub` auth and admin gating.
- Drawbacks: arts-collective is production mode on 3007 and public, so each entry change needs a rebuild of an app that other sessions have uncommitted work in (`.claude/rules/00-working-style.md`); the route would be on a public host unless blocked in middleware; iterating needs a separate dev container on a spare port anyway (the plan's own verification recipe). That second container is Option A with extra coupling. Arts-collective already carries the org-scoped routes this proposal is moving away from.

### C. Storybook-class tool (Storybook or Ladle) in a new workspace
- Cost: new dependency tree installed through `docker compose run --rm install` (musl/Alpine native addons); a separate bundler config for the Next-specific parts. Storybook cannot render async server components or `next/headers` consumers without extra framework support; this is assumed from general knowledge of its React-server-component status and was not checked against the current release. Components that read `getOrgFeed` or sessions would need mocking everywhere.
- Gain: mature controls panel, a11y and docs addons, story file convention that already means "catalogue".
- Drawbacks: a second toolchain and a second CSS pipeline beside `--eac-*` tokens; poor fit for `direct-edit`'s page-level canvas, which needs a real page and real routes for drag and keyboard behaviour.
- Integrate vs build: C is "integrate"; A is "build" a thin shell and keep Next as the one runtime. The shell is small (a registry, an index page, a frame), so A trades a mature panel for fidelity with production rendering.

## Recommendation

Option A: `apps/lab`, with the Playwright harness moved into it. Reason: the two stated pain points are org coupling and rebuild cost; a dev-mode app with no proxy host removes both, and it renders server components as the production apps do. Storybook-style controls can be added later as a small client panel over each entry's declared props, since `@elkdonis/blocks` already declares props as data.

### Reach and containment
1. No exposure: no `add-proxy-host.sh` run, no `org_domains` row, compose `ports` bound to the LAN address only (as `admin` is LAN-only). Compose profile `lab` so `docker compose up -d` does not start it. Verified requirement: compose `profiles` is already used for `install` and `photon` (ops.md table).
2. Request guard in `middleware.ts`: reject (404) any request carrying `X-Forwarded-Host` or a `Host` not in `LAB_ALLOWED_HOSTS` (LAN IP, localhost), so adding a proxy host by mistake does not expose it.
3. Identity: a signed-in platform admin (`getServerSession()` then the `is_admin` check) where a session reaches the host; otherwise a shared `LAB_TOKEN` in `.env` exchanged for an httpOnly cookie. Which one applies depends on the open question on cookies below. The lab holds no per-user data, so a token is acceptable for a LAN-only tool.
4. `robots: noindex` and no analytics beacon.

### Registering a component
One file per entry, `apps/lab/src/entries/<group>/<name>.lab.tsx`:

```tsx
export default defineEntry({
  title: "Feed card",
  group: "cards",
  component: FeedCard,                 // server or client component
  variants: { default: {...props}, long: {...props} },   // fixtures inline or imported
  data: "fixtures",                    // "fixtures" (default) | "scratch"
  tags: ["org-neutral", "needs-tokens"],
});
```

- Discovery: a small script (`pnpm --filter @elkdonis/lab gen`, run by the dev command and re-run on file changes) globs `entries/**/*.lab.tsx` and writes `entries.gen.ts` (a static import map). A generated map is used because Turbopack does not support `require.context`; this is assumed and should be checked in slice 1.
- Index page lists entries by group and tag; `/e/<group>/<name>` renders one with a variant switcher; `/e/<group>/<name>?frame=raw` renders only the entry for screenshots.
- If blocks already declare props as data (`defineBlock`), an adapter `fromBlock(def)` produces an entry with variants from `PropDef.default`, so the 45 block files appear with no hand-written entry. Whether `PropDef` carries enough sample data is unknown; slice 2.
- Later, a package may ship `*.lab.tsx` beside its component; the generator would glob `packages/*/src/**/*.lab.tsx`. Deferred so the lab does not add imports to packages in slice 1.

### Server components and data against a production database
Tiers, in order of default:
1. **Fixtures (default).** Entries receive props from checked-in fixtures (thread-shaped rows, org identity, feed items, copied from the existing `SAMPLE_ITEMS`, `starterDoc`, the workshop `PLACEHOLDER`). No database in the render path. The lab service still needs a `DATABASE_URL` string to satisfy `packages/db/src/client.ts` for any entry that imports `services`; set it to the scratch database, never `elkdonis_dev` (below).
2. **`elkdonis_scratch` for entries that must query.** The lab container's `DATABASE_URL` points at `elkdonis_scratch`, so a mistaken write cannot reach production. Today it is a stale, empty copy (205 tables, 0 threads); it needs (a) a documented refresh (schema from the migration runner against the scratch DB; data from a fixture seed script, not a dump of production, so member data does not spread) and (b) removal from the "drop when done" note in the IFAC plan. Refresh is a database write to a non-production database and needs the developer's approval each time.
3. **Read-only live reads (optional, off by default).** A dedicated Postgres role `eac_lab_ro` with `SELECT` only on non-private tables, used through a second client when an entry sets `data: "live-readonly"`. Requires a migration to create the role and a decision about which tables are non-private (messages, private threads, `user_connections` tokens must be excluded). Not in the first slices; the developer's decision.

Rules for entries, enforced by review and a lint in `gen`: no import of `getServerSession`/`requireUser` in an entry (the lab supplies a fake `ctx`); no Stripe, Nextcloud, mail or Meta clients (compose gives the lab none of those environment variables, so they fail closed); server actions in entries are replaced by a no-op action that appends to an on-page log, like the harness's fake `onSave`.

### Running an editor harness in the lab
- `direct-edit` mounts as a client entry: `variants` carry the sample document; the entry passes a fake `onSave` that shows the saved JSON and the `cleanDoc` result beside the canvas. No org, no `site_config` row, no rebuild.
- The esbuild/Playwright scripts from the plan move to `apps/lab/e2e/` (or `packages/direct-edit/harness/`) and drive `http://lab:3022/e/<group>/<name>?frame=raw` in the compose network, replacing the esbuild bundle step; the SSR check (`renderToStaticMarkup`) becomes a server entry whose page is fetched. The existing drive1-3 scripts (402 checks in all) would be the first regression set to port; their selectors target the harness page's DOM, so the ported page must reproduce the old harness's container ids. This is assumed from the plan's wording; the scripts were not read.
- The classifieds and cards editors become two entries over their existing engines (`lib/classifieds/editor-engine.ts`, `lib/cards/`). Those live in `apps/arts-collective/src`, so slice 3 moves their engine code into a package (`@elkdonis/direct-edit` or a new one) or imports across apps by path; moving is the cleaner choice and touches another session's files, so it waits for that session's pass 3 to land.
- Org-bound routes stay as thin consumers of the same editors; the lab becomes the place to change them first.

## Smallest first slice
Goal: one page in a dev-mode container that shows three entries, with no database and no rebuild of any live app.
1. `apps/lab` skeleton (Next 16, App Router, `transpilePackages` for `@elkdonis/primitives`, `cms-ui`, `blocks`, `direct-edit`), `middleware.ts` guard, token gate, `check-types` script.
2. Compose service `lab` on port 3022, profile `lab`, LAN-bound port, `DATABASE_URL` to `elkdonis_scratch`. A change to `docker-compose.yml` that another session may be editing; read `git diff docker-compose.yml` before editing.
3. `defineEntry` plus the generator, index page, `/e/...` route, variant switcher.
4. Three entries: a `primitives` component (client, token styles), `cms-ui` `FeedList` or `FoldCard` (server-rendered, fixture data), and `direct-edit` on the sample classifieds document with a fake `onSave`.
5. One ported Playwright check (a drive1 subset) against `?frame=raw`.
6. Verification per `.claude/rules/03-verification.md`: fetch twice and assert on markup only the entry produces; screenshot via the `verify-ui` skill; confirm a request with `X-Forwarded-Host` returns 404; confirm no proxy host exists.
7. Docs: row in CLAUDE.md apps table and `docs/reference/apps.md`; a short `docs/reference/dev-space.md`.

Not in slice 1: scratch DB refresh, read-only role, block adapter, packages shipping `*.lab.tsx`, moving org-route code.

## Open questions (for the developer)
1. Access: is a LAN-only service plus a shared token acceptable, or should the lab be reachable remotely through a subdomain with `is_admin` sign-in? The second needs a proxy host and a DNS name and puts a dev tool on a public host, which this proposal avoids. Does a GoTrue cookie reach `192.168.0.11:3022` at all? (Assumed no; test with `admin` on 3000.)
2. Name and port: `apps/lab` on 3022, or another name ("studio" and "workshop" are taken by other features)?
3. Scratch database: keep `elkdonis_scratch` as the lab's database (and stop the "drop when done" note), or create `elkdonis_lab`? Either needs approval to write; the seed is fixtures, not production data.
4. Read-only live data: wanted at all? If yes, which tables count as non-private?
5. Storybook-style controls: acceptable as a later add-on over declared props, or required from the start (which would favour Option C)?
6. Where editor engines live once they leave `apps/arts-collective/src`: `@elkdonis/direct-edit` or new packages per editor?
7. Whether `eac-dev` already has the Playwright browser available inside containers. Verified only on the host (`~/.cache/ms-playwright`); the harness ran "in the container" per the plan for SSR, browser location unknown.
8. Port 3020 is bound on the host while `sophia` is listed as not running (ops.md); the owner of 3020's listener was not identified. 3022 appears free.

## History
- 2026-11-02: proposal written from a read-only survey; no code, containers or database changed. `elkdonis_scratch` counts taken with read-only `SELECT count(*)`.
