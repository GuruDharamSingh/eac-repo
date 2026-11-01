# Housekeeping review (started 2026-10-18)

Working notes for a site-by-site review with the developer: what each site
does, which files are live, parked, replaced or dead, where the same job is
implemented more than once, and what one site has that its peers lack. No code
changes during the review; decisions are recorded here first. Settled facts move
into `docs/reference/apps.md` when a site is finished. First pair: ifac and
innergathering.

## Inputs

- Knip 5.88.1 and dependency-cruiser 16.10.4, run read-only on 2026-10-18 over
  the working tree (branch `elastrocal-and-network-work`, uncommitted changes
  included). Knip reports a file as unused when no import path reaches it from
  an entry point, so files loaded by URL (`public/`), by Docker commands, or by
  hand (`scripts/`) are false positives. Raw output was kept in the session
  scratchpad only; rerun to refresh.
- Workspace graph generator: `scripts/workspace-graph/build.mjs`
  (`docs/reference/packages.md` "Dependency graph").
- Earlier reviews, status not rechecked on 2026-10-18:
  `docs/open/COMPONENT_CENSUS_2026-09-15.md` (duplicate components; §2b covers
  amrit-canada ↔ innergathering) and `docs/open/HYGIENE_SWEEP_BRIEF_2026-09-03.md`
  (signup export, media-proxy and upload route copies).

## Developer context

Statements from the developer, recorded as given. Dated; newest last.

- The project was built quickly ("vibe coded"); expect two or three
  implementations of the same job. (dev, 2026-10-18)
- Most used: ifac and innergathering. More up to date: fourthwayBookreaders and
  amrit-canada. Network-level sites: arts-collective, art-auction, artdirect.
  (dev, 2026-10-18)
- `packages/ui` has been replaced (by `@elkdonis/cms-ui` + `@elkdonis/primitives`).
  On 2026-10-18 five Mantine-stack apps still declare it: admin,
  blog-guru-dharam, blog-tester, inner-gathering, elkdonis-arts-collective.
  (dev, 2026-10-18; app list verified by grep of `package.json` files)
- blog-guru-dharam and blog-tester are behind regular development. sunjay is
  current. (dev, 2026-10-18)
- `apps/amrit-canada/src/components/kundalini-panel.tsx` and
  `kundalini-panel-loader.tsx`: a visual graphic taken off the page for now.
  Parked; keep. (dev, 2026-10-18)

## ifac and innergathering

### Size and overlap (2026-10-18, measured)

| | ifac | innergathering |
|---|---|---|
| Source files under `src/` | 260 | 236 |
| Pages / API routes | 46 / 79 | 47 / 74 |
| Lines: `app/` · `components/` · `lib/` | 16,169 · 9,823 · 6,165 | 13,786 · 7,789 · 4,418 |
| Uncommitted files under `src/` | 68 | 29 |

- 72 route paths exist in both apps. 25 of those files are byte-identical, 12
  more are thin wrappers (15 lines or fewer in both), and the rest are copies
  that have drifted: for example `/api/hub/email/[key]/test` and
  `/api/hub/email/preview/[key]` share 98% of their lines,
  `/api/hub/meeting/rota` 97%, `/hub/email/[key]/edit` 89%.
- 24 files under `lib/` and `components/` have the same path in both apps; 2
  are identical (`lib/pipeline.ts`, `lib/utils.ts`), 22 have drifted
  (including `lib/auth.ts`, `lib/email-suite.ts`, `lib/forum.ts`,
  `lib/gather.ts`, `lib/reminders.ts`, `components/hub/HubSurfaces.tsx`).
- Sections only in ifac: `admin`, `dealers`, `gallery`, `publications`,
  `series`, `showcase`; API `manage/*`, `series/*`, `showcase`, `my-media`.
- Sections only in innergathering: `[feed]`, `account`, `center`, `meetings`,
  `p` (Puck pages), `posts`, `profile`, `studio`, `unsubscribe`, `workshops`;
  API `oidc/*`, `blocks`, `checkout`, `contact`, `rsvp`, `threads/*`,
  `work-question`, `workshops`.

### Review order (proposed 2026-10-18)

1. Site skeleton and sign-in: `config/site.ts`, `lib/auth.ts`, layouts,
   `/api/auth/*`, login.
2. Members' hub: `/hub/*` pages and `/api/hub/*` (compose, calendar, chat,
   documents, files, whiteboard, pipeline).
3. Meetings: rota, attendance, light, record; ifac series.
4. Email suite: `lib/email-suite.ts`, `/hub/email/*`, `/api/hub/email/*`.
5. Manage console: `/manage/*`.
6. Public site: landing, about, artists, feeds, series, showcase.
7. Media and uploads: `/api/media/*`, `/api/upload`.

### Area 1: site skeleton and sign-in (2026-10-18)

How a request finds its org, its user and its role. Checked by reading the
files named; role counts by a read-only query on 2026-10-18.

- Org: fixed per app in `src/config/site.ts` (`ifac`; `inner_group`), not
  read from the Host header. innergathering also reads landing copy from the
  `elkdonis` org (`landingConfigOrgId`).
- Request hook: `src/proxy.ts` is byte-identical in both, and in artdirect,
  forum, fourthwayBookreaders and sunjay (md5, 2026-10-18; amrit-canada,
  art-auction and elktours have their own versions). It only runs network
  sign-in on arrival via
  `@elkdonis/auth-server/sso-proxy`. No role checks happen there.
- Sign-in routes `/api/auth/*`: thin wrappers over `@elkdonis/auth-server` in
  both. Sign-up and Google callback both enrol a new account as `viewer` in
  this org (`defaultOrgs`), so a new sign-up is a follower, not a member.
- User: `getServerSession()` (`packages/auth-server/src/index.ts:273`). It reads
  the session with Supabase `getSession()`, which trusts the cookie without
  asking the auth server to verify it. Known open security item (CLAUDE.md
  "Current work"; `.claude/rules/areas/auth.md`). Fix belongs in the package,
  not per app.
- Roles: `getOrgRole` from `@elkdonis/services`. Editor = owner or guide;
  member = owner, guide or member; `viewer` is not a member.
- Role counts 2026-10-18: ifac owner 2, guide 3, member 1, viewer 2;
  inner_group owner 6, member 5, viewer 10.

Differences:

| | ifac | innergathering |
|---|---|---|
| Role gates | Three: `lib/auth.ts` (`getViewer`, `requireOrgEditor`/`Member`, `getApiEditor`/`Member`), `lib/hub-auth.ts` (`getHubViewer`, used by 23 hub files), `lib/manage-auth.ts` (`requireIfacManager`/`getIfacManager`, 11 files) | One: `lib/auth.ts` |
| Who may use `/manage` | `canManageIfac` (`lib/data.ts:120`): the `siteConfig.ownerEmails` allowlist, then any network admin (`users.is_admin`), then owner/guide | owner/guide (`requireOrgEditor`) |
| Who may edit in the hub | owner/guide (`getHubViewer`, `getApiEditor`); network admins and the allowlist are not included | owner/guide |
| `isAffiliate` (any role, viewer included) | absent | present; used for org-visibility threads and `/center` |
| Files calling `getServerSession()` directly | 21 | 2 |

- The allowlist resolves to nobody on 2026-10-18: `NEXT_PUBLIC_IFAC_OWNER_EMAIL`
  is not in `.env`, so the fallback `info@ifacgroup.com` applies, and no
  `users` row has that email. Comments that justify keeping it
  (`lib/cms/questionnaire-actions.ts:18-28`, `lib/manage-auth.ts`) say IFAC has
  zero owners; it has had owners since 2026-09-18. Stale.
- `lib/auth.ts` in ifac says it has no email allowlist and no `is_admin`
  reference; true of that file, not of the app.
- innergathering `lib/auth.ts:80` comment says "any role counts" for
  `requireOrgMember`; the code excludes `viewer`. Comment stale, code correct.
- Login form: `components/login-form.tsx` exists in both and has drifted
  (not compared line by line yet).

Questions for the developer (2026-10-18):
1. Should ifac `/manage` use the same rule as innergathering (owner/guide
   only), dropping the email allowlist and the network-admin path?
2. Should network admins (`users.is_admin`) reach any org's `/manage`
   console? If yes, that belongs in one shared helper rather than in ifac only.
3. Priority of the `getServerSession()` verification fix.

### Files Knip reports as unused (2026-10-18)

"Superseded by" was checked by grep on 2026-10-18: nothing in `apps/<app>/src`
imports the listed file, and the named replacement is what the live page uses.
The developer's first recollection is recorded beside it.

| File | Lines | Last commit | Status |
|---|---|---|---|
| ifac `src/components/auth-panel.tsx` | 156 | 2026-09-10 | Superseded by `components/site/series-signin.tsx` (one sign-in/sign-up form on the series and week pages, 2026-10-10/13). Dev recalled it as the series sign-up form. Removed 2026-10-18. |
| ifac `src/components/signup-form.tsx` | 70 | 2026-05-26 | Same as above. Removed 2026-10-18. |
| ifac `src/components/video-shelf.tsx`, `src/app/home-shelves.css` | 92 + 216 | 2026-09-23 | Old landing-page shelves. Series covers use `components/site/cover-media.tsx` (2026-10-13); the YouTube channel moved to `/publications` (`lib/video-feed.ts`). Dev recalled it as the series video banner. Removed 2026-10-18. |
| ifac `src/components/blog-card.tsx` + `.module.scss` | 82 + 240 | 2026-09-23 | `/publications` renders its own markup from `lib/blog-feed.ts` and does not import it. Dev recalled it as the publications card. Removed 2026-10-18. |
| ifac `src/components/showcase-grid.tsx`, `src/lib/showcase.ts`, `showcase-actions.ts` | 135 + 103 + 40 | 2026-09-23 | Older showcase. The live `/showcase` page uses `components/showcase/ShowcaseFeed` + `getShowcase` from `@elkdonis/services` (2026-09-19). Leave for now with the rest of the showcase (dev, 2026-10-18). |
| ifac `/showcase` page itself | 164 | | Underused; not wanted long-term. Deprecate, do not delete yet (dev, 2026-10-18). What "deprecate" means here is not yet decided (hide from navigation, mark in code). |
| ifac `.auth-panel-*` and `.button--ghost` rules in `src/app/globals.css` | 67 | | Used only by `auth-panel.tsx`. Removed 2026-10-18. |
| ifac `.showcase-*` rules in `src/app/globals.css` (from line 3801, after the 2026-10-18 removal) | | | Left with the showcase. |
| ifac `scripts/migrate-media-to-nextcloud.ts` | 135 | | One-time media move. Removed 2026-10-18 at the dev's request; whether it ran is unknown. The comment in `scripts/seed-directory.ts` now says it was removed. |
| ifac `src/lib/utils.ts` | 7 | | Identical to innergathering's copy; unused in ifac. |
| innergathering `src/components/landing/WorkQuestion.tsx` | 111 | | Parked; keep (dev, 2026-10-18). |
| innergathering `src/components/manage/compose-launcher.tsx` | 78 | | Not yet asked. |
| innergathering `src/components/ui/{dialog,form,popover,radio-group,separator,sheet,tooltip}.tsx` | 694 total | | Probably removable; dev not certain (2026-10-18). Grep each before removal. |

## Open questions

- Whether the shadcn files in `components/ui/` are still wanted at all in
  template-stack apps, given cms-ui and primitives.

## History

- 2026-10-18: review started; tool runs, developer context, ifac/innergathering
  measurements recorded. Developer went through the unused-file list; grep
  showed four ifac files the developer remembered as live are superseded by
  newer components (table above). Removed at the dev's request: ifac
  `auth-panel.tsx`, `signup-form.tsx`, `video-shelf.tsx`, `home-shelves.css`,
  `blog-card.tsx` + `.module.scss`, `scripts/migrate-media-to-nextcloud.ts`, and
  the auth-panel CSS block (not committed). Verified: grep found no remaining
  references; `tsc --noEmit` for ifac reported no errors. ifac runs in
  production mode, so the live site is unchanged until its next rebuild; none
  of the removed files was in its bundle.
