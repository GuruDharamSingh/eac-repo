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
