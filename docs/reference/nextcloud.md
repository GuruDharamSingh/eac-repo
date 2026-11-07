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
- Folder name is `users.storage_folder` (migration 169, 2026-09-27), not `users.slug`.
  It is set once from the slug by trigger `trg_users_storage_folder`, never follows a
  slug rename (the `/center` editor can rename slugs), and is unique, so a freed
  slug cannot resolve to another person's files. `getStorageSlug()` returns it.
  Folders are created on first upload (`uploadUserFile` creates the chain), not at
  signup; `apply-team-folder-acls.mjs` skips people whose folder does not exist.
  Orphans from renames before 169: `ario`, `ericbrummel`, `justin-gillis`,
  `rev-dr-sunjye-…` (not re-linked). (claude, 2026-09-27)
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
- 2026-09-25 07:40 to 2026-09-26 09:20: every run's ACL step failed with
  "permission denied" on the Docker socket (620 log lines), because `guru` is
  no longer in the `docker` group; Docker is reached through passwordless
  `sudo docker`. `apply-team-folder-acls.mjs` now uses `sudo -n docker` when
  the socket is not writable. The run at 09:24 applied, with 3 per-user
  `users/<slug>` failures (see Open items). (claude, 2026-09-26)
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
- Nextcloud cannot be iframed from other sites (frame-ancestors, SameSite
  cookies); hub surfaces link out. Exception since 2026-09-26: elkdonis-arts.org
  via the `eac_embed` app (below). (claude, 2026-09-26)

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
- 2026-09-26: when the sync removed an event itself (thread unpublished or
  unscheduled) it kept `threads.nextcloud_last_sync`, so after the thread was
  rescheduled the missing event read as "deleted in Nextcloud" and the thread
  was archived (Talk of the Month, twice). `org-calendar-sync.ts` now clears
  the marker on that removal. Live since innergathering (which runs the tick)
  was rebuilt 2026-09-26 11:30 EDT, build `eHfEZ1Ktn0wER3JxMHC-5`. (claude, 2026-09-26)
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
- UI: innergathering `/manage/video`. Talk-recording ingestion and matching
  recordings to meetings are not built.
- Recordings to YouTube (migration 193): a thread with
  `metadata.publish.youtube.connectionId` queues files under
  `<circle folder>/Meeting Recordings/` as `video_uploads`; the worker uploads
  approved rows (`youtube-uploader.ts`). Audio-only files (the browser reading
  recorder writes audio-only `.webm`) are wrapped in a 1280x720 title card
  first (`stillVideoFromAudio`, `video-render.ts`), since YouTube does not
  process a file without a picture. Approve in fourthwayBookreaders, Akhand
  Path admin (`/api/akhand-path/uploads`). (claude, 2026-11-01)
- YouTube connections use the collective's Google client by default
  (`YOUTUBE_CLIENT_ID/SECRET` in `.env`, passed to arts-collective,
  innergathering and fourthway-bookreaders; `youtubeApp()` in
  `connections.ts`). The client is Guru Dharam's brand-verified Cloud project;
  its redirect URI is `https://arts-collective.com/api/connections/callback`.
  Bring-your-own client remains under "Use your own Google client". Uploads
  through an unaudited project stay private until the YouTube API Services
  audit passes; quota is the project's 10,000 units/day. (claude, 2026-11-01)
- 2026-11-01 verified end to end: the Akhand Path Day 1 recording (audio-only
  webm) was approved, given a title card, uploaded as private video
  `qHpA42TpVog` on the Guru Dharam Singh channel, and processed by YouTube
  (`processingStatus: succeeded`, 34 s), checked with `videos.list`.

### Reels (Remotion) — 2026-10-03
- Templates are Remotion components in `packages/reels` (`@elkdonis/reels`). A
  composition takes `ReelInput` = the stored edit (`ReelEdit`, Nextcloud paths)
  plus a path→URL map, and converts it itself (`toArtworkReelProps`,
  `src/types.ts`), so the browser preview (`@remotion/player`) and the render
  run the same code. First template: `artwork-reel` (9:16, 1 s logo intro,
  dissolve to artwork with pan, clip, optional clip, optional extra, end card,
  music lowered under clips marked as speaking).
- 2026-10-04: the Video page is now a Studio kind at `/studio?kind=video`
  (`packages/reels/src/editor/VideoKind.tsx`, registered by
  `apps/arts-collective/src/components/studio/StudioApp.tsx`); `/studio/video`
  redirects. Publishing: `publishReel` (reels.ts) copies the latest render to
  `users/<f>/Media/Videos/reel-<project id>.mp4` (+ `Media/Images/…jpg`) and
  publishes a `writing` piece with `metadata.video`; shown by ArtDirect's piece
  page. Unpublish sets the piece to draft; the public copy stays.
- (superseded 2026-10-04) Studio page: arts-collective `/studio/video` (`apps/arts-collective/src/app/studio/video/page.tsx`,
  actions `src/lib/video-actions.ts`, upload `src/app/api/reels/upload/route.ts`,
  which streams the raw body to Nextcloud). Linked from the Studio "New ▾" menu
  (`packages/studio/src/kinds.ts`, `href`). Editor: `packages/reels/src/editor/VideoStudio.tsx`.
- Data: migration 189 (`reel_projects`, `reel_renders`); services
  `@elkdonis/services/reels` (`packages/services/src/reels.ts`). Queries are
  scoped by `owner_id`; `pathsAllowed` refuses an edit naming a file outside
  the project folder or the two music folders.
- Storage: project `<owner root>/Private/Video/Reels/<id>/` (`oad`/"Just me" →
  `users/<storage_folder>`, org → `EAC_Network/<org>`), output in `Finished/`.
  Music: personal `users/<storage_folder>/Private/Music/`; network
  `EAC_Network/oad/Private/Music/` (`oad` is the network's org, dev
  2026-10-03), filled by "Share" (WebDAV COPY). Read access is the ordinary
  org rule: `oad` affiliates only (24 members, 2026-10-03). ~~`_network`~~
  folder and media-authz rule were added and removed the same day.
- Recorder: "Record…" on the clip slots (`packages/reels/src/editor/Recorder.tsx`,
  camera or screen, MediaRecorder, capped at the slot's length). WebM is
  re-encoded to H.264 by the worker with Remotion's bundled ffmpeg
  (`render.mjs` `normalizeClips`) because MediaRecorder WebM has no duration or
  seek index. Needs a secure context (HTTPS or localhost).
- Renderer: compose service `reel-render` (`--worker`, polls `reel_renders`
  every 5 s, image `eac-reel-render`, `docker/reel-render.Dockerfile`, 8 CPUs,
  6 GB, volume `reel-work`). Debian, not `eac-dev`: Remotion does not support
  Alpine. The renderer lives in the image at `/opt/reel`
  (`packages/reels/render/image-deps.json`, glibc builds); the workspace copy of
  `remotion`/`@remotion/player` (musl tree, pure JS) serves the browser only.
  Keep both at 4.0.532. Templates are read from the bind mount: restart the
  worker after editing one; rebuild the image after changing a version.
  Folder renders by hand: `docker compose run --rm reel-render --project "<path>" [--init]`.
- Verified 2026-10-03 (render + frame extraction + ffprobe): 16.6 s 1080×1920
  H.264/AAC rendered in 18–20 s (≈30 s with download, bundle and upload), peak
  memory ≈5 GB at `REEL_CONCURRENCY=4`. Test folder project:
  `EAC_Network/brief_a_test/Private/Video/Reels/Test reel`. `tsc` clean for
  `@elkdonis/reels` and arts-collective.
- Verified 2026-10-03 (signed-in headless Chrome against the rebuilt
  arts-collective, test account removed afterwards): create reel, upload
  logo/artwork/clip/music, autosave, queue, worker render, playback of the
  result; recording 4.4 s from a fake camera into a slot and rendering it
  (17.0 s output). Migration 189 applied 2026-10-03; `reel-render` running.
- Reuse (2026-10-03): every slot has "From my files…" (`packages/reels/src/editor/SlotLibrary.tsx`):
  the person's finished reels (`listFinishedReels`, latest done render per
  project) and cms-ui `MediaBrowser` over `/api/my-files?kind=image|video`.
  The edit names the picked file where it is (no copy); `pathsAllowed` and the
  worker accept anything under the requester's own `users/<storage_folder>/`.
  Verified 2026-10-03 signed in: reel A rendered, reel B took A as its clip and
  an artwork picked by folder browsing, rendered 19.8 s (A's 12.9 s inside).
- `/api/my-files` (arts-collective) fixed 2026-10-03: MediaBrowser appends its
  own `path` (a full storage path) after the host's `?path=`, and the route read
  only the first, so opening a folder re-listed the start folder. It now takes
  the last `path`, strips the person's root, filters by `kind`, and searches
  with `q` (davListDeep, 200 results). The writing Library uses `kind=image`.
- Not verified: music ducking level; phone HEVC/HDR clips in the preview in
  every browser (no preview copies yet); the edge's upload size limit for
  large video; network music playback for a non-`oad` viewer (refused by design).

### Server OBS (broadcast) — 2026-10-03
- Compose service `obs` (container `eac-obs`, image `eac-obs`, `docker/obs/Dockerfile`):
  Ubuntu 24.04, OBS 32.2.0 from the OBS PPA, headless sway at 1920x1080
  rendering on the iGPU (since 2026-10-28; was Xvfb + fluxbox), wayvnc on
  127.0.0.1:5900 and websockify on 127.0.0.1:6080 inside the container (no
  password; `OBS_VNC_PASSWORD` is unused; since 2026-11-01 not published, the
  booth door below is the way in), PulseAudio null sinks `eac` (default) and
  `booth` (monitoring). `/dev/dri` passed in (groups 107 render, 44 video). 8 CPUs, 6 GB.
  Volumes `obs-home` (OBS config, scene collection), `obs-recordings`.
- `docker/obs/start.sh` seeds the config on every start: profile `EAC`
  (Advanced output, MKV to `/recordings`, CBR `OBS_VIDEO_KBPS` default 6000),
  obs-websocket on 4455 with `OBS_WEBSOCKET_PASSWORD`, preview off, browser
  hardware acceleration off. Encoder `ffmpeg_vaapi` (AMD Radeon 610M iGPU) when
  vainfo reports H.264 encode, else `obs_x264`; `OBS_ENCODER=x264` in `.env`
  forces x264 (compose does not see shell variables on this host).
- `docker/obs/agent.mjs` (bind-mounted; restart the container after editing):
  the only websocket client; HTTP on `obs:4456`, bearer `OBS_AGENT_SECRET`.
  Creates scenes Holding / Browser (input "Browser page") / Media (input
  "Media file"), lays them out, starts on Holding. Saves recordings to Nextcloud
  as MP4 (`ffmpeg -c copy`) into `users/<storage_folder>/Private/Video/Broadcasts/`.
- One session at a time (dev, 2026-10-03): the agent holds a lease
  (`POST /lock`, holder `<user id>:<tab id>`, built server-side in
  `broadcast-actions.ts`); every other POST and `/screenshot` need `X-Holder`
  equal to it, else 423. The console renews every 5 s; the lease lapses 20 s
  after the last renewal; `pagehide` sends a beacon to `/api/broadcast/release`.
  A second tab, even of the same person, sees "open in another session".
  Verified 2026-10-03: rules against the agent directly, and two tabs on the
  rebuilt page (second refused, took over 5.3 s after the first closed).
  The lease is in agent memory: restarting the obs container frees it.
- UI: arts-collective `/studio/broadcast` (admins only, `isAdmin`;
  `src/lib/broadcast-actions.ts`, client `packages/reels/src/broadcast/`,
  services client `@elkdonis/services/obs`). Linked from `/studio/video` for admins.
- Rules, each found by failure on 2026-10-03: delete `$CFG/.sentinel` at start
  (OBS 32 otherwise asks to run in Safe Mode, which disables obs-websocket);
  delete `plugin_config/obs-browser/Singleton*` at start (CEF exit code 21,
  "profile in use", after a container recreate); keep `BrowserHWAccel=false`
  (black browser source on llvmpipe); scenes and inputs share one name space;
  Node 22's WebSocket fires only `error` on a refused connect, so the agent
  retries on either event; the browser source's first load after start is
  refreshed by the agent (it raced the network and stayed black).
- Measured 2026-10-03 (docker stats, 4-sample means, 1080p30; motion = 1080p
  testsrc2 clip in the Media scene; stream to a local MediaMTX RTMP server, probed
  as H.264 1920x1080 ~30 fps + AAC; 0 encode/stream frames skipped in every run):
  | State | iGPU (VA-API) | x264 |
  |---|---|---|
  | Holding scene, idle | ~0.8 core | ~0.8 core |
  | Static web page on air | ~1.65 | ~1.65 |
  | Static page, recording | ~2.1–2.2 | ~2.3 |
  | Motion clip on air | 2.6 | 2.7 |
  | Motion, streaming | 3.2 | 3.8 |
  | Motion, streaming + recording | 3.2 | 3.8 |
  Recording shares the stream encoder (`RecEncoder=none`), so it adds no
  encode cost. Compositing and the browser source are software GL (llvmpipe):
  the virtual display has no DRI3, so the iGPU encodes but does not render.
- GPU display (2026-10-28): Xvfb replaced by a headless sway compositor
  (`WLR_BACKENDS=headless`, `WLR_RENDERER=gles2` on `/dev/dri/renderD128`); OBS
  runs as a Wayland client and logs `AMD Radeon 610M (radeonsi)` instead of
  llvmpipe. No monitor needed, no KMS output taken (the host console keeps
  HDMI). Xwayland is off (OBS does not use it); X11 screen/window capture
  sources do not work under Wayland. Measured the same way as above (docker
  stats, 4-sample means, 1080p30, VA-API; animated CSS test page; recording,
  not streaming), old and new image run back to back on eris:
  | State | Xvfb | GPU display |
  |---|---|---|
  | Holding scene, idle | 0.79 core | 0.03 |
  | Animated page on air | 1.50 | 0.07 |
  | Animated page, recording | 2.02 | 0.12 |
  | Motion clip on air | 2.63 | 0.10 |
  | Motion clip, recording | 3.26 | 0.16 |
  30 fps and 0 skipped frames in both; ~490 MB RAM. Recording checked: H.264
  1920x1080 30 fps, frames show the page moving. The browser source renders
  with `BrowserHWAccel=false` (true not tried). `ffmpeg_vaapi_tex` (zero-copy)
  is now offered but the profile still uses `ffmpeg_vaapi`.
- Not verified: streaming to a real YouTube/other ingest; ~~audio from the browser
  source in a recording~~ (verified 2026-11-01, see "Broadcast booth"); noVNC through an SSH tunnel; long sessions (only ~50 s
  runs); multiple simultaneous outputs beyond one stream + one recording.
- `docker compose restart obs` keeps `/tmp`; `start.sh` deletes
  `$XDG_RUNTIME_DIR/pulse` first, because PulseAudio's old pid file there kept
  the new daemon from starting (found 2026-11-01: no sinks, `parec` refused).

### Broadcast booth (OBS desktop in the browser) — 2026-11-01
- Page: arts-collective `/studio/broadcast/desktop` (admins, `isAdmin`; 404
  otherwise), client `packages/reels/src/broadcast/BroadcastDesk.tsx`. The full
  OBS window through noVNC 1.3's `RFB` module, loaded at run time from the
  container's own copy (`/obs/desktop/core/rfb.js`), scaled to fit; a side panel
  with the program picture (MJPEG, 5 fps, 640 px), Listen (monitor sound with
  meter and volume), picture quality (noVNC quality/compression), full screen
  (Chromium's Keyboard Lock then passes Ctrl+W/Ctrl+T/Esc to OBS) and a
  clipboard box (`clipboardPasteFrom`, and OBS's clipboard back). Console and
  Desktop are tabs of one Broadcast area (`desktopHref` in the console header).
- Lease: the desk claims the same one-session lease as the console
  (`useBroadcastLease`, `packages/reels/src/broadcast/lease.ts`), so console,
  desk and the Go live card exclude each other.
- The door (`docker/obs/agent.mjs`, bottom section): a second listener on
  4458, published on the host (`docker-compose.yml` obs `ports`). The edge
  sends `https://arts-collective.com/obs/` there (NPM proxy host 23, custom
  location `/obs/` → http `192.168.0.11:4458`; advanced box exactly
  `proxy_buffering off; proxy_read_timeout 1d; proxy_send_timeout 1d;`, one per
  line). Do not add `proxy_http_version` or the Upgrade/Connection headers
  there: NPM writes them into every location of a host with websocket support
  on, and a second `proxy_http_version` fails `nginx -t`. A location that fails
  `nginx -t` takes the whole host offline (NPM renames it `23.conf.err` and
  the host answers TLS "unrecognized name"): arts-collective.com was down
  2026-11-01 08:01 to ~09:20 EST that way. `/astro` (→ 3016) was hand-written
  in `23.conf`, not in NPM's database, and was lost when NPM regenerated the
  file; it is now a UI location. Paths:
  `GET /obs/desktop/<file>` (noVNC files, public, extension allowlist, no
  traversal), websocket `/obs/desktop/ws?token=` (handshake replayed without
  the token to websockify on 127.0.0.1:6080), `GET /obs/audio?token=` (raw PCM
  s16le 48 kHz stereo from `parec --device=booth.monitor`, 192 kB/s),
  `GET /obs/program?token=&fps=&w=` (`multipart/x-mixed-replace` JPEGs from
  `GetSourceScreenshot`; fps 1–10, width 320–1280).
- Tokens: `POST /door/token {purpose}` on the agent's bearer API, only for
  the current lease holder (`X-Holder`), via server action `broadcastDoorToken`
  (`apps/arts-collective/src/lib/broadcast-actions.ts`) and `obsDoorToken`
  (`@elkdonis/services/obs`). 60 s, one connection, one purpose. Every 2 s the
  agent closes door connections whose holder no longer has the lease and renews
  the lease for those that do (an open connection means the tab is open).
- Sound: OBS's monitoring device is the `booth` sink (`MonitoringDeviceId` in
  the profile), not the default `eac` sink, because Desktop Audio captures
  `eac.monitor` and monitored sound would come back into the program as an echo.
  The agent sets "Browser page" and "Media file" to Monitor and Output on every
  connect (like the layout); other sources are heard once set so in Advanced
  Audio Properties. The page schedules PCM on Web Audio with a 120 ms cushion
  and skips ahead past 500 ms.
- Verified 2026-11-01 inside `eac-network` (probe script against obs:4458,
  holder `probe:…`): `rfb.js` 200 `text/javascript`; `%2e%2e` traversal 404;
  desktop websocket answers `RFB 003.008`; the same token again, and an audio
  token on the desktop path, refused; audio stream 200 at real-time rate
  (381,600 B in 2 s); program 16 frames in 3 s (~8 KB each); unlock closes an
  open audio stream; token without the lease 423. Talk room
  (`https://cloud.elkdonis-arts.org/call/dgjnfosd`, "Broadcast audio test",
  public, made by the service account) renders in the browser source at the
  guest-name prompt.
- Measured 2026-11-01 (docker stats, 4 samples, VA-API, Browser scene with the
  Talk page on air, not streaming): 0.075 core; with the program feed (5 fps,
  640 px) and the audio stream open 0.108; 0.076 after closing them.
  Desktop (noVNC) cost not yet measured with a real browser client.
- Talk audio, verified 2026-11-01 05:00 UTC: a headless Chrome on eac-network
  joined the test room as guest "Tone (test)" with a 440 Hz file as fake
  microphone (`--use-file-for-fake-audio-capture`); OBS's browser source
  joined as "EAC Booth" through Interact (no microphone or camera needed;
  Talk asks for a display name in its Check devices dialog). The `booth` sink
  carried the tone (mean −40.6 dB; 440 Hz at −43.6 dB, every other probed
  frequency below −96 dB), the mixer meter moved, and an OBS recording held
  H.264 1920x1080 + AAC 48 kHz stereo at the same level (no Desktop Audio
  echo). OBS in the call: ~0.65 core (CEF decodes the call video in software,
  `BrowserHWAccel=false`), back to ~0.04 after leaving. Talk warns that
  Chrome 124/127 is "not fully supported" but the call works.
- Driving OBS over VNC (wayvnc virtual pointer): clicks and typing work, Qt
  context menus do not open (right-click shows nothing). Use the source
  toolbar under the preview (Properties, Filters, Interact, Refresh appear
  when a browser source is selected) instead of right-click menus.
- Not verified (2026-11-01): ~~the page signed in, through the edge (the `/obs/`
  NPM location is not added yet);~~ the developer used the desktop, program,
  Listen and meters through the edge on 2026-11-01 (NPM access log: desktop
  websocket 101, program and levels 200); desktop CPU with a real noVNC client.

### Broadcast graphics (EBU OGraf) — 2026-11-01
- Renderer: `docker/obs/overlay/index.html` (bind-mounted at `/opt/obs-overlay`),
  loaded by OBS's "Overlays" browser source (`http://127.0.0.1:4458/obs/overlay/`,
  `shutdown: false`, no audio; one scene item on top of each of Holding,
  Browser and Media, placed by `ensureScenes` on every connect; other scenes,
  including the relay's "Feed · …" scenes, need it added with Add existing
  source). It hosts EBU OGraf v1 graphics (https://ograf.ebu.io) in layers:
  imports the graphic's module, registers its default export as a custom
  element, calls `load`, `playAction`, `updateAction`, `stopAction`,
  `customAction`, `dispose`; calls for one layer are queued in order. It gets
  the full state over server-sent events with the command that caused it
  (`last`), animates only that layer, and rebuilds without animation after a
  reconnect. Layers move in the DOM only when out of order (moving an element
  restarts its CSS animations).
- Graphics: folders with a `*.ograf.json` manifest (needs `id`, `main`,
  `supportsRealTime: true`). From the repo, `docker/obs/overlay/graphics/`
  (read-only): `eac-lower-third` (styles panel, slash, reveal, fade; the last
  three adapted from Animated Lower Thirds 1.6 by noeal-dac, MIT, licence file
  in the folder), `eac-title-card`, `eac-corner-bug`, `eac-countdown` (custom
  action `restart`), and since 2026-11-01 `eac-ticker` (label + text scrolling
  at a set speed, copies measured so the loop has no seam), `eac-caption`
  (bottom or top), `eac-quote` (dims, quotation, who said it), since
  2026-11-02 `eac-chat` (viewer chat; see "Stream relay"), sharing `graphics/_lib/eac-graphic.mjs` (OGraf base class,
  shadow DOM, fonts loaded into the document). From admins' uploads,
  `$HOME/graphics` in the obs-home volume. The first graphic with an id wins
  (repo before uploads).
- Agent (`docker/obs/agent.mjs` "Graphics"): `GET /graphics` (catalog + layers),
  `POST /graphics {op}` with `add | remove | play | stop | update | step |
  custom | move | clear` (bearer + lease; at most 16 layers; data ≤ 20 KB;
  `step` past `stepCount` plays the graphic out), `POST /graphics/upload
  {folder, files: [{path, data}]}` (folder name and every path segment
  checked, file types from an allowlist of web assets, 25 MB, needs a
  top-level manifest that scans as usable, written to a temporary folder then
  renamed), `POST /graphics/delete {folder}` (uploads only; drops their
  layers), `POST /overlay/reload`. Layers are saved to
  `~/graphics-layers.json`; `GET /status` includes `graphics`. The page and
  graphics files are served to loopback peers only (404 through the published
  port), `no-cache`.
- Studio: `GraphicsPanel` (`packages/reels/src/broadcast/GraphicsPanel.tsx`) in
  the console and the desk, replacing the Overlays panel of the same day: add
  from the catalog, a form from each manifest's JSON Schema (text, multi-line,
  numbers, booleans, enums, `gddType: color-rrggbb`; an enum shows
  `gddOptions.labels[value]` when the manifest gives one, as the GDD spec
  requires for `gddType: select`), Play (sends an update
  first if edited) / Stop / Update / Back / Next / custom actions without
  parameters, reorder, remove, Stop all, upload a folder (`webkitdirectory`),
  remove an uploaded folder. Server actions `broadcastGraphics`,
  `broadcastDeleteGraphic`; upload route `POST /api/broadcast/graphics`
  (admins; FormData `tabId`, `folder`, `path`/`file` pairs; holder rebuilt
  from the session). Uploads go through the Studio rather than a Nextcloud
  folder because an uploaded graphic's code runs in OBS and the collective's
  folders are writable by non-admins (decision 2026-11-01).
- Verified 2026-11-01 (agent commands from inside eac-obs, program
  screenshots): add, play (mid-animation frame shows the slash sequence),
  stop, update with a new style and accent, custom `restart`, title card over
  the others, page reload rebuilding the playing layers, remove all; upload of
  a two-file test graphic rendered on the program, deleted with its layer;
  refusals for a `.sh` file, a `../` folder and an unusable manifest. The panel
  rendered in headless Chrome from source against a stand-in agent: Add built
  the form from the schema, Play after typing sent `update` then `play`.
  CPU: the Overlays source ~0 (measured with the fixed overlays of the same
  day, 0.025 core).
- Limits (2026-11-01): the countdown starts again from its minutes after a page
  reload (the start time is not kept); custom actions with a parameter schema
  have no button; non-real-time OGraf and the OGraf Server API are not
  implemented; the panel against the real agent signed in is not verified.
- Over the Holding scene the title card's dim lets the holding text show more
  than its alpha suggests; OBS seems to blend the browser source's alpha
  lighter than CSS. Not investigated.
  2026-11-01: the "Overlays" source carries a Color Correction filter
  (brightness 0.2727) and a Crop/Pad filter (read with `GetSourceFilterList`);
  the agent adds no filters, so they were added in the OBS desktop. With them
  every panel and accent comes out light grey (program screenshots of the
  corner bug and lower third, which were dark on 2026-11-01). Left in place
  for the developer to decide; remove the filter to restore the colours.

### Broadcast scene editor and cameras — 2026-11-01
- Agent "Studio" (`docker/obs/agent.mjs`): `GET /studio` (scenes top-first with
  their items, program, preview, studio mode, transitions and duration, audio
  inputs with volume/mute/monitor, layout names) and `POST /studio {op}`:
  `scene.create` (adds "Overlays" on top) / `scene.rename` / `scene.remove`
  (not the program scene, not the last one) / `scene.switch` (preview in
  studio mode) / `scene.take`, `studio.mode`, `transition {name, ms}`,
  `source.add {scene, kind: web | talk | media | stream | image | text | colour
  | existing, …, layout}`, `source.remove` (removes the input too when no scene
  uses it; the agent's own sources are kept), `source.toggle`, `source.move`
  (Overlays stays on top), `source.layout {preset}`, `source.rename`,
  `source.update {settings}` (per-kind allowlist), `media.action`,
  `audio.volume / audio.mute / audio.monitor`. `POST /studio/source {name}`
  returns one source's editable settings. Layout presets: fill, left, right,
  center, pip-br/bl/tr/tl, lower, audio (out of frame: heard, not seen).
  Text keeps its font size (no bounds) unless a layout is chosen; a colour is
  put at the bottom. Names are made unique across inputs and scenes (one
  namespace in OBS). Browser sources count as audio only with "Control audio
  via OBS" on.
- Media: `source.add` with `kind: media | image` and a `path` copies the file
  from Nextcloud (WebDAV GET as the service account) into `~/media` in the
  obs-home volume (name = sha1 of the path + file name; reused when the size
  matches). The path is relative to the person's own storage folder and is
  resolved in `obsStudioCommand` (`@elkdonis/services/obs`, `resolveWithin`
  under `userStorageRoot`), never taken from the client. Picker listing:
  `obsBrowseMedia` (folders and media files only).
- Meters: the agent subscribes to `InputVolumeMeters` (event mask 1 << 16)
  and keeps each input's peak; door path `GET /obs/levels?token=` (purpose
  `levels`) streams them as server-sent events ten times a second. Needs the
  `/obs/` edge location.
- UI: `SceneEditor` (`packages/reels/src/broadcast/SceneEditor.tsx`) in the
  console's main column: transition and duration, "Preview, then take",
  scene tiles (select to edit; Switch / Preview button), + New scene, rename
  and delete; the selected scene's sources (show/hide, Place…, ↑ ↓, ×, an
  edit form per kind, media play/pause/from the start, rename); add buttons
  for each kind with a media picker over the person's files; audio mixer
  (fader −60…+10 dB, Mute, 🎧 monitor, meter). Server actions
  `broadcastStudio`, `broadcastStudioCommand`, `broadcastSourceSettings`,
  `broadcastBrowseMedia`.
- Cameras: `CameraPanel` (`packages/reels/src/broadcast/CameraPanel.tsx`) in
  the console and desk side panels (same tab, same lease). getUserMedia with
  camera/microphone pickers and 720p/1080p. "Send to OBS": MediaRecorder
  (WebM VP8/Opus preferred, 250 ms chunks) over the door websocket
  `/obs/camera/ws?token=&name=&scene=&layout=` (purpose `camera`; a minimal
  RFC 6455 server in the agent); ffmpeg decodes, re-encodes H.264 on the iGPU
  (`h264_vaapi`, keyframe every 30 frames, ≤ 1280x720, AAC) and sends MPEG-TS
  to `udp://127.0.0.1:2300N`; OBS media source "Camera · <name>" reads it,
  placed in the chosen scene. The agent ends a camera after 8 s without data.
  "Record to my files": a second MediaRecorder (MP4/H.264 where the browser
  offers it, else WebM; 6–10 Mb/s), parts of 8 MB uploaded while recording
  through `POST /api/broadcast/camera-upload` (start, part, finish, abort;
  admins) into Nextcloud chunking v2 (`davChunkStart/Put/Finish/Abort` in
  `dav.ts`), file `users/<folder>/Private/Video/Camera/Camera <date>.<ext>`.
- Clean shutdown (`docker/obs/start.sh`): PID 1 traps SIGTERM, stops the OBS
  restart loop (`~/.obs-stopping`), sends OBS SIGTERM and waits up to 15 s so
  it saves the scene collection, then stops sway. Before this a container
  stop killed OBS after Docker's grace period and lost changes made since its
  last save (found 2026-11-01: a mute and a new scene). Stop now takes ~5 s.
- Dead peers on the door (found 2026-11-01: a removed browser container left
  its camera socket open and the open door kept renewing the lease, locking
  the studio): camera idle timeout 8 s, program stream drops a viewer whose
  send does not drain in 10 s, audio stream drops one backed up for 15 s,
  TCP keepalive on door sockets.
- Verified 2026-11-01: every studio command against OBS (scene create,
  colour/web/text/image sources, layout, hide, reorder, rename, update,
  volume, mute, monitor, switch, studio mode + take, remove) with program
  screenshots; image fetched from Nextcloud (`EAC_Network/openbook.jpg`) into
  `~/media`; changes kept across `docker compose restart obs` after the
  shutdown fix; the SceneEditor in headless Chrome against the real agent
  through a proxy holding a test lease (new scene, image from the picker,
  text, switch, hide, layout, fader −12 dB, mute; the program showed it);
  camera ingest with an ffmpeg-made VP8/Opus WebM and with Chrome's own
  MediaRecorder (fake camera) shown in OBS as picture-in-picture; a 12 s
  recording sent as one part and finished; Nextcloud chunking sequence with
  curl (6 MB + 1.2 MB parts assembled to 7,234,567 bytes, then deleted);
  camera idle timeout (silent at 3.0 s, closed at 12.0 s, lease freed).
- Not verified (2026-11-01): any of this signed in through arts-collective
  (server actions, the upload route) or through the edge; meters in a browser
  (need the door); camera latency and CPU measured; a long recording with
  several parts into Nextcloud.

### Recordings, phone capture and guest cameras — 2026-11-01
- Services `@elkdonis/services/recordings` (`packages/services/src/recordings.ts`):
  chunked uploads (Nextcloud chunking v2, `davChunk*` in `dav.ts`) into
  `users/<folder>/Private/Video/Recordings` (Studio) or `…/Camera` (booth
  Camera panel; `obs.ts` `cameraUpload*` delegate here); `listRecordings`,
  `renameRecording`, `deleteRecording` (path must be inside the person's
  Recordings, Camera or Broadcasts folder; Broadcasts added 2026-11-01); phone capture codes (8 characters from a 31-letter alphabet without
  0/O/1/I/L, 30 minutes, one recording, at most five open per person). Upload
  ids and codes are in the app process's memory: an app restart forgets them.
- Routes (arts-collective): `POST /api/studio/recordings/upload` (signed in;
  start/part/finish/abort), `POST /api/capture` (signed in; new code) and
  `GET /api/capture?code=` (owner only; status and result), `POST
  /api/capture/<code>?op=recording|failed|start|part|finish` (no session; the
  code is the credential; file goes to the code owner's Recordings), pages
  `/c/<code>` (phone, public, noindex, no-referrer) and
  `/guest/camera/<key>` (guest camera, public, noindex, no-referrer).
- Studio (`packages/studio`): `@elkdonis/studio/capture` (`Capture`: this
  computer's camera with device picker, the screen, or Phone; 1 s
  MediaRecorder slices, 8 MB parts while recording; `PhoneHandoff`: shows
  `<host>/c/XXXX-XXXX` and polls every 2 s; `PhoneCapture`: front/back camera,
  big buttons, parts while recording) and the Recordings kind
  (`@elkdonis/studio/recording`, `kind=recording`: list from both folders,
  player through `/api/media/`, rename, download, delete, "Use in a reel"
  → `/studio?kind=video&clip=<path>`, which fills an open reel's empty first
  clip slot). The reel editor's video slots gained "From my phone…"
  (`captureEndpoint` prop; the phone clip fills the slot by path, no second
  upload).
- Booth recordings in the Studio (2026-11-01): the Recordings kind's drawer has
  "In the booth" for admins (`booth` prop; actions `boothRecordingsAction`,
  `boothCopyRecordingAction`, `boothRemoveRecordingAction` in
  `apps/arts-collective/src/lib/recording-actions.ts`, admin-checked). It
  lists the obs container's `/recordings`; "Copy to my recordings" calls agent
  `POST /recordings/copy {file, path, by}`, which remuxes MKV to MP4
  (`-c copy`, faststart) and PUTs it to
  `users/<folder>/Private/Video/Broadcasts/<name>.mp4` in the background,
  with step and bytes sent in `GET /recordings` (`copy`); the page polls every
  2 s and opens the copy when it is done. "Delete from the booth" calls
  `POST /recordings/remove`. Both routes are lease-free (`LEASE_FREE` in the
  agent), so they do not take the booth from whoever has it, and refuse the
  file OBS is recording (the newest while `GetRecordStatus.outputActive`).
  Copy state lives in the agent's memory. Conversion files (`.upload-…`) are
  hidden from the list. "Edit with overlays" is now "Cut and add overlays".
- Guest cameras: `GuestCamera` + `whip.ts` (`packages/reels/src/broadcast/`):
  our own WHIP client (OPTIONS for `Link` ICE servers, non-trickle POST of
  the offer after gathering, H.264 preferred via `setCodecPreferences`,
  `maxBitrate` by quality, DELETE on leave and on `pagehide`). Publishes to
  `${RELAY_WHIP_BASE:-https://live.arts-collective.com}/in/<key>/whip`; the
  key is a relay feed key ("Copy camera link" in the relay's Feeds panel when
  `RELAY_GUEST_CAMERAS=1`). The relay side (WebRTC on 8889, ICE 8189, RTSP
  8554 for OBS, auth: webrtc may only publish to an existing `in/<key>`) is
  the relay session's; see "Stream relay" and
  `docs/open/WEBCAM_SOFTWARE_SURVEY_2026-11-01.md` for the transport
  findings and the hand steps (router forward 8189 UDP+TCP; NPM host
  `live.arts-collective.com` → 192.168.0.11:8889).
- Verified 2026-11-01: WHIP from headless Chrome (fake camera) through our
  client to a throwaway MediaMTX: H.264 Baseline 1280x720 + Opus, RTSP read
  both tracks, an OBS media source showed the picture and carried the audio;
  phone capture in Chrome against a stand-in server with the routes' request
  shapes (phone recorded 5.5 s, one part, "Sent"; the computer's handoff went
  waiting → recording → done and returned the result); the computer's Camera
  recorder (start with name, one part, finish, 4.07 s measured); type checks
  of studio, reels and arts-collective. Not verified: any of it signed in
  against the real routes and Nextcloud (the chunked sequence was verified
  separately with curl), a real phone, a real guest from outside (needs the
  hand steps).

### Clip template and clip editor (Reels) — 2026-11-01 (cuts and timeline added later the same day)
- Template `clip` (`packages/reels/src/templates/clip.tsx`, registered in
  `templates/index.ts`): one recording (`edit.clip`) in a frame chosen by
  `edit.format` (landscape 1920x1080, portrait 1080x1920, square 1080x1080;
  `ReelTemplate.dimensions`, applied by `calculateMetadata` in `root.tsx` and
  by `templateSize` in the player), `edit.fit` cover/contain. An end card
  follows the clip (3 s) only when `endCard.title` or `link` is set; music
  under it, at a quarter while the clip has speech. Sizes scale with the short
  side (1080 = 1). Fonts fall back to DejaVu in the renderer.
- Cuts (2026-11-01): `clip.segments` = the parts of the source kept, in source
  seconds, in order (`ReelSegment`); `clip.sourceSeconds` = the file's length.
  Played back to back with a `<Series>` of `OffthreadVideo trimBefore`, each
  part premounted a second ahead. An edit without segments reads as one part
  `trimStart` for `duration` (`clipSegments`). The editor keeps `trimStart` =
  the first part's start and `duration` = the total kept, so older readers
  (`probeClips` in the renderer) stay consistent; the renderer also writes
  `sourceSeconds` from the file.
- Overlays (2026-11-01): `edit.overlays.items` (`ReelOverlayItem`: `kind`,
  `at` and `seconds` in the edited clip's time, `seconds: 0` = to the end)
  of seven kinds: `title`, `lower` (styles panel | slash | reveal | fade, as
  the booth's graphic), `caption` (bottom/top), `quote`, `bug` (corner label),
  `image` (a picture by path, corner, size 5–60 % of the short side), `ticker`
  (label + scrolling text; copies estimated from the text length, no
  measuring, so renders match). Drawn in layers: picture, label, ticker, lower
  third, caption, quote, title. The 2026-11-01 fields (`title`, `lowerThird`,
  `bug`) are read into items by `overlayItems()` and dropped on the first
  timeline edit. `accent` stays on `overlays`. The renderer downloads picture
  overlays (`overlays.items[].image`) with the other files; the queue-time
  path check already walks the whole edit.
- Editor: `Timeline` (`packages/reels/src/editor/Timeline.tsx`) under the
  preview for clip reels, following the Player through its ref
  (`frameupdate`, `seeked`). Rows: Recording (the whole file with a 24-frame
  filmstrip drawn from a hidden video, kept parts outlined with drag handles,
  cut parts hatched; click a cut part → "Put it back"), Edit (kept parts back
  to back, then the end card), overlay lanes (bars laid out without overlap;
  drag to move, right edge to lengthen, click to edit below). Tools: Split
  at the playhead, "Cut from here…" / "…to here" across any span, zoom 1–32×,
  a selected part's From/To fields and "Start/End at playhead", "+ <kind>"
  buttons adding at the playhead, an inspector per kind (picture: from my
  files or upload into the project folder as slot `logo`), Duplicate, Remove.
  Keys while it has focus: space, S, Delete. The source length is probed from
  the file when the clip came by path. `ClipControls` keeps the frame, fit
  and accent; the slot's "Start at" is hidden for clip reels.
- Verified 2026-11-01: a landscape render in the reel-render image from a 12 s
  test video with three kept parts (1–3, 5–8, 9–11 s) and all seven overlay
  kinds: 300 frames (7 s + end card), 10 s of 1920x1080 in 12.1 s; the
  source timecode on stills at output 0.67, 2.5, 4.5 and 6.17 s read 1.667,
  5.5, 7.5 and 10.167 s, as the cut list gives. The Timeline with a live Player
  in headless Chrome: length probed (12 s), Split at 3 s, cut 6–8 s (label
  "cut 0:02.0"; segments 0–3, 3–6, 8–12; duration 10), three overlays added at
  the playhead and laid out in three lanes, filmstrip 24 pictures, a mouse drag
  moved a lower third 1.0 → 2.4 s, a drag on a part's right handle trimmed it
  3.0 → 2.36 s. Types: reels, studio, arts-collective. Not verified: anything
  signed in (no admin test account), a render queued from the Studio, the
  timeline on a 27-minute source (filmstrip seeks over range requests).
- Render engines (2026-11-01, `packages/reels/render/render.mjs`, worker
  restarted 2026-11-01 ~13:45 EST): the timeline writes one edit; the worker picks
  the engine. A `clip` edit with no overlay items, no end card, no music and
  no bars (fit `contain` with a source of another shape) goes through ffmpeg
  alone (`needsRemotion`, `renderCutsOnly`): one input per kept part (`-ss`/`-t`
  before `-i`), `concat`, scale + crop to the frame, libx264 CRF 20 veryfast,
  AAC 48 kHz, 30 fps, thumbnail at 2 s. Everything else goes through
  Remotion; the log line names the reason ("Remotion path (overlays)").
  `REEL_FFMPEG_PATH=off` forces Remotion. `clipSegmentsJs` copies
  `clipSegments()` from clip.tsx; change both together.
- The ffmpeg used is the compositor's own (`@remotion/compositor-linux-x64-gnu`,
  ffmpeg n7.1 and ffprobe). Its filters (2026-11-01): trim/atrim, concat,
  scale, zscale, crop, rotate, transpose, h/vflip, loudnorm, silencedetect,
  volume, amix, adelay, atempo, aresample, palettegen; no `pad`, `overlay`,
  `eq`, `setsar`, `fps`, `drawtext`, `asplit`, `showwavespic`. Encoders include
  libx264, aac, libfdk_aac, libmp3lame, libvpx-vp9, prores_ks, png, mjpeg; no
  WebP decoder. Remotion owns this binary (it is linked to its compositor), so
  it is not replaced; a fuller ffmpeg for our own jobs would be a second binary
  in the image.
- Pictures (2026-11-01): before a Remotion render, PNG/JPEG overlays and the
  logo larger than the frame's long edge are scaled down to it (artwork and an
  image `extra` to twice that, for the zoom), PNG kept as PNG (`shrinkPictures`,
  ffprobe for the size). SVG, GIF and WebP pass through. FX WebMs
  (`public/reel-fx`) are not touched.
- Frame cache (2026-11-01): `offthreadVideoCacheSizeInBytes` = 1 GB
  (`REEL_FRAME_CACHE_MB`). Without it a 60 s render from a 10-minute 1080p
  source reached the container's 6 GB limit and the compositor was killed
  (SIGKILL) on one of two runs; with it the peak was 4.45 GB.
- Measured 2026-11-01 in the reel-render image, 1080p H.264 source of 10 min
  (a 12 s test video looped): 60 s kept in two parts, ffmpeg path 7.9 s,
  Remotion 82.5 s (cache capped; 92.5 and 129.6 s before, bundling excluded).
  6 min 10 s kept in three parts, ffmpeg path 41.4 s; source timecode at
  output 0.0, 59.9, 60.1, 179.9, 180.1 and 369.4 s matched the cut list to a
  frame. Remotion path with a 6000x4000 JPEG logo: "scaled to fit 1920 px",
  rendered. Not verified: a job queued from the Studio taking the ffmpeg path.
- Worker image (2026-11-01, `docker/reel-render.Dockerfile`, recreated
  ~14:00 EST; previous image tagged `eac-reel-render:prev-20261101`): adds
  a static ffmpeg/ffprobe 9.0.2 (`mwader/static-ffmpeg:9.0.2-1`, 502 filters)
  in `/usr/local/bin`, and whisper.cpp v1.9.5 `whisper-cli` built from source
  with `ggml-small.en.bin` (487 MB, sha256 checked at build) in
  `/opt/whisper`. Remotion keeps its own ffmpeg; the cut-only path still uses
  Remotion's, the transcripts use 9.0.2.
- Transcripts (2026-11-01, migration 229 `reel_transcripts`, applied
  2026-11-01 ~14:20 EST at the developer's request; while a table is missing
  the worker logs "reel_transcripts is missing" and checks once a minute).
  `queueReelTranscript` / `getReelTranscript` in `services/reels.ts` (path
  rule as an edit's), actions `transcribeVideo` / `getVideoTranscript`,
  `VideoActions.transcribe/getTranscript` (optional). Worker: renders first,
  then one transcript: ffmpeg → 16 kHz mono WAV → `whisper-cli -ojf` (6
  threads) → words `{w, s, e, b?}` in source seconds, `b: 1` on the first
  word of each whisper phrase, bracketed sound notes dropped.
  `render.mjs --transcribe <file>` prints the words (test). Measured: 2 min of
  the 2026-11-01 Talk recording, 224 words in 13.8 s (about 3 min per 27 min,
  estimated). small.en gave no punctuation on that reading.
- Text kinds (2026-11-01): `text` (free text: x/y centre in %, size % of the
  short side, colour, font sans/serif/typewriter, bold, align, box) and
  `subtitles` (one item per clip, `cues` in SOURCE seconds with their
  `words`; style: place, size, colour, font, box, `highlight` = spoken-word
  colour). The template maps each output frame to source time
  (`sourceFrame`), so cues follow later cuts; editing a cue's text drops the
  word highlight for that line (`cueWordsMatch`). `templates/subtitles.ts`:
  `cuesFromWords` (close at a phrase start, a 0.8 s pause, 64 characters,
  5.5 s), `cueAt`, `toSrt`. Editor: `editor/TextFields.tsx` (TextFields;
  SubtitlesPanel: Make subtitles from speech → Use the transcript, style,
  editable line list with go-to, start/end at playhead, T = turn into a text
  overlay, ✂ = cut the line's stretch from the clip, ×; Download .srt in
  output time), a lines row under the overlay lanes in `Timeline.tsx`.
- Verified 2026-11-01: a portrait render (new image) from 2 min of the Talk
  recording, parts 0–12 and 24–40 s, 34 cues from its transcript with word
  highlight, one edited line and a text overlay: 28 s in 23.9 s; stills show
  the highlight, the edited line plain, the line at output 13 s = source 25 s.
  Timeline in headless Chrome with a stand-in transcript provider: 34 lines,
  15 shown on the lines row, 19 marked cut, an edit kept, ✂ on a line cut
  4.4–5.38 s, the preview showing the line. Not verified: anything signed in,
  a transcript job end to end from the Studio.
- Subtitles and text without Remotion (2026-11-01, render.mjs `editToAss`,
  worker restarted ~14:44 EST): an edit whose overlays are only `text` and
  `subtitles` (no end card, no music) goes through the ffmpeg path with an
  ASS file burned in by libass (`ass=…:fontsdir=/usr/share/fonts/truetype`,
  the image's ffmpeg 9). Fit `contain` uses `pad` there too. Matching rules:
  DejaVu Sans/Serif/Sans Mono (what the renderer's CSS falls back to); ASS
  size = CSS size x 2384/2048 (libass sizes by ascent + descent); WrapStyle 1
  (greedy, as the browser); BorderStyle 4 with a transparent outline (one box
  per line; style 3 boxes each karaoke word and the translucent boxes show
  seams); word highlight as `\k` karaoke (`\1c` highlight, `\2c` base);
  text `\an5\pos(x,y)\fad(267,267)`. Differences from Remotion: line
  height and box padding a little tighter; `align` left/right of a
  multi-line text overlay is not reproduced (centred on its point).
  Measured: the portrait test above, 28 s of video in 3.4-3.6 s (Remotion
  23.9 s); stills compared side by side at four times.
- Pauses and sound (2026-11-01, deployed ~15:02 EST): the transcript job also
  runs ffmpeg `volumedetect` + `silencedetect` on the same 16 kHz audio
  (threshold = peak - 28 dB within -80..-30, 0.4 s minimum, silences under
  0.1 s apart joined) and stores `pauses` [{s, e}] (migration 231
  `reel_transcripts.pauses`, applied 2026-11-01 19:59 UTC by another session's
  `db:migrate` run together with 230; without the column the words are stored
  and the silences dropped). `editor/Pauses.tsx`: "Pauses…" in the
  timeline bar, minimum length (0.4-3 s, default 0.8) and air kept each side
  (0-0.5 s, default 0.15), markers on the Recording row (click = cut), Cut
  all / Cut one; without stored silences the gaps between words stand in.
  Transcript state is shared (`useTranscript` in TextFields.tsx). Sound:
  `edit.levelAudio` (default on, "Even out the sound" in ClipControls) runs
  `loudnorm=I=-16:TP=-1.5:LRA=11` with the video copied after a clip render,
  either path. The 2026-11-01 Talk recording measured -66 dB mean, -42 dB
  peak (the booth's Talk audio is recorded far too low; not investigated).
  Verified: the excerpt's silences (28, 35 s of 120 s) against its word
  gaps; a levelled render measured -16.2 LUFS, peak -1.5 dB; the panel in
  headless Chrome (6 pauses in the kept parts, Cut all 48 → 38.2 s, 8 parts).
- Undo and snapping (2026-11-01; deployed 22:40 UTC with the arts-collective
  rebuild, which also carried the tree's classifieds / `packages/fonts` /
  `packages/direct-edit` and tenancy-floor work; edge-verified the built CSS
  and JS carry `.tl-snap` and the Undo/Alt titles; not tried signed in).
  `editor/history.ts` `useEditHistory` (VideoKind): each change pushes the
  edit before it, changes under 700 ms apart are one step (a drag, typing),
  100 steps, reset when another reel opens; Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z,
  Ctrl+Y outside text fields; ↶ ↷ in the timeline bar. Snapping in
  `Timeline.tsx` (Snap button, Alt while dragging = free): overlay bars snap
  either edge to 0, the end, the playhead, cuts and other overlays' edges
  within 8 px; part edges on the Recording row snap to the playhead, other
  parts' edges, pause edges and breaks between words of 0.12 s or more,
  within 8 px but never more than 0.4 s (first try snapped to a boundary
  inside speech and clipped a word); a dashed guide shows the snap. Verified
  in the harness: a text bar dropped near the 12 s cut ended exactly on it
  (at 8.0, 4 s long); one undo restored it, a second removed the bar, two
  redos brought both back; a part's end dragged near 11.0 s snapped to the
  pause at 11.12 s.
- Waveform and Words (2026-11-02; arts-collective rebuilt ~01:45 UTC and the
  worker restarted; edge-verified the served CSS/JS; not tried signed in). Worker: `wavPeaks` in render.mjs reads
  the 16 kHz WAV it extracts for whisper and stores `{rate: 20, data: base64}`
  in `reel_transcripts.peaks` (migration 232, **unapplied** at the time of
  writing; without it the UPDATE's 42703 is caught and there is no waveform):
  one byte per 50 ms, the loudest sample in dB under the recording's own peak,
  -48..0 dB → 0..255. Written right after the audio is extracted (0.2 s on the
  2-minute excerpt), before whisper. On the excerpt: median 30 inside
  silences, 173 in speech; 2400 bytes (3.2 kB as JSON) per 2 minutes.
  Editor: `editor/Words.tsx` `Waveform` (an SVG stretched to the Recording
  track, max-pooled to 12 000 columns, in a dark band over the lower half of
  the filmstrip; a light fill alone vanished on white frames) and
  `WordsPanel` ("Words…" in the timeline bar): the transcript as text in
  paragraphs (whisper segment starts or pauses of 1.5 s+), cut words struck
  through, the playhead's word underlined, search on whole words with
  Enter/↑/↓, click = seek, drag or Shift+click = select, then Cut (or
  Delete) / Put back. A cut runs from the middle of the gap before the first
  word to the middle of the gap after the last, so the join keeps one pause.
  Verified in the harness with the excerpt's real words and peaks: search
  "emotional bodies" 2 matches, cut → parts 0-7.84, 9.56-12; drag across a
  paragraph break selected "come to life Such", Delete cut 4.81-6.94, Put
  back and undo restored/reapplied it. The toolbar has a fixed height: the
  selection buttons appearing had pushed the text down under the pointer.
- Sound effects (2026-11-02; deployed ~05:00 UTC with an arts-collective
  rebuild that also carried other sessions' direct-edit, classifieds and relay
  changes then in the tree; worker restarted with the mixing code; served
  CSS/JS edge-verified, tenant-smoke 9/9; not tried signed in). Overlay kind `sound` (`sound` ref, `volume` 0-1.5,
  `seconds` = the sound's length, from its credit or the file's metadata).
  Library: network `EAC_Network/oad/Private/Sounds/<Category>/` (created
  2026-11-02 with Interface, Impact, Whoosh and transitions, Meme and
  reaction, Ambience, Other and a README; empty) and personal
  `<own>/Private/Sounds/` (upload slot `sound`, 20 MB). Each Sounds folder's
  `sounds.json` credits files by relative path (`licence`, `source`,
  `author`, `tags`, `duration`); services `listReelSounds`, `shareReelSound`
  (copy to a network category with its credit). Freesound: `searchFreesound`
  / `importFreesound` with `FREESOUND_API_KEY` (compose passes it to
  arts-collective; empty = the tab is not offered): CC0 only (filter plus a
  per-sound check of the licence URL), up to 12 s, the HQ MP3 preview from
  `cdn.freesound.org` copied into `<own>/Private/Sounds/Freesound/` with its
  credit. The API is free for non-commercial use (its terms). Editor:
  `editor/Sounds.tsx` (Library by category, Mine with upload and Share,
  Freesound tab; one shared preview player; volume; credit line). Render:
  Remotion `<Audio>` in a Sequence; the ffmpeg path (now also taken with
  sound items) adds each file as an input, `atrim,aresample,aformat,adelay,
  volume`, then `amix normalize=0 duration=first` over the clip's sound (or
  `anullsrc` when it has none). `SOUNDS_PATH` lets jobs read the network
  library; folder mode copies overlay pictures and sounds named in reel.json.
  Verified: a 2 kHz beep at 1.0 s and a 60 Hz boom at 8.0 s rendered in their
  windows on both paths (band levels -24.9 / -32.6 dB inside, -91 dB either
  side; ffmpeg 1.7 s, Remotion 11.3 s for 12 s); the picker in the harness
  (pick from Library read Boom's 1.0 s from the file; Freesound search + Add
  filled the item). Not verified: a live Freesound call (no key yet), the
  network listing through the app, playback for a non-`oad` member (refused
  by design, as for network music). Kenney's site answers scripted
  downloads with 403; its CC0 packs have to be fetched in a browser.
- Earlier 2026-11-01 (superseded by the above): in/out sliders and one each of title,
  lower third and bug in `ClipControls`; a portrait render with those
  rendered in 11.0 s for 9.0 s.

### Stream relay (one stream in, many out) — 2026-11-01
- Compose service `relay` (container `eac-relay`, image `eac-relay`,
  `docker/relay/Dockerfile`): node:22-alpine + ffmpeg + the MediaMTX 1.21.1
  binary. eac-network only, no published ports; 2 CPUs, 1 GB. Volume
  `relay-data` (`/data/feeds.json`). `docker/relay/start.sh` writes
  MediaMTX's config on every start: RTMP on 1935 only (RTSP, HLS, WebRTC,
  SRT off), API on `127.0.0.1:9997`, auth by HTTP to the agent; paths
  `program` and `~^in/[A-Za-z0-9_-]{8,64}$`. If MediaMTX or the agent exits,
  the container exits and restarts.
- Ports (2026-11-01): RTMP 1935 published on `${RELAY_RTMP_BIND:-127.0.0.1}`,
  so closed to the outside unless `.env` sets `RELAY_RTMP_BIND=0.0.0.0` (and
  the router forwards WAN 1935). `RELAY_PUBLIC_INGEST_URL` (arts-collective)
  replaces `rtmp://relay:1935/in` in Feeds in and adds the Zoom field names.
  2026-11-01: open (`RELAY_RTMP_BIND=0.0.0.0`, router forwards WAN 1935);
  verified by outside TCP probes, which the relay logged with their public
  source addresses (Docker does not rewrite them). The router does no hairpin
  NAT for 1935: on the LAN use `rtmp://192.168.0.11/in/<key>`.
  Plan and open steps: `docs/open/BROADCAST_BOOTH_AND_RELAY_PLAN_2026-11-01.md`.
- WHIP and RTSP (2026-11-01, for browser guest cameras; guest page and WHIP
  client are the booth session's, `packages/reels/src/broadcast/whip.ts`,
  `/guest/camera/<key>`): MediaMTX WebRTC on 8889 (WHIP at
  `/in/<key>/whip`) with ICE on UDP 8189, both published on
  `${RELAY_WEBRTC_BIND:-127.0.0.1}`; allowed origin https://arts-collective.com;
  ICE host candidates from `eth0` only (`RELAY_WEBRTC_INTERFACES`): 127.0.0.1
  was offered first and ffmpeg's WHIP muxer, which uses one candidate, failed
  with "Connection refused"; `RELAY_WEBRTC_HOSTS` adds the public host,
  `RELAY_TURN_URL` + `RELAY_TURN_SECRET` a coturn server (AUTH_SECRET form),
  `RELAY_WEBRTC_TCP=1` TCP ICE on 8189. RTSP on 8554, TCP only, not published:
  OBS reads every feed as `rtsp://obs:…@relay:8554/in/<key>` with
  `ffmpeg_options: rtsp_transport=tcp` (`addFeedScene`), because WHIP guests
  send Opus and the RTMP side served the video track only. These settings are
  in `docker/relay/start.sh`, baked into the image: rebuild
  (`docker compose build relay`) and recreate after editing it.
  `RELAY_GUEST_CAMERAS=1` (arts-collective) adds "Copy camera link" to Feeds in.
  Auth over WebRTC (2026-11-01, after the booth session's transport review):
  only publish to an existing `in/<key>` is allowed; `program` and every read
  (WHEP) are refused even as `obs`, because WHIP arrives through NPM from a
  private address. Checked with `/auth` requests: webrtc publish in/<key> 200;
  webrtc publish program, read program, read in/<key> as obs 401; rtsp read
  and rtmp publish as obs from 172.16.x 200.
  Verified 2026-11-01 on the relay with ffmpeg 8.1 `-f whip` from eac-network:
  H.264 Constrained Baseline 1280x720 + Opus 48 kHz stereo reached the path
  (source `webRTCSession`); RTSP read as obs returned both tracks; a wrong key
  over WHIP 401; RTSP without credentials 401. Not verified: a browser guest
  through NPM, ICE from outside, OBS playing a WHIP feed from this relay (the
  booth session saw picture and Opus audio in OBS against a copy of the relay
  image). 2026-11-01 later: "Add to OBS" on a WHIP feed from this relay gave
  `OBS_MEDIA_STATE_PLAYING` with the RTSP URL and `rtsp_transport=tcp`, and
  the relay counted one reader; OBS's volume meter reported nothing for the
  source, so audio in OBS is unverified here.
- `docker/relay/agent.mjs` (bind-mounted; restart the container after
  editing): HTTP on `relay:4457`, bearer `RELAY_AGENT_SECRET`. Answers
  MediaMTX's `/auth` (loopback only): publish `program` needs user `obs` +
  `RELAY_OBS_PASS` from a private address; publish `in/<key>` needs a key in
  `feeds.json`; read is allowed from inside the container (the fan-out) or as
  `obs` from a private address (OBS media sources). A public address refused
  10 times in 10 minutes is refused everything for 10 minutes (event
  `ip_blocked`); private addresses are never blocked, since Docker may show
  outside clients as the bridge gateway (whether it does is **unknown** until
  the port is opened). Refusals log at most one line a minute per address.
  Verified 2026-11-01 by posting MediaMTX-shaped requests to `/auth` with
  made-up addresses (obs from 172.16.x 200, from 203.0.113.5 401 for publish
  and read; feed key from a public address 200; after 10 bad keys that
  address 401 even with a good key while another public address got 200;
  12 bad keys from 172.16.7.1 did not block it), and by real publishes from
  eac-network. Fan-out: while outputs are armed and `program` has a publisher,
  one `ffmpeg -c copy -f flv` per output (no encode); each retries on its
  own (2, 4 … 30 s; reset after a minute up); an output whose process ends
  because the program ended goes to `waiting`, not counted as a failure.
  Stream keys are held in memory only and never returned (status shows
  `protocol://host:port`). Last 200 events in memory.
- OBS side (`docker/obs/agent.mjs`): `POST /stream/relay` sets the stream to
  server `rtmp://relay:1935`, key `program?user=obs&pass=$RELAY_OBS_PASS`
  (MediaMTX's documented OBS form); `POST /feeds/add {key,label}` creates or
  updates scene "Feed · <label>" with an `ffmpeg_source` reading
  `rtmp://relay:1935/in/<key>?user=obs&pass=…` (close when inactive,
  reconnect 2 s), filling the frame. obs gets `RELAY_OBS_PASS` from compose.
- Data: `stream_destinations` (migration 226, applied 2026-11-01): label,
  preset (`youtube`/`facebook`/`custom`), server, `key_enc` (AES-256-GCM,
  HKDF from `CONNECTIONS_KEY`, info `stream_destinations v1`, prefix `s1.`),
  `enabled` (the card's checkbox). Network-wide, admins only.
  `stream_events`: append-only go_live, stop (each output's live seconds,
  bytes, retries, last error), destination_added/updated/removed,
  feed_added/removed. Services: `@elkdonis/services/relay`
  (`packages/services/src/relay.ts`); keys are unsealed only in `armRelay()`.
- UI: the Video kind's Go live card (`packages/reels/src/editor/LiveCard.tsx`)
  renders `RelayPanel.tsx` when the page passes `relay` (arts-collective
  `/studio`, when `RELAY_AGENT_URL` and `RELAY_AGENT_SECRET` are set): saved
  destinations with checkboxes, add/edit/remove, "Go live to N
  destinations", per-output state, Feeds in (publish address, copy key, Add
  to OBS, remove), Recent (from `stream_events`). Server actions in
  `apps/arts-collective/src/lib/relay-actions.ts`. Go live: claim the lease,
  arm the relay, point OBS at it, start the stream; if OBS fails to start,
  the outputs are disarmed. Stop: OBS stream off, then outputs off, summary
  to `stream_events`. Without `relay`, the card keeps the single-destination
  form. The console's own Stream section (`/studio/broadcast`) still sets a
  server and key directly; it does not arm the relay.
- Feeds in is one component, `packages/reels/src/editor/RelayFeeds.tsx`, used
  in the card and (2026-11-01) on the console and the booth desk through their
  `extra` slot (`extra?: ReactNode`, rendered after Overlays inside
  `BroadcastTabContext`, `packages/reels/src/broadcast/tab-context.ts`; the
  pages pass `<RelayFeedsSlot />`, `apps/arts-collective/src/components/studio/
  RelayFeedsSlot.tsx`). There "Add to OBS" uses the page's own lease (tab id
  from the context); in the card it claims the lease first and releases it
  after when not live. A function slot was not possible: the pages are server
  components and cannot pass a function to a client component.
  Deployed with build `SKIgxo8D3-wwVaKiNewfX` (2026-11-01 ~05:55 UTC).
  Verified signed in (headless Chrome, throwaway admin, deleted): the console
  shows its panels only while holding the lease; headings in order Scenes,
  Browser scene, Overlays, Feeds in, Stream, Recordings; adding and removing a
  feed from the console worked; no script errors. "Add to OBS" from the
  console was checked in a harness only (tab id from the context), not
  against OBS.
- Verified 2026-11-01 (agent driven directly; ffmpeg publishers and ffprobe
  in throwaway containers on eac-network; two throwaway MediaMTX receivers
  `relay-rx1`/`relay-rx2`): a 1080p30 H.264 + AAC program reached both
  receivers (ffprobe: h264 1920x1080 ~30 fps, aac 48 kHz); a third output to a
  missing host retried with backoff while the other two stayed up;
  publishing `program` without credentials, publishing to an unknown feed
  key, reading `program` without credentials or with a wrong password were
  each refused ("Operation not permitted"); reading as `obs` worked; a feed
  published to `in/<key>` came online and offline in the agent's status; a
  program ending moved outputs to `waiting` with no error.
- Verified 2026-11-01, services layer (script in eac-admin calling
  `@elkdonis/services/relay` against the live tables; rows deleted after):
  keys stored as `s1.` seals with no plaintext; editing without a key keeps
  the stored one; an unticked destination is not sent; a trailing `/` on a
  server is joined correctly; stop summary and events written.
- Verified 2026-11-01, real OBS (script making the same calls as
  `relay-actions.ts`, under the lease): OBS on the Browser scene (a Talk room
  page) → relay → `relay-rx1` and `relay-rx2`: both probed as H.264 1920x1080
  ~30 fps + AAC 48 kHz stereo; 34 s live each, 0 retries, 0 skipped frames.
  `docker stats` while streaming: relay 0.02% of one core (stream copy, two
  outputs), obs 7.4%. `/feeds/add` created "Feed · <label>"; with
  close-when-inactive off, its media source reached `OBS_MEDIA_STATE_PLAYING`
  and the relay counted one reader on the feed path. The program scene was
  not changed; the test scene was removed afterwards.
- UI: `RelayPanel` rendered in headless Chrome from source with stand-in
  actions (idle, live with one output retrying, add form + Feeds in open);
  no script errors.
- Verified 2026-11-01, signed in on the deployed arts-collective (headless
  Chrome, throwaway admin account at the developer's request, deleted after):
  two destinations added through the card (saved, shown with key endings,
  "added a destination" under Recent); Go live while the developer's console
  tab held the lease was refused ("<name> has the studio open"); with the
  lease free, Go live → both receivers H.264 1920x1080 ~30 fps + AAC stereo,
  rows "live · 0:42"; Stop → OBS off, outputs closed, `go_live` and `stop`
  rows written (64 s live each, 0 retries). Leaving the page released the
  lease (pagehide beacon).
- Found in that run: after Stop the card kept renewing the lease (until the
  tab closed), because its success check was `'value' in r` and a server
  action's `value: undefined` arrives without the key; `RelayPanel` now checks
  `r.ok`. Deployed with arts-collective build `B2Lfcso7Ik6P3gEKXBE56`
  (2026-11-01 05:30 UTC, with the checkbox colour, left-aligned "+ Add
  destination" and wrapping names). Verified the same way with a second
  throwaway admin (deleted): Go live → both outputs live → Stop → lease
  `null` immediately and 8 s later.
- Not verified: a real YouTube or Facebook ingest, a feed from outside the
  server network, frames of a feed scene on air (a screenshot of the inactive
  scene came back blank).
- Presets (2026-11-01): YouTube, Facebook, Twitch
  (`rtmps://ingest.global-contribute.live-video.net:443/app`, the "Default" row
  of https://ingest.twitch.tv/ingests), Kick (per-account RTMPS server from
  Kick's dashboard, so the form asks for it), custom. `STREAM_PRESETS` in
  `packages/services/src/relay.ts`. Not verified with a real Twitch or Kick key.
- Chat (2026-11-01, phase 1 Twitch): a Twitch destination may name a chat
  channel (`stream_destinations.chat_channel`, migration 228 applied
  2026-11-01). Compose service `stream-chat` (container `eac-stream-chat`,
  image `eac-dev`, `packages/services/scripts/stream-chat.mts`) scans every
  15 s for ticked destinations with a channel, joins them over anonymous
  Twitch IRC (TLS 6697, `justinfan` nick, read only) and writes
  `stream_chat_messages` (unique per platform + message id); moderator
  deletions, timeouts and bans remove rows; rows older than 30 days are
  deleted hourly. The Studio reads them through `relayChat` (admins) into
  `RelayChat.tsx`: in the Go live card when a destination names a channel,
  and under "Chat" in the broadcast console and desk. Shown to operators only,
  not on the broadcast. Node 20 in `eac-dev` has no WebSocket client, hence
  IRC over `node:tls`.
- YouTube chat (2026-11-01, phase 2): the form's "Chat from" lists the
  admin's own connected YouTube channels (`youtubeChatSources`); the
  destination stores the channel id in `chat_channel`, and
  `relaySaveDestination` refuses a channel the saving admin has not connected
  (unless the edit keeps the stored one). The collector follows YouTube
  destinations only while they are in the latest `go_live` event with no
  `stop` after it (`liveDestinationIds`, 12 h window), finds the active
  broadcast once a minute (1 quota unit), then reads `liveChat/messages`
  every `STREAM_CHAT_YOUTUBE_SECONDS` (default 10) or slower if YouTube asks
  (5 units). Token: `getConnectionAccessToken` of the newest connected
  connection for that channel, cached 50 minutes; the service therefore has
  `CONNECTIONS_KEY` and `INTER_APP_JWT_SECRET` in compose. Super Chat
  amounts show as a tag. Quota errors pause an hour; `liveStreamingNotEnabled`
  retries every 10 minutes. Verified 2026-11-01: token refresh and
  `liveBroadcasts.list` against the connected channel (answer:
  `liveStreamingNotEnabled`); the class with network and database stubbed
  (look, read with page token and 10 s floor, Super Chat, deletion, ban,
  chat ended, quota pause, idle destination not polled); the form and chat
  in the standalone harness. Deployed in arts-collective build `8q6B50ef…`
  (2026-11-02 04:20 UTC, another session's build); the picker strings and
  `.vs-relay-chat__amount` verified in the chunks served through the edge.
  Not verified: a real YouTube chat; a signed-in render of the picker in the
  live app.
  Plan for Facebook and Kick:
  `docs/open/BROADCAST_BOOTH_AND_RELAY_PLAN_2026-11-01.md`.
- Chat on air (2026-11-02): OGraf graphic `eac-chat`
  (`docker/obs/overlay/graphics/eac-chat/`), added from the Graphics panel like
  the others. While playing it reads `/obs/overlay/chat?minutes=&limit=` every
  2 s; the agent route (loopback only, like the rest of `/obs/overlay/`)
  passes the collector's `GET /recent` (`STREAM_CHAT_PORT`, default 4459, on
  eac-network only; `recentStreamChat` in `stream-chat.ts`; agent env
  `STREAM_CHAT_URL`, default `http://stream-chat:4459`). Fields: heading,
  corner, messages on screen (1-10), seconds each stays (0 = until pushed
  out), age limit in minutes, one platform or all, platform badges, accent;
  custom action Sample (three made-up messages for 10 s). Deleted or banned
  messages leave the screen on the next read; chat text is set as text only.
  Verified 2026-11-02: in headless Chrome with stand-in data (stacking, push
  out, deletion, platform filter, hold, Sample, stop ends the reads, an
  `<img onerror>` body shown as text, dark Twitch name colours lightened); then
  in OBS after an obs restart: two rows inserted into `stream_chat_messages`
  showed on the Overlays source, one deleted left within a read, rows removed
  afterwards. The Overlays source's Color Correction filter greys the panels
  (see "Broadcast graphics").
- Verified 2026-11-01: the collector's code with database calls stubbed joined
  five public Twitch channels and parsed 39 messages in 25 s (author, colour,
  badges, reply target, sent time). 2026-11-01 evening, signed in as a
  throwaway admin on build `8gds-WFctF8NygpPtsGcW` (screenshots, then
  destination, two inserted chat rows, events and account deleted): the form
  shows Server only for Kick and Chat channel only for Twitch; a pasted
  `https://www.twitch.tv/EAC_Relay_Test` saved as `eac_relay_test`; inserted
  rows appeared in the card's Chat and the console's Chat with badge, time and
  author colour; no page errors. Not verified: a stored message from a real
  channel. Layout fix: destination names broke mid-word and the chat time
  wrapped in the narrow card (`video-studio.css` `.vs-relay__dest > label`,
  `.vs-relay-chat__time`); live in build `MMInwvHoC7hSl-t7Yejua` (20:01 UTC,
  another session's rebuild; rules checked in the CSS served through the edge).

### Collect Art FX pack (video FX in the booth and the clip editor) — 2026-11-01
- Source: Collect Art's fire and lightning FX, rendered by the `auction-stream-fx`
  Remotion project on the developer's Windows machine
  (`C:\Users\Justi\Elkdonis Arts Collective\auction-stream-fx`, `out/pack/`, its
  README describes each piece). 1920x1080, 60 fps, VP9 with alpha; transitions are
  OBS track-matte stingers, "same file, stacked" (1920x2160: the stinger with alpha
  on top, a black/white matte below, white = the incoming scene). Not in this repo.
  Both surfaces use 30 fps copies: the booth canvas runs at 30 fps (`start.sh`
  `FPSCommon=30`, read back with `GetVideoSettings`) and CEF decodes VP9 alpha in
  software. Transcode: decode with `-c:v libvpx-vp9` (ffmpeg's own vp9 decoder
  drops the alpha), `fps=30`, `libvpx-vp9 -pix_fmt yuva420p -crf 30 -b:v 0`; alpha
  checked with ffprobe (`alpha_mode=1`) and frames composited over colour. About a
  third of the original size (O2 18.2 → 5.6 MB).
- Booth graphics (EBU OGraf, admins' uploads in obs-home `~/graphics/`, not the
  repo): `ca-fx-thunder-strike`, `ca-fx-flame-surge`, `ca-fx-the-call` (New high
  bid / Going once / Going twice / Sold with an optional price line),
  `ca-fx-ember-drift` and `ca-fx-heat-frame` (loops), `ca-fx-stingers` (Burn through,
  Lightning cut, Fire wall, Page turn, Cloth droop: the stingers' own layer over
  the program, no scene change; it also carries the stacked files for
  `transition.stinger` below), `ca-fx-ascension` (below), `ca-fx-wordmark` (named
  "buy the font licence before air": the Brothers typeface is licensed for
  personal use only), `ca-fx-curtains` (claret stage drapes part, hold and clear,
  5.6 s). Built from `auction-stream-fx/ograf/fx-booth.json` (one entry per
  graphic) by `ograf/build-booth.mjs`: transcodes into `ograf/_build/30fps/`
  (cached), writes `ograf/<id>/` fresh with the manifest, `graphic.mjs` (the
  template `ograf/_src/fx-video.mjs`, or the entry's own `template`, with the
  entry's config inlined; self-contained, since an upload cannot import
  `graphics/_lib`) and the videos; refuses a folder over 25 MB. Uploaded by
  `ograf/upload-booth.sh <id>…`: `POST /graphics/upload` with curl inside eac-obs
  (bearer from that container's environment), holding the lease only for the
  upload and refusing when someone else holds it. `.txt` is not an allowed upload
  type: the fonts' OFL notice travels as `fonts/fonts-license.json`.
- Behaviour: muted `<video>` elements preloaded at load. Play = from the start; a
  one-shot plays out and hides itself, but its layer still reads "On air" in the
  Graphics panel until Stop (the page cannot tell the agent it finished); the
  custom action "Play again" fires it again without Stop/Play. Stop = a 250 ms
  fade. Loops fade in over 300 ms and repeat until Stop. After a renderer
  reconnect (play with `skipAnimation`) a one-shot stays hidden, a loop resumes.
  The call's price line is HTML on the video's own clock, placed and timed as the
  Remotion source draws its `sub` prop (`src/fx/BidCall.tsx`): Inter 600, 40 px,
  tracked 0.22em under New high bid / Going once / Going twice, Fraunces 600, 72 px
  under Sold; pale blue-white with a blue glow for the bid, warm cream with a
  vermilion/claret glow for the rest; fonts bundled as woff2 (OFL).
- `ca-fx-ascension` (template `ograf/_src/fx-ascension.mjs`): the back of the set
  (video), the lot's picture, the front of the set (video); both videos start
  together and the front is put back on the back's clock whenever they drift
  more than a frame. Fields "Lot image URL" and "Frame" (a gilded border about 7 %
  of the width, gold gradient #9e6624 → #ffdb80, and a warm glow). The picture
  follows the back video's time t: visible from 2.4 s, centre x 960, y from 1320
  up to 360 (ease-out over 2.5-5.0 s, a slight float), a 330x465 card scaled
  0.95 → 0.78 as it rises, then over 4.95-6.0 s it turns white-gold
  (brightness/sepia up), fades and grows 8 %; the sparks and the flare are in the
  videos. The picture is shown, never read (it may be cross-origin). OBS's browser
  has no session: use a public image URL (a public `/api/media/` path, the auction
  site's image), not a Private path. No URL = the set alone.
- Verified 2026-11-01: all nine in `GET /graphics` (source uploads); The call
  (Sold, "£4,200 · Lot 12"), Ember drift and Ascension (with a picture) played on
  the program with program screenshots (the one-shot had cleared itself 4 s later; both test layers removed,
  lease released, the two existing layers untouched and not playing); every
  graphic class also driven in headless Chrome through a harness that calls the
  OGraf methods like the renderer (fonts loaded, price line on cue, self-clear
  after `ended`, Play again). CPU: the eac-obs container ~0.40 core while a
  full-frame loop played against ~0.04 just after Stop (`docker stats`); OBS's own
  `GetStats` cpu 0.07 → 0.14; ~0.93 core while Ascension plays (two full-frame
  videos). Several full-frame FX at once add up.
- Colours: the "Overlays" source still carries the Color Correction filter
  (brightness 0.2727, see "Broadcast graphics", read again 2026-11-01 with
  `GetSourceFilterList`), so FX come out washed out on the program (Sold's dark
  vignette shows light grey). Remove that filter in the desktop for true colours.
- Stinger transitions in the booth: obs-websocket 5 cannot create a transition.
  Agent op `POST /studio {op: 'transition.stinger', name, graphic: {folder, file}
  | path, matte?: 'stacked' | 'side-by-side' | 'none', point?: ms, use?: boolean}`
  (`setStinger` in `docker/obs/agent.mjs`): refuses unless a transition of that
  name exists and is an `obs_stinger_transition`; copies the file from a graphic
  folder (uploads, then repo) into `~/media/stingers/<folder>-<file>` (new inode,
  so a later re-upload does not change the file under OBS), or fetches `path` from
  Nextcloud like media (the services layer resolves `path` inside the person's
  storage for every studio op, `obsStudioCommand`); then makes it the current
  transition, `SetCurrentSceneTransitionSettings` with `path`,
  `track_matte_enabled`, `track_matte_layout` (0 side-by-side, 1 stacked, from the
  plugin's locale order), `tp_type` 0, `transition_point` (ms, default 1000; with a
  matte it only moves the audio over), `hw_decode: false` (VP9 alpha needs libvpx),
  `preload: false` (a 2 s 1920x2160 stinger in RAM is about 1 GB), and switches
  back to the previous transition unless `use`. One-time desktop step: Scene
  Transitions → + → Stinger, named e.g. "Burn Through", "Lightning Cut", "Fire
  Wall", "Page Turn", "Cloth Droop" (the file can stay empty), then once per transition, e.g.
  from inside eac-obs (the op needs the lease like every POST):
  `{"op":"transition.stinger","name":"Burn Through","graphic":{"folder":"ca-fx-stingers","file":"T1_BurnThrough_trackmatte-stacked.webm"}}`.
  The console's transition select then lists them and Preview, then take uses
  them (the duration field does not apply to a stinger). Status 2026-11-01:
  written and syntax-checked, not live (agent.mjs is read when the obs container
  starts) and not run against OBS (no Stinger exists yet); no console button.
- Clip editor: overlay kind `fx` (`types.ts`: `fx` = catalog id, `sub` = a call's
  price line). Catalog `packages/reels/src/templates/fx-catalog.ts` (id, label,
  category overlay | loop | transition, file, seconds, alpha, `matte: 'stacked'`,
  `call`, `pending`); drawing `templates/fx.tsx`; wired into `clip.tsx` (`Fx`
  part, `itemSeconds`/`itemSpan`: a one-shot or transition lasts its own length,
  a loop its `seconds`, 0 = to the end; `sourceFrame`, `cutFrames`). Each FX is
  an `OffthreadVideo transparent` laid over the frame, cover-fitted: exact in
  16:9, cropped to the middle in 9:16 and 1:1 (the calls' words are cut at the
  sides in 9:16). Loops repeat with `<Loop>`. A transition sits on a cut: the part
  before carries on in source time where the matte is black, the next part shows
  where it is white, the stinger's layer plays on top; blended with CSS (inverted
  matte multiplied over the outgoing picture, then the incoming picture × matte
  added with `plus-lighter`) so the Player and the renderer's Chrome draw the same;
  every extra copy of the recording is muted. Transitions draw under the
  graphics, other FX over everything. FX sequences premount a second ahead.
  Timeline: "+ FX" (it comes from `OVERLAY_KINDS`), an inspector with the catalog
  grouped as Overlays / Loops / Transitions (pending entries hidden), the price
  line for calls, a transition jumps to the nearest cut within 2 s when chosen and
  offers "Move to the nearest cut"; one-shots have no length handle and no For /
  Until the end.
- Clip FX files: `packages/reels/public/reel-fx/` (30 fps copies, ~50 MB, and
  `fonts/`), loaded with `staticFile('reel-fx/<file>')`. The renderer bundles
  `public/` (`publicDir` in `render/render.mjs`), so FX need no localize step (not
  Nextcloud paths). The Studio's Player asks arts-collective for
  `/reel-fx/<file>`: `apps/arts-collective/public/reel-fx` is a symlink to
  `../../../packages/reels/public/reel-fx` (works with the bind-mounted dev target
  in compose; the production stage of the root Dockerfile copies `public/` only
  and would need the files themselves). The middleware matcher skips paths with a
  file extension. Safari cannot play VP9 alpha (preview only).
- Verified 2026-11-01: renders in the reel-render image without touching the
  worker (`docker compose run --rm --no-deps -v /tmp/fxtest:/fxtest reel-render
  --local /fxtest/landscape --out /fxtest/out`, folder form with a `reel.json`
  of `template: clip`): a 12 s three-pattern clip cut to three parts with Ember
  drift, Sold + price, Burn through and Lightning cut on the two cuts, New high
  bid + price and a lower third: 10 s of 1080p in 46 s, portrait in 50 s. Stills:
  price lines under the words, the next part showing through the burn holes and
  arriving under the lightning flash, embers over everything, centred crop in
  9:16. A second render with Ascension over the clip and Page turn and Cloth
  droop on the two cuts: 10 s in 75 s. Types: reels (`tsc --noEmit`). Not verified: the Timeline in a browser,
  anything signed in, a render queued from the Studio, the Player's preview of a
  transition (five videos kept in step by the Player).
- A new FX: (1) render it into `out/pack`; (2) booth: one entry in
  `fx-booth.json` (`todo` until the file exists), `node ograf/build-booth.mjs <id>`,
  `bash ograf/upload-booth.sh <id>` (nothing to restart); (3) clips: copy its 30 fps
  file from `ograf/_build/30fps/` (a file no graphic uses goes in `clipOnly` in
  fx-booth.json, `node ograf/build-booth.mjs clip-only`) into `packages/reels/public/reel-fx/` and add
  one line to `fx-catalog.ts` (`pending` until the file is there), then restart
  reel-render and rebuild arts-collective.
- Needs the developer: restart reel-render (it bundles the templates and
  `public/` once per process); rebuild and restart arts-collective for the
  Timeline's FX and for `/reel-fx/` (Next lists `public/` at start); restart obs
  for `transition.stinger`, then the desktop step above; the Brothers licence
  before the wordmark goes on air or into a reel; whether ~50 MB of WebM goes into
  git as it is.

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
- App `eac_embed` 1.0.0 in `custom_apps` (claude, 2026-09-26; source
  `docker/nextcloud-apps/eac_embed`): adds the origins in app value
  `frame_ancestors` (now `https://elkdonis-arts.org`) to the CSP
  frame-ancestors of every page. Verified by header read (Talk `/call/…`,
  `/login`, `/s/…`). `X-Frame-Options: SAMEORIGIN` is still sent; browsers
  ignore it when frame-ancestors is present (**assumed**, not tested in a
  browser at elkdonis-arts.org). Only same-site hosts can embed with a
  session: Nextcloud cookies are SameSite=Lax. Used by: fourthwayBookreaders
  circle page (session links: Talk room, session document) and innergathering's
  landing offering card ("Join the room" opens the call in the RSVP column,
  `apps/innergathering/src/components/landing/OfferingCall.tsx`).
  Also innergathering's `/hub/chat`, `/hub/documents`, `/hub/files` (2026-10-08,
  `NextcloudFrame` in `cms-ui/hubsite`). Signed-out `/apps/files/files` answers
  401 with `frame-ancestors 'none'` (header read, 2026-10-08), so a Files frame
  shows "refused" rather than a login page until the person signs in at top
  level; whether a signed-in Files page carries the `eac_embed` origin is
  **unknown**. (claude, 2026-10-08)
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
- ~~Two per-user ACL allows on `users/<slug>` fail on every reconciler run (436 and 21
  occurrences since 2026-09-20). Cause unknown.~~ 2026-09-27: three (aeon,
  jason-ford, eric-brummel), all Nextcloud-linked people with no folder; the script
  now skips missing folders (dry run verified; first live run not yet checked). Because the script skips group
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
