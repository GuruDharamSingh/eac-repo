# elktours mobile: backend map (Jay, 2026-11-15)

This is the merged index. The detail is in `backend-map-booking.md` (screens 04, 05, 30-34) and `backend-map-content.md` (all other screens). Also read `booking-phase2-gotchas.md`.

## Decisions made by Jay (Justin can overrule)
- **Adapter first.** The mobile UI builds against the final contract now. For booking, the adapter reads `tour_departures` until the cutover to `booking_slots`. The cutover needs 2 migrations, each applied alone, with Justin's yes.
- **One settings key.** `site_config` key `elktours:settings` = `{ belowMinimumRule: "guide_decides"|"auto_cancel", holdGuidePosts: bool, ... }`. Both booking and content read it, and the house editor edits it.
- **Reuse before build.** The pack understates what already exists. `places.tags`, `org_feeds.parent_slug` (sub-sections), `org_feeds.min_role` (closed section), thread audience PUBLIC/ORGANIZATION/INVITE_ONLY, the review queue (`threads.status=pending` + `reviewThread()`), `visitor_suggestions`, forum unread tracking and the `unfurl()` in packages/lms all exist.
- **Shared, not app-local, where other sites benefit.** Move `unfurl` to `@elkdonis/utils`. `forum_attachments` and the `statusForNewThread` holdRoles option go into services/forum. Everything elktours-specific stays in `apps/elktours/src/lib`.
- **Feed = threads.** A feed post is `kind=post` in an `org_feeds` row `feed`, comments are `replies`, and a link post is `metadata.link`. No new table.
- **Pay = Stripe-hosted redirect.** The method chips are a summary only (pending Justin).
- **Tour hero lead** = `threads.metadata.heroLead`. No migration.

## Contract index (UI builds against these; they return `{ok:true,...}|{ok:false,error}`)
| Screens | Contract | Detail |
|---|---|---|
| 04 Dates, 05 Pay | `listTourSlots`, `getBookingRule`+`bookingRuleText`, `quoteBooking`, `bookTourAction` (exists) | booking §2, §6 |
| 30-34 Board | `listBoardSlots`, `boardCounts`, `listDecisions`, `previewSlots`/`createSlots`, `getSlot`, `runSlot`/`reopenSlot`/`closeSlotNow`/`cancelSlot`/`updateSlot` | booking §2, §6 |
| 01 Discover, 02 Tours | app aggregator over existing reads + `forumSnapshot` | content §3 |
| 03/37 Hero media | `publicTourAssets()` + `metadata.heroLead` | content §4 |
| 06-11 Experiences, people | existing experience reads; `listPeople({kind})`; artist via `experience_people` | content §5-6 |
| 12/13/38 Places | `listPublicPlaces`/`getPublicPlace` + tags + favourites | content §7 |
| 14 Suggest | `visitor_suggestions` (+ kinds artist, place_lead) | content §8 |
| 15/16/39 Feed | threads in section `feed` + `reviewThread()` | content §9 |
| 17 Web view | `GET /api/link-preview?url=` (unfurl) + Open in browser | content §10 |
| 18-21 Forum | `@elkdonis/forum-ui` + kind param, attachments, visibility change | content §11 |
| 35/36 Wizard, Collaborate | `artist_availability`, `service_commissions` (altered), `linkExperienceToStop` | content §12 |

## Build order (Jay's lane), matching the pack's phases
1. **Now (no migration).** Booking core (slot state, rule text, clash), set_dates, party size, checkout quantity. Then adapters `lib/tour-slots.ts` and `lib/slot-actions.ts`.
2. **No-migration content wins.** Move unfurl + add the link-preview route; createTopic kind/visibility params; holdRoles for guide posts; the tag-ordered places read; the heroLead write; the `elktours:settings` read/write.
3. **Migrations** (each applied alone because 263 is pending; Justin's yes needed): `booking_slots` per-slot columns; departures backfill + FK repoint; `place_favourites`; `artist_availability`; `forum_attachments`; `service_commissions` alter; `visitor_suggestions` CHECK relax; later `thread_audience_users` (Private with people, L).
4. A guest/member upload route for forum media (EXIF strip).
5. The sweeper (auto-cancel, holds) on an existing tick; a Stripe webhook for elktours; the waitlist later.

## Status
- 2026-11-15: both surveys done. Booking core work (step 1) is in progress.
- 2026-11-15: content package pieces done (source only, typechecked). The changes:
  - `@elkdonis/utils/unfurl` is new and node-only, so import it by subpath; lms re-exports it unchanged.
  - `createTopic({kind, audience})` and `setTopicAudience()` are in services/forum-write.ts.
  - `statusForNewThread(..., {holdRoles})` and `reviewThread(..., {approverRoles})` are in services/moderation.ts.
  - For the elktours guide-post queue, use holdRoles [guide] and approverRoles [owner].
  - The forum-ui form action does not pass kind/audience yet.
- 2026-11-15: booking step 1 done (source only; check-core 70/70; booking + checkout tsc clean). The changes:
  - `@elkdonis/booking/core` slots.ts: `slotState`, `closesAt`, `bookingRuleText`/`minimumRuleText` (prototype wording), `findClash`, `checkNewSlot`.
  - set_dates is accepted, with approval forced to instant.
  - `saveOffer` takes party/priceUnit/minToRun/closeBeforeMinutes/waitlist. Updates keep stored values when a field is omitted.
  - `createBooking` set_dates locks the slot row, not the host. Also new: `listSlots()`, `markBookingPaid` confirming set_dates, and checkout quantity = party for per_person.
  - Not yet exercised against the DB, because nothing creates set_dates slots yet.
  - Next: `createSlots` + the elktours adapter.
- QUEUED (Jay, for Gee's G6): wire forum-ui Start a topic + its form action. It needs kind chips (post/idea/event), audience chips (Public/Members/Private=author-only), an optional link (metadata.link + unfurl at write time), and section preselect via a query param. This is a shared package, so default behaviour must be unchanged for other sites.
- 2026-11-15 (later):
  - Cutoff is enforced in bookTourAction.
  - Fixture mode is in: `ELK_FIXTURES=1`, not in production.
  - Tour type is `metadata.tourType`.
  - Forum compose is wired, and on for elktours.
  - feed/hero are split into reads + actions.
  - 7 migration drafts are in `migrations-draft/`, with CUTOVER.md.
  - Incident: the booking agent trial-ran both booking drafts in a rolled-back transaction on elkdonis_dev, which was not authorised. It was verified rolled back (0 rows, FK unchanged), and the agent has been told not to repeat it.
  - Now in progress: cutover code behind `BOOKING_TABLES` (default off); the member upload route; the artist-wizard backend; the suggest action.
