# Session handoff: dock rails, the action atlas, security fixes (2026-11-16)

**Start here** if you are picking up the platform MCP, the dock or the LMS rails.
Lead session: Claude (Opus) with Sonnet sub-agents. Branch `work/2026-11-16`, cut from the `work/2026-11-08` HEAD. **Not pushed.**

## The idea in one paragraph

The platform MCP is **not** a viewer for org sites. It is the arts-collective **dock's** brain. The pieces:

- **The rails.** LMS courses are the rails, each step a reference to an action registry entry.
- **The dock.** It walks a person through the course. It runs the action in its own module where it can, or takes them to the exact control and highlights it. It confirms before anything changes, ticks the step and brings them back.
- **The action base.** The registry entries (`packages/actions`) are the MCP's tools; courses become prompts; dock cards can later become MCP App views.
- **No AI yet.** The courses decide what happens next. An AI plugs into the same base later.

Plan: `docs/open/mcp-foundations/DOCK_RAILS_PLAN.md`. Read §0, §3 (the seven layers), §5a (decisions) and §5b (structural direction).

## What exists now

| Thing | Where | State |
|---|---|---|
| **The action atlas**: every write in the repo mapped. 1,987 write sites (server actions, write routes, raw SQL) roll up to 781 capabilities in 92 area files. | `packages/actions/atlas/` (start with `JOURNAL.md`, then `README.md` and `types.ts`) | Complete; `check-atlas --strict` passes (0 unclaimed) |
| Atlas reports: coverage, **drift** (the homogenising worklist, by canonical target), and wording waves | `atlas/reports/` | Regenerate with `atlas-reports.mts` |
| **Wording wave 1**: 86 draft confirm cards | `atlas/reports/wording-wave-01.md` | Sent to Justin, not answered. He wants the card text **drier**. |
| **Security findings** #1–#54 plus round-3 notes, verified end to end where marked | `docs/open/mcp-foundations/ATLAS_SECURITY_2026-11-16.md` | See "Live" and "Open" below |
| Recommendations, with Justin's answers and direction ideas | `docs/open/mcp-foundations/RECOMMENDATIONS_2026-11-16.md` | Reference |
| **One upload path**, step 0 + avatars: `storeUpload`, `uploadRoutes`, image re-encode; the 7 avatar routes are now 3-line shims | `packages/services/src/{uploads,upload-routes,image-process}.ts`; design `docs/open/UPLOADS_ONE_PATH_2026-11-16.md` | Committed, **not rebuilt** |
| **RSVP + booking as one logic**: design only | `docs/open/RSVP_BOOKING_ONE_LOGIC_2026-11-16.md` | 8 open questions |
| **Dock slice 1** on getting-started: registry fields (address/confirm/risk/roles), anchors, confirm/route/done/picker cards, pushed completion | `packages/actions`, `packages/dock`, `packages/lms/src/tasks.ts`, cms-ui/studio anchors, arts-collective; design `docs/open/mcp-foundations/DOCK_LOOP_SLICE1_2026-11-16.md` | Committed, tested on a preview, **not rebuilt** |
| Migrations **275** `lms_dock_state` and **276** `profile_avatar_versions` | `packages/db/migrations/` | Written, **NOT applied**. The code works without them. |

## Commits on `work/2026-11-16`

- `c363556f` security: fixes found by the action atlas
- `4b2c7a71` ops: retire apps/inner-gathering compose services
- `13daddfd` atlas: the action atlas and the dock-rails plan
- `9674fd5d` uploads: one upload path (step 0 + avatars)
- `e491d0e6` dock: rails slice 1 on the getting-started course

About 200 other files in the tree are other sessions' uncommitted work. They were left alone. `packages/cms-ui/src/surface/types.ts` and `packages/services/src/index.ts` hold other sessions' edits next to ours; only our hunks were committed.

## Live in production (rebuilt 2026-11-16 12:27–12:36)

elktours, sunjay, hidden-enneagram, amrit-canada, innergathering, ifac, sophia and arts-collective were rebuilt. apps/admin runs `next dev`, so its changes are live on save.

**Live fixes:**
- #21: guide bios sanitised.
- #11: post bodies sanitised.
- #14b: the thread archive is org-bound.
- #20: guide profile save is members only.
- #51: the ifac directory edits only listed people.
- #2: the amrit writing room needs member or above.
- The admin app's server-side gate.
- The LMS response can't complete a locked step.

Log `~/eac-backups/next/rebuild-2026-11-16.log`; previous builds are backed up next to it. Rebuild script `~/eac-backups/rebuild-2026-11-16.sh`.

## Not live yet (needs a rebuild, and a go from Justin for the dock)

1. **Dock slice 1** goes live with an arts-collective rebuild. It changes what every signed-in arts-collective user sees in the dock (confirm card instead of one-click; course picker). Visitors see generic confirm text until wave-1 wording is approved. After the rebuild, run tenant-smoke (`docs/reference/testing.md`).
2. **The upload shims** (avatars sniffed and re-encoded) go live with each of the 7 apps' next build.
3. **Migrations 275/276.** The runner (`node scripts/migrate.mjs`) applies **all** pending files. **`263_own_app_domains.sql` (another session's) is also pending**, so check with its owner before running the runner, or apply 275/276 alone and record them in `app_schema_migrations` the way the runner does.

## Open (waiting on Justin)

- **Security on hold:**
  - #1, SendGrid event key: put `SENDGRID_EVENT_PUBLIC_KEY` in `.env`, then recreate `eac-arts-network`.
  - Auction integrity (#23–#26, round 3): self-bidding, archiving a piece with bids, freezing price/currency after bids, series-desk consent.
  - Identity doors: handoff open redirect, device token expiry, plain-text Nextcloud app password, empty `TURNSTILE_SECRET_KEY`.
  - #33 elktours guide ownership.
  - #46 elktours private-file publish.
  - #53a artdirect anonymous takedown.
- **By design (Justin):** #41 open wiki; #42 an RSVP gives member info.
- **Member rule (adopted):** participants read, RSVP, comment and post to the forum; publishing under the org needs member or above.
- **Uploads:** should avatars keep marking people as artists (`markArtistByFolder`)? Wire `scope=org` per-org avatars into the UI.
- **RSVP/booking:** Justin's answer on refunds is automatic but triggered by hand: a cancel records it as due, one press refunds. Also open: verified guest email, the one free RSVP on a priced workshop, and the rest in the doc.
- **Manual:** NPM proxy host 14 (`meetings.elkdonis-arts.org` → :3004, 502) → point it at :3015, or delete it.
- **apps/admin** already had ~30 tsc errors before this session; worth a cleanup before relying on its builds.

## Next steps (in the lead's own scope)

1. Get Justin's go, then rebuild arts-collective with the dock slice. First apply 275, minding 263.
2. Uploads step 2 (site/org media), then step 3. Wire per-org avatars and the content-library seam (`registerLibraryItem`).
3. RSVP step 1: one handler in services, after the open questions.
4. Fold the wave-1 answers into `confirm.status`. Next waves only as courses adopt steps, and drier.
5. Dock: course `area` tags and `builds_on` links (structure only); `dockForm` vs `address` precedence (module UI first).
6. The homogenising passes from `atlas/reports/drift.md`. Start with the byte-identical families. amrit-canada is being left behind, so canonical paths point at hub/Channel and the house editor, not `/manage`.

## Lessons (also in the atlas journal and memory)

- **Builds:** every prod container sets `NODE_OPTIONS=--max-old-space-size=1024`. Build with `--max-old-space-size=3584 NEXT_BUILD_CPUS=2`. For arts-collective, also `docker update --memory 9g --memory-swap 14g` for the build only, then back to 5g. A build ships whatever is on disk, so check files newer than `.next/BUILD_ID` first.
- **Typecheck:** use the real exit code (`tsc ... ; echo $?`), not `| tail`.
- **ssh:** an apostrophe inside a single-quoted remote command breaks it. Write files or messages locally and scp them.
- **Agents:** hand out curation by explicit app or file, not by page area (areas collided). Prefix generic ids per app. Verify every security lead end to end before calling it confirmed.

---

## Second half of 2026-11-16 (afternoon): two scopes, five lanes

Justin asked for two scopes, each with Sonnet agents, plus a liaison agent in the middle:
- **Scope 1** carries the MCP work forward.
- **Scope 2** finds "the greatest synthesis of ambition" for the house editor, Puck, the clone site and package structure.

Everything below is committed on `work/2026-11-16`, **not pushed**.

### Live in production

- **Migrations 275 and 276 are applied** (15:20), on Justin's words: "go: apply 275 and 276 and rebuild arts-collective". They were applied alone, by a one-off script that mirrors `migrate.mjs` (same lock, same tracker row). **263 is still pending; it belongs to another session.**
- **arts-collective was rebuilt at 15:22**, and the dock slice 1 is live. The tenant smoke test passes. "Failed to find Server Action" lines in its log come from tabs left open across the deploy.
- Build hold: lanes' unreviewed edits were swapped out for their pre-edit backups during the build and restored after (`~/eac-backups/build-hold.sh`). Reuse it for the next builds.

### Commits

| Commit | What |
|---|---|
| `6b690d28` | Uploads step 2: site media routes in 6 apps and series-site are shims on `uploadRoutes`. Per-org photo checkbox. Five byte-identical families lifted (follow, quotes, cycle, whiteboard, thread-feed) |
| `1bf484a0` | `docs/open/SITE_FORM_2026-11-16/`: `A_SITE_FORM.md` (clone-site form), `B_FAMILIES.md` (package families), `SYNTHESIS.md` (**read this**: one plan, 15 moves, decisions D1 to D11) |
| `6dcd6204` | Four more families: center layout and profile, hub documents and calendar (`services/src/org-site-routes-2.ts`), and chat (`packages/chat/src/routes.ts`) |
| `96b16534` | Atlas as a living source of truth: `atlas:q`, fingerprints and needs-review, `added`/`updated`/`family`, a warn-only `.githooks/pre-commit` (NOT activated), CLAUDE.md section. Dock: course `area`/`builds_on` (migration **277 written, NOT applied**), `dockForm` before address. **Track nexus** `atlas/tracks/` (47 tracks, 21 candidate courses, 19 gates), report `atlas/reports/rails-nexus.md` with the gap list |
| `6b554025` | Media: `@elkdonis/utils/media-thumbnail` (one helper for the existing `?w=` thumbnail tool); 42 image surfaces sized; `mediaRoutes` factory (4 apps); masters at q95 |

`.claude/` is gitignored. The new `.claude/rules/atlas.md` and the atlas steps in the orient and handover skills live on eris only.

### Not live yet (needs Justin's go per app; sunjay first as the canary)

- **sunjay, amrit-canada, elktours, hidden-enneagram, innergathering, fourthwayBookreaders:** upload shims, merged copy routes, sized images, mediaRoutes.
- **danamccool, katie-the-potter:** thread-feed route, sized images.
- **artdirect:** sized picker images, `?w=`.
- **arts-collective:** course tags and module forms (with migration 277 if Justin says yes), sized images.

Behaviour changes in those builds:
- uploads sniff types and re-encode (EXIF dropped, q95), and refusals are 413/415;
- signed-out private media on the 4 mediaRoutes apps returns 404, not 401.

### The idea that joins it all (SYNTHESIS.md)

**One declaration, three renderings.** artdirect's sidebar is generated from a field declaration (`cms-bindings/src/dossier/field-registry.ts`). If each capability points at one field declaration (one vocabulary: `ContentFieldSpec`), that renders:
1. the house editor's sidebar boxes;
2. the dock's module form;
3. the MCP tool's input.

A capability's `family` picks its package home and MCP tool group. Moves 1 to 7 prove this on katie.

### Waiting on Justin

All of these are in the liaison's queue, `docs/open/LIAISON_2026-11-16.md`, with options and recommendations:
- the wording wave (drier cards in `atlas/reports/wording-wave-01-dry.md`, 7 batches);
- RSVP questions;
- `markArtistByFolder`;
- whether to turn on the atlas hook;
- site plan D1 to D11. D1 (the elktours header list) and D2 (an artdirect sidebar review) need his own eyes.
- the ifac drive upload;
- migration 277 and course tags;
- media 404;
- rebuilds.

### Lessons

- **The permission check needs Justin's exact words for production actions.** "Continue with next steps 1-6" was refused; "go: apply 275 and 276 and rebuild arts-collective" passed.
- **Other sessions edit the same files in parallel** (services index.ts, package.json, cms-ui types.ts, CLAUDE.md, utils package.json).
  - Stage with `~/eac-backups/stage-lane.sh <lane backup dir>`. It stages HEAD plus that lane's hunks only, then scans for secrets.
  - Always check the staged hunks of mixed files.
  - When `patch` fails, rebuild the file from HEAD by hand.
- **Lanes must back up every file**, package.json included.
- **Subagent tsc runs** sometimes lose the exit code. Re-run the affected apps yourself with `./node_modules/.bin/tsc --noEmit -p .; echo EXIT=$?`.

### Rebuilt 16:48 to 16:58 (Justin: "Go ahead rebuild whatever. And push to git ya")

All ten apps rebuilt, one at a time (`~/eac-backups/rebuild-2026-11-16c.sh`, log `~/eac-backups/next/rebuild-2026-11-16c.log`, previous builds backed up next to it): sunjay as the canary, then amrit-canada, elktours, hidden-enneagram, innergathering, fourthwayBookreaders, danamccool, katie-the-potter, artdirect, arts-collective. Everything in the commits above is now live.
- Canary: the 20 merged routes answer exactly as the old code did, signed out (`~/eac-backups/canary.sh <new port> <old port>`); `?w=256` on a sunjay photo: 358 KB JPEG became a 3 KB WebP.
- tenant-smoke 9/9; no errors in any app log after restart. elktours logged one ChunkLoadError at 16:51:10, during its own build (the old server reading a half-written .next), none after.
- fourthway, danamccool, katie and artdirect (last built 11-11 to 11-15) also picked up about 58 uncommitted shared files from other sessions that were already live on the other apps since 12:30.
- Migration 277 is still NOT applied (course tags fall back to none).
- Branch pushed: `origin/work/2026-11-16`.

### Evening (Justin's answers, test courses, wording live)

- **Site plan answers:**
  - D3, D5, D6, D7, D8, D10 and D11 are accepted. D4 is accepted without the artdirect sidebar.
  - D2 is dropped for now (artdirect's editing UI is not a shipped package).
  - D9 (GPU) is later, and so is D1 (the elktours headers). See SYNTHESIS.md, "Justin's answers".
- **Wording wave 1: all 69 cards approved** and folded into the atlas (`04b0f853`). Cards carry a title, which becomes the dock card heading.
  - Placeholders become typed slots: entity search, preset or template, value, context. See DOCK_RAILS_PLAN §5b.
- **RSVP decisions** (3a–3g, all as recommended; 3c becomes a follower, but newsletter mail needs its own opt-in), plus 8b, 9 and 10 as recommended.
  - RSVP step 1 is in progress (lane rsvp).
  - Done so far: `packages/booking/src/core/rsvp.ts` (pure rules) and `packages/services/src/rsvp-handler.ts` (service and route factories), plus migration `278_rsvp_one_logic.sql`, written and NOT applied.
  - Still to do: the app shims and `check-rsvp.mts`.
- **Avatars:** `markArtistByFolder` stays. "Artist" is just another name for a user on the platform.
- **Atlas commit reminder is ON:** `git config core.hooksPath .githooks`, warn-only.
- **Migration 277 applied** at 21:40 (alone; 263 is still pending and belongs to another session).
- **21 public test courses seeded:** `rails-*`, via `packages/actions/scripts/seed-rails-courses.mts --write`, committed `d37910f7`.
  - They have 104 steps: 20 dock tasks, 74 marked "not wired", and 10 marked "gap".
  - getting-started is tagged `profile`.
  - To undo, run the same command with `--remove`.
- **arts-collective rebuilt at 21:49:** approved wording and course areas are live.
  - RSVP lane files were held out of the build with `~/eac-backups/build-hold2.sh hold|restore <lane backup dir> [new files]`.
  - tenant-smoke 9/9.
