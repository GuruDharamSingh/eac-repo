# ElkTours fly-over pipeline: readiness audit + proposal (2026-11-02)

Platform Engineer (claude) + PC sub-worker. This is an audit and a proposal only: nothing was migrated, no app code or tool was edited, and the only new files are this doc and one scratch test folder on the PC.

Goal (Justin): a visitor or editor requests a fly-over of a tour's route. Once the request is accepted, the Windows PC (ElkTourUnity) renders it automatically. Every tour and stop asset (films, stills, 3D map, posters, images) gets storage, access, and a per-asset on/off switch on the site. Out of scope: how the PC learns about a request.

## Verdict: READY WITH GAPS

The render core is deterministic and does not need a human once its inputs exist. In the test, the Marais camera.json was regenerated from `tour.json` plus a *templated* views.json, and the result was byte-identical to the hand-made one. What is missing:

- the PC has no single entry point;
- the player has no exit codes, timeouts or tile-load failure detection;
- safety rules hold by convention, not by checks;
- there is no poster step;
- the server has no asset registry, request object or worker door.

### Top gaps (both halves)

| # | Sev | Gap | Fix |
|---|---|---|---|
| 1 | High | `ElkTour.exe` always exits 0. An exception in `Start()` (missing key file, bad film.json) **hangs it forever** (TourPromo.cs:81-106, 595). | try/catch, `Application.Quit(code)`, global deadline |
| 2 | High | If tiles never reach 100%, each frame waits up to 1800 frames and then **captures anyway, logging nothing** (TourPromo.cs:586) | fail with code 4 and record it in the manifest |
| 3 | High | No orchestrator. elev.json is only produced by `flycam.mjs`, and mapcam needs it | shared `elev.mjs` + `Tools/autorender.mjs` |
| 4 | High | Server: no request table, claim API or worker auth | migrations 233/234 + `render-jobs.mts` (below) |
| 5 | Med | Duration, height, turn and angular-speed rules are only printed (flycam:253, autocam:170, mapcam:99), never enforced. The renderer runs to the last key with no 30 s cap (TourPromo.cs:88) | camera.json gate, exit 5 |
| 6 | Med | No poster step anywhere (sheet.jpg is a contact sheet) | frame at ~15 s → jpg + webp |
| 7 | Med | Server: no asset registry or visibility toggle. A film is a single `metadata.film` value with no history | `tour_assets` |
| 8 | Med | `Tools/mkbats.mjs` makes .bat launchers for every `Tours/*` with a tour.json | skip `_`-prefixed folders, or write auto output outside `Tours/` |
| 9 | Med | Screen capture needs an awake, unlocked, interactive desktop, so it cannot run as a Windows service | worker runs as a logged-in scheduled task; refuse when locked |
| 10 | Low | Mapcam end card crops the bottom of the route (fit 2.3, mapcam:65); promo text is 16 px and faint; accented titles garble render.ps1 filenames; `nvidia-smi` app list can't tell whether the GPU is busy | tune; use utilization.gpu |

## Half 1: PC side (`C:\Users\Justi\ElkTourUnity`)

### Can one script go from tour.json to mp4 + poster with no human steps?
No single script exists today, but every step can be automated for the mapcam style:

- **Route:** the eris `tour.json` already carries `route.legs`, so no router call is needed. Since 2026-11-01, eris `refreshTourRoute` uses FOSSGIS `routed-foot` (labelled `source:'osrm'`). Routes saved before that may be car routes from the OSRM demo; a re-save fixes them.
- **Chain:** `prepfilm.mjs <dir> tiles` (0.05 s) → elev.json (today only via flycam, 67 s, open-meteo) → `mapcam.mjs` (needs views.json `.map`; throws if elev.json belongs to other stops, mapcam:25) → player renders frames → ffmpeg (render.ps1:12-13: libx264 slow crf 23 yuv420p faststart; 720p `scale=1280:720 crf 26`).
- **Manual today, and what replaces it:**

| Manual step | Auto replacement |
|---|---|
| views.json | template |
| Hero view picking (viewcands, autocam) | not needed for mapcam |
| highlights.spec review (osmfind) | skip highlights in auto mode |
| Captions | mapcam writes `N · stop title` (mapcam:95) |
| Title and end card | come from tour.title (TourPromo.cs:361) |
| Poster | missing |
| Encode | render.ps1, but it never checks the exit code or the frame count |

### Safety gates

| Gate | Status | Where |
|---|---|---|
| "For promotional purposes only" | Automatic, always drawn (small, faint) | TourPromo.cs:630 |
| Google/Cesium credit | Automatic, bottom-left, clear of the caption band. Not verified | TourPromo.cs:144, 619-624 |
| OSM credit | Automatic when highlights exist | TourPromo.cs:631 |
| No Street View | Met by construction (3D Tiles URL only; Panoramax only in `street` mode, which is dormant) | prepfilm:7,10 |
| ≤ 30 s | Convention (defaults of 30); no cap in the renderer | TourPromo.cs:88 |
| Camera above ~90-140 m | Convention (mapcam range 650-900, flycam alt 120) | none |
| Turn ≤ 25°/s, heading step ≤ 60° | Printed only | flycam:253, autocam:170 |
| Speed | Printed. Use an angular measure: the Marais outro pull-back peaks at 688 m/s at a ~2 km range | mapcam:99 |
| Clean exit / timeout | Missing | — |

Independent check of the Marais camera.json: max turn 4.9°/s, max heading step 0.5°, minimum camera height 774 m, 30 s. Latin Quarter is similar.

### Deterministic default
**mapcam + gold waveform route line, no highlights, auto captions/title/end card.** This is the style Justin chose for dense tours.

views.json template `map`:

| Setting | Value |
|---|---|
| range | 900 (650 when the route is shorter than ~2 km) |
| pitch | -50 |
| hold | 0.45 |
| lead | 1.2 |
| sigma | 1.6 |
| fxScale | 2.6 |
| total | 30 |

### Proposed entry point `Tools/autorender.mjs`

```
node Tools/autorender.mjs --request <request.json | tour.json> [--style map] [--out Tours\_auto\<requestId>\] [--probe-only]
request.json = { requestId, payloadSha256, payload: {tour, meetingPoint, route, stops, style, limits} }  (from claim)
```

Steps:
1. Validate: ≥2 stops, legs match stops, Paris bounding box, route length cap, cleaned title.
2. Create a fresh out dir and refuse to reuse one.
3. Template views.json.
4. prepfilm `tiles`.
5. elev.json, with a cache keyed by grid bounds.
6. mapcam.
7. **Gate camera.json:**
   - last t ≤ 30
   - minimum height above ground ≥ 140 m
   - turn ≤ 25°/s
   - heading step ≤ 60°
   - angular speed cap
8. **Probe** `-at 1,15,28.5`. The frames must not be blank (pixel variance), and the credit strip (bottom-left) must not be empty.
9. Full render under a 20 min deadline; require 900 frames.
10. ffmpeg 1080 + 720.
11. Poster: the ~15 s frame as jpg q90 + webp.
12. Write `manifest.json`: input hash, tool file hashes and exe date, camera metrics, gate results, timings, output sha256s, log path.

Outputs in `<out>`: `film-1080.mp4`, `film-720.mp4`, `poster.jpg`, `poster.webp`, `manifest.json`, `render.log`, `frames/` (deleted after a successful encode).

| Exit | Meaning | Retry |
|---|---|---|
| 0 | ok | — |
| 2 | bad input | no |
| 3 | network / rate limit (open-meteo) | yes |
| 4 | tile-load timeout / blank frames | yes |
| 5 | safety gate failed | no |
| 6 | GPU busy / Unity crash / hang / desktop locked | yes |
| 7 | encode failed | yes once |

Concurrency:
- Lock `Tours\_auto\.lock` holding the PID and start time; the lock is stale if that PID is gone.
- Refuse to start if ElkTour.exe or Unity.exe is running, or if `nvidia-smi --query-gpu=utilization.gpu` stays above 30% for 10 s.
- Kill only the PID the script started.
- Never touch hand-made `Tours/<id>/` folders.

The key stays in `%USERPROFILE%\.elktour-unity\gmaps.key`. It never goes into the manifest or the logs.

**Time per render:** ~40 s setup and probe, 3-10 min of frames, ~1 min encode, plus up to 65 s per open-meteo rate-limit hit. Budget ~12 min; deadline 20 min.

### Failure modes
| Failure | What happens today |
|---|---|
| open-meteo rate limit | waits 65 s × 5, then exits 1 |
| Overpass | not used in auto mode |
| FOSSGIS (stops.json tours only) | **silently** falls back to straight lines |
| Dead key or network for tiles | silent partial or blank frames |
| Missing key file or film.json | hangs |
| GPU busy | not detected |
| Locked or asleep PC | capture fails |

### Test (done, frames only)
- **Setup:** C: had 187 GB free; GPU was an RTX 4080 SUPER, idle. Copied only `Tours/elkMarais01tour000004/tour.json` into `Tours\_autotest_marais\`; the original folder was untouched.
- **Files and times:** templated views.json; prepfilm 0.05 s; flycam (for elev.json) 67 s; mapcam 0.06 s. elev.json and camera.json are **byte-identical** to the hand-made Marais files.
- **Render:** `-at 1,12,28.5` took ~41 s and exited 0.
- **Frames** (in `Tours\_autotest_marais\frames\`):
  - `f00030.jpg`: title card; Google credit bottom-left; promo text top-right.
  - `f00360.jpg`: caption "8 · Hôtel de Beauvais"; the waveform route drawing itself; "Google • Landsat / Copernicus" fully visible.
  - `f00855.jpg`: end card; the route's bottom edge is cropped.
- **To do:** delete `_autotest_marais` before running mkbats, or it gets .bat files.

## Half 2: server side (eris, read-only audit)

### What exists today

| Thing | Where | Notes |
|---|---|---|
| Tour | `threads` row, `kind='tour'`, org `elktours` (migration 208) | 11 tour rows: 8 published with films, 2 drafts (`elkLatinQ01tour000002`, `elkMediev01tour000004`), 1 archived sample |
| Walking route | `threads.metadata.tour.route = {legs: [lng,lat][][], source: 'osrm'\|'straight', fetchedAt}` (211, no column) | Refreshed on stop save by `refreshTourRoute` (`apps/elktours/src/lib/tour-cache.ts`) through FOSSGIS `routed-foot`, the same router the films use. Every tour row has one. |
| Stops | `tour_stops` (208 + 211): position, title, body, lat/lng, Street View pose heading/pitch/fov, `image_url`, `still_url`, `guide_notes`, duration | Only one image and one still per stop. No per-asset visibility. |
| Film | `threads.metadata.film = {url, url720, poster, seconds, source:'elktour-unity'}` (top level, because the tour form rewrites `metadata.tour` whole) | Written by the one-off `apps/elktours/scripts/import-films-2026-11-01.mts` and by the Edit page bar (`patchTourAction`, `lib/tour-live-actions.ts`), which only accepts our own `/api/media/...` URLs. One film per tour; uploading a new one replaces the old one with no history. |
| Street View stills | `tour_stops.still_url`, made by `ensureStopStills` (Static Street View API, 150/day ceiling) | These are a separate Google product from 3D Tiles. They are not film material and must never go into a render payload. |
| File storage | Nextcloud WebDAV `EAC_Network/elktours/Media/{Videos,Images}/...` (public) or `.../Private/Media/...` | `uploadFile` + `getProxyFileUrl` in `packages/services/src/nextcloud.ts`. |
| Serving | `apps/elktours/src/app/api/media/[...path]/route.ts` | Proxies Nextcloud, supports Range (video seeking), limited to the org tree + `EAC_Network/users/`, and checks `canReadMedia` for Private paths. |
| Generic media table | `media` (id, org, uploaded_by, attached_to_type `thread\|reply`, url, nextcloud_path, type `image\|video\|audio\|document`, w/h, caption, alt) | No visibility, kind/role, source or stop link. The films imported on 2026-11-01 have no `media` rows. |
| Job queues | `video_jobs` (147: queued→processing→ready→approved→published/failed, `attempts`, `heartbeat_at`, `approved_by`; the worker is the only writer of progress); `publish_jobs` (222); `astro_interpretations` claim/store/fail (`packages/astro-corpus/scripts/reasoning-jobs.ts`: `FOR UPDATE SKIP LOCKED`, re-claims a stale `running` row after 30 min) | `video_jobs` is the closest model: an outside worker, a review gate, heartbeat. |
| `packages/pipeline` | Org kanban over Nextcloud Deck | Not a job system. Could show render requests as cards later, but it is not the queue. |
| Worker auth | No existing machine-token pattern for an outside worker calling an app API (searched for `WORKER_TOKEN`/`CRON_SECRET`; I didn't read `.env`) | The astro worker runs a script through `docker compose run` over SSH and never touches an HTTP API. |
| Migrations | `node packages/db/scripts/migrate.mjs --status` (in `eac-elktours`): 232 applied, 0 pending, no 233+ files in the tree | **Next free: 233 (assets), 234 (render requests).** Other agents are migrating today (232 landed 05:07), so re-check just before writing. |

### Gaps for the goal

1. No asset registry. Films/posters live in metadata, stills/images live in stop columns, and nothing has a visibility toggle, provenance (source, licence, attribution), or history.
2. No request object. There is nowhere to store "someone asked for a fly-over", nothing to accept or reject it, and nothing for a worker to claim.
3. No worker identity or auth for the PC. Options: (a) like the astro worker, the PC runs a claim/complete script on eris over SSH (`docker compose run ... tsx scripts/render-jobs.ts claim`). No new public surface, so this is recommended first. (b) Later, an HTTP API with a hashed per-worker token.
4. Delivery is one-off. The import script hard-codes ids. A delivered render needs a reusable "upload to Nextcloud → register assets → point metadata.film at them" step.
5. Payload must be a snapshot. The route and stops change on every edit, so a request has to freeze what was asked for (route legs + stops + style), and the worker renders from the snapshot, never from live rows.

### Proposal (a): `tour_assets` (migration 233)

```sql
CREATE TABLE tour_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id     varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  stop_id       uuid REFERENCES tour_stops(id) ON DELETE CASCADE,      -- NULL = whole tour
  kind          text NOT NULL CHECK (kind IN ('film','poster','image','still','map3d','streetview','document')),
  role          text,                    -- 'hero' | 'gallery' | 'card' | 'background' ... (free, validated in code)
  variant       text,                    -- '1080' | '720' | 'poster' ... siblings of one render share render_request_id
  storage       text NOT NULL DEFAULT 'nextcloud' CHECK (storage IN ('nextcloud','external')),
  storage_key   text,                    -- EAC_Network/elktours/Media/Videos/... (nextcloud)
  url           text NOT NULL,           -- /api/media/... or external https URL
  mime_type     text, bytes bigint, width int, height int, seconds real,
  sha256        text,
  source        text NOT NULL,           -- 'elktour-unity' | 'upload' | 'streetview-static' | 'import'
  attribution   text,                    -- e.g. 'Google, Cesium; © OpenStreetMap contributors' (must render with it)
  licence_note  text,                    -- e.g. 'Google Maps Platform: promo use only, <=30 s, uncropped'
  visible       boolean NOT NULL DEFAULT false,   -- the per-asset on/off toggle on the site
  position      int NOT NULL DEFAULT 0,
  caption text, alt_text text,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb, -- style, render checks, camera summary
  render_request_id uuid,                -- FK added in 234
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,  -- NULL = pipeline
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz             -- soft delete; history kept
);
CREATE INDEX ON tour_assets (thread_id, stop_id, kind, position) WHERE archived_at IS NULL;
-- At most one visible hero film per tour:
CREATE UNIQUE INDEX tour_assets_one_hero_film ON tour_assets (thread_id)
  WHERE kind='film' AND role='hero' AND variant='1080' AND visible AND archived_at IS NULL;
```

- Rules: `visible` defaults to false, so nothing new appears until an editor switches it on (or acceptance with auto-publish does). Only owners/guides can toggle. The public site reads `visible AND archived_at IS NULL`.
- `metadata.film` stays the site's read path for now, as a cache. Setting a film asset as the visible hero writes `metadata.film = {url, url720, poster, seconds, source, assetId}` in the same transaction, so the tour page and cards don't change. Backfill: register the 8 existing films + posters and the stop stills as assets (`visible=true`, `source='import'`/`'streetview-static'`).
- Private assets (drafts, rejected renders) go to `EAC_Network/elktours/Private/Media/...`, which `/api/media` already gates through `canReadMedia`. Making one visible moves or copies it to `Media/`. Flipping a flag alone does not make a private Nextcloud path public.
- Why not extend `media`: its `attached_to_type` check, varchar(21) ids and `thread|reply` scope are shared network-wide by pigeon, reading and other apps. A tour-scoped table avoids a cross-app migration. An optional `media_id` column could link the two later.

### Proposal (b): `tour_render_requests` (migration 234)

```sql
CREATE TABLE tour_render_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id      varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  kind           text NOT NULL DEFAULT 'flyover' CHECK (kind IN ('flyover')),
  status         text NOT NULL DEFAULT 'requested' CHECK (status IN
                   ('requested','accepted','claimed','rendering','delivered','failed','rejected','cancelled')),
  requested_by   uuid REFERENCES users(id) ON DELETE SET NULL,  -- NULL = anonymous visitor
  requester_email text,                                         -- visitor contact, optional
  note           text,
  style          jsonb NOT NULL DEFAULT '{"camera":"mapcam","routeLine":"waveform","highlights":false}',
  payload        jsonb,          -- frozen at ACCEPT: {tour:{id,title,slug}, meetingPoint, route:{legs,source,fetchedAt},
                                 --   stops:[{id,position,title,lat,lng}], style, limits:{maxSeconds:30}, schemaVersion:1}
  payload_sha256 text,
  priority       int NOT NULL DEFAULT 0,
  accepted_by    uuid REFERENCES users(id), accepted_at timestamptz,
  rejected_reason text,
  worker_id      text,           -- 'justin-pc'
  claimed_at timestamptz, heartbeat_at timestamptz, started_at timestamptz, finished_at timestamptz,
  attempts       int NOT NULL DEFAULT 0, max_attempts int NOT NULL DEFAULT 3,
  progress       real NOT NULL DEFAULT 0,
  error_code     text,           -- mirrors the PC exit code (see Half 1): 'bad_input'|'network'|'tiles_timeout'|'gate_failed'|'gpu'|...
  error          text,
  result         jsonb,          -- manifest from the worker: checks, metrics (max turn deg/s, min range m, seconds), hashes, timings
  delivered_asset_ids uuid[],
  auto_publish   boolean NOT NULL DEFAULT false,  -- on delivery, make the film the visible hero
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tour_render_requests_queue ON tour_render_requests (priority DESC, accepted_at) WHERE status = 'accepted';
CREATE UNIQUE INDEX tour_render_requests_one_open ON tour_render_requests (thread_id, kind)
  WHERE status IN ('requested','accepted','claimed','rendering');   -- dedupe: one open request per tour
ALTER TABLE tour_assets ADD CONSTRAINT tour_assets_render_fk
  FOREIGN KEY (render_request_id) REFERENCES tour_render_requests(id) ON DELETE SET NULL;
```

**Lifecycle**
```
requested --accept (owner/guide; freezes payload)--> accepted --claim--> claimed --start--> rendering --complete--> delivered
    |                                                    ^                  |                  |
    +--reject--> rejected                                +--(retryable fail, attempts<max)----+--fail--> failed
    +--cancel--> cancelled           stale heartbeat (>20 min) -> back to accepted (attempts+1)
```
- Visitors may only create `requested` rows, rate-limited per IP/email and deduped by the unique index. Their input is the tour id and an optional note. Visitors never send geometry or style. Editors may pick a style.
- Accept validates the snapshot and rejects with a reason otherwise: route present, 2–40 stops, all inside a Paris bounding box, route length ≤ ~8 km.

**Worker API** (start as a script on eris, `apps/elktours/scripts/render-jobs.mts`, run over SSH like reasoning-jobs; add HTTP routes under `/api/render-worker/*` with a hashed per-worker bearer token later):

| Command | Effect |
|---|---|
| `claim [--worker justin-pc]` | `WITH picked AS (SELECT id ... WHERE status='accepted' OR (status IN ('claimed','rendering') AND heartbeat_at < now()-'20 min') ORDER BY priority DESC, accepted_at LIMIT 1 FOR UPDATE SKIP LOCKED) UPDATE ... SET status='claimed', worker_id, claimed_at=now(), heartbeat_at=now(), attempts=attempts+1 RETURNING id, payload, payload_sha256`. Prints `JOB <json>` or `JOB null`. |
| `heartbeat <id> [progress] [--rendering]` | Updates `heartbeat_at` and progress, sets status `rendering`. Rejected if the row is no longer claimed by this worker. |
| `complete <id> <dir>` | Reads `<dir>/manifest.json`, re-checks the server-side gates (seconds ≤ 30, all checks passed, payload hash matches), uploads `film-1080.mp4`, `film-720.mp4` and `poster.jpg` to `Private/Media/Videos|Images/tour-<thread>-<req8>-<variant>.<ext>` and inserts 3 `tour_assets` rows (`source='elktour-unity'`, attribution, `meta.checks`, `render_request_id`). Status → `delivered`. If `auto_publish`, it publishes them (copy to public `Media/`, `visible=true`, role `hero`, archive the previous hero, write `metadata.film`) in one transaction. Otherwise an editor does that from the asset panel. |
| `fail <id> <code> <message>` | Retryable codes (network, tiles_timeout, gpu) go back to `accepted` while `attempts < max_attempts`. Everything else, and exhausted retries, → `failed`. |

Upload size: a 30 s 1080p film is ~10–30 MB. Over SSH the PC can `scp` the files into a staging dir, which a bind mount or `docker cp` makes visible to the script.

**Delivery → site:** the delivered film is an asset (history kept). `metadata.film` points at whichever asset is the visible hero, and switching back to an older film just means toggling it.

## Gates enforced twice
The PC enforces them (exit 5). The server re-checks the manifest on `complete`: seconds ≤ 30, every check true, payload hash equal to the accepted snapshot, files are mp4/jpg with expected sizes. If any check fails, the request is `failed` with `gate_failed`, and nothing is uploaded publicly.

## Alignment with ELKTOURS_EXPERIENCES_SPEC_2026-11-02.md
That spec did not exist in `docs/open/` when this doc was written. Points to reconcile once it lands:
- table names (`tour_assets`, `tour_render_requests`);
- whether visitors may request fly-overs or only editors (proposed: visitors create `requested`, owners/guides accept);
- whether acceptance auto-publishes (proposed: off by default, delivered films land private and an editor toggles them visible);
- the 233/234 numbering.

## Proposed order of work
1. PC: player exit codes, deadline and tile-timeout failure (Unity rebuild).
2. PC: `elev.mjs`, then `autorender.mjs` with gates, probe, poster and manifest.
3. eris: migrations 233 (`tour_assets` + backfill of the 8 films, posters and stills), 234 (`tour_render_requests`).
4. eris: `scripts/render-jobs.mts` (claim/heartbeat/complete/fail). The PC worker calls it over SSH and uploads via scp.
5. Site: request button (visitor), accept/reject queue and per-asset toggles (editor).
6. PC: a scheduled task in Justin's logged-in session polls `claim`, runs autorender, and calls complete/fail.

## PC autorender (done, 2026-11-02)

`C:\Users\Justi\ElkTourUnity\Tools\autorender.mjs <request.json|tour.json> [--out Tours\_auto\<id>] [--probe-only] [--keep-frames]`

- **Input:** the `claim` JOB object (`{id, threadId, attempts, payloadSha256, payload}`; a raw `JOB {...}` line also works) or a plain tour.json for local tests. The PC recomputes the canonical payload hash and records `payloadShaMatches`, but the manifest echoes the request's `payloadSha256`, so `complete` compares like with like.
- **Output:** always a new folder. It refuses an existing folder, and it refuses any `Tours\<id>` whose name does not start with `_`. Files: `film-1080.mp4`, `film-720.mp4`, `poster.jpg` (15 s frame), `poster.webp`, `manifest.json`, `render.log`, `player-{probe,render}.log`, `progress.json` (phase and frame count, for a heartbeat wrapper), and `probe/`. `frames/` is deleted after the encode.
- **Manifest** matches `render-jobs.mts complete`: `payloadSha256`, `seconds`, `checks{}` (all booleans), `metrics`. It also carries `exitCode`, `errorCode` (the `fail` code names), timings, sha256 of each file, tool hashes and the build date of the player assembly.
- **Steps:**
  - validate the input (same bounds and 10 km cap as render-requests.ts);
  - take the lock `Tours\_auto\.lock`;
  - preflight: refuse when ElkTour.exe or Unity.exe is running, the desktop is locked (LogonUI.exe), the GPU is above 30% in all 5 samples, or C: has less than 5 GB free;
  - template views.json;
  - prepfilm `tiles`;
  - elev.json: cached in `Tours\_auto\.elevcache`, or read from a matching hand-made tour, otherwise open-meteo;
  - mapcam;
  - gates;
  - probe `-at 1,15,28.5`;
  - full render (20 min deadline; killed after 4 min with no new frame or log line);
  - ffmpeg 1080/720, checked with ffprobe for 900 frames and ≤30 s;
  - poster.
- **Gates (exit 5, refuse to render):**
  - ≤30 s;
  - minimum height above ground ≥140 m;
  - turn ≤25°/s;
  - heading step ≤60°;
  - angular sweep ≤30°/s. This measures camera motion across the view ray divided by the distance to the look point, so a straight pull-back does not count.
- **Probe checks (exit 4):**
  - blank frames, from pixel std and mean;
  - the Google credit, counted as bright pixels that stay stable across the 3 frames in the bottom-left 200×60. Marais scored 620; a control strip on the bottom right scored 14.
- **Player change (TourPromo.cs, rebuilt with `ElkTourBuild.BuildPlayer` batch):**
  - in `-render` mode, any exception now quits with code 3 instead of hanging. Tested: a missing film.json exits 3 in 4 s.
  - a tile-load timeout is logged as `TILE TIMEOUT frame N`, and the render then exits 4.
  - "For promotional purposes only" is now 26 px bold white on a dark band, top right, clear of the credit.
  - Backup: `Tools\.bak-2026-11-02\`.
- `mkbats.mjs` skips `_`-prefixed folders.
- **Test (copy of the Marais tour.json):**
  - `--probe-only`: exit 0 in 15 s.
  - full run: exit 0 in 204 s (render 89 s, encode 100 s).
  - Gate values: 30 s, minimum height 683 m, turn 4.9°/s, step 0.5°, sweep 9.1°/s.
  - Every check was true.
  - Poster and frames inspected: "Google" credit visible and uncropped, promo line legible, gold route drawn.
  - Test output deleted.
- **Remaining:**
  - the 1080p mp4 is ~93 MB (crf 23 slow, busy aerial). That is under the 200 MB cap in render-jobs, but the doc's 10–30 MB estimate is wrong; consider crf 26 or `-maxrate`.
  - `style.emphasizeStopIds`, `timeOfDay` and `aspect` are ignored (16:9 only).
  - the claim → scp → complete/fail wrapper and its scheduled task are not built.
  - the end card still crops the bottom of the route (mapcam fit 2.3), unchanged.
  - an exception logged by Cesium mid-render would now abort the render (exit 6, retryable). None were seen.
