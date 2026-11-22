# Review of G7 (board, forms, artist tree), 2026-11-15

Read-only review of Gee's G7a/G7b/G7c work against `contract-booking.md`, `contract-content.md`, the real signatures in `lib/*`, and the design pack (`screens-board.md`, `data-and-state.md`, prototype `Elkdonis App.dc.html`). Nothing was run in a browser (nobody can sign in); this is a code read plus `git diff` of the desktop files. Severity: **bug** (wrong behaviour or data loss), **leak** (someone sees or does what they should not), **design gap** (design element missing or different), **nit**.

Verdict: the booking contract is used correctly (every `{ok:false}` is handled, preview refusals show inline, nothing writes on render), and the desktop trees are unchanged above `md`. There are 2 real bugs (one data-loss, one "None minimum" that cannot be stored), 5 leaks (all guide-to-guide or guide reading the office queue, nothing reachable by a guest), and the main design gaps are on the Board home (office "To review", guide rows) and the missing settings screen for the below-minimum rule.

## 1. Bugs

| # | Where | Finding | Fix |
|---|---|---|---|
| B1 | `lib/artist-wizard-actions.ts:63-67` (called from `artist-wizard-view.tsx:125`) | **Data loss.** `saveArtistProfileAction` upserts `role_title` and `bio_override` straight from the form (`EXCLUDED`). The wizard never prefills craft, area or about (`artist-wizard-view.tsx:77-79` start empty, `artist-wizard-loader.tsx:15` passes `name: ""`), so an existing artist who sends a second experience overwrites their saved craft and bio with NULL. The comment says "only fill gaps"; only name and city follow that rule. | `ON CONFLICT ... SET role_title = COALESCE(EXCLUDED.role_title, org_profiles.role_title), bio_override = COALESCE(EXCLUDED.bio_override, org_profiles.bio_override)`; and prefill the three fields (see D6). |
| B2 | `slot-view.tsx:94` and `new-slots-view.tsx:129` -> `slot-actions.ts` `updateSlot` / `createSlots` -> `booking/src/server/slots.ts` `setOverrides` | **"Minimum: None" cannot be stored when the tour has a minimum.** The UI sends `minToRun: null` for None. In the booking package `null` means "inherit the offer's value", so a slot set to None keeps the tour's minimum (for example 2) and still lands in "Needs your call"; the stepper then shows None while the slot behaves as 2. On New slots the same: None against a tour default of 2 creates inheriting slots. | Either block None when the tour has a minimum (floor the stepper at 1 in `slot-view.tsx:158` and `new-slots-view.tsx:310`), or store a distinct "no minimum" (a sentinel such as `min_to_run = 0` needs a CHECK change, so the first is the cheap fix). |
| B3 | `new-slots-view.tsx:101,311`, `board-server.tsx:187` | Preview and Create disagree when a tour default minimum is larger than the default places: `max` always starts at 8 (`:102`) while `min` comes from the tour (`:101`). With minimum 10 the preview says "ready", then `createSlots` skips every slot ("minimum ... between 1 and the number of places") and the user sees "Nothing was created" only after tapping Create. | Start `max` at `max(8, min)`, or clamp `min` to `max` in `pickTour`. |
| B4 | `slot-actions-ui.tsx:91` | Message says "Booking is open again for 24 hours" always. `reopenSlot` closes 24 h from now only when the start is further away; for a start inside 24 h it closes at the start (`booking/core/slots.ts reopenCloseBeforeMinutes`). | Return the real `closesInHours` from the adapter action and use it in the toast, or phrase it "reopened". |
| B5 | `decisions-view.tsx:51-55` (`DecisionsView` intro, lines 200-204 of the combined listing) | Under the `auto_cancel` rule the intro says "Run one or reopen booking here to keep it", but under that rule a below-minimum slot is never `below` (it is cancelled by the sweeper), so the list is always empty and Run is never offered. The promise cannot be kept. | Under `auto_cancel`, say "Slots below their minimum are cancelled automatically at cutoff" (the prototype's own text) and, if wanted, list "closing soon below minimum" slots with a Run/Reopen so the guide can act before the sweep. |

## 2. Role and visibility leaks

Nothing here is reachable by a signed-out visitor or a signed-in non-member: every `/manage/*` page calls `requireOrgEditor`, every `/artist/*` page `requireOrgMember`, and every board action starts with `requireOrgEditor`. The leaks are between roles.

| # | Where | Finding | Fix |
|---|---|---|---|
| L1 | `board-server.tsx:204-209` (`SlotMobile`), `lib/slot-actions.ts` `getSlot`, `cancelSlot`, `runSlot`, `reopenSlot`, `closeSlotNow`, `updateSlot` | **A guide can open and act on another guide's slot.** The lists are scoped (`guideUserId`), but the slot page and every action only check "is an editor". By guessing or sharing a URL a guide sees another guide's guest list (names, emails, notes) and can cancel it. | In `getSlot` and each action: if `viewer.role !== "owner"` require `slot.guide?.id === viewer.userId`. |
| L2 | `lib/slot-actions.ts` `createSlots` (input `guideUserId`), `new-slots-view.tsx:133` | The UI limits a guide to themselves, the action does not: a guide can post another guide's id (or the owner's) and schedule slots on their calendar. | In `createSlots`/`updateSlot`: for a non-owner, force `guideUserId = viewer.userId`. |
| L3 | `app/manage/feed-review/page.tsx:9-12`, `feed-review-view.tsx:43` | Guides can read the office queue (other guides' pending posts); the view says "You can read the queue". The design says the queue is the office's. Approving is correctly blocked (`reviewFeedPostAction` -> `reviewThread` with owner approvers). | Gate the page to owners (`redirect` when `viewer.role !== "owner"`); drop the read-only note. |
| L4 | `lib/collaborate.ts:107`, `app/manage/tours/[id]/collaborate/page.tsx:15-18` | A guide opening another guide's tour by URL reads its stops, linked experiences and invitation states (`getCollaborate` only checks `canEdit`). Writes are blocked ("That is not your tour"). | In the page, `notFound()` when `viewer.role !== "owner" && base.authorId !== viewer.userId`. |
| L5 | `app/manage/invitations/page.tsx:15-16` | Owners see every artist's invitations with fees (correct for the office). A guide sees only their own (correct). But `listInvitations` itself returns everything to any editor (`lib/collaborate.ts:107`), so another page could leak it. Same for `/manage/tours/[id]/collaborate` (L4). | Scope `listInvitations` for guides to their own tours' invitations. |

Checked and fine: `/artist/invitations` and `/artist` pass `artistUserId: viewer.userId` and `listInvitations` refuses another id for non-editors (`collaborate.ts:107`); `respondCommission` is `WHERE seller_user_id = viewer` so an artist cannot answer someone else's; `saveExperienceDraftAction`/`submitExperienceForReviewAction` check author or `experience_people`; `decideExperienceAction`, `inviteArtistAction` and `saveSiteSettings` are owner-only in code. **None of the owner-only actions is exposed in the UI**: see D1 and D2.

## 3. Writes on render, or without user intent

None found. `previewSlots` (called on every form change, debounced) is read-only; `getSlot` refresh, the loaders and `boardCounts` only read. The only taps that write at once with no confirm are Run, Reopen and Close booking now (`slot-actions-ui.tsx:88-98`) and the star on a place (`place-edit-view.tsx:53`), all deliberate single-purpose buttons.

- **nit** `slot-actions-ui.tsx:97`: "Close booking now" cannot be undone from the UI (Reopen is only offered when below minimum), so a mistap on an open slot fixes the guest list. Add the same in-UI confirm that Cancel has.
- **nit** `app/manage/page.tsx:154-159`, `schedule/page.tsx`: `Split` renders both trees on every request, so the phone Board runs its queries on desktop and the desktop planner on phones (hidden by CSS). Not a leak; a cost. Choose the tree server-side only if it shows.

## 4. Desktop trees

`git diff` of the touched files:
- `app/manage/page.tsx`, `schedule/page.tsx`: the old default export renamed `DesktopDashboard` / `DesktopSchedulePage` with its body unchanged; the new default wraps `Split`. Desktop output is the same markup, inside the existing `hidden md:block`. `?journal=1` is the only added branch. **OK.**
- `app/manage/layout.tsx`: class hooks only (`elk-manage`, `elk-manage-chrome`, `elk-manage-body`); the hiding rules are inside `max-width:767px` and need `.elk-m` present (G7a report). **OK** above md.
- `bookings/page.tsx`, `tours/[id]/page.tsx`: import swap to `@/lib/departures` (the flag), plus on the tour page two `md:hidden` links and the new `bookingDefaults` prop for the desktop `TourForm` (a visible desktop addition: the booking-rules block, expected).
- `tours/[id]/assets`, `places/[id]`, `experiences/new`: the old tree moved into `Split` `desktop=`, unchanged. On the three, the phone loaders also run on desktop (extra queries only).
- `suggestions/page.tsx`: a new visible desktop section "Artist and place leads" (requested, additive).
- New `/manage/schedule/new`, `/manage/schedule/[slotId]`, `/manage/decisions`: on desktop only a one-line pointer to Schedule. **nit:** desktop owners cannot open a slot from the desktop planner's side panel into the new page, and Decisions has no desktop equivalent beyond the planner; acceptable.

Judgement: desktop renders as before above md. One behavioural change worth knowing: the desktop `/manage` dashboard now also depends on `requireOrgEditor` being called twice (page and wrapper); harmless.

## 5. Contract correctness (booking and content)

Checked every call against the real signatures; all arguments and result shapes match, and every `{ok:false}` is surfaced (inline `role="alert"` plus toast in the board; `toast(...)` in the forms). Specific points:

- `previewSlots`/`createSlots`: input shape matches `NewSlotsInput`; `createSlots` result (`created`, `notStored`, `firstDay`) used correctly; redirect to `?week=firstDay` as designed. `waitlist: false` is always sent (`new-slots-view.tsx:132`). **nit (latent):** with `BOOKING_TABLES=1` and a tour that has a default waitlist size, every slot created from the phone gets a per-slot `waitlist_cap = 0` (`slot-actions.ts` override for `waitlist === false`), silently switching the waitlist off for those slots once the waitlist exists. Send `waitlist` only when the user touches it (the UI has no control yet), so omit it.
- `getSlot`/`updateSlot`/`runSlot`/`reopenSlot`/`closeSlotNow`/`cancelSlot`: correct. The refund list uses `RefundDue.totalMinor` (the adapter maps `amountMinor` to it) and says "nothing was sent to Stripe" (accurate). **nit** `slot-actions-ui.tsx:70`: "N bookings cancelled and emailed" counts unpaid holds too, which are not emailed.
- Fixtures/preview refusals: all board actions return `Preview data: nothing is saved.` and the UI shows it as the error line. Fine.
- `reviewFeedPostAction`, `submitFeedPostAction` (`status` "pending"/"published" drives the done screen correctly), `setHeroLeadAction`, `setAssetVisibleAction`, `upsertAssetAction`, `savePlaceAction` (partial-safe: omitted fields keep current), `toggleFavouritePlaceAction`, `setPlaceWebsiteAction`: correct.
- `linkExperienceToStopAction` result (`invited`, `skippedNotFree`) used for the toast copy; `inviteForDepartureAction`: correct. **nit:** `collaborate-view.tsx:64,78`, `invitations-view.tsx:37`, `artist-home-view.tsx:203`, `place-edit-view.tsx:60`: failures use the neutral `toast(r.error)`; use `toast.error`. The raw "available after migration" string reaches users when a migration is pending; give it a sentence ("Not available yet").
- Booking-table price: the UI shows price per slot read-only and says "not available yet" (`slot-view.tsx:161`, `new-slots-view.tsx:337`), matching the backend refusal. Correct.

## 6. Design fidelity

Compared with `pack/screens/30-41`, `screens-board.md` and the prototype logic.

### 31 Schedule: matches
Week strip with dots and day filter, previous/next week, slots grouped by day, card with time range, tour title, state line coloured by tone, seat bar with a tick at the minimum, booked/max, shortfall note on open slots, guide filter chips and guide initial for the office, cancelled struck through and dimmed. **nit** (`schedule-view.tsx`): no waitlist note ("N on the waitlist") on the card, expected (waitlist not built).

### 32 New slots: matches except the two items the backend refuses or lacks
Present: tour chips loading defaults, month grid multi-select, up to 4 start times stepped by 15 min with end time, duration stepper, minimum/maximum with seat dots and the rule sentence (both rules), cutoff chips 6h/12h/1 day/2 days/3 days, guide chips (office only), preview list with ready/blocked reason and the "Clashes with ..." and "Booking would already be closed. Shorten the cutoff." wording, "Create N slots", jump to that week. Missing: waitlist switch and size (backend not built), price override switch (backend refuses). **nit:** the tour's maximum is not a default (always 8; design loads `max`); the clash line omits the guide's short name the office sees in the prototype; the start-time stepper wraps past midnight (`hhmm`).

### 33 Slot: partly
Present: status panel (colour follows the tone), run / reopen / cancel with refund list, close now while open, booked count with seat ticks, steppers for cutoff, minimum and places, guest list with party size and note. **Live in the backend and wired:** run, reopen, close now, per-slot minimum and cutoff. Not wired because the backend still refuses or lacks it: per-slot price, waitlist switch, waitlist and Offer.
- **design gap** `slot-view.tsx:130-136`: the panel heading is the state label ("Needs your call · 2 of 4 minimum") with note and rule text appended; the prototype has a separate heading ("Below the minimum" / "Booking is open" / "Confirmed" / "Running below minimum" / "Cancelled automatically" / "Finished") and one sentence per state ("2 of the 4 needed had booked when booking closed (Fri 20 Nov, 10:00). It only goes ahead if you say so."; "Closes ..., in 2d 3h. 2 more needed to reach the minimum of 4."). Add a `panelText(slot)` in booking core next to `slotState`.
- **design gap** kicker is "date · start" (prototype: "date · start-end"); subline "With Dana McCool" (prototype: "Led by ... · craft"); guests label "N bookings" (prototype: "N bookings · N guests").
- The "Cancel this slot" button is offered on every live slot; the prototype offers cancel only in the below-minimum state (Close booking now on open ones). More capable, not wrong; keep the confirm.

### 34 Decisions: partly
Present: below-minimum list with Run/Reopen/Cancel on each card, empty state. Missing: the second list "full slots with a waitlist" (waitlist not built). The intro wording differs from the prototype (see B5).

### 30 Board home: design gap (the largest)
Present: header (name, role line, date), the vermilion banner to Decisions, counts, today and this week's slots, links to the queues, per-tour Collaborate / Page media / Edit.
Missing against `screens-board.md`:
- **Guide:** "Experiences on tours" rows with "N confirmed · N asked" per linked stop and the dashed "+ Add an experience to a tour stop"; "On Discover": Places & favourites (N featured · N in the catalogue), Elkdonis Forum, the guide's own feed posts with status ("On Discover" / "With the office" / "Declined"), "+ Share a post or a link"; "New from artists" (public experiences not on any tour yet). These are replaced by a flat list of links (`board-server.tsx:35-46`). Backend reads exist (`getCollaborate`, `listFeedPosts({authorUserId, includePending})`, `listExperiences`).
- **Office (D1):** "To review" (new experiences with Publish / Members only / Send back), "Artists" (everyone -> profile). **`decideExperienceAction` and `listExperiencesToReview` are not used anywhere in the UI**, so the experience status flow (review -> public / members / sent back with notes) has no phone screen; the link "Experiences: Review, publish and edit" opens the desktop page.
- **Artist board** (`artist-home-view.tsx`): the design's Invitations cards inline with Accept/Decline and "Coming up" with guests booked are on `/artist/invitations` instead (one tap further); "When I'm free" is "saved at once" in the design, here it needs a "Save my week" button (`artist-home-view.tsx:37,80`); the profile card shows "You" because the name is not loaded (`app/artist/page.tsx:21`).

### 35 Artist wizard: matches except prefill
Four steps with a progress bar and tappable earlier steps, validation as in `data-and-state.md` (name and `@` for new artists; title, pitch, place unless online; one cell; one offer), grid and notice chips, offer switches with fee stepper and per run / per guest, visibility chips, preview card, copy as designed.
- **design gap** (D6) step I is not prefilled for a returning artist (name `""`, craft/area/about empty, kind chips and the "link" field absent; `artist-wizard-loader.tsx:15,24`), which with B1 loses data; the design says "prefilled".
- **nit** Where: every place in the catalogue renders as a chip (`artist-wizard-view.tsx:228`, up to 200, 75 today); the design shows a few. Add search or show the nearest first.

### 36 Collaborate: matches
Tour chips, stops as a timeline with offset, experience and artist per stop, one chip per upcoming date (Confirmed / Asked / Declined / + Invite / Not free), "+ Add an experience" sheet of public experiences with "Free for N of M dates", automatic invitations on choosing with the invited/skipped toast. **nit:** "Not free" chips are disabled, but `inviteForDepartureAction` allows "the guide chooses anyway"; the design shows Not free as inert, so this is right.

### 37 Tour page media: matches with small gaps
"Opens with" chips for the available kinds, switches per film / 3D / cover / gallery / Street View stills, "arrive switched off" note, preview button. **nit:** the "Request a fly-over film" link shows whenever there is no film (`tour-media-view.tsx:139`), the design only when the stops are placed on the map; indoor tours should not offer the 3D row.

### 38 Place edit: matches
Name, kind chips (stored as a tag, noted by Gee), area, website, "why you like it", tag toggle chips plus New tag, feature star, save needs name and area.

### 39 Share a post: matches
Post/link chips, title, link (a dot required), body, role-dependent note and CTA ("Send to the office" / "Publish on Discover"), done screen. **nit:** the note and CTA are chosen by role (`isOwner`), not by the site setting `holdGuidePosts`; if the owner turns holding off, a guide's post publishes at once while the screen said the office reads it first (the done screen then correctly says Published).

### Invitations and posts to confirm
Invitation card: tour, stop and time, experience and fee, Accept / Decline. **design gap:** the prototype headline is "{Guide} invites you" and the stop is "Stop IV · name · date, about 11:15" (roman numeral, "about" the arrival time); here the card title is the tour and the guide's name is not shown (`invitations-view.tsx:55-57`; the invitation row has `requestedBy`). Posts to confirm: matches (Put on Discover / Decline).

### Missing screen (D2): the below-minimum rule setting
`saveSiteSettings` (owner-only) is not reachable from any screen, so the "guide decides / auto-cancel" setting and `holdGuidePosts` cannot be changed; both stay at their defaults. The prototype's three-way role switch is demo-only, but the rule needs a place (an owner row on the Board, or `/manage/settings`). **design gap, needed before auto-cancel can be used.**

## 7. Where the backend now allows what the UI still disables

- Run / reopen / close-now / per-slot minimum and cutoff: **wired** (no mismatch).
- Per-slot price: backend refuses; UI read-only and says so (consistent).
- Waitlist (switch, size, Offer, second Decisions list): backend not built; UI hidden (consistent).
- Artist availability "saved at once": the backend action is cheap and could save on each tap; the UI makes the artist press a button (D-gap above).
- Experience decisions (Publish / Members only / Send back): backend `decideExperienceAction` exists; **no UI** (D1).
- "Request a fly-over": a desktop route exists (`/manage/tours/[id]/flyover`); the phone link goes there; fine.

## 8. Suggested order of fixes

1. B1 (data loss) and B2 (None minimum): small, do first.
2. L1-L3 (guide scoping, feed-review gate): a few lines each in the actions and pages.
3. A settings screen for the rule (D2) and the experience review cards on the office Board (D1).
4. The Board home guide rows and the slot panel sentences (design gaps), then the nits.
