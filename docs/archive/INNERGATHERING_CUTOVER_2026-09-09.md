# Cutover: apps/inner-gathering → apps/innergathering

**Status 2026-09-16: FLIPPED.** `elkdonis-arts.org` and `www` now serve
`apps/innergathering` on 3015. Verified live over HTTPS: landing, `/about`,
`/offerings`, `/blog` all 200; every legacy redirect below resolves through the
public domain; network SSO handoff returns to `https://elkdonis-arts.org/login`
and renders; `/api/media` serves masters and `?w=` webp variants.

## Where things point today

| Domain | Upstream | App |
|---|---|---|
| `elkdonis-arts.org`, `www.elkdonis-arts.org` | `192.168.0.11:3015` | **new** `apps/innergathering` (`inner_group`) |
| `meetings.elkdonis-arts.org` | `192.168.0.11:3004` | old `apps/inner-gathering` — DNS is a stale AAAA, already unreachable |
| `eac.elkdonis-arts.org` | `192.168.0.11:3005` | `apps/elkdonis-arts-collective` — currently 502 |

Note that `elkdonis` and `inner_group` are two different orgs. The new app is
`inner_group`; it reads the collective's landing copy out of `site_config`
under `elkdonis`, which is where the old admin screens wrote it.

## How the flip was done (2026-09-16), and how to undo it

Nginx Proxy Manager, proxy host **16** (`elkdonis-arts.org`,
`www.elkdonis-arts.org`), forward port **3004 → 3015**. Nothing else changed —
same host, same certificate, same domain, so the GoTrue allow-list
(`https://elkdonis-arts.org/**`) still covers it.

No NPM admin credentials were on hand, so the change was made in NPM's own
store rather than through its API:

1. `proxy_host.forward_port` for id 16 set to 3015, using the container's own
   `better-sqlite3` (`docker exec … node -e …`) — the image has no `sqlite3`
   binary and the data directory is not writable from the host as `guru`.
2. The generated `/data/nginx/proxy_host/16.conf` `set $port` edited to match,
   because nothing regenerated it.
3. `nginx -t`, then `nginx -s reload` **as uid 568 (`npm`)**. As root it fails
   with `kill(…) failed (Operation not permitted)`: the container's caps are
   `0xcb` (chown, dac_override, fowner, setgid, setuid) with **no CAP_KILL**,
   and the nginx master does not run as root.

Backups, all inside the NPM container:

- `/data/database.sqlite.bak-ig-cutover-20260916` + `/data/nginx/proxy_host/16.conf.bak-ig-cutover-20260916` (this flip)
- `/data/database.sqlite.bak-20260909` + `/data/nginx/proxy_host/16.conf.bak-20260909` (pre-flip, 2026-09-09)

Rollback is the same three steps with 3015 → 3004.

`eac-inner-gathering` is **still running** on 3004. It is no longer the public
site, but proxy host 14 (`meetings.elkdonis-arts.org`) still forwards to it, so
it was left up rather than stopped as part of the flip. That subdomain's DNS is
a stale IPv6 record that does not answer, so nothing real depends on it.

## What the new app answers for

All re-verified 2026-09-16 over `https://elkdonis-arts.org`:

| Old URL | Now | Code |
|---|---|---|
| `/home` | `/` | 308 |
| `/feed` | `/general` | 308 |
| `/manifesto`, `/manifest` | `/about` | 308 |
| `/profile` | `/account` | 308 |
| `/workshops-eac` | `/offerings` | 308 |
| `/workshops/create` | `/manage/content/new` | 308 |
| `/admin`, `/admin/*` | `/manage` | 308 |
| `/calendar` | `/hub/calendar` | 307 |
| `/files` | `/hub` | 307 |
| `/meetings/<id>`, `/posts/<id>`, `/workshops/<id>` | that thread's `/<feed>/<slug>` | 308 |
| `/meetings/<id>/edit`, `/workshops/<id>/edit` | `/manage/content/<id>` | 308 |
| `/profile/<userId>` | that person's `/about/<slug>` | 308 |

The id-addressed ones are database lookups (`src/lib/legacy.ts`) because the
old site addressed content by id and this one addresses it by feed and slug.
The ids did not change — same rows, same database — so the links all resolve.

The two members-only destinations are 307 rather than 308 on purpose: where a
signed-out visitor lands is a decision this app should stay free to change,
and a 308 would be cached in people's browsers saying otherwise.

## What the new app does NOT answer for

These would 404 after a flip. None is wired to anything in the new app, so each is
a decision rather than an oversight:

- `/forum`, `/forum/*` — the new app has no forum. `@elkdonis/forum-ui` exists
  and hidden-enneagram mounts it; this app never did. See `GRAND_FORUM_PLAN.md`.
- `/polls`, `/polls/*` — questionnaires were unified onto `questionnaires.fields`
  (migration 103); no surface here yet.
- `/live` — the live session page.
- `/meetings/<id>/drawing` — the Excalidraw canvas.
- `/network-mock/*`, `/email-templates` — internal, no public value.

**One broken redirect, found at cutover.** `/feed` 308s to `/general`, and
`/general` **404s for everyone** — `org_feeds` has `inner_group/general` with
`is_public = false` (it is the attic migration 107 filed 24 archived threads
into), and `src/app/[feed]/page.tsx` calls `notFound()` on a non-public feed
regardless of session. Old `/feed` was the signed-in members' home (meetings +
posts + forum + Substack), so the honest target is `/offerings` or `/hub`, not
the archive. The fix is one line in `next.config.ts`, but it needs a rebuild of
the container that is now the live public site, on a working tree with other
sessions' uncommitted work in it — so it was left for a deliberate build.

## Also still on 3004/3005

- `eac.elkdonis-arts.org` → `apps/elkdonis-arts-collective`, whose landing was
  folded into this app. It is a second thing to retire, not covered here.
- `apps/inner-gathering` code stays in the repo until the flip has held for a
  while. Nothing else imports it, and `feedback_ignore_inner_gathering` already
  says not to preserve compatibility for it.
