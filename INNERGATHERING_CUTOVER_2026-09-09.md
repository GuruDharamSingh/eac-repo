# Cutover: apps/inner-gathering → apps/innergathering

**Status 2026-09-09:** the new app is ready and every legacy URL shape resolves,
but `elkdonis-arts.org` **deliberately still points at the old app**. The flip
is held on purpose, not blocked — the public site keeps serving
`apps/inner-gathering` until someone decides otherwise. Everything below is
preparation, already built and verified, waiting on that decision.

## Where things point today

| Domain | Upstream | App |
|---|---|---|
| `elkdonis-arts.org`, `www.elkdonis-arts.org` | `192.168.0.11:3004` | **old** `apps/inner-gathering` |
| `eac.elkdonis-arts.org` | `192.168.0.11:3005` | `apps/elkdonis-arts-collective` (also legacy) |
| — | `192.168.0.11:3015` | **new** `apps/innergathering` (`inner_group`) |

Note that `elkdonis` and `inner_group` are two different orgs. The new app is
`inner_group`; it reads the collective's landing copy out of `site_config`
under `elkdonis`, which is where the old admin screens wrote it.

## The flip, when it is wanted

Nginx Proxy Manager, admin on `:30020`, proxy host **16**
(`elkdonis-arts.org`, `www.elkdonis-arts.org`): change the forward port from
**3004 → 3015**. Nothing else changes — same host, same certificate, same
domain, so the GoTrue allow-list (`https://elkdonis-arts.org/**`, already
present) still covers it.

Backups already sitting in the NPM container, if the edit ever needs undoing
by hand:

- `/data/database.sqlite.bak-20260909`
- `/data/nginx/proxy_host/16.conf.bak-20260909`

Rollback is the same edit in reverse.

**Order matters.** Flip first, verify, and only then stop
`eac-inner-gathering`. Stopping it while the domain still points at 3004 takes
the public site down — which is why that container is still running.

## What the new app answers for

All verified against the running container:

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

## Also still on 3004/3005

- `eac.elkdonis-arts.org` → `apps/elkdonis-arts-collective`, whose landing was
  folded into this app. It is a second thing to retire, not covered here.
- `apps/inner-gathering` code stays in the repo until the flip has held for a
  while. Nothing else imports it, and `feedback_ignore_inner_gathering` already
  says not to preserve compatibility for it.
