# elktours mobile: plan (2026-11-15)

Design pack: `pack/` (Claude Design handoff "Tour Guide Booking App 2"). Read `pack/README.md` first.

## Team
- **Justin**: owner and tie-breaker. Rebuilds, migrations and deploys need his yes in the session that runs them.
- **Jay** (session system32-c6, 2 Sonnet agents): platform. packages/booking phase 2, services, db, contracts, gap list.
- **Gee** (session system32-04, 2 Sonnet agents): UI. apps/elktours screens and components, Puck props/settings, direct-edit editability.

## Files
| File | Owner | What |
|---|---|---|
| PLAN.md | both | This file: team, phases, status |
| design-breakdown.md | Gee | Themes, tokens, screens, components, editable slots |
| backend-map.md | Jay | The contract table (screen component → data/props → function/route) plus gaps. Merged from backend-map-booking.md and backend-map-content.md |
| QUESTIONS.md | both | Questions for Justin, tagged [Jay]/[Gee], with a recommended answer each |

## Lanes
- Jay owns `packages/*` and `packages/db/migrations`.
- Gee owns `apps/elktours/src` UI.
- Cross-lane edits: tell the other first.
- Don't commit. Run `git diff` before editing any shared file (other sessions share the tree).

## Phases (follows the pack's build order)
0. Survey + contracts (now).
1. Tokens, fonts, shell.
2. Guest booking path (Discover → Tours → Detail → Dates → Pay). Needs booking phase 2 or an adapter.
3. Experiences, artists, About.
4. Places.
5. Feed + forum.
6. Board (schedule, slots, decisions, collaborate, media, share, review queues).

## Status
- 2026-11-15: pack unpacked; surveys running (Jay: booking + content; Gee: design breakdown).
- 2026-11-15: Justin chose mobile layout below md, desktop kept; editable copy+look on guest pages. design-breakdown.md written. Gee G1 (tokens/shell) + G2 (m-* Puck plumbing, /tours pilot) starting.
- 2026-11-15 (evening), Jay lane: code-complete short of migrations.
  - Booking: core rules, set_dates, party size, adapter + fixtures, cutoff, cutover code behind BOOKING_TABLES (off).
  - Content: people, places, feed, hero, tour type, link preview, forum compose + attachments (opt-in), member upload, artist wizard, suggest, collaborate, favourites.
  - Everything typechecks; check-core 83/83; check-collaborate 20/20.
  - Not run against a DB: the slot/booking-table paths and the migration drafts. These need the scratch-DB yes from Justin.
  - Waiting on Justin: the scratch DB, 7 migrations (MIGRATIONS_TODO.md, CUTOVER.md), the org_feeds feed row, the elktours rebuild (coordinate with Check).
- 2026-11-15 (night):
  - Scratch DB tests passed: content one pass, booking 17/17. The scratch container is removed.
  - Applied live, each alone with a tracker row (Justin'\''s yes): 268 place_favourites, 269 artist_availability, 270 visitor_suggestions kinds, 271 forum_attachments, 272 service_commissions invites, 273 booking_slots per-slot columns.
  - HELD: tour_departures_backfill. It moves both departure FKs to booking_slots, so it must go together with the BOOKING_TABLES flip (CUTOVER step 3 + 5 together). Otherwise notes and invites on departures created through the old path would fail.
  - Code waiting for the tree to be free after Gee'\''s build: widen ServiceCommission.serviceThreadId; attachments:true in lib/forum.ts.
- 2026-11-15 22:00, BOOKING CUTOVER DONE (Justin: "turn switch on"):
  - Every departure caller now goes through lib/departures.ts / departuresSql(); the token page, ics and return hop read both sources.
  - Applied 274_elktours_tour_departures_backfill: 12 set_dates offers, 3 slots, 0 bookings; FKs now point at booking_slots.
  - BOOKING_TABLES "1" is in the elktours env in docker-compose.yml (backup in ~/eac-backups).
  - Rebuilt and recreated: build sqlpshXf_48JdIJdw8N1E, .next backup elktours-20261115-2157.tgz, 15 CSS files.
  - Routes are 200 (/manage 307 when signed out).
  - Rollback: set BOOKING_TABLES "0" and recreate. Anything booked on the new tables must be copied back first (ROLLBACK block in the 274 draft).
  - Still open: a Stripe webhook for elktours, the waitlist, automatic refunds, and the first real paid booking as the end-to-end test.
- 2026-11-15 22:05, Stripe webhook (Justin: "Both"):
  - art-auction rebuilt (PnuokS29_IUJ4Quk1b-mh, backup art-auction-20261115-2203.tgz, CSS unchanged). The platform webhook now runs markBookingPaid, so elktours booking-table orders confirm on checkout.session.completed. Its Nov-12 build had only markTourBookingPaid.
  - elktours /api/stripe/webhook is added (copy of art-auction's) and dormant until Justin adds a Stripe endpoint plus ELKTOURS_STRIPE_WEBHOOK_SECRET in .env; it ships on the next elktours build.
  - Note: every app build bundles commerce, which dynamically imports @elkdonis/booking. Any app built before 2026-11-15 won't confirm booking-table orders from its own return/sync path.
- 2026-11-15 22:57: build 9E3CmfGSWcJ9AzIHEFLrZ is live (backup elktours-20261115-2257.tgz). It ships:
  - the Office + /manage/settings;
  - the review fixes;
  - the cms-ui surface forum on phones (/forum, sections, popup, /forum/t/[id]/[slug], compose surface, replies + attachments);
  - the place lightbox + place-detail surface;
  - the film-style 3D route, city menu, and tour quick-view + itinerary PNG.
  - Per Justin, not tested beyond / returning 200.
  - Lesson: client files must not import package barrels. Run the trial build with a named chmod'd volume before every prod build.
