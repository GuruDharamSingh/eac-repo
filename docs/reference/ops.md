# Operations: containers, builds, edge, DNS, backups

Covers how the EAC stack runs on the TrueNAS host: the Docker Compose services,
the shared `eac-dev` image, installs, which apps run as production builds, how
to rebuild one safely, the Nginx Proxy Manager edge, DNS and certificates, the
subdomain launch checklist, and backups. Last verified: 2026-09-23 (against
`docker compose config`, `docker ps`, the NPM container's generated configs,
public DNS, and the files cited).

## Current state

### Compose project
- Project name `guru-eac` (`COMPOSE_PROJECT_NAME` in `.env`). The running
  containers were created from `docker-compose.yml` plus
  `docker-compose.override.yml` (container label
  `com.docker.compose.project.config_files`, verified on `eac-ifac`, `eac-admin`).
- `docker-compose.override.yml` is gitignored (`.gitignore:73`), so it never
  appears in `git diff`. It does two things:
  - pins `admin` to `NODE_ENV=development` + `pnpm dev` (the base file,
    `docker-compose.yml:204`, says `pnpm build && pnpm start`);
  - maps the compose network `nextcloud-network` to the real external network
    `nextcloud-aio`. Without it, apps join an unrelated, empty Docker network
    also named `nextcloud-network` and cannot reach `nextcloud-aio-apache:11000`.
- Use `docker compose config` to see what a service actually runs.
- Networks: `guru-eac_eac-network` (apps, Postgres, GoTrue, Redis) and
  `nextcloud-aio` (Nextcloud AIO). Most app containers are on both, so
  `docker inspect` prints two IPs run together.
- `docker-compose.prod.yml`, `docker-compose.production.yml`, `Dockerfile.prod`
  and `scripts/{build,start,stop,status,migrate}-production.sh` are not used by
  the running stack. They reference `.env.production` (absent) and services
  such as `inner-gathering-prod` (last touched 2026-06-06).
- `docker/nginx/` and `docker/postgres/` are not mounted by any service
  (verified by grep of `docker-compose.yml`). Production ingress is NPM (below).

### Image, user, installs
- One image, `eac-dev`, built from the `development` stage of `Dockerfile`
  (`docker build --target development -t eac-dev .`). It holds Node 20 Alpine,
  pnpm 9 via corepack, and `python3 make g++` for native addons (`sweph`
  compiles from source on musl). It contains no source and no `node_modules`:
  every service bind-mounts the repo at `/app`.
- App containers run as `user: "${EAC_UID:-3003}:${EAC_GID:-3003}"` (the host
  user). A root-owned file appearing in the tree means some container ran as
  root. `silex`, `postgres`, `redis` and the Supabase services have no `user:`.
- Install path: `docker compose run --rm install` (service `install`,
  profile `tools`, `docker-compose.yml:137-147`). It runs
  `printf 'n\n' | pnpm install --config.package-import-method=hardlink` as uid
  3003 with no `NODE_ENV`, so devDependencies are kept and pnpm's
  "remove node_modules and reinstall?" prompt is declined. No app start command
  runs `pnpm install`.
- `node_modules` contains Alpine/musl native builds (`sweph`, `sharp`). The
  host's Node is v20 glibc. Host-side `node_modules/.bin/tsc` and `turbo` run
  (verified 2026-09-23); do not install or build on the host.

### Services, ports and modes (2026-09-23)
From `docker compose config` and `docker ps`. "prod" = `NODE_ENV=production`,
start command builds only when the sentinel is missing, then `next start`.
"dev" = `next dev`, hot-reloads source. Build date = mtime of `.next/BUILD_ID`
in the container; source changed after that date is not live.

| Service | Container | Port | Mode | Public host | Running | Build date |
|---|---|---|---|---|---|---|
| admin | eac-admin | 3000 | dev (override) | none, LAN only | yes | – |
| sunjay | eac-sunjay | 3001 | prod | paratheater.arts-collective.com | yes | 09-20 |
| blog-guru-dharam | eac-blog-guru-dharam | 3002 | dev | – | no | – |
| forum | eac-forum | 3003 | dev | forum.arts-collective.com | yes | – |
| inner-gathering | eac-inner-gathering | 3004 | prod | meetings.elkdonis-arts.org | yes | 09-06 |
| elkdonis-arts-collective | eac-arts-collective | 3005 | dev | eac.elkdonis-arts.org (502) | no | – |
| amrit-canada | eac-amrit-canada | 3006 | prod | amritcanada.ca | yes | 09-16 |
| arts-collective | eac-arts-network | 3007 | prod | arts-collective.com | yes | 09-19 |
| ifac | eac-ifac | 3008 | prod | ifacgroup.com | yes | 09-21 |
| art-auction | eac-art-auction | 3009 | prod | market.arts-collective.com | yes | 09-21 |
| blog-tester | eac-blog-tester | 3011 | dev | – | no | – |
| hidden-enneagram | eac-hidden-enneagram | 3012 | prod | hiddenenneagram.com | yes | 09-16 |
| artdirect | eac-artdirect | 3013 | dev | directory.arts-collective.com | yes | – |
| pigeonshoot | eac-pigeonshoot | 3014 | dev | – | no | – |
| innergathering | eac-innergathering | 3015 | prod | elkdonis-arts.org, www | yes | 09-23 |
| elastrocal | eac-elastrocal | 3016 | dev | – (basePath `/astro`) | no | – |
| danamccool | eac-danamccool | 3018 | prod | danamccool.com | yes | 09-21 |
| fourthway-bookreaders | eac-fourthway-bookreaders | 3019 | dev | elkdonis-arts.org/books | yes | – |
| sophia | eac-sophia | 3020 | dev | none (no proxy host) | no | – |
| silex | eac-silex | 6805 | – | edit.arts-collective.com | yes | – |
| supabase-auth (GoTrue v2.151.0) | eac-supabase-auth | 9999 | – | auth.elkdonis-arts.org | yes | – |
| supabase-rest | eac-supabase-rest | 127.0.0.1:9998 | – | – | yes | – |
| supabase-realtime | eac-supabase-realtime | 127.0.0.1:4000 | – | – | yes | – |
| postgres (16) | eac-postgres | 127.0.0.1:5432 | – | – | yes | – |
| redis (7, no password) | eac-redis | 127.0.0.1:6379 | – | – | yes | – |
| video-worker | eac-video-worker | – | – | – | yes | – |
| install (profile tools) | one-shot | – | – | – | – | – |
| photon (profile geo) | eac-photon | 2322 | – | – | no | – |

Container names that do not match the service: `eac-arts-network` is service
`arts-collective`; `eac-arts-collective` is service `elkdonis-arts-collective`.

Nextcloud is AIO, version 33.0.6 (`version.php` in `nextcloud-aio-nextcloud`,
2026-09-23). Apps reach it at `http://nextcloud-aio-apache:11000`
(`NEXTCLOUD_URL`); public at `cloud.elkdonis-arts.org`. Host port 8080 is the AIO
mastercontainer admin interface, not Nextcloud itself.

### Ports held by non-EAC containers on this host
3010 (`open-webui`), 3017 (`astrology-dev`), 3030 (listener, owner unknown),
8080 (Nextcloud AIO master), 8180 (`code-server`), 11000 (Nextcloud apache),
82/8444/2525 (Zulip), 8008/8009/8014/8090/1200 (metis-*), 8013 (dawarich),
5433 (`world_brain_postgres`), 8880/10300/10301 (TTS/STT), 30007 (ddns),
30020-30022 (NPM), 3478 (Talk). 9222 and 9241 are screenshot containers other
sessions start (`eac-shotter*`). Check `docker ps` and `ss -ltn` before
assigning a port; the list in `CLAUDE.md` is not complete.

### Memory, heap and CPU limits
- Production containers: `mem_limit` 5g, runtime `NODE_OPTIONS=--max-old-space-size=1024`;
  `inner-gathering` 6g / 5120. Dev containers mostly 3g / 1024; `forum` 6g / 4096.
- Boot builds pass `NEXT_BUILD_CPUS=4`; `arts-collective` passes
  `NODE_OPTIONS=--max-old-space-size=3584 NEXT_BUILD_CPUS=2`
  (`docker-compose.yml:777`) because a build at the 1024 MB runtime heap is
  OOM-killed (exit 137).
- `NEXT_BUILD_CPUS` only takes effect where `next.config.ts` maps it to
  `experimental.cpus` (e.g. `apps/amrit-canada/next.config.ts:36-38`). It is
  read by amrit-canada, sophia, inner-gathering, sunjay, innergathering, ifac,
  arts-collective, hidden-enneagram, forum and fourthwayBookreaders; it is
  ignored by art-auction and danamccool (grep, 2026-09-23).
- `video-worker` is capped at `cpus: 8`, 4g.

### Build sentinel
The production start commands decide whether to build from files in the
container's `.next` volume:

| Services | Test | Lines |
|---|---|---|
| ifac, sunjay | `[ -f .next/BUILD_ID ] && [ -f .next/server/pages-manifest.json ]` | `docker-compose.yml:1280`, `:425` |
| amrit-canada, art-auction, arts-collective, danamccool, hidden-enneagram, inner-gathering, innergathering | `[ -f .next/server/pages-manifest.json ]` | `:939`, `:1358`, `:777`, `:1496`, `:1439`, `:602`, `:1029` |

`next build` writes `pages-manifest.json` during compilation, before type
checking; `BUILD_ID` is written only when the build completes. A build that
compiles and then fails leaves `pages-manifest.json` without `BUILD_ID`. On the
seven one-file services the next start then skips the build and `next start`
fails with "Could not find a production build" on every restart (crash loop).
`BUILD_ID` alone is not a usable sentinel either: `next dev` writes one.

### `.next` volumes
Each app's `.next` is an anonymous per-container volume
(`- /app/apps/<app>/.next`). The empty host directory `apps/<app>/.next` is its
mount point. Deleting that host directory while the container runs detaches the
mount inside the container (dev sites return 500; recovered by
`docker restart`, 2026-09-17). Inside the container `.next` itself cannot be
removed (`Resource busy`); clear its contents with `rm -rf .next/*`.
`admin`'s volume is declared at `/app/.next` (`docker-compose.yml:201`), not
`/app/apps/admin/.next`, so admin writes its `.next` to the host tree.

### Environment baking
- `NEXT_PUBLIC_*` values are inlined at build time. Each app's
  `NEXT_PUBLIC_APP_URL` comes from `<APP>_URL` in `.env` with a
  `http://localhost:<port>` fallback in compose (e.g. `docker-compose.yml:1392`).
  A production app built while the variable is unset ships the localhost value
  until it is rebuilt.
- 2026-09-23: `HIDDEN_ENNEAGRAM_URL` is not set, so the live
  `hidden-enneagram` build has `NEXT_PUBLIC_APP_URL=http://localhost:3012`.
- Container environment is fixed when the container is created. After editing
  `.env`, run `docker compose up -d <svc>` (recreates, keeps the anonymous
  `.next` volume); `docker compose restart` does not re-read `.env`.
- Two origin sources exist: request-derived (`currentOrigin()` in
  `packages/auth-server/src/handoff.ts:45`, reads `x-forwarded-*`) and
  env-derived (`NEXT_PUBLIC_APP_URL`). Only the second needs a rebuild. See
  `docs/reference/testing.md` for why localhost tests misreport the first.

### Edge: Nginx Proxy Manager
- TrueNAS app `ix-nginx-proxy-manager-npm-1`, image
  `jc21/nginx-proxy-manager:2.15.1`. Host ports 30021 (http), 30022 (https),
  30020 (admin UI + REST API). Data at
  `/mnt/.ix-apps/app_mounts/nginx-proxy-manager/data`.
- Generated configs are readable:
  `docker exec ix-nginx-proxy-manager-npm-1 cat /data/nginx/proxy_host/<id>.conf`.
- EAC proxy hosts (2026-09-23), all forwarding to `192.168.0.11:<port>` with a
  per-host Let's Encrypt HTTP-01 certificate:

  | id | Host | Port |
  |---|---|---|
  | 1 | cloud.elkdonis-arts.org | 11000 |
  | 8 | eac.elkdonis-arts.org | 3005 (container stopped, 502) |
  | 14 | meetings.elkdonis-arts.org | 3004 |
  | 15 | auth.elkdonis-arts.org | 9999 |
  | 16 | elkdonis-arts.org, www | 3015; `location /books` → 3019 |
  | 20 | ifacgroup.com | 3008 |
  | 21 | amritcanada.ca | 3006 |
  | 22 | hiddenenneagram.com | 3012 |
  | 23 | Arts-Collective.com | 3007 |
  | 24 | edit.arts-collective.com | 6805 |
  | 25 | danamccool.com | 3018 |
  | 26 | market.arts-collective.com | 3009 |
  | 27 | directory.arts-collective.com | 3013 |
  | 28 | forum.arts-collective.com | 3003 |
  | 29 | paratheater.arts-collective.com | 3001 |

  The other hosts on this NPM (`*.in-transit.ca`, dawlishfoundation) are not EAC.
- There is no wildcard proxy host and no wildcard certificate. A hostname with
  no proxy host gets nginx's default 404 over HTTP and a TLS failure over HTTPS
  (verified for `sophia.arts-collective.com`, 2026-09-23).
- `scripts/add-proxy-host.sh <hostname> <port> [--no-ssl] [--force-ssl-off]`
  creates a proxy host and requests its certificate in one API call
  (`certificate_id: "new"`, `dns_challenge: false`). It is idempotent: an
  existing hostname is reported, not duplicated. Credentials: `NPM_TOKEN` (a
  short-lived JWT from `POST /api/tokens` with `"expiry":"10m"`), or
  `NPM_EMAIL`/`NPM_PASSWORD` from the environment, `scripts/.env.npm`, or `.env`.
  2026-09-23: neither `.env` nor `scripts/.env.npm` holds NPM credentials, so a
  human must supply them. Claude's permission classifier blocks running it
  (category "DNS / Domain / Cert Changes").
- Manual change without the API (used 2026-09-16 for the elkdonis-arts.org
  cutover): edit `/data/database.sqlite` through the container's own
  `better-sqlite3` (`docker exec … node -e`), edit the matching
  `/data/nginx/proxy_host/<id>.conf` (nothing regenerates it), `nginx -t`, then
  `docker exec -u 568 ix-nginx-proxy-manager-npm-1 nginx -s reload`. As root the
  reload fails (`kill … Operation not permitted`): the container has no
  `CAP_KILL`. Back up both files first. Details:
  [INNERGATHERING_CUTOVER_2026-09-09](../archive/INNERGATHERING_CUTOVER_2026-09-09.md).
- `apps/arts-collective/src/middleware.ts` has a subdomain/custom-domain model
  keyed on `org_domains` (migration 081). It sees only hosts NPM forwards to
  3007. The `org_domains` rows for ifacgroup.com, hiddenenneagram.com and
  amritcanada.ca are inert because NPM sends those hosts to dedicated apps.
  `org_domains` has no writer; rows are hand-inserted.

### DNS and certificates
- Both `arts-collective.com` and `elkdonis-arts.org` are hosted at Bluehost
  (`ns1/ns2.bluehost.com`). The public address is `69.196.152.249`.
- **2026-09-23: both zones have a wildcard A record** (`*.arts-collective.com`
  and `*.elkdonis-arts.org` → `69.196.152.249`, TTL 14400), verified with
  `dig` against 1.1.1.1, 8.8.8.8 and `ns1.bluehost.com`. `arts-collective.com`
  SOA serial is `2026092300`. `www.arts-collective.com` is a CNAME to the apex.
- The arts-collective.com zone has changed three times in a week (no wildcard
  2026-09-15; wildcard present 2026-09-19; wildcard and apex reset by Bluehost
  2026-09-20; wildcard present again 2026-09-23). Check before relying on it.
- Check DNS only from public resolvers (`dig +short <host> @1.1.1.1`, or
  `@ns1.bluehost.com` to bypass caches). This host resolves through the router
  (192.168.0.1), which answers for names that have no public record.
- Zone records that must stay pointed at Bluehost hosting: `mail`, `webmail`,
  `cpanel`, `ftp`, `whm`, `ssh`, `webdisk`, `autoconfig`, `autodiscover`, and
  the SendGrid CNAMEs (`em8442`, `s1._domainkey`, `s2._domainkey`). Records
  added for this host use TTL 14400; Bluehost defaults use 3600.
- The zone can be read through the cPanel UAPI (`DNS/parse_zone`, fields are
  base64) with the token stored in `.env` as `Cpanel_token`; the account name
  and cPanel host are not recorded here. Writes are blocked by the permission
  classifier: read to diagnose, then give the human the exact change.
- Certificates are issued by NPM via HTTP-01 per host. A wildcard certificate
  would need DNS-01, which Bluehost has no API for.
- Other domains (ifacgroup.com, amritcanada.ca, hiddenenneagram.com,
  danamccool.com) each resolve to the same address and need their own records
  at their registrar.

### Backups and scheduled jobs
- `scripts/backup-db.sh` runs from guru's crontab at 03:17 daily
  (`pg_dump -Fc` of `elkdonis_dev`, including GoTrue's `auth` schema). Output
  in `~/eac-backups`; each dump is checked with `pg_restore -l` before it is
  kept; 14 dailies, plus the first dump of each month for a year. Log:
  `~/eac-backups/backup.log` (last success 2026-09-23 03:17).
- Restore: `docker exec -i eac-postgres pg_restore -U postgres -d elkdonis_dev --clean < file.dump`.
- The backups are on the same pool as the database; there is no off-box copy.
  Nextcloud data, `.env` and NPM data are not covered by this script.
- The same crontab runs `scripts/sync-nextcloud-access.sh` every 10 minutes
  (logged via `logger -t nc-access-sync`).

## Procedures

### Build and deploy a production-mode app
1. Check the tree. `git status apps/<app> packages/` and
   `find apps/<app>/src packages/*/src -mmin -10` — a build compiles every file
   on disk, including other sessions' uncommitted work, and deploys it. If
   someone edited files in the last few minutes, wait. A clean `tsc --noEmit`
   minutes earlier does not prove the build will pass.
2. Back up the current build outside the repo:
   `mkdir -p ~/eac-backups/next && docker exec eac-<container> sh -c 'cd /app/apps/<app> && tar -czf - --exclude=.next/cache .next' > ~/eac-backups/next/<app>-$(date +%Y%m%d-%H%M).tgz`
3. Build inside the app's own production container, which already has
   `NODE_ENV=production`:
   `docker compose exec -T <svc> sh -c 'cd /app/apps/<app> && NEXT_BUILD_CPUS=4 pnpm build'`
   (arts-collective: `NODE_OPTIONS=--max-old-space-size=3584 NEXT_BUILD_CPUS=2`).
   `next build` clears `.next` early, so the site can fail requests during the
   build and stays down if the build fails.
4. `docker compose restart <svc>`. The sentinel is present, so it goes straight
   to `next start`.
5. Verify through the edge (`docs/reference/testing.md`) and check
   `docker compose logs --tail 50 <svc>`. Expected noise: `Failed to find Server
   Action` from stale tabs; `Dynamic server usage` bailouts; on standalone apps
   `"next start" does not work with "output: standalone"`.

Do not build a production app inside a dev container: arts-collective's build
failed for weeks with `Cannot read properties of null (reading 'useContext')`
while prerendering `/_global-error` because it was built with
`NODE_ENV=development` inherited from its container (found 2026-09-18; the
webpack path printed `You are using a non-standard "NODE_ENV" value`, Turbopack
printed nothing). If a dev container is the only option, pass
`-e NODE_ENV=production`.

### Force a rebuild at container start
`docker compose exec <svc> rm -rf /app/apps/<app>/.next/server` then
`docker compose restart <svc>` (the `CLAUDE.md` method) removes
`pages-manifest.json`, so the start command rebuilds. The site is down for the
whole build, and a failed build leaves the crash loop described above. Prefer
the explicit build in the previous section. Alternative with the same trade-off:
`docker compose up -d -V <svc>` renews the anonymous volume, giving an empty
`.next`.

### Recover a crash-looping production app
You cannot `exec` into a restarting container. Either:
- restore the backup: `docker stop eac-<c>`;
  `docker run --rm --volumes-from eac-<c> -v ~/eac-backups/next:/backup:ro --user 3003 --entrypoint sh eac-dev -c 'cd /app/apps/<app> && rm -rf .next/* && tar -xzf /backup/<file>.tgz'`;
  `docker start eac-<c>`; or
- rebuild at start: `docker stop eac-<c>`;
  `docker run --rm --volumes-from eac-<c> --user 3003 --entrypoint sh eac-dev -c 'rm -rf /app/apps/<app>/.next/*'`;
  `docker start eac-<c>`, then watch `docker compose logs -f <svc>`.

### Add a workspace app or dependency
Edit `package.json`, then `docker compose run --rm install`. Afterwards check
that `node_modules/.bin` still contains `tsc`, `turbo` and `prettier`. Do not
run `pnpm install` through an app container: the production ones set
`NODE_ENV=production`, which prunes the root devDependencies (2026-09-20,
through `eac-ifac`); the older advice to `docker exec eac-ifac … pnpm install
--filter` is superseded. If it happens anyway, repair with
`docker compose run --rm install`.

### Launch an org site on a subdomain
1. Choose a free port (see the port section) and add a compose service copied
   from a production-mode app (e.g. `amrit-canada`), with the two-file sentinel.
2. Set `<APP>_URL=https://<host>` in `.env` before the first build.
3. Add `https://<host>/**` to `ADDITIONAL_REDIRECT_URLS` in `.env` (compose
   passes it to GoTrue as `GOTRUE_URI_ALLOW_LIST`, `docker-compose.yml:40`),
   then `docker compose up -d supabase-auth`. Without it, sign-in returns to
   `SITE_URL` instead of the app. Google Cloud Console needs no change: it only
   sees GoTrue's callback.
4. DNS: `*.arts-collective.com` and `*.elkdonis-arts.org` resolve today
   (check with a public resolver). Any other domain needs a record first.
5. A human runs `./scripts/add-proxy-host.sh <host> <port>`.
6. If the site is served by arts-collective's middleware rather than its own
   app, insert an `org_domains` row by hand.
7. Build (procedure above) and verify through the edge.

## Rules and constraints
- Install only with `docker compose run --rm install`: other paths either prune
  root devDependencies or offer to purge every workspace's `node_modules`.
- Read `docker compose config`, not `docker-compose.yml` alone: the gitignored
  override changes `admin`'s command and the Nextcloud network name.
- Back up `.next` and check `git status` before any build: the build deploys
  whatever is on disk.
- Build production apps with `NODE_ENV=production`, then restart: a restart
  alone rebuilds nothing while the sentinel exists.
- Do not delete host `apps/<app>/.next` directories: they are volume mount points.
- Set `<APP>_URL` before building: `NEXT_PUBLIC_*` is baked in.
- Recreate (`up -d`), not restart, after editing `.env`.
- Check DNS from public resolvers only: the local resolver answers for names
  that do not exist publicly.
- Do not edit `docker/nginx/` to change production routing: nothing mounts it.
- Test through the edge with SNI after any edge or build change.

## Open items
- `scripts/add-proxy-host.sh:163` passes `$NPM_EMAIL` to `jq` under `set -u`.
  With only `NPM_TOKEN` supplied, `NPM_EMAIL` is unset and the script aborts
  before creating anything (read, not executed, 2026-09-23). The certificate
  request also needs an email.
- NPM credentials are not stored in `.env` or `scripts/.env.npm`; `CLAUDE.md`
  says they are in `.env`.
- `HIDDEN_ENNEAGRAM_URL` unset: the live build carries a localhost
  `NEXT_PUBLIC_APP_URL`.
- `forum.arts-collective.com` and `hiddenenneagram.com` are not in
  `ADDITIONAL_REDIRECT_URLS` (19 entries in the running GoTrue). Effect on their
  sign-in flows is **unknown**.
- `sophia.arts-collective.com`: `SOPHIA_URL` set, DNS resolves via the wildcard,
  no proxy host, container stopped.
- `eac.elkdonis-arts.org` (proxy host 8) returns 502; `meetings.elkdonis-arts.org`
  (14) still serves the retiring `inner-gathering` build of 2026-09-06.
- Seven production services use the one-file sentinel; ifac and sunjay use both
  files. Moving the rest to the two-file test removes the crash-loop case.
- `NEXT_BUILD_CPUS` is ignored by art-auction and danamccool.
- `admin`'s `.next` volume path (`docker-compose.yml:201`) does not match its app directory.
- Backups are not off-box; Redis has no password.
- The owner of the listener on port 3030 is **unknown**.
- `docker-compose.prod.yml`, `docker-compose.production.yml`, `Dockerfile.prod`
  and the `*-production.sh` scripts are unused; retire or document them.

## Sources
Supersedes: `docs/archive/DEPLOYMENT.md` (plan for a different server, never
used), `docs/archive/DOMAIN_AND_STORAGE_AUDIT_2026-09-15.md` Part 1,
`docs/archive/dns-and-certs.md`, `docs/archive/startupguide.md`,
`docs/archive/SILEX_PUBLIC_DEPLOY.md` (the editor went live as
`edit.arts-collective.com`, not `silex.`), `docs/archive/OIDC_NETWORK_FIX.md`
(network fix now lives in the override), the edge parts of
`docs/archive/INNERGATHERING_CUTOVER_2026-09-09.md`, and the deployment notes in
`docs/archive/HANDOFF.md` (2026-05-21; its "never `pnpm dev`, rebuild with
`up --build`" advice predates the shared image).
Memory: `feedback_build_shared_tree`, `pnpm_filtered_install_prunes_root`,
`pnpm_install_purge_prompt`, `bug_arts_collective_build`,
`project_ops_hardening_2026_09_17`, `project_edge_and_domains`,
`cpanel_dns_api`, `project_innergathering_app` (cutover and edge parts).

Corrections recorded 2026-09-23:
- `CLAUDE.md` lists Nextcloud 29; the running version is 33.0.6.
- `nextcloud_storage_architecture` (memory) says the start command checks
  `prerender-manifest.json`; that changed on 2026-09-07 to `pages-manifest.json`.
- `feedback_test_through_the_boundary` and `project_consolidation_pass` (memory)
  classify arts-collective as dev and ifac/art-auction/hidden-enneagram as dev;
  all four are production builds now (table above).
- `project_edge_and_domains` and `cpanel_dns_api` say the wildcard is gone;
  true on 2026-09-20, not on 2026-09-23.
- `CLAUDE.md` says "restart" `supabase-auth` after editing the allow-list; a
  restart does not re-read `.env`, so recreate it.
