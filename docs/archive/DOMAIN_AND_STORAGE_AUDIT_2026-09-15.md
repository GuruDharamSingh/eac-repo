# Subdomain provisioning + Nextcloud storage — where it stands, what to build

Audit date: 2026-09-15. Everything below was read off the live system
(Postgres `elkdonis_dev`, the Nextcloud AIO database, the NPM container's
generated nginx configs, and public DNS), not from the design docs.

---

## Part 1 — The reverse proxy and subdomains

### What is actually in front

The reverse proxy is **Nginx Proxy Manager** running as a TrueNAS app
(`ix-nginx-proxy-manager-npm-1`, `jc21/nginx-proxy-manager:2.15.1`), published
on host ports **30021 (http) / 30022 (https) / 30020 (admin + API)**. Its data
lives at `/mnt/.ix-apps/app_mounts/nginx-proxy-manager/data`.

The `docker/nginx/` directory in this repo is **not** what serves production. It
is an unused artefact of an earlier single-host design (it proxies a service
called `app:3000` and a `nextcloud:9000` FPM backend that no longer exist —
Nextcloud is AIO on `:11000` now). Nothing in `docker-compose.yml` mounts it.

### Current proxy hosts (23 live, EAC-relevant ones)

| Host | → | App |
|---|---|---|
| `Arts-Collective.com` | 192.168.0.11:3007 | arts-collective |
| `edit.arts-collective.com` | :6805 | Silex |
| `elkdonis-arts.org`, `www.` | :3004 | **old** inner-gathering |
| `meetings.elkdonis-arts.org` | :3004 | old inner-gathering |
| `eac.elkdonis-arts.org` | :3005 | elkdonis-arts-collective |
| `ifacgroup.com` | :3008 | ifac |
| `amritcanada.ca` | :3006 | amrit-canada |
| `hiddenenneagram.com` | :3012 | hidden-enneagram |
| `danamccool.com` | :3018 | danamccool |
| `cloud.elkdonis-arts.org` | :11000 | Nextcloud AIO |
| `auth.elkdonis-arts.org` | — | GoTrue |

### Five things that are broken or missing

**1. There is no wildcard DNS.** `*.arts-collective.com` does not exist:

```
arts-collective.com          → 69.196.152.249   (the server)
www.arts-collective.com      → 204.11.56.246    (registrar parking page)
test123.arts-collective.com  → NXDOMAIN
artdirect.arts-collective.com→ NXDOMAIN
```

The entire per-org subdomain model — `extractSubdomain()` in
`apps/arts-collective/src/middleware.ts`, the `RESERVED_SLUGS` guard, the
`slug.arts-collective.com` copy in `/hub/admin` — **cannot resolve for anybody
on the public internet today.** It works on `*.localhost` in dev and nowhere
else. `artdirect` is reserved as an infrastructure subdomain and is also
NXDOMAIN; artdirect is reachable only on `:3013` directly.

`www.arts-collective.com` pointing at a parking IP is a separate, visible bug.

**2. No wildcard proxy host in NPM.** Even with wildcard DNS, NPM has no
`*.arts-collective.com` entry, so a new subdomain would 404 at the proxy. There
is also no wildcard certificate — every EAC cert is a per-host Let's Encrypt
HTTP-01 cert (`npm-80`, `npm-81`, `npm-84`…), and HTTP-01 **cannot** issue a
wildcard. That needs DNS-01.

**3. `org_domains` has no writer.** Grepped the whole repo: every reference to
the table is a `SELECT`. The nine rows in it were hand-inserted on 2026-09-05.
Migration 081 says as much ("Rows are admin-inserted today") and `verified_at`
is populated but never enforced. There is no domain-add UI, no DNS-verification
flow, and no code path that creates a row when an org is created.

**4. The `org_domains` rows for IFAC / hidden-enneagram / amrit-canada are
inert.** Those three domains are in `org_domains` pointing at their org, *and*
NPM routes them straight to their own dedicated Next apps (3008 / 3012 / 3006).
arts-collective's middleware never sees those requests, so the lookup it would
perform never happens. Two mechanisms claim the same hostnames; only the proxy
one is real. This will bite the moment someone assumes a row in `org_domains`
makes a site serve.

**5. `/api/org/create` provisions Nextcloud but nothing at the edge.** It
writes `organizations`, `user_organizations`, `artist_profiles`, an unclaimed
identity profile, and calls `provisionOrgOnNextcloud` + `grantOrgAccess`. It
does **not** write `org_domains`, touch DNS, or touch NPM. A new org is a
database row with a folder and no address.

### What to build, in order

**Step A — wildcard DNS (manual, once, at the registrar).**
Add `*.arts-collective.com A 69.196.152.249` and fix
`www.arts-collective.com` (A record to the same IP, or CNAME to apex) so it
stops resolving to the parking page. Nothing else on this list works until this
is done, and no code can do it — it is a registrar action.

**Step B — wildcard certificate, which means DNS-01.**
NPM supports DNS-01 via certbot plugins if the registrar has a supported API
(Cloudflare, Namecheap, deSEC, …). Needed:
- an API token for whoever hosts `arts-collective.com` DNS;
- one NPM certificate of type "Let's Encrypt, use a DNS challenge" for
  `*.arts-collective.com` + `arts-collective.com`.
If the registrar has no supported DNS API, the fallback is: move the zone to a
provider that does (Cloudflare is the least friction), or abandon wildcard and
issue a per-org HTTP-01 cert at provisioning time via the NPM API — which works
but adds a Let's Encrypt rate-limit ceiling (50 certs/week/domain) and makes
provisioning able to fail on an external service.
**Recommendation: wildcard via DNS-01.** One cert, no per-org failure mode.

**Step C — one wildcard proxy host in NPM.**
`*.arts-collective.com` → `192.168.0.11:3007`, using the Step-B cert, force SSL,
websockets on. That single entry makes **every** future org subdomain work with
zero per-org proxy work. Note NPM's `server_name` for the apex is currently
literally `Arts-Collective.com` with capitals — harmless in nginx, but worth
normalising while you are in there.

At the end of Step C, org subdomains auto-provision with **no code at all**:
create the org row, and `slug.arts-collective.com` serves via the existing
middleware rewrite to `/sites/[slug]`. That is the 80% outcome and it is three
manual actions, not a feature.

**Step D — code, only for custom domains (`amritcanada.ca`-class).**
A custom domain genuinely cannot be wildcarded, so this is where automation
earns its place. Build `packages/services/src/npm-client.ts`:
- authenticate against `http://127.0.0.1:30020/api/tokens` (NPM's API is live
  and healthy — verified: `{"status":"OK","setup":true,"version":2.15.1}`);
- `ensureProxyHost(domain, forwardHost, forwardPort)` — idempotent create/update
  of a proxy host with `certificate_id: "new"` to trigger HTTP-01 issuance;
- store the returned NPM proxy-host id on a new `org_domains.proxy_host_id`
  column so re-runs update rather than duplicate.

Then a `/hub/admin/domains` flow: admin adds `example.com` for an org →
row written unverified → a TXT-record challenge shown → a verify button that
resolves the TXT and sets `verified_at` → **on verification**, call
`ensureProxyHost`. Gate the middleware lookup on `verified_at IS NOT NULL` at
the same time (currently it is not gated, so an unverified row serves).

Credentials go in `.env` as `NPM_API_URL` / `NPM_API_EMAIL` / `NPM_API_PASSWORD`.
Note this gives the app the ability to rewrite the proxy for **every** domain on
this host, including `nas.in-transit.ca` and the Zulip/Matrix hosts — so the
route must be global-admin only, and `ensureProxyHost` should refuse any domain
not already present in `org_domains`.

**Step E — decide the dedicated-app question.**
Before wiring custom domains to `:3007`, settle whether IFAC / hidden-enneagram /
amrit-canada / danamccool stay as dedicated apps. Right now a custom domain can
mean either "serve from arts-collective's `/sites/[slug]`" or "serve from this
org's own app on its own port", and nothing in the schema records which. If
dedicated apps are staying, `org_domains` needs a `forward_port` (or a
`serve_mode` of `network | dedicated`) so the provisioner knows where to point
NPM — otherwise automation will happily repoint `ifacgroup.com` at 3007 and take
IFAC down.

---

## Part 2 — Nextcloud: folders, orgs, users, Circles

### The live layout

Nextcloud is **AIO** (`nextcloud-aio-*`), reached by the apps at
`http://nextcloud-aio-apache:11000` / publicly at `cloud.elkdonis-arts.org`.
Everything the platform writes goes through the single service account
(`NEXTCLOUD_ADMIN_USER`, `eac_intergration` — note the typo is load-bearing,
it is the real account name).

Three groupfolders exist:

| id | Name | Group | Members | Size |
|---|---|---|---|---|
| 1 | Elkdonis Collective | Elkdonis Arts Collective | 13 | **144 GB** |
| 2 | **EAC_Network** | EAC_Network | 10 | 362 MB |
| 3 | IFAC | IFAC | 6 | **0 — empty, unused** |

`EAC_Network` (id 2) is the one the platform uses. Its top level:

```
_published/  amrit_canada/  artdirect/  elkdonis/  fourth_way_book_readers/
guru-dharam/  hidden-enneagram/  ifac/  inner-gathering/  inner_group/
justing/  market/  pigeonshoot/  saw/  stonebalancing/  sunjay/
surrealistwriting/  users/          + a stray openbook.jpg at the root
```

`users/` holds 560 entries — the per-person tree from
`ensureUserFolder()` (`EAC_Network/users/<slug>/…`), created for every
principal whether or not they have a Nextcloud login. That part of the design
is real and populated.

### Access control — how it actually resolves

`scripts/apply-team-folder-acls.mjs` documents an empirically-established rule
set, and it **has been applied**: 134 ACL rules on groupfolder 2 (51 group, 83
user). The model is:

- deny the `EAC_Network` **group** on each top-level folder;
- allow per **user** on exactly the folders that person should see
  (a user allow beats a group deny; a circle allow does **not**).
- `eac_intergration` gets user-level allows on everything first, because it is
  in the group and a blanket deny would cut off the robot that serves all media
  for every app.

**Circles are not an ACL mechanism here and never will be.** 53 circles exist
and 15 of 17 orgs carry a `nextcloud_circle_id`, but:
- a group DENY beats a circle ALLOW (tested, per the script's header);
- a Circle cannot receive a calendar share — DAV returns 200 and persists
  nothing (`packages/nextcloud/src/calendar.ts:594`);
- the service account gets 403 reading circle membership over OCS.

Circles survive for exactly two reasons: they are creatable over OCS without
the `#[PasswordConfirmationRequired]` browser gate that blocks group creation,
and they work for Deck and Talk sharing. Treat `nextcloud_circle_id` as "the
Deck/Talk handle for this org", not as its permission model. **No application
code reads or writes circles** — only `scripts/provision-org-circles.mjs` does.

### Cross-org users

Membership is in `user_organizations` (role: `owner · guide · member · viewer`),
plus `org_profiles` for IFAC's artists who exist only there. Seven people with a
Nextcloud account belong to more than one org; one belongs to seven. Those
people resolve correctly today because access is per-user ACL allows plus
per-user shares, both of which are additive — a person in IFAC and
inner_group gets allows on both folders and neither org sees the other's.

Scale is the honest constraint: **52 users, 10 with a Nextcloud account.** The
per-user ACL model is O(users × orgs) rules and is fine at 134 rules; it will
not be fine at 500 users. That is not today's problem, but it is the reason the
"deny broadly, re-grant per circle" idea keeps coming back — and it does not
work, so do not retry it.

### The reconciliation gap

`scripts/sync-nextcloud-access.sh` is the designed answer: it runs
`provision-org-circles.mjs` (folders, circles, membership, shares — all OCS, no
privileges) then `apply-team-folder-acls.mjs --apply` (needs `occ`, so it must
run on the host). Its header proposes a `*/10 * * * *` cron entry.

**It is not scheduled.** `crontab -l` for `guru` is empty and there is no
systemd timer for it (the only EAC-adjacent timer, `nextcloud-talk-fix.timer`,
last ran 2026-06-05). So every join, every new org, and every newly-connected
Nextcloud account sits unreconciled until somebody runs the script by hand.
This is the single highest-value, lowest-effort fix in this document.

### Drift worth cleaning

- `EAC_Network/inner-gathering/` **and** `EAC_Network/inner_group/` both exist —
  one org, two folders.
- `organizations.nextcloud_folder_path` is empty for 8 of 17 orgs whose folders
  demonstrably exist, and `fourth_way_book_readers` records `EAC-Network/…`
  with a hyphen where the real root is `EAC_Network`. This is exactly why
  `org-storage.ts` derives the root from the org id and ignores the column —
  but the column is still there, still wrong, and still readable by anything
  that does not know better. Either backfill it correctly or drop it.
- Groupfolder 3 (`IFAC`) is empty with 6 members while IFAC's real files live in
  `EAC_Network/ifac/`. Delete it or it will eventually be written to by mistake.
- `openbook.jpg` loose at the root of the network folder.
- `artdirect/` is the pseudo-org folder that `ensurePersonMediaFolder()` is
  deprecated in favour of `users/` — the migration script
  (`migrate-member-media-to-user-folders.mjs`) exists but the folder is still
  there, so it has not been completed.

---

## Recommended order of work

1. **Schedule `sync-nextcloud-access.sh`** (systemd timer, every 10 min). One
   unit file; closes the gap between "someone joined an org" and "Nextcloud
   knows". Do this first — it is an hour and it is the difference between a
   design and a working system.
2. **Registrar: wildcard A record + fix `www`.** Unblocks everything in Part 1.
3. **NPM: DNS-01 wildcard cert + one `*.arts-collective.com` proxy host.**
   After this, org subdomains provision themselves with no code.
4. **Decide Step E** (dedicated app vs network-served) and add
   `org_domains.serve_mode` / `forward_port` to record it.
5. **Build the NPM client + `/hub/admin/domains` verify flow** for custom
   domains, and gate the middleware lookup on `verified_at`.
6. **Clean the drift** — merge `inner-gathering`/`inner_group`, finish the
   artdirect→users migration, delete groupfolder 3, fix or drop
   `nextcloud_folder_path`.
