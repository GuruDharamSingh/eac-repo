# After the atlas: recommendations (lead, 2026-11-16)

Justin asked for recommendations on what's left. This draws on the complete atlas (`packages/actions/atlas`), the security doc (`ATLAS_SECURITY_2026-11-16.md`, #1–#54 plus the round-3 notes) and `DOCK_RAILS_PLAN.md`. Each item is a recommendation, and nothing here is done without Justin's go.

## Where we are

- **The map is complete.** It covers all 1,987 write points in the repo: 1,613 mapped and 374 deliberately ignored, each with a reason. The strict check passes. There are 92 area files.
- **1,101 capabilities**:
  - 776 person (candidate rail steps)
  - 223 internal
  - 53 system
  - 49 admin
- **Coverage gaps**: only 81 of the 776 person rows have a registry entry today. 132 rows carry money risk, and 130 rows carry `SECURITY:` notes.
- **Confirm wording**: 776 drafts. Wave 1 (86) is with Justin.

## 1. Security: recommended order

Justin's rule from this session is that taking part counts as membership: RSVPing gives member info (#42), and the wiki is open for input (#41). So the remaining work is about **people acting outside their own org or their own things, money correctness, and the admin and identity doors**, not about soft member gates.

| Rank | What | Why first | Size |
|---|---|---|---|
| 1 | **apps/admin has no server-side gate.** Its pages (including the whole activity log) render with no check. `createMeetingAction` inserts a meeting into any org with no session at all, and `/api/auth/signup` is open. | It is the network's central admin app; a stranger can read it and write through it | A `middleware.ts` requiring `is_admin`; delete the unused action and signup route |
| 2 | **#1 SendGrid event webhook unsigned** (on hold) | Anyone on the internet can suppress any address in any org | Paste one key in `.env` and recreate the container (minutes) |
| 3 | **#51 ifac directory admin overwrites any user's global profile** | The same class as #20, already fixed elsewhere | One org check, as in #20 |
| 4 | **LMS `saveResponse` completes locked steps** (round 3) | Courses ARE the rails: if steps can be completed out of order, the dock can't trust progress | Run the same unlock check `completeStep` runs |
| 5 | **Auction integrity**: archiving or marking sold a piece whose lot has bids; changing price, currency or payee after bids; sellers bidding on their own lots (#23); `buyNowLot` (#24); a series desk listing an artist's piece without consent | Money and trust in the auction | Freeze lot-linked fields once bids exist; refuse archive or sold while a lot is live; one policy decision on self-bidding and consent |
| 6 | **Identity doors** (round 3): the handoff open redirect; device tokens that never expire and carry the Nextcloud app password; that password stored in plain text; `TURNSTILE_SECRET_KEY` empty, so signup has no bot check | Account takeover paths and spam | Several small fixes; set the Turnstile key |
| 7 | **#33 elktours: guides can edit or cancel each other's tours and bookings**, the same in schedules, heroes, stop notes, assets and email triggers | Within one org, but it touches bookings | Copy the `slot-actions` own-tour check (it already exists in the same app) |
| 8 | **#46 elktours private-file publish**: the path is decoded after the `..` check | Possibly reads outside the org folder (untested) | Normalise, then check |
| 9 | **#53a artdirect: an anonymous visitor can take down unclaimed business listings** | Signed out, and it hides public listings | Send to a review queue instead |
| 10 | Hygiene: rate limits and captcha on the public contact, RSVP and inquiry routes; MIME sniffing on avatar uploads; the newsletter double-send guard; the elktours emails carrying amrit-canada's Khanda emblem | Low each, but there are many | Batch them per app when it is next rebuilt |

**One design decision would settle several findings at once:** write down who counts as a member. Under the rule above, a follower or viewer would be a participant. Then:
- the amrit-canada writing room (#2) becomes a policy question: should participants publish under the org?
- `org/join` (#3) becomes acceptable as self-serve participation, provided private and invite-only orgs refuse it;
- fourthway topics become acceptable.

I recommend: **participants may read, RSVP, comment and post to the forum; publishing under the org's name needs member or above.** This keeps #2 as a one-line fix and makes #3 and the fourthway items "by design".

**Rebuilds:** the 4 fixes already in source (#11, #14b, #20, #21) ship with each app's next build. I recommend one deliberate rebuild of elktours and sunjay soon. Their builds carry nothing but the fixes, so the two stored-script problems on elktours (#21) stop being live.

## 2. Homogenising: recommended order

The atlas shows the same code copied across apps. These are the merges that buy the most:

1. **The org-site kit** (`packages/org-site`, already planned in NETWORK_SERVING_ARCHITECTURE §4) as the home for shared actions. Start with the byte-identical families, because they are zero-risk moves:
   - amrit-canada and sunjay: 46 of amrit-canada's 52 write files are identical to sunjay's;
   - the cms actions (status, pin, remove, standing meeting, feed, section);
   - questionnaires, dictionary, site style and profile update.
2. **RSVP**: 7 copies, of which only arts-collective checks eligibility. Merge them into one `rsvpHandlers` in services. This removes most of the RSVP-related findings at once.
3. **Center profile, avatar and signup**: 7 copies each. One handler, with MIME sniffing in one place.
4. **Uploads**: 4+ implementations, of which only pigeonshoot re-encodes images. One upload service.
5. **Publishing a post**: 5 paths on arts-collective alone. Make `createThread`/`updatePost` the only door.
6. **Booking**: three service-booking copies plus the legacy elktours departures. Move everything onto `packages/booking`, then retire `tour_departures`/`service_bookings` (already planned behind `BOOKING_TABLES`).

Each merge is its own approved pass. The atlas `canonical` fields name the target per capability, and `reports/drift.md` lists them.

## 3. Cleanup

- **Retire `apps/inner-gathering`.** It has been stopped for 5 weeks and is superseded by innergathering. Remove its compose service from the three compose files so a `compose up` can't revive its 101 routes. Point NPM proxy host 14 (`meetings.elkdonis-arts.org`, which returns 502 today) at innergathering's port 3015, or delete that proxy host.
- **Delete dead code** listed in the journal (elktours: 8 unused actions; ifac `api/signup`; `center/quotes` with no caller; fourthway `baselineCirclePlan`).
- **blog-tester**: if it isn't meant to be live, take it down. Today any `elkdonis` member can publish a public post there.

## 4. The atlas and the dock: recommended next steps

1. **Consolidation pass** (one agent): merge the round-2 and round-3 copies into their originals as extra hosts on one capability, so "publish a post" is one row with all its hosts, not six rows. Also add the ignored signup and pulse copies as hosts on `create-account`/`collect-page-pulse`. This turns 1,101 rows into a cleaner set and makes `drift.md` the homogenising worklist.
2. **Don't word all 776 confirms now.** Word only what a course is about to use. Finish wave 1 (86 cards). After that, a wave is made when a course adopts its steps.
3. **Prove the loop on one course (DOCK_RAILS_PLAN P1–P2).** Rebuild `getting-started` (16 bound steps already) on the atlas:
   - registry fields `address`/`confirm`/`risk`/`roles` for those 16 entries;
   - `data-eac-anchor` on their controls;
   - the dock's confirm card and "take me there / back to the trail";
   - pushed completion.
   
   This shows the whole idea working end to end on arts-collective before the network-wide reach (P4).
4. **Commit the atlas.** It is about 92 area files, 3 scripts and the docs, all uncommitted. I recommend a commit on a `work/2026-11-16` branch after a secret scan (house pattern), with the security-fix source changes in a separate commit so they can be reviewed apart.
5. **An MCP key page in apps/admin** (round 3 notes keys are mint-and-revoke by script only). Do it after the admin gate (§1 rank 1), not before.

## Decisions needed from Justin (short)

1. Go on the apps/admin gate (§1 rank 1)?
2. The member rule ("participants read, RSVP, comment and post to the forum; publishing under the org needs member+")?
3. Rebuild elktours and sunjay to put the fixes live?
4. Self-bidding by sellers: forbid? And series-desk listing without the artist's consent: forbid?
5. Retire inner-gathering (compose service and proxy host 14)?
6. Commit the atlas and fixes on `work/2026-11-16`?

## Justin's answers and direction (2026-11-16)

**Decided**
- **Member rule (2): yes.** Participants (followers who RSVP, comment, post to the forum) are part of the org. Publishing under the org's name needs member or above. Done in source: amrit-canada writing room (#2).
- **Retire inner-gathering (5): yes.** Done: the service is removed from `docker-compose.yml`, `.prod.yml` and `.production.yml` (backups in `~/eac-backups/atlas-recommendations-2026-11-16/`), and the stopped container is removed (volumes kept). **Left for a human:** NPM proxy host 14 (`meetings.elkdonis-arts.org` → :3004, returns 502): point it at innergathering's :3015, or delete it.
- **Merges:** RSVPs yes ("consider logic straightening with booking or vice versa"); avatars and uploads into one, yes.
- "Go ahead with wrapping up and approaching your recommendations": the source-level fixes below are done; rebuilds, commits and `.env` changes still wait for an explicit go.

**Context for the homogenising pass**
- amrit-canada is the oldest site, and much of it is being left behind. Copy-per-page (`/manage` sections) is giving way to inline on-page editing (the house editor).
- sunjay leads the "dissolve /manage" direction: **hub and Channel are the main admin surfaces**, and hub surface pages give cards and pop-ups their own space (Channel as the example). Canonical paths should point there, not at amrit-canada's `/manage` shape.

**Ideas ahead (recorded, not acted on: "don't get bogged down")**
- **artdirect goes two ways at once:**
  - a directory and business-listing site (a yellow pages);
  - the **source package** for users, orgs/org-profiles, associated businesses, classifieds and paid work, serving arts-collective and the network's sites.
  
  This is a step toward splitting the server in two.
- **A business suite**: booking UI, money management and so on, as a shared package, maybe living with artdirect. Ship a medium-large version into the arts-collective network, and a leaner one to individual apps as needed. Business lives with the artist/user and/or org profile. Sites draw on it, and the platform takes it beyond the directory into a network of content.
- **The studio in three tiers:** a basic studio package shipped to sites; the studio on arts-collective; and the studio on arts-collective that reaches a future secondary GPU server (heavy processes, some saved features).
- **art-auction** is the chief store for art, but a separate, collaborative product that owns its own logic. It overlaps in the business mechanics of users. **Selling artwork should not require going through art-auction.**
- **Domain MCP "experts"**: artdirect (directory and business), art-auction (market) and studio could each have their own MCP handling, a sub-server or tool group. *Lead's note:* this maps cleanly. One MCP endpoint can expose **tool groups per domain** (`directory.*`, `market.*`, `studio.*`, `rails.*`), each owned by its package and served from the host that owns the data. Alternatively, each domain runs its own small MCP server, and the dock or an AI connects to several. The atlas already groups capabilities by area, so a domain's tool group is a filter over the atlas. Decide this at P6, not now.

## Done in source on 2026-11-16 (not rebuilt, not committed)

| Fix | Files |
|---|---|
| apps/admin: server-side admin gate on the server pages (`requireAdminPage`); `createMeetingAction` checks admin; the open `/api/auth/signup` route removed (no form used it) | `apps/admin/src/lib/require-admin-page.ts` (new), `app/{page,new/page,events/page,email-templates/page}.tsx`, `lib/actions.ts`, `app/api/auth/signup/route.ts` (deleted) |
| #51 ifac directory admin: only people listed by ifac can be edited | `apps/ifac/src/lib/directory-admin.ts` |
| #2 amrit-canada writing room: member or above (member rule) | `apps/amrit-canada/src/lib/writing-room-actions.ts`, `app/write/page.tsx` |
| LMS: a response completes its step only when the step is open, and editing a response is bound to its own enrolment and step | `packages/lms/src/record.ts` |

These ship with each app's next build: admin, ifac, amrit-canada, and every app that renders LMS lessons (arts-collective, sophia).

- Type-check 2026-11-16: ifac, amrit-canada, sophia and packages/lms are clean. apps/admin already had 30 tsc errors (sample-data, meeting-card, data.ts, WorkshopForm, oidc/authorize, agent/post, and the MeetingType import and "org" default in lib/actions.ts); none comes from the new gate code. Worth a cleanup pass on apps/admin before its next build.
