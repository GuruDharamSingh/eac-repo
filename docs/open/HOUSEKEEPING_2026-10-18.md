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

### Area 1 recheck (2026-11-04)

- Correction to area 1: `getServerSession()` now verifies the token
  (`packages/auth-server/src/verify-session.ts`, landed 2026-11-01), so question
  3 above is closed for source. Verified by searching each running bundle for
  the module's log string: present in ifac, innergathering, arts-collective and
  sunjay (builds 2026-11-02/03); absent in amrit-canada and fourthwayBookreaders
  (builds 2026-11-01), whose containers also lack `JWT_SECRET`. Other apps not
  checked. An old bundle keeps trusting the cookie until that app is rebuilt.
- Role counts: inner_group viewer 18 (was 10); other rows unchanged.
- Allowlist, `is_admin` path and the three ifac gates: unchanged. Questions 1
  and 2 remain open.
- `series-signin.tsx` moved to `packages/series-site/src/components/`
  (2026-11-02); the table below names its old path.

### Area 2: members' hub (2026-11-04)

Measured by script over `app/hub`, `app/api/hub`, `components/hub`.

| | ifac | innergathering |
|---|---|---|
| Hub pages / API routes | 16 / 29 | 15 / 18 |
| Lines (pages · API · components) | 3,349 · 2,036 · 3,382 | 1,936 · 1,359 · 1,342 |
| Layouts | `cards2` (default since 2026-10-18), `classic`, `site` | `site` (default), `classic`, `cards2` |
| Gate on `/api/hub/*` | `getHubViewer` 16, `getApiMember` 6, `getApiEditor` 11 | `getApiMember` 14, `getApiEditor` 10 |

Only these two apps offer the layout toggle. Which layout members use is unknown:
the `hub_view` cookie is not logged.

Correction to the 2026-10-18 overlap figures: those counted comments. Compared
with comments removed, 9 of the 35 files shared by path have identical code
(`meeting/rota`, `meeting/record`, `email/addresses`, `email/identity`,
`email/messages/[id]`, `email`, `forum`, `whiteboard`, `EmailSuiteHost`). Most
of the routes in between differ by the gate call plus ifac's series handling
(`meeting/attendance`, `email/[key]`, `/test`, `/preview`). Business logic is
already in `@elkdonis/services`; what repeats is the wrapper. 25 route factories
exist for the same purpose (`createThreadAdminRoutes`, `createGatherRoutes`,
`centerRoutes`, `calendarRoutes`, …), so moving the identical routes is
mechanical. Not started.

Findings on `/api/hub/threads/[id]`, the read behind every popup (read from
code unless marked):

| Rule | ifac | innergathering |
|---|---|---|
| Honours the audience rule (`canViewThread`, `min_role`) | No: own SQL and own check; any guide could read an owners-only or author-only thread. No such ifac thread exists (query, 2026-11-04), and `apps/ifac/src` never sets `min_role` | Partly: `getThreadById` checks it, then the route applies a second check that omits `INVITE_ONLY`, so a `member` gets 404 in the popup on a members-audience post. 2 published posts are affected; the post's own page works. Not run signed in |
| Hides `document_url` from non-members | Yes (`isMember ? … : null`) | No: passed through `lib/surface-thread.ts:57`. A follower may read `ORGANIZATION` threads, so a follower receives the link |

- Security item: the `document_url` of a living document is a public writable
  share, per the comment in `apps/ifac/src/app/api/hub/documents/route.ts`. Anyone can sign
  up at elkdonis-arts.org and hold `viewer` (18 do). 3 published `ORGANIZATION`
  threads in `inner_group` carry such a link (2 meetings, 1 document). Signed-out
  request returns 404 (verified through the edge, one thread). The follower case
  is read from code, not run: no test account was created. The same line is in
  amrit-canada, sunjay and elktours; their routes were not read. Not fixed.
  - Correction and fix, 2026-11-04 (source only, not committed, not deployed).
    The exposure was wider than the hub popup, so "one line in each route" (question 4)
    was wrong. Read from code: the thread pages render the link for followers
    (`ThreadView`, "Workspace"); list rows carry it to the browser as props of the
    client component `ThreadCard`; `getForumThread` returned it to anyone who can
    read the thread; arts-collective `api/org/[slug]/threads/[id]` returned it to any
    role.
  - Changed: `lib/data.ts` in innergathering, amrit-canada, sunjay and elktours
    (`mapThread` sets null; `withDocumentLink` restores it on single-thread reads for
    members); `packages/services/src/forum.ts` (`getForumThread`: org members, global
    admins, the author); the arts-collective route (null for `viewer`);
    fourthwayBookreaders `[feed]/[slug]/page.tsx` (hidden from people with no role).
    hidden-enneagram never passed the link. ifac's hub route was already correct; its
    forum page gets the fix through services.
  - Kept: Fourth Way gives the link to followers, per the owner's decision of
    2026-09-26 (`circle-page.ts:203`). In the forum, a Fourth Way follower no longer
    gets it.
  - Verified: `check-types` reports no errors in the six changed apps (run before the
    helper was moved below `mayRead`, an order-only change). Not verified: any
    runtime behaviour; a rebuild is needed and no follower test account exists.
  - Published threads carrying a link (query, 2026-11-04): inner_group 3, amrit_canada
    2, ifac 2, fourth_way_book_readers 1; all `ORGANIZATION`.
  - Deployed 2026-11-04 12:22 EST on amrit-canada only (build `VbYAtabmh-cAf3pg-0AT5`;
    recreated with `JWT_SECRET`; previous build in
    `~/eac-backups/next/amrit-canada-20261104-1221.tgz`). Held at the developer's
    request: innergathering (3 threads carry a link; 18 followers) and arts-collective
    still serve the old code. Sunjay, elktours, ifac and fourthway not rebuilt.
  - Verified 2026-11-04 through the edge on amrit-canada, two threads, with a temporary
    password account (removed; 0 rows left in `users`, `auth.users`,
    `user_organizations`, `org_profiles`): popup API returns 404 signed out and with no
    role; 200 with no link as follower; 200 with the correct link as member.
    `/api/hub/documents` 403 for follower, 200 with link for member. Thread page and
    feed list carry no link for any of the four. A real password session authenticates
    with token checking on; a forged cookie gets `{"user":null}`. No errors in the logs.
  - Not verified: forum gating at runtime. The forum page carried no link for the
    member either, so that test does not separate the two cases (the sample threads are
    a post and a document); `getForumThread` is read from code. Google sign-in not run.
    The thread page's "Shared document" button was not exercised: amrit-canada has no
    published meeting with a link.
  - Open: links followers may already have stay valid until the Nextcloud shares are
    replaced; whether any were opened is unknown. Latent, no live rows:
    arts-collective `lib/org.ts` (`getOrgFeed`, `getOfferingThread`, `getFeaturedThread`)
    and `packages/silex-render/src/queries.ts` select `nextcloud_doc_url` on public
    queries; no published `PUBLIC` thread has one.
- Join links: `/api/hub/threads/[id]` returns `meetingUrl` and `talkToken` to
  signed-out visitors for `PUBLIC` meetings (verified through the edge: ifac 1,
  innergathering 2; values not recorded). On innergathering the public page
  carries the same values (verified), so the route exposes nothing extra there.
  ifac's public page was not compared. Whether public meetings should show the
  link is a developer decision.

Other differences:

- Only ifac: series planner, group research and ideas, meeting history, email
  reply, per-series letters, document delete, `/hub/profile`, appearance and page
  sections cards.
- Only innergathering: `/hub/newsletter`, `/hub/publish`, `/hub/organization`,
  framed Nextcloud Files and Talk, whiteboard export to Nextcloud, Cloud, Gallery
  and Email faces, audience choices in compose.
- `lib/hub-auth.ts` (`getHubViewer`) admits the same roles as `getApiMember` and
  runs two role queries instead of one. ifac is the only app with it (24 files).
- Calendar: ifac uses cms-ui `HubCalendar`; innergathering, amrit-canada, elktours
  and sunjay carry local `CalendarGrid` + `CalendarPageView`. Features not compared.
- Breadcrumbs: ifac has `HubPageShell` (wraps the shared `HubPageFrame`, 9 files)
  and a separate local `HubCrumbBar` (6 files). Not compared.
- innergathering `/api/hub/documents` passes `authorName: viewer.email`; a member
  with no display name is listed by email address. ifac does not pass it.

Questions for the developer (2026-11-04):
4. ~~Fix the `document_url` exposure now?~~ Answered yes 2026-11-04; source fix
   above. Rebuilt on amrit-canada; other apps held.
5. Should public meetings show their join link to signed-out visitors?
6. Keep all three hub layouts on both sites, or settle on one?
7. Should document delete and audience choices exist on both sites?

### Area 3: meetings and series (2026-11-04)

Read-only pass; nothing changed. Sources: code, and read-only queries on
`elkdonis_dev`. No signed-in render.

Current state:
- A meeting is one `threads` row. Occurrences of a recurring meeting are computed
  in JS and have no row; `meeting_hosts` and `meeting_occurrence_notes` address one
  by (thread, instant). A series is a `series` thread with one `series_session`
  thread per week (`series_sessions`, migration 203).
- Published on the pair: ifac "Weekly Meeting" and one series; inner_group "Daily
  Online Presence", "Ritual Theatre Labs", "Board Meeting", "General Meeting".
- `/api/hub/meeting/*` exists in ifac and innergathering only. `record` and `rota`
  match apart from comments; `attendance` and `light` differ by auth wrapper, and
  ifac's `attendance` adds a series guard. `history` is ifac only; innergathering
  passes no `history` prop, so its card has no back arrow (read from code).
- RSVP routes: innergathering `/api/rsvp` (guests, `guest_submissions`),
  `/api/threads/[id]/rsvp` (members, payment), `/api/hub/meeting/attendance`. ifac
  `/api/hub/rsvp`, `/api/series/rsvp`, `/api/hub/meeting/attendance`; no guests.
- Series pages, routes, mail and reminders are in `packages/series-site`. Per-series
  letters and mailings remain in `apps/ifac/src/lib/series-letters*` (516 lines), so
  sunjay has series without them.
- The Nextcloud calendar tick for every org runs from innergathering's
  `instrumentation.ts`; hubs also refresh on open.

Findings:
- Reminders on elkdonis-arts.org. **The form's "Email me a reminder beforehand" box
  (ticked by default) has no sender behind it.** 15 of 15 guest RSVPs on inner_group
  ticked it, the latest 2026-11-04. Nothing reads guest rows for this org: the
  retired app's tick read `thread_rsvps` only, and innergathering's tick mails hosts
  only (`apps/innergathering/src/lib/reminders.ts`). Members have had no attendee
  reminder since the retired app stopped 2026-10-10 (last send 2026-09-27; that tick
  covered only the first date of a recurring meeting).
- amrit-canada, sunjay and elktours mail guests, from near-identical copies of
  `lib/reminders.ts` (6 and 12 differing lines) with no occurrence expansion, so a
  plain recurring meeting is reminded for its first date only. Series reminders on
  ifac sent through 2026-11-03.
- The meeting record (`note`, `attended`; `/api/hub/meeting/record`) has 0 rows with
  content in any org. Host light: 1 thread (inner_group).
- Used only by `apps/inner-gathering` and `apps/admin`: `services/src/meetings.ts`,
  `packages/ui` `MeetingForm` and `hooks` `useMeetingForm`. Used only by
  `apps/inner-gathering`: `services/src/calendar-sync.ts`. No caller: `packages/ui`
  `RsvpForm`.
- A guest RSVP names no date (`guest_submissions` has no occurrence column); the
  count drops it after the current cycle (`getAttendanceCount`).
- The aliases for a series stored as `meeting`/`event` have no rows left to serve
  (2 series with `metadata.series`, both kind `series`).

Reminder fix (2026-11-04, source only, not live; innergathering rebuild held):
- `packages/services/src/attendee-reminders.ts` (new; exported from `index.ts`) and
  `runAttendeeReminderTick` in `apps/innergathering/src/lib/reminders.ts`, called from
  `instrumentation.ts`. An RSVP is good for the next occurrence after it was made.
  Members need status `yes`; guests need an address and the box ticked. Left out:
  addresses unsubscribed in `contacts`, occurrences with a red light or a cancelled
  cycle. Guests get the join link on `PUBLIC` threads only.
- Verified: `check-types` passes in innergathering. Selection run at chosen moments
  (read-only, counts only): the window opens and closes as expected; 2026-11-04 21:00
  Daily Online Presence gives 1 member and 1 guest, matching a separate SQL count. The
  second ledger claim returns nothing (`BEGIN … ROLLBACK`). Letter rendered, not sent.
- Not verified: a real send; the red light, cancelled cycle and unsubscribed exclusions
  (no matching live data; not written to production to test them).
- amrit-canada, sunjay and elktours keep their own copies; they could call this service.

Open questions:
- Keep or remove the meeting record.
- Is ifac "Weekly Meeting" still wanted beside the series.
- Remove `apps/inner-gathering` and the code only it uses.

### Area 4: email suite (2026-11-04)

Read-only pass; nothing changed. Sources: code, read-only queries, signed-out requests
through the edge. No signed-in render.

Security, open:
- **Any signed-in person can read any org's address book and inbox on
  arts-collective.com (read from code, not exercised signed in).** `/api/org/join` is
  ungated and grants `viewer`. `guardOrgEmail`
  (`apps/arts-collective/src/lib/email-suite.ts:52`) accepts any role, and
  `GET /api/org/[slug]/email` and `/email` return `loadEmailSuite`: `listAddressBook`,
  `listInbox` (40 messages, `SELECT *`, bodies included), recent activity. ifac and
  innergathering allow owners and guides only. Signed out: 404 (verified). Whether it
  has been used: unknown. Stored messages: ifac 16, amrit_canada 1.
  2026-11-04: fixed and deployed. `guardOrgEmail` now admits owners and guides only; the
  `/email` switcher lists only those orgs. arts-collective build `dEph4kxiD-uji06oJY5Cw`,
  restarted. Verified through the edge with a temporary password account on amrit-canada
  (removed; 0 rows left in `users`, `auth.users`, `user_organizations`, `org_profiles`):
  signed out, no role, follower (joined through `/api/org/join`) and member all get 404
  on the API and preview, and no org data on `/email`; guide gets 200 with inbox and
  address book. tenant-smoke 9/9. No `.next` backup was made of the replaced build
  (`cRSV_4Wf8M07goYVNzdU8`): a script error. Latest backup is
  `~/eac-backups/next/arts-collective-20261102-1205.tgz`.
  Edge logs (NPM, 2026-11-04; arts-collective.com requests kept only for October and
  November 2026): no 200 on `/api/org/*/email` except this test, `/api/org/join` posted
  only by this test. `/email` 200s: 2026-10-09, one client, 31 requests in 2 seconds, link
  prefetches for 15 orgs, so an account holding roles in all of them; 2026-10-31, one
  request, role unknown. Nothing in those logs shows the hole being used; before October
  unknown.
- `GET /api/org/[slug]/files` still admits followers: the same temporary follower got 200
  with 3 top-level entries from the amrit-canada team folder (names not read). The gate
  (`route.ts:42`) says this is intended, but `/api/org/join` makes it open to anyone.
  `path` is any subpath of the org root, so `Private/` names can be listed (read from
  code). File contents go through `canReadMedia` (not tested). Closed 2026-11-04, see
  "Follower access" below.
- `POST /api/email/events` accepts unsigned events: `SENDGRID_EVENT_PUBLIC_KEY` is unset
  (verified on `eac-arts-network`; an empty POST through the edge returned 200). A forged
  event can mark an address unsubscribed (`ledger.ts`).

Current state:
- Shared suite (`@elkdonis/cms-ui/email`): ifac `/manage/email`, innergathering
  `/hub/email`, arts-collective `/email?org=`. Of 9 paths shared by ifac and
  innergathering, 4 route files are identical; the others differ mainly by ifac's series
  letters and page layout.
- amrit-canada, sunjay, elktours use an older per-thread surface: `EmailSurface.tsx`
  (373 lines) and `lib/email-template-settings.ts` are identical in all three.
  `trigger-email` has four copies, innergathering's 111 lines and the others 158-162.
- Only ifac can reply from the org's address (`api/hub/email/reply`); innergathering has
  no `sendReply` connector, so its Inbox falls back to `mailto:`. The reply route also
  calls `recordSend`, which `sendEmail` already does, so a reply is logged twice.
- innergathering's test send omits `bodyFont` and `chrome`; ifac's passes them.

Use (2026-11-04):
- `email_sends`: 168 rows since 2026-09-18 (inner_group 73, ifac 67, sunjay 24, elkdonis
  4). All `queued`; `email_events` has 0 rows, so delivered and bounced are never recorded
  and bounced addresses are not suppressed. The SendGrid Event Webhook has not delivered.
- `email_inbox`: ifac 11 enquiries and 1 spam unread, 4 read, latest 2026-11-03;
  amrit_canada 1 unread from 2026-09-21; inner_group 0. `kind='contact'` sends on ifac end
  2026-09-21, so no reply has gone through the site since.
- Newsletter: 0 stored drafts in any org, 0 `newsletter` sends, 0
  `reading_newsletter_issues`. Recipients come from `contacts` only (inner_group: 12
  subscribed), not the merged address book.
- Stored letters: ifac none. inner_group: `rsvp-guest` layout, a `welcome` row, and 3
  thread-specific rows on archived threads.

Open questions:
- Connect the SendGrid Event Webhook (dashboard, developer) and refuse unsigned events.
- Who reads the ifac inbox.
- Keep or park the newsletter editor.
- Move amrit-canada, sunjay and elktours to the shared suite.

### Follower access on arts-collective (2026-11-04)

A follower (`viewer`) is anyone with an account: `/api/org/join` and Follow grant the role
without approval. 25 such rows existed on 2026-11-04, 18 of them on `inner-gathering`.

Found by a temporary follower through the edge, before the fix (values not printed):
- `/hub/organization?org=<slug>` sent the org's roster addresses and draft ids to the
  browser (amrit-canada: 2/2 addresses, 4/4 drafts). `OrgConsoleHost` is a client
  component and received the whole `ConsoleState`, which also holds form responses and
  the published list. Plain members received it too.
- `GET /api/org/[slug]/files` listed the team folder, `Private/` names included.
- `GET /api/org/[slug]/threads/[id]` tested status only, so any role read a members-only,
  owners-only or only-me thread by id (read from code; not run before the fix on the
  restricted rows).

Changed, deployed 2026-11-04 (build `KtYiwkFGPywjkBtCiT2B-`, built 00:41 UTC 2026-11-05):
- Files route refuses `viewer` (`files/route.ts`). `ConnectionsBand` shows a follower only
  "My files" and no service counts.
- Non-editors get `EMPTY_CONSOLE_STATE` (`lib/org-console.ts`); the surfaces that read the
  state open only from editor bands.
- Thread route applies `canViewThread` with `min_role`, pen names and platform admins.

Verified through the edge after the rebuild, temporary account, on amrit-canada and
inner-gathering; statuses and counts only, no content printed; account removed, 0 rows:

| Role | Addresses in hub HTML | Team folder tab | Files API | Members-only thread | Owners-only thread | Followers thread |
|---|---|---|---|---|---|---|
| none | 0 | no | 403 | 404 | 404 | 404 |
| follower | 0 | no | 403 | 404 | 404 | 200 |
| member | 0 | yes | 200 | 200 | 404 | 200 |
| guide | all | yes | 200 | 200 | 404 | 200 |

tenant-smoke 9/9, check-types 0, no error lines in the container log after restart.
Backup of the replaced build: `~/eac-backups/next/arts-collective-20261104-1939.tgz`.

Unknown: whether anyone read this data. Edge logs (October and November 2026) show 495
hub page 200s from 60 clients and 71 files API 200s from 8 clients, and hold no role, so
followers cannot be told from owners. Before October unknown. Addresses already read
cannot be recalled.

Not tested: an owner account after the change; the owners-only thread for its owner or
author; only-me threads (`elkdonis`, `fourth_way_book_readers`).

Open:
- A guide still sees the title and id of owners-only and only-me threads in the console's
  published list (`loadPublished`: 3/3 restricted ids in the guide's HTML on
  inner-gathering). The body stays refused.
- `listOrgEventsInRange` and the calendar route do not test audience: an `INVITE_ONLY`
  event would list with its join link to a follower. 0 such rows on 2026-11-04.
- Other routes were not audited for the follower case. Same pattern to check on the other
  apps' hubs, not only arts-collective.

### Area 5: manage console (2026-11-06)

Read from code and data on 2026-11-06; nothing changed except the page gates recorded in
the next section.

| | ifac `/manage` | innergathering `/manage` |
|---|---|---|
| Gate | `requireIfacManager`: `ownerEmails` allow-list, network admins, owner/guide | `requireOrgEditor`: owner/guide |
| Tabs | Overview, Artists & dealers, People & access, Site copy & events, Submissions, Email, Store, Appearance, Cloud storage, Visitors | Content, Pages, Site copy, People, Video, Center; Visitors for owners |
| Where content is written | the hub (compose adapter); no content tab | here: list, `content/new`, `content/[id]`, attendee roster; the hub's Compose card lands on `/manage/compose` |
| Shared parts | email suite (`@elkdonis/cms-ui/email`), visitors (`@elkdonis/analytics`) | the same two |

Use (data, 2026-11-06):
- ifac Site copy & events: 3 `org_site_sections` rows, last saved 2026-05-31.
- innergathering Site copy (`/manage/pages`): 0 `org_site_sections` rows for `inner_group`
  or `elkdonis`: never saved. The landing's words are edited on the page instead
  (`page-edits:home`, live) and the canvas (`puck:landing`, source, unsaved).
- innergathering Video: 1 pipeline. ifac Submissions: queue off by default (migration 156);
  ifac Cloud: owners only, off until the network admin switches it on.
- Edge logs: each tab drew 45-85 loads on 8 (ifac) or 12 (innergathering) days, nearly the
  same number per tab; consistent with the tab bar's link prefetch, so not a measure of use.

Overlaps:
- One org's people and roles are changed from four screens, all through `setOrgRole`, with
  three rules:

| Screen | Who may change roles | May grant owner |
|---|---|---|
| ifac `/manage/people` (`lib/manage.ts:174`) | owner, guide, allow-list, network admin | no; owners untouchable |
| innergathering `/manage/people` (`cms/actions.ts:529`) | owner only | yes |
| `/center` org section on ifac and innergathering (`services/org-people.ts:121`) | owner, guide | no; owners untouchable |
| arts-collective `/hub/organization` (`api/org/[slug]/members/[userId]`) | owner only | yes |

  A guide of `inner_group` is refused on `/manage/people` and allowed on `/center`.
- Site theme: ifac `/manage/appearance` and arts-collective `/hub/organization` settings.
  Email: each `/manage/email` and arts-collective `/email`. Identity: arts-collective settings.
- innergathering has two "new item" entries, `/manage/content/new` (content list, calendar
  "Add a gathering") and `/manage/compose` (the hub's Compose card, shared sheet).
- innergathering's landing copy has three editors (above); saving `puck:landing` freezes
  the `/manage/pages` copy.

### Console pages served to signed-out visitors (2026-11-06)

Found while checking the other sites for the follower gap. Each console gates in its
layout only (`requireOrgEditor`, `requireIfacManager`, `requireAdmin`). Next renders the
layout and the page in parallel, so a page without its own check streams its data in the
body of the 307 to `/login`; a plain signed-out GET is enough.

Verified 2026-11-06 through the edge, signed out, counting distinct addresses in the
response (none printed or kept):

| Site | Page | Addresses |
|---|---|---|
| elkdonis-arts.org | /manage/people | 42 |
| market.arts-collective.com | /admin/users, /admin/orders, /admin/money | 41, 5, 1 |
| ifacgroup.com | /manage/directory | 19 |
| paratheater.arts-collective.com | /manage/people | 5 |
| amritcanada.ca | /manage/people | 4 |
| elkdonisexperiences.com | /manage/people, /manage/schedule | 3, 2 |
| hiddenenneagram.com | /manage/contacts, /manage/orders | 1, 1 |

Content lists, drafts, the market's money, stores and visitors pages are open the same
way; elkdonis-arts.org/books has 8 such pages without addresses. Pages under `[id]`
(attendee lists among them) were not fetched; same pattern (read from code).

Edge logs, October-November 2026: 460 signed-out 307s on these paths, mostly scanners
(`/admin`, `/.env`); none on the address pages above except
`hiddenenneagram.com/manage/contacts` (16 requests, 1 contact row). RSC requests return
200 and cannot be told from editors' navigation. Before October unknown.

State 2026-11-06: page-level gate added in source to 80 pages (`await <gate>()` first in
each page, comment dated) in innergathering, ifac, amrit-canada, sunjay, elktours,
fourthwayBookreaders, art-auction (`/admin`), hidden-enneagram. check-types 0 in all
eight. **Not rebuilt: the leak is live on all eight sites until each app is rebuilt.**
The developer chose notes only (2026-11-06). Rebuilds ship each app's uncommitted work;
innergathering, ifac and sunjay rebuilds were held for other reasons; another session
edited elktours files within 3 hours of the check. art-auction `/studio` pages without a
check are per-user and were left unchanged.

Not done: server actions and route handlers in these consoles were not audited for the
same reliance on the layout.

### Follower audit, other sites (2026-11-06)

Read-only code audit (subagent) plus a data check. No other site sends rosters to
followers; hub, manage and file gates exclude `viewer` (`getViewer` `isMember`,
`getHubViewer`). Open, in code, with the data on 2026-11-06:

| Finding | Where | Exposure today |
|---|---|---|
| `loadSeries` ignores audience (`meeting-series.ts:599`) | ifac, sunjay series pages | none: no non-public series rows in either org |
| join link to any role; "I'm coming" grants viewer (`series-site/src/lib/series.ts:129`) | ifac, sunjay | by design (developer, 2026-10-10) |
| RSVP by id ignores audience; confirmation mail carries the meeting URL (`api/threads/[id]/rsvp`) | innergathering, amrit-canada, sunjay, elktours | none: no restricted thread has RSVP on |
| same RSVP route; a yes RSVP opens the Akhand Path reader (`lib/paath.ts:188`) | fourthwayBookreaders | unknown: one INVITE_ONLY reading group with a link, RSVP off; whether the route checks RSVP-enabled not read |
| circle `Private/` files and recordings to followers (`circle-file` route, `circle-page.ts:205`); RSVP grants viewer | fourthwayBookreaders | developer decision ("owner's call, 2026-09-26") |
| "members only" event block gives followers Talk and meeting URLs (`lib/puck/data-event.ts:59`) | sunjay | data not checked |
| PUBLIC thread in a members-only feed opens by id, signed out (`api/hub/threads/[id]/route.ts:33`) | hidden-enneagram | one members-only feed; contents not checked |

Lower: guides read owner-only and only-me threads in the thread-by-id routes of ifac,
innergathering, amrit-canada, sunjay, elktours; ifac members see INVITE_ONLY meetings in
`hub/meetings/[slug]`.

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

- Rebuild the eight apps carrying the console page gates (2026-11-06; leak live until then).
- Whether reading-circle `Private/` files and join links should stay open to followers.
- One rule for role changes across the four screens (area 5).
- Keep innergathering's Site copy tab, given three landing editors (area 5).
- One "new item" path in innergathering, or both (area 5).
- Whether the shadcn files in `components/ui/` are still wanted at all in
  template-stack apps, given cms-ui and primitives.

## History

- 2026-11-04: area 1 rechecked; area 2 (hub) recorded. No code changed.
- 2026-11-04: document link gated in source across six apps and services; deployed on amrit-canada only.
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
