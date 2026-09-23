# Nextcloud integration and media

How the platform uses Nextcloud: the storage tree and its access model, user
linking, the host-side reconciler, Deck, Talk, calendars, the Forum app sync,
video pipelines, and how apps serve and accept media. Last verified: 2026-09-23.

## Current state

### Instance
- Nextcloud AIO, **version 33.0.6** (verified 2026-09-23 via `status.php` inside
  `nextcloud-aio-apache`; container env `NEXTCLOUD_VERSION=33.0.6`, AIO v13.3.1).
  The "Nextcloud 29" line in `CLAUDE.md` is stale.
- Apps reach it at `http://nextcloud-aio-apache:11000` (`NEXTCLOUD_URL` in `.env`);
  the public host is `NEXTCLOUD_PUBLIC_URL` (cloud.elkdonis-arts.org).
  `packages/nextcloud/src/client.ts:77-83` has no fallback URL and throws when
  `NEXTCLOUD_URL` is unset. Some compose services still default to
  `http://nextcloud-nginx:80` (`docker-compose.yml:892,987,1055`), which does not
  exist; `.env` overrides it.
- Relevant app versions (verified `occ app:list`): groupfolders 21.0.15, deck 1.17.5,
  spreed (Talk) 23.0.11, calendar 6.5.4, circles 33.0.0, forum 1.4.1,
  sociallogin 6.5.5, files_antivirus 6.4.1.

### Service account
- One service account, `eac_intergration` (spelling is the real account name),
  stored in `.env` as `NEXTCLOUD_ADMIN_USER` / `NEXTCLOUD_ADMIN_PASSWORD`. It is a
  subadmin, not an admin; groups `EAC_Network`, `Elkdonis Arts Collective`, `Talk`.
- Every app read and write goes through it. It can see every org's and every
  person's files, Deck boards and calendars, so Nextcloud permissions are never the
  boundary between orgs; the app layer is (`packages/services/src/dav.ts:11-15`).
- The 2026-09-06 design called for two robots: a read-only `eac_media` for
  `/api/media/*` and a read-write account for uploads. **Not implemented**
  (verified 2026-09-23: no reference to `eac_media` in code or `.env`;
  `scripts/apply-team-folder-acls.mjs:47` lists only `eac_intergration`, overridable
  with `NC_SERVICE_ACCOUNTS`).

### Storage tree
- Groupfolders (verified `occ groupfolders:list`):
  - 1 "Elkdonis Collective" — legacy human drive, about 142 GB, group
    `Elkdonis Arts Collective`. Not used by the platform.
  - 2 "EAC_Network" — the platform root, about 2.8 GB, group `EAC_Network`,
    advanced permissions on.
  - 3 "IFAC" — empty, group `IFAC`. IFAC's files are in `EAC_Network/ifac/`.
- Layout under `EAC_Network/`:
  - `<org_id>/` — the org's published assets and private files. Standard subtree
    `Media/{Images,Audio,Videos,Documents}` and `Private/Media/{…}`
    (`packages/nextcloud/src/org-folders.ts:11-23`).
  - `<org_id>/workshops/<thread_id>/materials` — workshop materials
    (`packages/nextcloud/src/workshop-materials.ts:26`).
  - `<org_id>/Private/Video/<pipeline>/` — video pipelines (below).
  - `users/<users.slug>/` — a person's own work (avatar, portfolio). Created for
    every principal whether or not they have a Nextcloud login
    (`ensureUserFolder`, `org-folders.ts:131`; `scripts/provision-user-folders.mjs`).
- Principal-canonical, share-not-sync: one folder per principal; connecting a
  Nextcloud account adds a share or ACL allow and never moves files. The database
  is the authority on access; a path is a filing convention.
- Ownership decides location: a person's work goes in `users/<slug>/`, an org's
  published assets in `<org>/Media/`. IFAC's 18 artist folders were moved to
  `users/<slug>/` on 2026-09-06 (`scripts/migrate-member-media-to-user-folders.mjs`).
- `getUploadPath()` (`packages/services/src/nextcloud.ts:286-295`) writes
  `PUBLIC` uploads to `Media/` and anything else to `Private/Media/`.
- `packages/services/src/org-storage.ts:41` derives an org's root from the org id
  and ignores `organizations.nextcloud_folder_path`, which is empty or wrong for
  several orgs.
- `packages/services/src/user-storage.ts:56` (`resolveUserPath`) confines
  per-person file operations to one `users/<slug>/` and throws on escape attempts.
  `apps/arts-collective/src/app/api/my-files/route.ts` resolves the slug from the
  session, never from the request.
- Folder-name drift: org `oad` uses folder `artdirect` (maps in
  `provision-org-circles.mjs:71` and `apply-team-folder-acls.mjs`). Both
  `EAC_Network/inner-gathering/` and `EAC_Network/inner_group/` exist
  (`inner_group` is the core member group; private by default).

### Access control (groupfolder ACLs)
- Tested precedence (2026-09-06, `occ groupfolders:permissions --test`): a user
  allow beats a group deny; a group deny beats a Circle allow. So the model is:
  deny the `EAC_Network` group on each top-level folder, then allow per user.
- `scripts/apply-team-folder-acls.mjs` generates the rules from the DB. Emission
  order: service-account allows, per-user org allows, per-user `users/<slug>`
  allows, group denies on org folders, group denies on each `users/<slug>`.
  The `users/` parent stays listable; each `users/<slug>` is denied individually
  and the service account gets an explicit allow at the same depth.
- Affiliation is `user_organizations` (role member/guide/owner) union
  `org_profiles` — the same rule as `media-authz.ts`. Viewers get nothing
  (`apply-team-folder-acls.mjs:100-111`).
- The team folder mounts only through the `EAC_Network` group. SSO accounts are
  not auto-grouped (sociallogin `defaultGroup` is empty, verified 2026-09-23), so
  the ACL script adds affiliated uids to the group last, and only when no rule
  failed in the same run (`apply-team-folder-acls.mjs:190-225`).
- 2026-09-23: the last run emitted 156 rule commands; 10 affiliated uids are in
  the group.

### Reconciler (scheduled)
- `scripts/sync-nextcloud-access.sh` runs `provision-org-circles.mjs` (folders,
  Circles, Circle membership, per-role shares: owner 15, guide/member 1 — all over
  OCS) then `apply-team-folder-acls.mjs --apply` (needs `occ`, so host only).
  It flocks, finds nvm's node itself, and claims/finishes queued requests from
  `nextcloud_sync_requests` via `scripts/nc-sync-queue.mjs`.
- **It is scheduled**: guru's crontab has
  `*/10 * * * * …/scripts/sync-nextcloud-access.sh 2>&1 | logger -t nc-access-sync`
  (verified `crontab -l` 2026-09-23; `journalctl -t nc-access-sync` shows 446
  completed runs since 2026-09-20).
- It only adds access. Demoting or removing a member revokes nothing.
- Apps request a sync with `requestNextcloudSync`
  (`packages/services/src/org-nextcloud-access.ts:233`, migration 139, which also
  adds `org_grants`). Owners with the `nextcloud_access` grant use
  `createNextcloudAccessRoutes` + `@elkdonis/cms-ui/nextcloud-access`
  (IFAC `/manage/cloud`, route `apps/ifac/src/app/api/manage/nextcloud-access/route.ts`).
- Every run since at least 2026-09-20 has ended with 1 or 2 failures
  (a `+read +write` allow on two members' `users/<slug>` folders). See Open items.

### Circles
- Circles are created and populated over OCS by `provision-org-circles.mjs`; the id
  is `organizations.nextcloud_circle_id` (migration 102; 18 of 18 orgs set,
  2026-09-23). No app code calls the Circles API; `nc-forum.ts` and
  `org-nextcloud-access.ts` read the column.
- A Circle is not a permission mechanism: it loses to a group deny, cannot receive
  a calendar share (DAV 200, nothing persisted —
  `packages/nextcloud/src/calendar.ts:594`), and the service account gets 403
  reading circle membership. It serves as the Deck/Talk/Forum team handle.
- Attaching a Circle to a groupfolder and every groupfolder ACL write are
  `#[PasswordConfirmationRequired]` over HTTP; `occ` works.

### User provisioning and onboarding
- Admin-API user creation (`POST /cloud/users`) returns 403 "Password confirmation
  is required" for any stateless credential (tested 2026-07-15 with CLI-minted,
  scope-edited and Login Flow v2 tokens). Groupfolder writes carry the same gate.
  Deck, Talk, calendar and file-sharing writes do not.
- `packages/nextcloud/src/users.ts:43-86` (`provisionUser`) links an existing
  account by email (`findNextcloudUserIdByEmail`) before any create attempt.
- New accounts are self-provisioned through SSO. Nextcloud's sociallogin
  provider `elkdonis` authorizes at `https://elkdonis-arts.org/api/oidc/authorize`
  (verified 2026-09-23). The provider lives in
  `apps/innergathering/src/app/api/oidc/{authorize,token,userinfo}`; the
  authorize route writes `users.nextcloud_user_id = 'elkdonis-<users.id>'` and
  `nextcloud_synced = true`, never overwriting an existing link
  (`authorize/route.ts:95-97`). Needs `JWT_SECRET` and `NEXTCLOUD_OIDC_SECRET`.
- Onboarding chain: sign in (role `viewer`) → an owner/guide promotes to member →
  the person uses "Sign in with Elkdonis" on the Nextcloud login page once → the
  next reconciler run adds Circle membership, shares, ACL allows and the group.
- 2026-09-23: 56 users, 10 with `nextcloud_user_id`, 1 with a stored
  `nextcloud_app_password` (which is the account password, not a per-app
  password — `docs/archive/nextcloud-security.md`).
- Nextcloud cannot be iframed (frame-ancestors 'self', SameSite cookies); hub
  surfaces link out.

### Deck boards
- Migration 101 adds `organizations.deck_board_id`; 3 orgs have a board
  (2026-09-23). Service layer `packages/services/src/org-deck.ts`; UI and route
  factory `packages/pipeline` (`createPipelineApi`). Provision with
  `scripts/provision-org-deck-boards.mjs` (`--dry-run`) or the empty-state button.
- Isolation is app-layer only: `org-deck.ts` resolves the board from the org and
  rejects stack/card ids from other boards with a not-found error (`org-deck.ts:63`).
- Members are granted per uid (`syncOrgDeckMembers`, `org-deck.ts:148`).
  Assignment requires a Nextcloud principal with a board ACL entry.
- All writes are the service account, so comment authorship is carried as a
  leading `**Name**:` and parsed back; attribution only.
- Deck omits `cards` on an empty stack; `DeckStack.cards` is optional
  (`packages/nextcloud/src/deck.ts:78`).
- API facts: card move puts the destination stack in the reorder URL; comments are
  OCS-only; attachment upload needs `data=<filename>`; attachment reads need API
  v1.1; `oc_deck_cards.done` is a timestamp; archived cards appear only under
  `/stacks/archived`.

### Talk
- Org chat: `organizations.talk_room_token` (7 orgs set, 2026-09-23), service
  `packages/services/src/org-chat.ts`, UI and routes `packages/chat`. Rooms must
  be type 3 (public) so members without a Nextcloud account can join as guests.
  `ensureOrgChatRoom` (`org-chat.ts:106`) repairs private rooms;
  `scripts/provision-org-talk-rooms.mjs:52` creates type 3.
  `createOrgTalkRoom` in `packages/nextcloud/src/org-provisioning.ts:169` still
  creates type 2 ("group") but has no caller.
- Each member posts through a Talk guest session (migration 102
  `talk_guest_sessions`; migration 103 `name_is_custom`). The stored `cookie` is a
  Nextcloud session credential, used server-side only (`org-chat.ts:184-323`).
  Guest display names resolve at read time, so a rename is retroactive.
- Reads go over the service account, so system messages read as "You …"; they and
  deletion tombstones are filtered from the transcript.
- Per-meeting rooms (`threads.nextcloud_talk_token`) come from
  `createTalkRoom(name, type, { moderator, listable })` and `configureTalkRoom`
  (`packages/services/src/nextcloud.ts:353,397`): invite the author first, then
  promote to moderator. `packages/nextcloud/src/talk.ts` has no delete-message
  function.
- `social_login_auto_redirect` reads `false` (verified 2026-09-23); the 2026-07-11
  note in `docs/archive/NEXTCLOUD_CUSTOM_CHANGES.md` set it to `true`. See Open items.

### Calendars
- Migration 104 adds `organizations.calendar_uri` + `calendar_synced_at`
  (4 orgs set, 2026-09-23). Calendars are owned by the service account and shared
  per uid, never to a Circle.
- Two-way sync: `packages/services/src/org-calendar-sync.ts`
  (`reconcileOrgCalendar` :137, `syncOrgCalendarIfStale` :493,
  `runOrgCalendarSyncTick` :504). `threads` is the record; CalDAV UID = thread id.
  Events created in Nextcloud are imported as threads and re-PUT under the thread
  id; later edit wins; an event deleted in Nextcloud archives the thread (more
  than 2 at once is treated as a reset and re-pushed). Runs every 3 minutes from
  `apps/innergathering/src/instrumentation.ts:29-47`, and on hub reads older
  than 2 minutes (`STALE_MS`, `org-calendar-sync.ts:474`).
- Share levels: members get read shares (`syncOrgCalendarShares`,
  `packages/services/src/org-calendar.ts:192`); owners/guides get read-write
  (`syncEditorWriteAccess`, `org-calendar-sync.ts:441`), which only re-shares
  editors not already read-write. Re-sending every tick hit Nextcloud's per-hour
  share-request limit on 2026-09-21.
- In `oc_dav_shares.access`, 2 = read-write and 3 = read
  (`apps/dav/lib/DAV/Sharing/Backend.php:23-26` in the container). Live org
  calendars carry both levels (verified 2026-09-23).
- `packages/nextcloud/src/calendar-read.ts` is the only CalDAV read (REPORT with
  server-side `expand`, instances in UTC). `getCalendarEvents` in `calendar.ts:499`
  is a stub.
- `packages/services/src/calendar-sync.ts` is dead code: it reads and writes
  `threads.nextcloud_calendar_event_id` / `nextcloud_calendar_synced`, which do not
  exist (verified `information_schema` 2026-09-23). Its only callers are in the
  legacy `apps/inner-gathering` (`src/lib/actions.ts:156`,
  `src/app/api/webhooks/nextcloud/calendar/route.ts:86`), where the call throws
  and is caught. `nextcloud-sync.ts` (webhook event store) is likewise used only
  by `apps/inner-gathering/src/app/api/webhooks/nextcloud/route.ts`.

### Nextcloud Forum sync
- Migration 144 (`org_nc_forum`, `nc_forum_links`) is the sync itself; migration
  163 adds sub-categories (`org_feeds.parent_slug`, `org_feeds.nc_category_id`).
  Both applied (`app_schema_migrations`, 2026-09-23).
- Service `packages/services/src/nc-forum.ts`; provision or sync by hand with
  `scripts/nc-forum.mts` run through tsx in the innergathering container.
  Provisioned: `inner_group` only (category 8, not public).
- One category per org, team-scoped by `nextcloud_circle_id`. Syncs topics an
  owner/guide ticks "Also post to Nextcloud", topics started in the org's
  category, and replies to either. Replies need member level unless the category
  is public.
- Inbound is a poll (the forum app emits no events): every 3 minutes from
  innergathering instrumentation, plus `syncOrgNcForumIfStale` (`nc-forum.ts:759`)
  on org `/forum` pages. Per-org advisory lock (`nc-forum.ts:297`).
- Site removal hides the Nextcloud thread (`isHidden: true`, `nc-forum.ts:429-433`)
  and never deletes it: the forum app's unique-slug check ignores soft-deleted
  threads, so a new topic with a deleted topic's title returns 500.
- Nextcloud authors without a site account post as sentinel
  `NC_FORUM_SENTINEL_ID` (`nc-forum.ts:37`). Nextcloud posts are BBCode with unix
  seconds; the site stores sanitized HTML with timestamptz.
- Sub-categories are matched on `nc_category_id` first; live thread ids are
  accumulated across all mirrored categories before the archival pass, and an
  existing link revives an archived topic.

### Video pipelines
- Migrations 147 (`video_pipelines`, `video_jobs`) and 148 (moved the seed under
  `Private/`). 1 pipeline, 0 jobs (2026-09-23).
- Folders: `EAC_Network/<org>/Private/Video/<pipeline>/` with
  `1 Drop recordings here`, `2 Processing`, `3 Finished`, `Originals`, `Failed`,
  `Intro and outro`. `pipelinePath` throws unless the folder is under `Private/`
  (`packages/services/src/video-pipeline.ts:171-174`).
- Worker: compose service `video-worker` (image `eac-video-worker`,
  `docker/video-worker.Dockerfile`, 8 CPUs, scratch volume `video-work`) runs
  `packages/services/scripts/video-worker.mts`, polling every
  `VIDEO_SCAN_SECONDS` (60). A file is taken only after it is seen twice with the
  same size and mtime (`video-pipeline.ts:451`). Rendering is
  `@elkdonis/services/video-render` (ffmpeg; worker only): silence at start/end cut
  via silencedetect, refuses if under 20% would remain (`video-render.ts:183`).
- UI: innergathering `/manage/video`. YouTube publish, Talk-recording ingestion and
  matching recordings to meetings are not built.

### Media serving and authorisation
- `canReadMedia(viewerId, path)` and `parseMediaPath`
  (`packages/services/src/media-authz.ts:59-93,204-238`). A path is private if any
  segment equals `private` (case-insensitive). **A path with no `Private` segment is
  public to anonymous visitors.** Workshop paths
  (`<org>/workshops/<thread>/…`) are always private and gated by
  `canAccessWorkshopMaterials`. Org targets need affiliation
  (`user_organizations` ∪ `org_profiles`); `users/<slug>` targets need the owner or
  a shared org. Accepts a `users.id` or an auth uuid. Fails closed.
- `serveMedia` (`packages/services/src/media-serve.ts:167`) authorizes, returns 404
  for both missing and forbidden, sets `nosniff`, `inline` only for safe types
  (`attachment` otherwise), and `private, no-store` vs
  `public, max-age=31536000, immutable` from `parseMediaPath().isPrivate`.
  `allowedPrefixes` is a subtree bound only.
- Media read routes, 2026-09-23:
  - `serveMedia` with `?w=`: art-auction, arts-collective, danamccool,
    fourthwayBookreaders, ifac, innergathering, sophia.
  - `serveMedia` without `?w=`: artdirect.
  - Hand-rolled with `canReadMedia`: amrit-canada, hidden-enneagram, pigeonshoot,
    sunjay, blog-server `createMediaGetHandler` (blog-guru-dharam, blog-tester),
    and the legacy inner-gathering and elkdonis-arts-collective.
- Thumbnails: `packages/services/src/media-thumbnail.ts`. `parseThumbnailWidth`
  snaps to 128/256/512/1024; sharp (dynamic import), WebP output, Redis cache keyed
  on the upstream ETag, cache hits resolved from a HEAD, single-flighted renders,
  `limitInputPixels` 50 MP and a streamed 40 MB source cap. Derived from bytes
  `serveMedia` already authorized.

### Upload security
- `validateUploadBuffer` / `sniffFileType` (`packages/utils/src/file-validation.ts:43,125`)
  check magic bytes; SVG is kind `svg` and rejected by default media pipelines.
  Used in the upload routes of amrit-canada, art-auction, artdirect,
  arts-collective, danamccool, fourthwayBookreaders, hidden-enneagram, ifac
  (`/api/upload`, `/api/media/upload`), innergathering, pigeonshoot, sunjay.
- Not byte-validated (2026-09-23): `packages/blog-server/src/media.ts:195-224`
  (trusts `file.type`), `apps/ifac/src/app/api/hub/upload` → `uploadOrgFile`
  (`org-storage.ts:78`), `apps/admin/src/app/api/nextcloud/upload` (admin only),
  `apps/inner-gathering/src/app/api/nextcloud/upload` (legacy).
- ClamAV: `nextcloud-aio-clamav` runs; `files_antivirus` `av_mode=daemon`,
  `av_host=nextcloud-aio-clamav`, `av_infected_action=only_log` (verified
  2026-09-23). Infected uploads are logged, not deleted.
- Silex HTML is sanitized at render and at publish; see
  `docs/archive/nextcloud-security.md`.

### WebDAV helpers
- `packages/services/src/dav.ts`: `davMkcol` (:227) treats 405 as success; MKCOL
  does not create parents, so trees are built one segment at a time
  (`ensureFolderTree`, `org-folders.ts:46`). `davMove` (:240) sends
  `Overwrite: F`. `resolveWithin` (:55) guards traversal only.

### Local Nextcloud configuration to preserve
- sociallogin custom OAuth2 provider `elkdonis` (authorize URL above),
  `defaultGroup` empty, `allow_login_connect=1`, `update_profile_on_login=1`.
- groupfolder 2 ACL rules (regenerated by the reconciler).
- files_antivirus settings above.
- Forum app: the service account holds the forum Admin role (**assumed**, per
  `docs/archive/BRIEF_D_NC_FORUM_SYNC_2026-09-18.md`; not checked).
- The code-level patches listed in `docs/archive/NEXTCLOUD_CUSTOM_CHANGES.md`
  (default URL in `client.ts`, username derivation in `users.ts`) are superseded:
  `client.ts` now requires `NEXTCLOUD_URL`, and `users.ts` links by email via
  `findNextcloudUserIdByEmail`.
- Host timer `nextcloud-talk-fix.timer` (enabled; last ran 2026-06-05) runs a
  script outside the repo that fixes the Talk TURN relay IP and iptables rules.

## Rules and constraints
- Run `occ` only on the Docker host (`docker exec -u www-data nextcloud-aio-nextcloud php occ …`): app containers cannot reach the Nextcloud container, and the HTTP equivalents are password-confirmation gated.
- Do not retry admin-API user creation or groupfolder writes over HTTP: `#[PasswordConfirmationRequired]` rejects every stateless credential.
- Treat the database as the access authority and write rows, then let the reconciler apply them: Nextcloud access is derived state.
- Put anything non-public under a `Private/` segment: `canReadMedia` serves every other org or user path to anonymous visitors.
- Serve media through `serveMedia`/`canReadMedia`, and treat `allowedPrefixes` as a subtree bound only: the prefix is not the access decision.
- Check org membership in app code before any Deck, calendar, DAV or chat call: the single service account can see every org.
- Never share an org's Deck board, calendar or folder with a group or Circle: a group share lands in every member's sidebar, and a Circle calendar share silently persists nothing.
- Verify Nextcloud writes by reading state back (share list, `oc_dav_shares`, a real media fetch), not by HTTP status: several endpoints return 200 and change nothing.
- When adding a group deny, add a service-account allow at the same path depth first: a deny cuts off media serving otherwise, and a parent allow does not inherit past a deeper deny.
- Never deny the `users/` parent: a person cannot reach their own `users/<slug>` inside a folder they cannot list.
- Keep Talk rooms type 3: type 2 admits only Nextcloud accounts, which most members lack.
- Keep `talk_guest_sessions.cookie` server-side: it is a Nextcloud session credential.
- Hide Nextcloud Forum threads, never delete them: the forum app's slug check ignores soft-deleted threads and then 500s on a reused title.
- Write `stack.cards ?? []`: Deck omits `cards` on an empty stack.
- Create WebDAV folders one segment at a time and MOVE with `Overwrite: F`: MKCOL does not create parents, and `Overwrite: T` clobbers an existing target.
- Run `reconcileOrgCalendar(org, { dryRun: true })` before a first sync of an org: the first live run can pull a stale Nextcloud date over a newer hub date.
- Rebuild every app that runs the 3-minute ticks after changing `nc-forum.ts` or `org-calendar-sync.ts`: production builds keep running the old sync.
- Do not add code to `calendar-sync.ts` or `nextcloud-sync.ts`: they target columns and webhooks that do not exist; use `org-calendar-sync.ts`.

## Open items
- Two per-user ACL allows on `users/<slug>` fail on every reconciler run (436 and 21
  occurrences since 2026-09-20). Cause unknown. Because the script skips group
  adds whenever any rule failed, a newly linked member will not be added to
  `EAC_Network` (and gets no mount) until the failure is fixed.
- `social_login_auto_redirect` reads `false`, contrary to the 2026-07-11 setting.
  Unknown whether it was reverted on purpose; the Talk-join redirect flow assumed
  `true`.
- ClamAV `av_infected_action=only_log`; `docs/archive/nextcloud-security.md`
  recommended `delete`. No decision recorded.
- The second, read-only media robot is not implemented.
- Uploads without byte validation (blog-server, `uploadOrgFile`, legacy routes).
- `?w=` not passed through by artdirect or the hand-rolled media routes.
- Revocation: the reconciler never removes shares, ACL allows or group membership.
- Drift: groupfolder 3 empty; `inner-gathering/` and `inner_group/` folders;
  `organizations.nextcloud_folder_path` empty or hyphenated for several orgs;
  `artdirect/` still present; a probe calendar `eac-probe-ifac` remains on the
  service account.
- Forum sync provisioned for `inner_group` only; the one stored app password is the
  account password and should be replaced with a real app password and encrypted.
- Per-user ACLs scale as users × orgs; acceptable at current size (10 linked users).

## Sources
Supersedes, for this area:
- `docs/archive/NEXTCLOUD_CUSTOM_CHANGES.md`
- `docs/archive/nextcloud-security.md` (Silex sanitization detail remains there)
- `docs/archive/BRIEF_D_NC_FORUM_SYNC_2026-09-18.md`
- `docs/archive/DOMAIN_AND_STORAGE_AUDIT_2026-09-15.md` (Part 2 only)
- Memory: nextcloud_storage_architecture (storage/ACL parts),
  nextcloud_access_reconciliation, nextcloud_circles_calendar_facts,
  nextcloud_forum_app_facts, nextcloud_provisioning, project_nextcloud_onboarding_chain,
  project_org_deck_boards (Deck parts), project_org_general_chat (Talk parts),
  project_video_pipelines, project_calendar_two_way, project_media_thumbnails,
  feedback_deck_cards_absent.

Corrections to those sources (2026-09-23):
- "Sync script is not scheduled" (access_reconciliation, storage audit) — wrong
  now; the `*/10` cron is installed and running.
- "Calendar shares are always read-write; `access = 3` is read/write"
  (circles_calendar_facts) — wrong: in Nextcloud 33, 3 = read and 2 = read-write,
  and both levels exist on live org calendars.
- "Only arts-collective and art-auction pass `?w=`" (media_thumbnails) — stale;
  seven apps do.
- "amrit-canada and hidden-enneagram use `isMember`, not `canReadMedia`"
  (storage_architecture) — fixed; both use `canReadMedia`.
- "Zero ACL rules" and "`EAC_Network` group has 2 members" (storage_architecture,
  2026-09-06) — superseded by the applied ACLs and 10 group members.
- Worker path is `packages/services/scripts/video-worker.mts`, not
  `scripts/video-worker.mts` (video_pipelines).
