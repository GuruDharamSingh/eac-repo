# CLAUDE.md

Orientation for Claude Code in the Elkdonis Arts Collective (EAC) monorepo.
Rewritten 2026-09-23. Kept short on purpose: it loads in every session. Detail
lives in `docs/reference/` (read on demand) and, on the maintainer's machine, in
`.claude/rules/` (loaded automatically by path) — see `.claude/README.md`.

## What this is

A self-hosted platform run by the Elkdonis Arts Collective, a not-for-profit.
One server hosts a network of org sites (arts groups, study groups, artists'
sites, an art marketplace) that share one database, one sign-in and one
Nextcloud. `arts-collective.com` is the network hub and offers subdomain
hosting; the collective also hosts and edits other organisations' own domains.
`inner_group` (InnerGathering, `elkdonis-arts.org`) is the collective's core
member group; its content is private by default.

Stack: Next.js 16 (App Router) + React 19 + TypeScript · PostgreSQL 16 ·
Supabase GoTrue · Nextcloud 33 (AIO) · Redis · Silex 3.9 · Puck
(`@puckeditor/core`) · Turborepo + pnpm · Docker Compose on a TrueNAS host,
edge via Nginx Proxy Manager. UI: `@elkdonis/cms-ui` + `@elkdonis/primitives`
(plain CSS on `--eac-*` tokens); Mantine + `@elkdonis/ui` only in five legacy apps.

## Facts that prevent the most damage

- `elkdonis_dev` is the production database. Every write lands on live data.
- The Stripe keys in `.env` are live. Do not create Stripe objects or run probe
  scripts; see `docs/reference/commerce.md`.
- The tree and the running containers are shared with other sessions. Read
  `.claude/rules/00-working-style.md` (or `docs/reference/ops.md`) before any
  build, checkout, revert or migration.
- Multi-tenancy is by `org_id` on every content table; filter by it.
- Resolve the acting user from `getServerSession()`, never from request params.
  `users.is_admin` is granted only in `apps/admin`.
- A media path without a `Private/` segment is served to anonymous visitors.
- Check `\d <table>` before hand-writing SQL; several documented columns do not
  exist. Store jsonb with `db.json(x)`, never `${JSON.stringify(x)}::jsonb`.
- A new `threads.kind` appears on every feed, forum and search page unless it
  is added to `OFF_FEED_KINDS`.
- `request.nextUrl.origin` reports `0.0.0.0:<port>`; build external URLs with
  `publicOrigin()`.
- `@elkdonis/services` exports TypeScript source: one broken file fails every
  app's type check.

## Operating rules

- Install only through the container: `docker compose run --rm install`.
  `node_modules` holds Alpine/musl native addons (sweph, sharp).
- App containers run as uid 3003 from one image, `eac-dev`
  (`docker build --target development -t eac-dev .`). Nothing in the tree
  should be root-owned.
- Each app's `.next` is a per-container volume; the host `apps/<app>/.next`
  directory is its mount point. Never `rm -rf` it on the host. To force a
  rebuild of a production-mode app, follow `docs/reference/ops.md`.
- `docker-compose.override.yml` is untracked but changes what runs. Use
  `docker compose config` to see the effective configuration.
- After editing `.env`, recreate the service (`docker compose up -d <svc>`);
  `restart` does not re-read it. `NEXT_PUBLIC_*` and `<APP>_URL` are baked in
  at build time.
- Postgres, Redis, PostgREST and Realtime listen on 127.0.0.1 only; apps reach
  them on `eac-network`.
- Type-check script is `check-types` in every workspace (turbo skips other names).
- Migrations: next number via `/new-migration`; never reuse a number or edit an
  applied file. The runner strips a file's own `BEGIN;`/`COMMIT;`.
- Nightly DB backups: `scripts/backup-db.sh` → `~/eac-backups` (same pool; not off-box).
- There are no automated tests or CI. Verification is manual: `docs/reference/testing.md`.

## Commands

```bash
docker compose ps                                        # what is running
docker compose logs -f <svc>
docker compose up -d <svc>                               # (re)create one service
docker compose exec admin pnpm --filter @elkdonis/db db:migrate
docker compose exec admin pnpm --filter @elkdonis/db db:migrate:status
docker compose exec -T postgres psql -U postgres -d elkdonis_dev
pnpm --filter <pkg> check-types                          # in a container
./scripts/add-proxy-host.sh <host> <port>                # proxy host + certificate
```

Do not run a bare root `pnpm dev` (it starts every app).

## Apps

| Dir | Port | org_id | Public host | Status |
|---|---|---|---|---|
| admin | 3000 | global | — | internal |
| sunjay | 3001 | sunjay | paratheater.arts-collective.com | live |
| blog-guru-dharam | 3002 | guru-dharam | — | not running |
| forum | 3003 | all orgs | forum.arts-collective.com | live (Grand Forum; owns wiki + dictionary) |
| inner-gathering | 3004 | inner_group | meetings.elkdonis-arts.org | retiring — do not maintain |
| elkdonis-arts-collective | 3005 | elkdonis | — | retired (landing moved to innergathering) |
| amrit-canada | 3006 | amrit_canada | amritcanada.ca | live; template for new org sites |
| arts-collective | 3007 | network | arts-collective.com | live; SSO broker, `/hub` console |
| ifac | 3008 | ifac | ifacgroup.com | live |
| art-auction | 3009 | market | market.arts-collective.com | live; reference store app |
| blog-tester | 3011 | elkdonis | — | not running |
| hidden-enneagram | 3012 | hidden-enneagram | hiddenenneagram.com | live; Silex pages |
| artdirect | 3013 | network | directory.arts-collective.com | live |
| pigeonshoot | 3014 | pigeonshoot | — | not running |
| innergathering | 3015 | inner_group | elkdonis-arts.org | live |
| elastrocal | 3016 | elastrocal | arts-collective.com/astro | not running |
| danamccool | 3018 | danamccool | danamccool.com | live; Puck pages |
| fourthwayBookreaders | 3019 | fourth_way_book_readers | elkdonis-arts.org/books | live; basePath `/books` |
| sophia | 3020 | — | — | LMS; not deployed, uncommitted |
| signal-watch | — | — | — | Android app, outside the web platform |

Details, run modes and per-app traps: `docs/reference/apps.md`. Ports 3010 and
3017 are held by containers outside this repo.

Packages (41, in `packages/`): catalogue and conventions in
`docs/reference/packages.md`. Most-used: `db` (client, migrations), `services`
(business logic, source-exported), `auth-server`/`auth-client`, `cms-ui`,
`primitives`, `nextcloud`, `email`, `commerce`/`payments`/`checkout`,
`blocks`/`page-builder`.

## Documentation

- `docs/reference/` — current state per subsystem; start here (`/orient <area>`).
- `docs/open/` — briefs and boards with outstanding work.
- `docs/sessions/` — handovers (`/handover`).
- `docs/archive/` — reports before 2026-09-23; historical, often stale.
- Write in the neutral register described at the end of `docs/README.md`.
