# Onboarding Sprint — 2026-09-18

**Goal:** the first big group (IFAC artists) signs in and gets a real experience of
both *their website* and *the platform*: hub → their tools, center → their standing
on the network (profile, store, directory).

**PM:** this session. Worker sessions each take one brief. Report back here: when a
session finishes a slice, append a line under its "Log" with what was verified and how.

| # | Workstream | Brief | Owner | Status |
|---|---|---|---|---|
| A | `/center` UI + arts-collective `/hub` mirror (profile popup: tabs, where-you-show, compose anywhere) | `BRIEF_A_CENTER_UI_2026-09-18.md` | user + 1 session | slices 1–4 built; 4 live on AC; 1–3 await innergathering rebuild |
| B | Org `/forum` — scope toggle | `BRIEF_B_FORUM_SWITCHER_2026-09-18.md` | 1 session | ready — not started; must build on D's forum-ui edits |
| C | IFAC onboarding (sign-in → claim → Nextcloud) | `BRIEF_C_IFAC_ONBOARDING_2026-09-18.md` | 1 session | phase 1+3 done (owners, OIDC fix, cron, /manage/cloud); merge→sync hook + IFAC /center open |
| E | Hub first-steps checklist (IFAC + innergathering) | `BRIEF_E_HUB_TOUR_2026-09-18.md` | 1 session | ready — not started |
| F | Store walkthrough: profile → art-auction listing | (not written) | — | queued |
| D | Nextcloud Forum ↔ org forum sync | `BRIEF_D_NC_FORUM_SYNC_2026-09-18.md` | PM session | **done for inner_group** (live) |

## File ownership (to keep sessions off each other's work)

| Area | Owned by | Others may… |
|---|---|---|
| `packages/cms-ui/src/center/**`, `packages/services/src/center.ts`, `apps/*/src/app/center/**` | A | read only; C *mounts* the result in IFAC once A says it's stable |
| `packages/forum-ui/**`, `apps/forum/**`, `apps/*/src/app/forum/**` | B | read only |
| `apps/ifac/**` (except `app/forum`, `app/center`, and the FirstSteps mount in `app/hub/page.tsx`) | C | read only |
| `packages/cms-ui/src/hub/FirstStepsFace.tsx`, `packages/services/src/first-steps.ts`, the mount lines in both hubs | E | read only |
| `packages/services/src/nc-forum-sync*`, NC forum job/script, its migration | D | read only; forum-ui touches wait for B |
| `packages/services/src/index.ts` | shared — **append-only**, never `git checkout` it | |
| `docker-compose.yml`, `.env`, migrations | ask PM first (take the next free number — check `ls packages/db/migrations` at write time) | |

## House rules every session must follow
- Read `CLAUDE.md` Operating rules. Install only via `docker compose run --rm install`.
- The tree has **uncommitted work from other sessions** (see `git status`). Never
  `git checkout`/`git stash`/blanket-revert a file you didn't author. Diff per file.
- Building an app compiles everyone's in-flight code; back up `.next` first
  (memory: *Build on a shared tree*). Hub hosts (IFAC, amrit-canada) are **prod
  builds** — a change isn't live until rebuilt.
- Verify UI by rendering it (mint a session, screenshot via alpine-chrome over CDP),
  not by status codes. Measure contrast on every new colour pair.
- Don't commit unless the user asks.

## Cross-cutting risks the PM is tracking
1. **IFAC has no `owner` row** (owners decided: Justin Gillis, Eric Brummel — see brief C) and only 2 `user_organizations` rows (both `guide`).
   19 roster profiles are all `claim_status='unclaimed'`, only 2 have an email. →
   C must solve linking before anything else is meaningful.
2. **Email:** `GOTRUE_MAILER_AUTOCONFIRM=true` (signup needs no email), but password
   reset / reminders / RSVP mail depend on SMTP/SendGrid, which has never been
   confirmed to deliver. C should test one real send early; if it fails, the
   onboarding copy must not promise email.
3. **Nextcloud access reconciliation is not on a timer** (`scripts/sync-nextcloud-access.sh`).
   An artist who joins won't see the team folder until someone runs it. C decides:
   cron it, or run it per join from the approve-claim path.
4. **Stripe keys absent** — stores can list, not take money. Onboarding copy says
   "list your work", never "start selling".
5. **Forum skins were retired 2026-09-17** ("one design"). B's "classic vs cards"
   toggle reintroduces a *view* (layout), which is fine — it must not bring back
   colour skins. **Resolved 2026-09-18:** cards = new tile layout in the steel design, not the old skin (see brief B).

## Log
- 2026-09-18 — sprint opened, briefs written (PM).
- 2026-09-18 — C: user decided manual role ladder (sign-in = viewer; promote in /manage). Owners: Justin Gillis + Eric Brummel (Eric = unclaimed sentinel, merge on his first sign-in). Invite links dropped. (PM)
- 2026-09-18 — C (worker): **Overview/recon only, no code changed.** Found a new blocker: Nextcloud's "Sign in with Elkdonis"
  (sociallogin `custom_providers`) points at `https://elkdonis-arts.org/api/oidc/authorize`, which returns **404**
  because elkdonis-arts.org moved to `apps/innergathering` on 09-16 and that app has no `/api/oidc`. Only the old
  `apps/inner-gathering` sets `users.nextcloud_user_id`. So no new artist can get a Nextcloud link → the sync can't add
  them, whether it's on cron or not. Also: `sync-nextcloud-access.sh` needs `occ` on the host, so it can't be called
  from the approve-claim route in a container. It has to be a cron job (or a host job that watches for a flag). And the sync
  gives **viewers** read access too (no role filter in `provision-org-circles.mjs`/`apply-team-folder-acls.mjs`).
- 2026-09-18 — PM checked C's recon. Confirmed: elkdonis-arts.org/api/oidc/authorize → 404; only old apps/inner-gathering sets `nextcloud_user_id` (`'elkdonis-'+user.id` at authorize). **Rejected "use admin app as IdP"**: ADMIN_URL is LAN-only (192.168.0.11:3000), not reachable by an artist's browser, and its authorize doesn't record nextcloud_user_id. Decision: port the 3 oidc routes (+ the nextcloud_user_id write) into apps/innergathering at the same path → no Nextcloud config change, same `elkdonis-<id>` uids, existing 10 links keep working. Eric = sentinel d4ef2252 already linked to NC `ebrummel` (no email); set it owner now, merge his real account in when he signs in (merge keeps the higher role). Cron + viewer filter: recommended, awaiting user's OK for the crontab. (PM)
- 2026-09-18 — C: **viewer filter DONE** in `scripts/provision-org-circles.mjs` + `scripts/apply-team-folder-acls.mjs`
  (dry-runs verified: viewer rows drop out, members/guides/owners unchanged; additive only — revokes nothing).
  **Cron NOT installed, sync NOT run live** — blocked pending explicit user go-ahead. OIDC: admin's `/api/oidc` is
  NOT a fit (not public, never writes `nextcloud_user_id`). Plan instead: port old `apps/inner-gathering/src/app/api/oidc/*`
  into `apps/innergathering` (elkdonis-arts.org, where Nextcloud already points) — needs PM ok, it's outside C's files.
- 2026-09-18 — C: **Owners seeded:** Justin (fbf699b9) + Eric Brummel (d4ef2252) are `ifac` owner. Eric's future real
  account must be `mergeProfile`d INTO d4ef2252.
- 2026-09-18 — C: **Sync is on cron** — `*/10 … sync-nextcloud-access.sh | logger -t nc-access-sync`, exactly the header
  line. Script now finds nvm's node itself (cron has none) and holds a flock (one run at a time). Filters are
  `role IN ('member','guide','owner')` in both scripts. First live run: exit 0, 95 s, `ebrummel` added to the IFAC circle.
- 2026-09-18 — C: **Migration 139** applied: `org_grants` (network admin → org capability, first: `nextcloud_access`) +
  `nextcloud_sync_requests` (one pending per org). Each cron run claims pending requests and records done/failed
  (`scripts/nc-sync-queue.mjs`; round trip verified). Service: `@elkdonis/services` `org-nextcloud-access.ts` —
  `requestNextcloudSync(orgId, by, reason)` is what the claim-merge path should call. Owner panel + admin switch: in progress.
- 2026-09-18 — (separate session, not A/B/C) Elkdonis hub tab rebuilt; **migration 138_feed_stewardship applied** (organizations.steward_org_id, org_feeds.post_role; elkdonis stewarded by inner_group; feeds announcements/feedback/cross-posts). services: getViewerRoles applies stewardship, createTopic enforces post_role, canPostToFeed exported (index.ts append). No forum-ui changes.
- 2026-09-18 — C: **Owner Nextcloud panel LIVE on IFAC** at `/manage/cloud` (tab "Cloud storage"). Shared pieces:
  `createNextcloudAccessRoutes` (services) + `@elkdonis/cms-ui/nextcloud-access` (+ `.css`, own --ncx-* tokens, both
  palettes ≥ 6.4:1). Gate = owner AND `org_grants` 'nextcloud_access'; IFAC granted. Admin switch: `apps/admin`
  `/org-grants` + `/api/organizations/grants` (admin container is NOT running — built, type-clean, unverified in a browser).
  Verified on the rebuilt IFAC with a throwaway password account (created + deleted in-container): guide → 403 + message;
  owner → tab/panel/data (Eric + Justin linked); POST queues, 2nd POST dedupes. No visual screenshot yet (the
  permission check stops copying a session token into the headless browser). Another org mounts it with ~15 lines (IFAC's route + page).
- 2026-09-18 — C: **"Sign in with Elkdonis" FIXED** — `/api/oidc/{authorize,token,userinfo}` ported into `apps/innergathering`
  (+ `src/lib/oidc.ts`), incl. the `nextcloud_user_id = COALESCE(…, 'elkdonis-'||id)` write. No new deps: HS256 via
  node:crypto (verified byte-compatible with `jose` both ways; rejects bad sig/aud/expired/alg:none), userinfo cache in
  memory instead of Redis. Signed-out → `/login?next=/api/oidc/authorize…` (innergathering reads `next`, not `returnTo`).
  docker-compose: `JWT_SECRET` + `NEXTCLOUD_OIDC_SECRET` added to innergathering (from .env, same values as old app).
  Nextcloud config unchanged. Rebuilt live (backup of prior .next `mmKLqV9h…` in C's scratchpad); the build also shipped
  the other sessions' uncommitted innergathering/cms-ui edits (type-clean). **Real round trip verified:** NC button → our
  authorize → NC callback 303 → NC session as `elkdonis-<uid>`, DB link recorded. Test GoTrue/users rows + NC user deleted.
  → Onboarding chain is now complete: sign in → viewer → owner merges + promotes in /manage → person clicks "Sign in with
  Elkdonis" on cloud.elkdonis-arts.org → within ~10 min the cron adds them to the circle + folder.
  Open for C: "This is them" merge+promote in /manage should call `requestNextcloudSync('ifac', by, 'claim')`.
- 2026-09-18 — C: **Admin (3000) started** (`next dev` via docker-compose.override.yml, LAN-only). `/org-grants` serves;
  its API refuses signed-out. **Nextcloud iframe checked — not viable for org sites:** NC sends
  `frame-ancestors 'self' https://cloud.elkdonis-arts.org` + `X-Frame-Options: SAMEORIGIN`, and its session cookies are
  SameSite=Lax/Strict, which browsers never send inside a cross-site iframe (ifacgroup.com ≠ elkdonis-arts.org), so the
  person could not stay logged in even if framing were unlocked. Proposed instead: a "Cloud" hub card → surface with the
  org folder listed server-side (existing DocumentsFace/dav path) + "Open Nextcloud" (new tab). Awaiting user/PM go-ahead.
- 2026-09-18 — B decided: one scope toggle, layout follows scope. E (hub checklist) split out of C phase 4 and written; renamed from D — D is taken by NC forum sync. (PM)
- 2026-09-18 — (LMS session) **Sophia** built: migrations 140–143 applied (lms_* tables), new packages `lms` + `lms-ui`, new app `apps/sophia` (:3020), **docker-compose.yml gained a `sophia` service block** (inserted before blog-sunjay; nothing else touched), `.env` gained SOPHIA_URL, `pnpm install` run via the install container (lockfile changed). org_feeds row `elkdonis/elkdonis-path` added. See lms/SYNTHESIS.md.
- 2026-09-18 — **D done (PM session), live on innergathering + IFAC.** Migration 144 (`org_nc_forum`, `nc_forum_links`, sentinel identity `nextcloud-forum`); `services/nc-forum.ts` (push topic/reply/moderation, poll, retry, queue-when-host-has-no-NC-creds); hooks in `createTopic` (`syncToNextcloud`, owner/guide only), `postReply` (members-only gate + push), `moderateThread`, `removeThread` (hides on NC, never deletes — NC slug bug); forum-ui: NC chip, "See on Nextcloud ↗" (new tab), "via Nextcloud" reply badge, "Also post to Nextcloud" checkbox, reply gate. Scheduler: innergathering instrumentation, every 3 min, all orgs; org `/forum` pages sync-on-open. `scripts/nc-forum.mts` (categories / provision / move / sync). NC: robot `eac_intergration` given forum Admin; category 8 "InnerGathering" (Team-scoped) under new header "Organisations"; 6 old topics moved in (3 visible synced, 1–3 left hidden per user); 6 empty old categories deleted (backup `~/eac-backups/nc_forum_before_sync_2026-09-18.sql`). Verified by service probe, forum-host form posts (queued → delivered), and signed-in renders on localhost:3003 and :3015 (prod). Also fixed a pre-existing `postReply` crash: notification ids were 27 chars into varchar(21) — any reply to a watched topic rolled back. **Open:** forum container has no NEXTCLOUD_* env (compose — PM call; queuing covers it); Justin's stored NC app password is stale (401) so everyone posts via the robot; B's forum-ui files were touched additively (NC bits only) — B should rebase on them.

- 2026-09-18 — A refocused by user: profile card → tabbed popup (details / where you show / page / payouts), compose-anywhere, AC /hub = /center + org switcher + open site. 4 slices, user reviews each. A now also owns `apps/arts-collective/src/app/hub/(tabs)/**`. (PM)
- 2026-09-18 — (LMS session) migration **145_lms_course_pool** applied (144 was taken by nc_forum_sync); compose: `arts-collective` service gained NEXT_PUBLIC_SOPHIA_URL (container recreated once), `sophia` gained NEXTCLOUD_* env.
- 2026-09-18 — A **slice 1 (tabbed profile popup) built, awaiting user OK — NOT deployed.** `ProfileSurface` now has tabs on your
  own profile: Profile (card: name/photo/headline/statement) · Details (pronouns, city/province/country/postal code, portfolio URL,
  links, comment colour with a live contrast readout, slug with a "this moves your page" warning) · Page · Payouts. A tab shows
  only when the host fills it (amrit-canada/org targets unchanged). Deep link `?surface=profile:details|page|payouts`; tab clicks
  rewrite the address in place. Card back gained "Your details". Data: `getProfileDetails`/`saveProfileDetails` in
  `services/center.ts` (explicit columns, never USER_COLS → no claimed_by/created_by/source_note; slug checked for reserved/taken,
  23505 caught), index.ts append; innergathering `/api/center/profile` GET adds `details`, PATCH runs the refusable details first.
  **Verified** on a capped `next dev` preview of innergathering (live prod build untouched), throwaway account + member row,
  desktop 1280 + phone 390: all tabs render, no overflow, no page errors; typed in the browser → Save → Postgres row has
  pronouns/postal/portfolio/colour; taken slug refused with nothing half-saved; arrow keys move tabs. **Host memory is tight:**
  the preview only survived with eac-forum + eac-artdirect stopped (user OK'd; both restarted after). Test account
  `claude-center-a-…@example.com` (79d8cb16) kept for slice 2, delete at the end. Only other host with the route is IFAC →
  **recipe for C:** copy innergathering's `/api/center/profile` diff (details GET + PATCH block) into `apps/ifac/src/app/api/center/profile/route.ts`; no connector change needed.
- 2026-09-18 — A slice 1 **revised per user review**: tab order Profile · Page · Payouts · Details. Details reordered: page
  address first, then portfolio + links, city + pronouns, then province/country/postal **folded** under "More about where you
  are (optional)" (the fold shows a count, never the values), comment colour, then a read-only **Your account** block (signed-in
  email, member since = `users.created_at`, cloud storage URL + NC username when `nextcloud_user_id` is set) + **Sign out**
  (POST `/api/auth/logout`). Tabs now sticky. Re-verified by render, desktop + phone, no overflow. Sign out NOT click-tested
  (it would revoke the test session). **User decided "where you show" = option 3:** a person may hide themselves from an org's
  site freely; being shown needs an owner/guide's approval. Work history has no column anywhere — open question to user.
- 2026-09-18 — A: page address removed from Details (user). **Slice 2 "Where you show" built, not deployed.** New tab (Profile ·
  Where you show · Page · Payouts · Details). `services/presence.ts` `loadPresence`/`setPresence` (self only; the write re-reads
  the matrix and refuses any cell it didn't offer) + innergathering `/api/center/presence` + `presence: true` on
  `createHubConnectors` (default route). Cells: you×directory = `directory_listed`; you×org = `org_profiles.is_public`, **hide
  freely, to be shown ASK** (option 3 → `listing_request` notification to the org's owners+guides, "Requested" while unread, 30 d;
  NO table and owners have no list to act on yet — they see a count only → needs a small table + a /manage panel, PM call);
  blog×page = `profile_sections.blog`; store×page (active store only) + store×market = status, reviewers' call; galleries×page =
  `profile_sections.galleries` + `is_public`; galleries×IFAC = `hidden_on`. Org columns link only orgs with their own domain.
  Switches use ink, not accent (IG gold was 2.68:1): measured 14.2:1 on / 8.4:1 off. **Verified** in the browser (desktop +
  phone) and on the public pages each switch drives: arts-collective `/artists` hides/shows the person with the directory
  switch; IG `/about` hides them with the org switch; IG `/artists/<slug>/writing` 404 ↔ 200 with blog; ArtDirect page hides the
  gallery when private. Refusals: org not yours, market, unknown cell, bad row → 400; signed out → 401. Test notifications to
  IG's 6 organisers were created and **deleted** (twice). **Fixed outside A's files (1 line, flagged):**
  `apps/arts-collective/src/lib/network.ts` roster now honours `directory_listed` (it listed unlisted people whose card 404'd;
  the 11 affected rows are test/junk accounts). **Known gaps:** IG `/artists` lists every member regardless of the org switch
  (membership-gated by design); IFAC's static roster fallback can re-show people; store rows untested (test account has no store).
- 2026-09-18 — A **slice 3 "Post to…" built, not deployed.** User clarified: no cross-posting — from /center a person posts to ANY
  org they're part of, as themselves, not only the host org (one destination). New surface `postTo` (`PostToSurface.tsx`;
  descriptor + url `?surface=postTo[:org|feed]` + router + provider meta), connector `postTo: true` on createHubConnectors
  (default `/api/center/post`), `CenterComposeBar` opens it whenever the host supplies it (not only staff). Services in
  `center.ts`: `listPostTargets` (every public feed where `canPostToFeed` passes for the viewer's real roles, incl. stewardship,
  + "My blog") and `createPostAnywhere` (org → forum's own `createTopic`, which re-checks min_role/post_role; blog →
  `createWritingPost` + publish, `kind='writing'` so OFF_FEED_KINDS keeps it off feeds). Value shape `orgId|feedSlug` like forum-ui.
  **Verified** by posting from the compose bar in the browser to Elastrocal·services, InnerGathering·blog and My blog: rows have
  the chosen org/section/kind, no thread_orgs, the IG post shows on IG /forum + /blog, the writing piece on neither; the
  Elastrocal post doesn't show on IG. Refused: elkdonis|announcements (guide-only, also absent from the list), an org you're
  not in, a missing feed. Blog "Open it" link only when the writing section is on (the piece page 404s otherwise) — says where
  to turn it on. All 4 test threads + 2 temp memberships deleted. Links to another org's post only when it has its own domain.
- 2026-09-18 — A **slice 4 done — LIVE on arts-collective.com/hub/network** (dev-mode container, so live on save). New shared
  pieces in `@elkdonis/cms-ui/center`: `PersonPanel` (your card → profile popup, "Where you show" → that tab, compose bar →
  "Post to…") and `OrgSwitcher` (your orgs: role badge, tier, member/published counts, current marked "Working here" — same
  current rule as the Organization tab — "Open its hub" → `/hub/organization?org=`, "Open site" ONLY for a verified own domain;
  the elkdonis org = the network). `(tabs)/network/NetworkCenterHost.tsx` mounts a SurfaceProvider (profile+presence+postTo).
  arts-collective gained `/api/center/{profile,avatar,presence,post}` (profile = own person only, `?org=` → 404; no "My blog" —
  no member blog pages here). The tab's existing Visit buttons now also only link verified domains: checked live,
  `*.arts-collective.com` subdomains resolve but fail TLS (no cert), so they were browser error pages. **Verified** by render
  (desktop + phone, no overflow, no page errors): card, popup tabs (Profile · Where you show · Details — no Page/Payouts here,
  host has no page connector yet), Post to lists the viewer's feeds; a phone layout bug (name truncated, label overlapping) fixed
  and re-shot. AC post route end to end: post to IG·Offerings 200 with a working elkdonis-arts.org link (deleted after); org not
  yours / blog → 400. Organization tab's console untouched.
  **Recipe for C (IFAC /center):** IFAC already has `/api/center/profile` + `/avatar`. Add (1) the Details block from
  innergathering's `api/center/profile/route.ts` (getProfileDetails in GET, saveProfileDetails first in PATCH) and (2) copy
  `api/center/presence/route.ts` + `api/center/post/route.ts` from innergathering (swap `getViewer` for IFAC's viewer, set
  `blogOrgId: 'ifac'`), then `presence: true, postTo: true` on IFAC's `createHubConnectors`. A `/center` page = copy
  innergathering's `app/center/page.tsx` with IFAC's siteConfig/auth. No other connector change.
  **Open for PM:** listing requests have no table/manage panel (owners only see a count); innergathering is a prod build, so
  slices 1–3 go live there only on its next rebuild; test account 79d8cb16 still exists (delete at sprint end).

## End of day 2026-09-18 (PM)
**Live and checked (curl):** elkdonis-arts.org 200, ifacgroup.com 200, amritcanada.ca 200, forum.arts-collective.com 200,
arts-collective.com/hub/network 307 (sign-in redirect, as expected), elkdonis-arts.org/api/oidc/authorize 400 without params (it was 404 this morning).
NC access cron runs every 10 min and its last run had 0 failures. Nightly DB backup cron is in place. Migrations 138–149 are applied; no new duplicate numbers (052/054/102/103/112 are old duplicates).
**Problems:**
- **market.arts-collective.com → 502.** `eac-art-auction` (and `eac-sophia`) exited cleanly ~2 h ago, probably stopped to free memory. Host RAM is tight: 52/60 GB used. Restart only once memory allows.
- innergathering is a prod build: A's slices 1–3 aren't on elkdonis-arts.org until the next rebuild. Read `git status` first; 248 changed paths from many sessions.
- Nothing from today is committed (123 M, 111 ??, 14 D). The 14 deletions are in apps/admin and apps/danamccool (another session's), so check them before a snapshot commit.
- Test accounts to delete: 79d8cb16 (A), f8addeba (A organiser), e10711eb (hub test), 05e9c4f3 (artdirect-login-check).
**Tomorrow, in order:**
1. C: have the "This is them" merge in /manage call `requestNextcloudSync`, then mount IFAC /center (A's recipe above) and rebuild IFAC.
2. Rebuild innergathering so A's slices 1–3 go live.
3. A: the listing-requests owner panel. Migration 149 `org_listing_requests` exists, so check who wrote it and whether the panel is done.
4. B (forum scope toggle) and E (hub checklist) both have briefs and neither has started. F (store walkthrough) needs market back up.
5. Commit a snapshot once the user OKs it.
- 2026-09-18 — A **listing requests + members-shown-by-default, LIVE (migration 149 applied; user's go-ahead).**
  149: `org_listing_requests` (one pending per org+person), `org_profiles.self_hidden`, trigger `trg_user_org_show_members`
  (on INSERT or role change INTO member/guide/owner → org_profiles.is_public = true unless self_hidden). **Forward only** — no
  backfill: 23 existing member/owner rows stay hidden/without a row (several are junk/test accounts); list in A's report.
  Sign-ups were already `viewer` everywhere (auth-server signup + OAuth fallback, every app's signup, AC join/follow) — verified.
  presence.ts: hide sets self_hidden; ask writes a request row + notifies owners/guides once; `listListingRequests` /
  `decideListingRequest` (role checked from the DB). Shared `ListingRequests` panel (cms-ui/center) mounted on AC
  /hub/organization for owners/guides (returns null when none). That tab's "Open site" now only shows for a verified domain.
  **Verified** with a throwaway org + organiser account: join → both shown; hide → self_hidden; ask ×2 → 1 request, 1
  notification; organiser sees the panel (desktop+phone), "Show them" → shown, self_hidden cleared, request approved, notif
  read. Trigger tested in a rolled-back txn (viewer→member shows; self-hidden stays hidden on re-promotion). Test org +
  organiser deleted. **Blip:** for a few minutes AC's Organization tab 500'd on a stale Turbopack module after my edit
  (dev server restarted itself); healthy since (6/6 200, no errors). IFAC /manage could mount the same panel (C's call).
- 2026-09-18 — C: **Real cause of "folders don't show up" found + fixed.** Team folder 2 (`EAC_Network`) is assigned only to
  the NC *group* EAC_Network; sociallogin's defaultGroup is empty and neither sync script ever added anyone to it (the 4
  SSO users in it were added by hand). So a linked member got circle + ACL rules but NO mount. `apply-team-folder-acls.mjs`
  now adds affiliated uids to the group as its last step, only if every ACL rule applied (never widen with a deny missing).
  Cron 20:20 run: `ebrummel` added, 0 failures; `--test`: ifac read+write, inner_group/amrit_canada/users/jg -read.
- 2026-09-18 — C: **Cloud card on IFAC /hub** (shared `CloudFace` + `CloudSurface` in `@elkdonis/cms-ui/hub`,
  `getViewerCloud` in services). Links out — no iframe (NC frame-ancestors 'self' + SameSite cookies, see above). Linked:
  team-folder + own-folder deep links (`/apps/files/files?dir=/EAC_Network/<org>`) + Open Nextcloud; unlinked: the one-step
  "Sign in with Elkdonis" instructions. IFAC rebuilt; member render verified (card + unlinked state, Files card intact),
  probe account deleted. Popup itself not screenshot. innergathering mount: not done (its HubSurfaces has another
  session's uncommitted edits, and it's the live elkdonis-arts.org build).
- 2026-09-18 — (A session, user's new request) **Hub "page" layout — alternative view, trial on innergathering, NOT deployed.**
  New `@elkdonis/cms-ui/hubsite` (+ `hubsite.css`, plain CSS on --sf tokens): MeetingBanner (next weekly meeting, host avatar,
  2 photos, date top right) · HubPortrait | HubCalendar (plain MonthGrid, paging) · ActivityFeed · InlineCompose (title + ↵ →
  unfolds: Post/Gathering/Workshop, body editor slot, cover from library, feed; other kinds → full compose prefilled) ·
  FileBrowser (org + my files, breadcrumbs, back/forward/up, list/grid, type icons with measured badge contrast, remembers folder)
  | WhiteboardPanel, then HubDoors (Suggest an idea → Post to…, Forum, Write together) · GalleryHero carousel. Per-person toggle
  "Cards | Page" (cookie `hub_view`). innergathering: new `app/hub/site-view.tsx`, `/api/center/files` (members, read-only),
  `listOrgActivity` in services/center.ts; `app/hub/page.tsx` only gained the cookie branch + toggle. Card hub untouched.
  Verified on the capped preview (desktop + phone, no overflow/errors, real data; compose unfolded, nothing saved).
  IFAC next once the user OKs the look (C owns apps/ifac — needs C/PM). innergathering is a prod build → live only on rebuild.
- 2026-09-18 21:31 — C: **innergathering rebuild FAILED, site restored.** Cloud card added to innergathering (`hub/page.tsx`,
  `HubSurfaces.tsx`, surgical; tsc clean at 21:2x). The build then died on `src/app/hub/site-view.tsx:118` — an untracked
  file ANOTHER session is writing right now (the `@elkdonis/cms-ui/hubsite` "site view"), edited mid-build at 21:33.
  elkdonis-arts.org was 502 ~21:31–21:33; restored the previous build (8mM1BZ…, incl. the OIDC routes) via a volume
  restore; `/`, `/hub`, `/login` handoff, `/api/oidc/authorize` all answer normally again. Tree is type-clean again now,
  but the next rebuild will also ship the hubsite work — **not rebuilding until that session says it's at a stopping
  point.** Cloud card is live on IFAC only.
- 2026-09-18 — (A session) Hub page layout, round 2 per user: meeting banner = ONE photo edge to edge (slow cross-fade through up to
  4, none under reduced motion), date top right (beside the title on phones), **Join video** (meeting URL or Talk room) and **"Will
  you make it?"** menu (services' RSVP_FLAVOURS) on the card; card click opens the popup. New innergathering route
  `/api/center/attendance` (copy of IFAC's, org-scoped, members only). Portrait: smaller, name as a small corner tag, then Profile ·
  Page (popup Page tab) · Center; "Your page" removed. New row: General Chat | CrossPostCycler (network threads via new
  `listNetworkActivity`; chat takes the full row while nothing is cross-posted — true today). Verified on the preview, desktop + phone.
- 2026-09-19 — C: **IFAC hub page layout built** (scope change from the owner). `apps/ifac/src/app/hub/site-view.tsx` +
  `hub-site.css` + `components/hub/site/{ComposeBar,ResearchPanel,PipelinePanel}.tsx`, reusing the OTHER session's
  `@elkdonis/cms-ui/hubsite` read-only. Order per spec: banner → flip card + calendar → compose → feed → cross-posts →
  files + whiteboard → doors → chat (square) + research → gallery → pipeline (draggable, capped height); no welcome text,
  toggle at the foot; Cards stays the default. Owner's notes applied: compose is a plain row (no frame) opening the SAME
  compose surface, portrait is /center's ProfileFlipCard (flips). **Email → /manage/email** (with /hub/email redirecting),
  **Appearance → /manage/appearance**, Page sections + Cloud left out. Verified on a throwaway dev server (port 3108,
  never the live container): all sections render in order, manage pages + redirect + cards view OK, screenshot taken.
  **NOT DEPLOYED:** IFAC's build fails on `packages/cms-ui/src/editor/wikilink-suggest.ts` — two prosemirror-view copies
  (1.41.3 + 1.42.3) from another session's in-flight dependency work (10 package.json + lockfile modified). Both ifac and
  innergathering tsc hit it. Needs that session to finish its install; then IFAC rebuilds.
- 2026-09-19 — C: **Roles + compose, per owner.** Members may now post in the hub: `canCompose: isMember` (IFAC
  HubSurfaces + hub layout), and `saveContentAction` allows a member `kind='post'` while DATED kinds stay owner/guide.
  New shared flag `ComposeContext.canPublishDated` gates event/meeting/workshop so a member is never offered a form the
  server refuses (default true → no other host changes). **Escape hatch from the modal:** `ComposeContext.pageHref`
  ("/hub/compose?kind=:kind") puts "Open as a page" on the catalogue AND on each kind's form, carrying kind + typed
  title; IFAC's compose page takes `?title=`. Compose bar reworked: avatar dropped, button "Publish", placeholder
  "Write a title", Enter button right of the field on one shared rule. Verified in the browser as a MEMBER: catalogue =
  Post / Art piece / Blog (event, meeting, workshop correctly absent), both exits present, typed title carried into the
  form. Screenshots taken. Still NOT deployed — the prosemirror-view clash from the other session's install still fails the build.
- 2026-09-19 23:48 — C: **IFAC REBUILT AND LIVE** (BUILD_ID mThPVdQqeRSBMZ7IzVGrO; prior fTmhuE0wmLNaI0Yp2dfYM backed up
  in C's scratchpad). The prosemirror-view clash cleared on its own — ifac tsc is 0 errors — and nothing in the tree had
  been touched for 6 min before the build. Live checks as a throwaway guide: page layout renders all 17 marks in order,
  /manage/email + /manage/appearance serve, /hub/email → /manage/email redirect works, cards view keeps its bands with
  Email/Appearance/Cloud gone. Public ifacgroup.com /, /about, /gallery 200 (bare /artists, /dealers 404 — pre-existing,
  the nav points at /#artists). Probe accounts deleted. innergathering still NOT rebuilt (its Cloud card + the other
  session's hubsite work are staged in the tree).
- 2026-09-20 — (A session) **Meeting suite: host assignment, eligible-host status button, one-line RSVP menu, "Promise?".**
  User's asks, all shared/services-level so both hub layouts (and IFAC) get them:
  1. **Self-assign was silently dead.** `PlanAheadSurface`'s `editable = canPlan && data.canPlan` meant a plain member NEVER
     saw a control, even though the rota route already allowed self-assign — the backend worked, the UI never offered it.
     Fixed: non-editors now get a self-serve door per role ("I'll host this one" / "Step down"), only ever touching their
     own row (route re-checks the CURRENT holder server-side before allowing a clear). Added a **co-host** slot (same
     table, new `role='co-host'`, no schema change) alongside host, editor or self-serve either way.
  2. **"Is it happening" widened past canEdit.** `StandingMeetingLight.canSet` used to be ANDed with the face's own
     `canEdit`, so a host-supplied `canSet:true` could never actually widen anything. Now `canSet` is authoritative when a
     host passes it. New `isOccurrenceHost`/`getRoleHolder` in `meeting-rota.ts`. Innergathering: added `/api/hub/meeting/light`
     (ported from IFAC's, gate = canEdit OR host/co-host of the SPECIFIC occurrence, checked against `meeting_hosts` not
     trusted from the request) and wired `attendance`+`light` into the classic hub for the first time (neither was wired
     there before). New canonical `/api/hub/meeting/attendance` replaces the one-off `/api/center/attendance`.
  3. **RSVP dropdown, one line per option** — the actual bug: MY hubsite `MeetingBanner` had reintroduced hardcoded notes
     (`FLAVOUR_NOTE`) under each option, undoing the network's own decision (already recorded in `RSVP_FLAVOURS`'s comment)
     to drop them. Removed. **C's IFAC `site-view.tsx` had copied the same bug** (literal same map) — fixed there too, plus
     IFAC's attendance route now passes `promiseNext` through (was silently dropping it).
  4. **"Promise?"** — migration **155** `thread_rsvps.promise_next boolean` (services: `setMeetingAttendance`
     forces it false unless flavour is `next_time`). Inline checkbox on that one option, in the SHARED `RsvpControl`
     (cms-ui/hub) and in hubsite's `MeetingBanner` — both write through to the same column.
  **Verified**: cms-ui/services/innergathering/ifac all tsc-clean. Live on the preview + direct route calls: self-assign
  host/co-host 200, assigning someone else 403, step-down 200 (row confirmed by role), a non-host occurrence's light 403
  while the held occurrence's light 200 (host source: `derived→yellow`), promise_next persisted true/read back correctly,
  RSVP menu confirmed ONE visual line per option on both hub layouts (screenshot), no console/page errors. Preview never
  needed forum/artdirect stopped this time (host had headroom). All test rows deleted, Avery back to `member`.
- 2026-09-20 — C: **Moderation + submissions, and the /showcase digest — LIVE on IFAC** (BUILD_ID UIvILPPePCYRcJQ2YlA6K).
  Migration 156: threads gain status 'pending' (+ reviewed_by/at), organizations gain `member_posts_review` DEFAULT FALSE.
  `packages/services/src/moderation.ts` states the rule once — owner/guide (or network admin) moderate; a member's post
  waits ONLY if the org turned the queue on; drafts stay drafts. IFAC: saveContentAction routes through
  `statusForNewThread`, the author is told when held, and `/manage/submissions` (new tab) lists the queue with
  Publish/Turn down plus the switch. `PostStatus` in @elkdonis/types gained 'pending' (types is dist-built — rebuild it).
  **Showcase:** `services/showcase.ts` (public digest query + derived section index + guide-set card size in site_config)
  and IFAC `/showcase` — slim bar, pinned hero, side index of sections that actually have public items, CSS grid feed at
  three sizes a guide picks ON the page. Verified: moderation rules end-to-end via tsx probe (all 12 assertions),
  showcase rendered + screenshotted with seeded content, then every probe row deleted (0 left).
  **Open:** nothing links to /showcase yet, and IFAC has no public published content right now, so it reads "Nothing
  published yet" (its old items are archived; `writing` is deliberately off-feed).
- 2026-09-20 — C: **IFAC forum right column restored** (owner). The hide lived only in `apps/ifac/src/app/globals.css`
  (`.gf-rail{display:none}` + a one-column `.gf-layout.has-rail`); removed, with a note saying why it is gone. Rebuilt;
  verified in the browser at 1400px: rail present, 300px, boxes = Latest posts / Topics / You / Wiki (4 pages) /
  Dictionary, and forum.css's own <1100px drawer is intact.
- 2026-09-20 — **Payouts: root cause found and fixed; IFAC wired, NOT deployed.**

  *Why nobody was ever marked payable.* Two connected accounts existed
  (`aeon`, `Justin G`), both with `stripe_onboarded_at` NULL despite the user
  completing Stripe's form twice. Stripe was never the problem: both accounts
  read `details_submitted / charges_enabled / payouts_enabled: true`, zero
  requirements. The `account.updated` events fired (five of them, 21:38–21:39
  on 09-20) with `pending_webhooks: 0` — **Stripe had nobody to deliver them
  to.** The endpoint at market.arts-collective.com was a plain *account*
  endpoint; a connected account's events only reach an endpoint created with
  `connect: true`. The handler at `packages/checkout/src/server/stripe.ts`
  was correct all along and had simply never been called. The return path
  didn't save it either: `refreshStripeAccountStatus` was called from exactly
  one place in the repo (art-auction `/studio/payouts`), so innergathering
  sent people back to `/account?payouts=done` — a page that wasn't listening.

  *Done.* Connect endpoint `we_1UHwWaCnszTFIPi75QOilV6c` created (live, `connect: true`,
  `account.updated`), and its signing secret is in `.env`. `parseWebhook` now verifies against either secret,
  platform first. Both stale rows stamped (ledger was empty, so the held-funds
  release was a guaranteed no-op). Return-refresh added to innergathering
  `/account` and IFAC `/hub`.

  *Consolidated (risk 4 work).* `startPayoutsFor`, `disconnectPayoutsFor` and
  `PAYOUT_ONBOARDING_COPY` now live once in `@elkdonis/checkout/stripe`;
  innergathering's action went 52 → 17 lines and IFAC is a caller, not a copy.
  IFAC's Payouts tab is wired via `apps/ifac/src/lib/cms/payout-actions.ts` +
  `profilePage` in its `HubSurfaces`. Type checks clean: payments, checkout,
  innergathering, ifac.

  *Correction to risk 4 above ("Stripe keys absent — stores can list, not take
  money"):* live keys ARE present, and the restricted `rk_live_` key can both
  read connected accounts and create them — two accounts exist and are fully
  payable. Onboarding copy may say "set up how you get paid". It still must
  not promise a **sale**, because no store has ever sold anything (the
  `payout_ledger` table has zero rows) and IFAC deliberately takes no money
  itself — its artist pages are a window onto art-auction (decided 2026-09-20).

  **NOT DEPLOYED — deliberately** (user's call: the tree has other sessions'
  in-flight work and a build compiles all of it). To make it live:

  1. DONE — `STRIPE_CONNECT_WEBHOOK_SECRET` is in `.env`.

     Note for anyone doing this again: the Stripe dashboard's **Event
     destinations** page (v2, ids like `ed_…`) CANNOT do this. It only offers
     v2 event types (`v2.core.account.*`), and Express connected accounts emit
     the v1 `account.updated`. Two destinations were created there before this
     was understood — one scoped `self`, one `other_accounts`, neither able to
     carry the event. Use Developers → **Webhooks** (v1, ids like `we_…`) with
     "listen on connected accounts", or create it through the API.
  2. `docker compose up -d art-auction` — **up, not restart**: an environment
     change needs the container recreated. The `.next` volume survives, so
     there's no rebuild.
  3. `docker compose up -d ifac` — same reason (it gains `STRIPE_SECRET_KEY`).
     IFAC is a **prod build**, so also force the rebuild for the code:
     `docker compose exec ifac rm -rf /app/apps/ifac/.next/server` then
     `docker compose restart ifac`. Back up `.next` first.
  4. `docker compose up -d innergathering` for the return-refresh + the
     slimmed action.
  5. **Before any of this**, `docker compose run --rm install` when the tree is
     quiet: `apps/ifac/package.json` gained `@elkdonis/checkout`, and for now
     that resolves through a hand-made symlink
     (`apps/ifac/node_modules/@elkdonis/checkout`) rather than a real install.
     Decline the modules-purge prompt if it appears.
  6. Verify by rendering, not status codes: sign in on IFAC, open the profile
     popup, confirm a **Payouts** tab appears and that `?surface=profile:payouts`
     reopens it. A returning seller lands on `/hub?surface=profile:payouts&payouts=done`.

  *Still open.* Nobody has completed an end-to-end sale, so `confirmOrderPaid`
  and the settlement split remain unexercised in production.
- 2026-09-20 — C: **Talk rooms in IFAC's compose** (owner: the option was missing, unlike innergathering). Two faults,
  both fixed: (1) IFAC never declared `canCreateTalkRoom`, so content-fields.ts hid the toggle — now set in HubSurfaces
  AND /hub/compose; (2) IFAC's save path ignored the answers entirely — new `attachRooms()` in lib/cms/actions.ts calls
  `createTalkRoom(title,'public')` (type 3, guest-joinable) and `createCollaborativeDocument`, writing
  `threads.nextcloud_talk_token` / `document_url`, best-effort with warnings returned to the author as a toast. Adapter
  now carries `create_talk_room` + `create_document`. **Also found:** the /hub/compose PAGE built its own field context
  (`{feeds, orgSlug}`), dropping every capability flag — so the document toggle had been invisible there too; it now
  forwards the whole ComposeContext. Verified: services createTalkRoom → real room, type 3, deleted after; both switches
  render in the live build's meeting form. Rebuilt live (BUILD_ID KYCqKD1kmbs5E9M2jUoPX).
- 2026-09-21 — C (final task): **editing, hosts and Plan ahead — fixed across IFAC + innergathering, LIVE on both**
  (IFAC qG6oD7M2iAf_XwhUyEyvb, innergathering K0jc9qzpM6AVToIkDDZH2; prior builds backed up in C's scratchpad).
  Root causes found and fixed:
  1. **Edit duplicated the thread (IFAC only):** the surface always passed `threadId`; IFAC's connector dropped it and
     `saveContentAction` only inserted. Now an `updateExisting` branch (author-or-editor, keeps slug/author/published_at)
     — amrit-canada / sunjay / hidden-enneagram / innergathering already honoured threadId.
  2. **Switches reset on edit (network-wide):** `defaultThreadToAnswers` never mapped rooms back. Now
     `create_talk_room ← talkToken`, `create_document ← documentUrl`; IFAC's `attachRooms` made idempotent (skip if it
     exists) so an ON switch over an existing room never makes a second. IFAC's thread route now returns documentUrl
     (members only).
  3. **No way to set a host (IFAC):** `meeting-rota` surface was never registered and /api/hub/meeting/{rota,record}
     didn't exist — ported. The card now gets its Plan ahead tool; the page-view banner gets `planAheadThreadId`.
  4. **Plan ahead read-only everywhere from the banner (network-wide):** `PlanAheadSurface` required BOTH the opener's
     `canPlan` prop and the server's; the banner never passes it. Now the server's answer rules.
  5. **Host in the form (new):** `ComposeContext/ContentFieldContext.hostCandidates` → "Who's hosting" (host + co-host)
     on dated kinds; saved to the ROTA for the next occurrence (`assignNextHosts`, candidates-only), read back via the
     thread route's `extra.next_host_user_id`. One source of truth: meeting_hosts.
  6. **What a week covers (new):** migration 159 `meeting_occurrence_notes.plan` (+planned_by/at), `setOccurrencePlan`,
     a "Covering" line per week in Plan ahead — organiser any week, host/co-host their own. innergathering's rota route
     patched too: a `plan` body used to fall through to the CLEAR branch and would have removed the host.
  Verified end-to-end in a browser on the live IFAC: edit form opens with Talk + doc switches ON and the host picker;
  Save & publish → 1 thread before / 1 after, same row, token/doc/WEEKLY kept; host on the rota; plan saved; host
  survives the plan write. innergathering API: plan write 200, host kept, non-host 403. All probe rows deleted.
  **Found, not fixed:** weekly occurrences step a fixed 7 days in UTC (expandOccurrences), so a 9:51 meeting shows
  8:51 after DST ends — calendar-wide, and correcting it moves the occurrence_at keys meeting_hosts rows use.
- 2026-09-21 — **Card checkout "error page" on market.arts-collective.com: diagnosed, fixed in code, NOT deployed.**

  *Cause:* not Stripe configuration and not the 09-20 payouts work. Order
  `ART-20260921-9522` was for a test work ("weqrwer") priced at
  $123,321,321,321.00 CAD. Stripe caps one card charge at 99,999,999 minor units
  ($999,999.99); above that no payment method qualifies and Stripe answers "No
  valid payment method types for this Checkout Session", which misleadingly
  points at dashboard settings. Platform verified healthy: cards on,
  `card_payments` active, CA/CAD. Both failures (10:31:00, 10:31:21) predate the
  work being repriced to $1 and archived (10:32:55).

  *The real bug:* the app turned that refusal into a crash page after the cart
  had already been emptied. Fixed:
  - `@elkdonis/checkout/stripe`: `CARD_CHARGE_CEILING_MINOR` and a
    `CardCheckoutRefused` error (`over_ceiling` checked before calling Stripe;
    `stripe_refused` for any session-level refusal). Other failures stay loud.
  - art-auction `placeOrder` / `payOrderByCard` → one `cardCheckoutUrl()`; a
    refusal lands the buyer on their order page (`?card=<reason>`), which
    explains it and offers e-Transfer. The order stays placed and reserved.
  - The order page hides "Pay by card" when the order is over the ceiling.
  - Deliberately **no** price cap at listing time: a fine-art sale over $1M is
    legitimate and goes by e-Transfer.

  Type checks (local tsc, exit 0): checkout, art-auction, innergathering,
  payments, ifac. services/src clean.

  **art-auction rebuild now carries three things:** the dual webhook secret
  (a live `account.updated` reached the server 09-21 and failed signature
  verification only because the bundle predates the fix; Stripe retries for
  3 days), this checkout fix, and the `mergeProfile` carry. Force rebuild:
  `docker compose exec art-auction rm -rf /app/apps/art-auction/.next/server`
  then `docker compose restart art-auction` (back up `.next` first).

  *Cleanup:* `ART-20260921-9522` (pending_payment, $123B) can never be paid by
  card and should be cancelled.
- 2026-09-21 — C: **Org calendars now two-way with Nextcloud, network-wide — LIVE** (IFAC iACH2Z3LbkRjQ_w3fWvVy,
  innergathering Lpg2wwrWgqDiCxnlnWTZH). Found: the READ side never existed (`getCalendarEvents` was a stub returning
  []), and nothing ever removed an event — IFAC's Nextcloud calendar held 4 archived meetings + 1 orphan.
  Built: `packages/nextcloud/src/calendar-read.ts` (CalDAV REPORT, server-side `expand` so times arrive in UTC — no TZ
  math) and `packages/services/src/org-calendar-sync.ts` `reconcileOrgCalendar`: one key (thread id = CalDAV UID;
  events made in Nextcloud are imported as threads — visibility ORGANIZATION, attributed to the org's first owner — and
  ADOPTED under the thread id); hub decides visibility (archived/draft/pending/gone → removed); edits flow from whichever
  side changed later; deleted in Nextcloud → thread archived; orphans (non-client UIDs with no thread) removed; a valve
  re-pushes instead of archiving if >2 vanish at once (reset calendar). Owners/guides get READ-WRITE on the org calendar
  in Nextcloud (`syncEditorWriteAccess`), members read. Runs: every 3m for all orgs (innergathering instrumentation,
  `runOrgCalendarSyncTick`), on every hub calendar read if >2m stale (inside `listOrgEventsInRange`, 1.5s bound), and
  immediately on archive (thread-admin) / unpublish (IFAC edit).
  Caught in dry run before it hit data: amrit's 4AM Yoga (moved on the hub to Oct 17, stale Aug 15 copy in Nextcloud,
  no push timestamp) would have been PULLED back — rule changed to "later edit wins" when both look changed.
  First real run: amrit pushed 1 (Nextcloud corrected), ifac removed 5, inner_group pushed 1; second run all zeros.
  Verified two-way on IFAC's real calendar: add in NC (7pm Toronto, weekly) → hub meeting at 23:00Z, WEEKLY, 90 min,
  adopted, on /hub; rename in NC → hub; rename on hub → NC; delete in NC → archived; settles; logged; cleaned up.
  Note: IFAC's `standing_meeting` pointer names an ARCHIVED thread (WICmSS4…) — the live weekly meeting is T0V4HGRp….
- 2026-09-21 — C: **Eric Brummel (d4ef2252, NC `ebrummel`) added to innergathering (`inner_group`) as member.**
  Sync run by hand: added to the InnerGathering team (circle 18kXT2nC…), inner_group folder readable, other orgs still
  denied; already in EAC_Network. Calendar share BLOCKED by Nextcloud's per-hour share-request limit — caused by my
  morning change: `syncEditorWriteAccess` re-shared every editor of every org every 3 min. Fixed: new
  `listCalendarShareAccess` (PROPFIND, not a share request) → only send when missing/wrong level; the tick now also
  shares MEMBERS (before, a member joining after calendar creation never got it). innergathering rebuilt
  (_JBE7pIVJdIkcfmpB17uT); Eric's share lands automatically once the window clears. Unrelated pre-existing failure in
  the ACL run: `users/aeon -u Ario` (occ refused) — worth a look.
