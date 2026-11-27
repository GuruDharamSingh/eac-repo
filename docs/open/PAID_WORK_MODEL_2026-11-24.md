# Paid work: one model (2026-11-24)

This page records the paid-work model agreed in conversation with the
developer on 2026-11-24. It maps the model onto today's tables and says what
the WorkingArts experiment tests. Sources: the live schema, read on 2026-11-24
(queries against `information_schema` and row counts), and the services and
commerce code. No code in the main tree changed for it.

## The model

The platform sells two things.

- **Time:** a meeting, reading, consultation, lesson, workshop, series or tour.
  These are one offer with four settings:
  - **When:** once, recurring, a set of sessions, by appointment (open hours or
    "ask for a time"), or set departures.
  - **Take-up:** RSVP, a booked time, or a paid seat or party.
  - **Price:** free, fixed, sliding, per person or per booking.
  - **Attached:** materials folder, Talk room, document, a Sophia workspace.
- **Object:** artwork. It adds stock and editions, provenance, shipping and
  auction on top of the shared order and payment.

There are two ways through it: booked and then scheduled (by appointment), or
scheduled and then RSVP'd or bought (dates set first). The kind (service,
workshop, tour…) is a label and a template, not a separate code path.

Separate from paid work (developer, 2026-11-24):
- **Posts and writing, and comments.**
- **Unpaid meetings.** RSVP is shared with paid work, not owned by it: a free
  community meeting uses the same RSVP without being an offer.
- **Org membership:** roles, audiences, followers. It decides who may offer on
  an org's behalf and who sees what.

Later: in-person trades priced by breakdown (diagnostic, labour, parts), not
only by the hour. A booking still happens. `booking_components` (below) already
has the composition shape.

## Today's tables against the model (verified 2026-11-24, schema query)

| Model part | Where it lives now | Note |
|---|---|---|
| The offer | `threads` (kind, price, currency, scheduled_at, duration_minutes, location, format, is_rsvp_enabled, attendee_limit, min_attendees) | one row per offer for every kind of time |
| Offer page extras | `workshop_pages` (15 rows): subtitle, cover, gallery, sliding scale, registration | used by services and workshops alike |
| When: recurring | `threads.recurrence_pattern`, `recurrence_until`, `recurrence_custom_rule` | |
| When: sessions | `threads.sessions` (jsonb), `workshop_sessions` (7), `series_sessions` (16) | three stores of one idea |
| When: appointment and dates | `booking_offers` (13, all elktours tours, `set_dates`), `booking_slots` (20), `booking_rules` (0), `booking_standing_rules` | `booking_offers.mode` allows `open_hours`, `set_dates`, `request_time`, `sessions`, `rsvp` (migration 265) |
| Take-up: RSVP | `thread_rsvps` (49): status, flavour, promise_next, hold, attended | |
| Take-up: booking | `bookings` (4): slot, party size, order, hold, proposed times, agent, parent booking, agreement | general table |
| Take-up: older bookings | `service_bookings` (0), `tour_bookings` (0) | still read in commerce, elktours, hidden-enneagram, sunjay |
| Money | `commerce_order`, `commerce_order_line`, `payout`, `payout_ledger` | shared by every paid take-up, artwork included |
| Object | `artwork`, `artwork_variant`, `artwork_media`, `artwork_provenance`, `store`, `order_shipment`, `auction_series*` | not a `threads` kind |
| Composition | `booking_components` (0): offer made of component offers, role `stop`/`extra`, required, per person/party | built for tours |
| Workspace attached | Sophia courses and runs; `lms_workshop_listings` (3) lists a workshop thread on the Sophia hub (migration 175) | the workshop thread stays the offer; the workspace is what you enter after taking it up |
| Yellow pages | `business_listings` (30): address, hours, phone, site, claimed/unclaimed | |

Notable: migration 265 already designed `booking_offers` to cover RSVP and
sessions (`mode` `rsvp`, `sessions`), so the booking module is the natural home
of "when" and "take-up" for all paid time. Nothing uses those two modes yet.

Published public offers on 2026-11-24 (query): meetings and series with RSVP
(ifac, inner_group, sunjay, fourthway), services with a price and no booking
offer (elastrocal, hidden-enneagram, inner_group, oad), and elktours tours with
`set_dates` booking offers. No public workshop.

## Code paths for one idea (services and commerce)

- `packages/services/src/artist-offerings.ts`: who offers it (a person, homed in
  `oad`), not a kind. Person's lead offer is `users.featured_thread_id`.
- `packages/services/src/service-offerings.ts` and `workshop-offerings.ts`: two
  kinds on the same `workshop_pages` table; the workshop file says it mirrors
  the service file.
- `packages/services/src/meeting-content.ts`: dated threads for any org; its
  header lists six app copies.
- An org's lead offer is `threads.pinned`; a person's is
  `users.featured_thread_id`.

## What the WorkingArts experiment tests

Branch `experiment/workingarts-2026-11-24` (worktree
`~/eac-worktrees/workingarts`, local only). One read layer,
`@elkdonis/workingarts/paidwork`, returns any offer of time in the model's
shape (`loadWork`, `leadOf`) over the unchanged tables. The arts-collective
free tier (`<org>.arts-collective.com/`) draws its one offering from it. The
point is to see whether one shape carries every kind on the smallest site
before the main tree is straightened. Nothing on the branch is deployed.

## Draft on the branch: one form, one Puck offer page (2026-11-24)

Uncommitted on `experiment/workingarts-2026-11-24`. Tours and experiences are
left out (developer, 2026-11-24: not on the free tier; they come back with the
community routes).

- **Form:** `packages/studio-forms/src/forms/kinds/offer/` adds one form kind,
  `offer`. Its sections are Title, When it happens, Why and What, then the
  sections of whichever kind the mode chooses:
  - One date or Repeats: the meeting form's sections.
  - By appointment or Set dates: the offering (service) form's sections.
  - Sessions: the workshop form's sections, or the series form's for a series
    preset.

  The kinds a person starts from are presets: reading, lesson, meeting, weekly
  meeting, paid event, workshop and series. `adapters/offer.ts` sends each
  save to today's adapter for that kind, after removing the two form-only
  keys.
- **Verified (forms harness, Ledger look, 1320 px):** pages `offer-weekly` and
  `offer-reading` render with no console errors, and both reach "Ready to
  publish".
- **Gaps seen:**
  - ~~The meeting form's own Repeats switch repeats the mode.~~ Fixed later on
    2026-11-24 (see below).
  - ~~The offering form's "People pick a time from my hours" checkbox repeats
    By appointment.~~ Fixed later on 2026-11-24.
  - ~~The Start from menu in the harness shows the meeting presets, not the
    offer presets.~~ Fixed later on 2026-11-24.
  - A price on a meeting is drawn but not saved (`meeting-content.ts` stores
    no price). The adapter says so in its warnings.
- **Doubled controls fixed (later 2026-11-24)** in
  `kinds/offer/sections.tsx`. The offer form now uses its own versions of
  two of the existing sections:
  - **Meeting track:** the When section drops its Repeats switch, because One
    date / Repeats sets `recurrence_pattern`. The repeat's end now says
    "Times", not "Sessions", and the section is labelled "Date and time".
  - **Service track:** the "People pick a time from my hours" checkbox is
    gone. By appointment turns the booking module on (`modePatch`), and Open
    hours / Ask for a time stays as the one sub-choice. The older "suggest
    three times after paying" path is not offered in this form
    (`service_bookings`: 0 rows).
  - **Length:** the booking Length row is hidden in this form (`forms.css`),
    and `adapters/offer.ts` copies the length from How it's held into the
    booking offer on save.
  - **Set dates** is no longer offered as a mode, because this form has no
    date-list editor. It shows only for a record that already has set dates.
    The lesson preset is now by appointment.
  - **Verified** in the harness (Ledger, 1320 px; crops of the When and
    Booking sections). The original `service` and `1b` pages still render
    unchanged, with no console errors.
  - **Not handled:** choosing a preset from Start from does not run the mode
    switch, so a reading picked on a blank form shows "Set your hours" (one
    action) until it is pressed.
- **Page:** `packages/workingarts/src/puck/` adds five sealed blocks: title
  and cover; when, where and price; sessions or dates; description; RSVP or
  book. They read one thread from the page metadata (`threadId`), so an owner
  cannot point the page at a second offer. Each kind has its own starting
  block order (`templates.ts`). An org's edited copy would be stored as
  `site_config` `puck:offer-<kind>`. Nothing saves one yet, and the hub has
  no editor for it.
- **Verified (branch preview, signed out, live database read only):** the
  arts-collective free-tier `/offering` page draws the template for ifac,
  4th-way, elastrocal and inner-gathering, in the expected block order. Its
  RSVP block calls the site's existing `/api/threads/<id>/rsvp`.

### Offer page editor (later 2026-11-24, uncommitted on the branch)

- **Route:** `/hub/sites/<slug>/offer/<kind>?thread=<id>` (arts-collective)
  opens the house editor (Puck) for one kind's page. It opens the org's saved
  copy (`site_config` `puck:offer-<kind>`) or the kind's starting template.
  The `thread` it previews with is the one asked for, if it belongs to the
  org and is that kind, else the org's newest of that kind. Owners and guides
  only (`canEditOrgSite`); everyone else gets a 404, and a signed-out visitor
  is sent to login.
- **Allowed blocks** (`lib/puck/offer-catalogue.ts`): the five offer blocks
  plus blocks that draw only what the owner types. Excluded:
  - every data-driven block (feeds, the offering card, people, galleries,
    stores);
  - the Card (`feature-card`), which can fill itself from another post.

  `saveOfferPageAction` refuses any other block type before it writes, and
  `resetOfferPageAction` deletes the stored copy.
- **Editor data:** `/api/org/<slug>/offer-blocks/<id>?thread=` feeds the
  canvas. Owners and guides only, and only for a thread of that org.
- **Hub:** the Published list shows "Page look" beside meetings, reading
  groups, services, workshops and series.
- **Verified** (branch preview, live database, existing test account
  `house-editor-test@example.com`, a guide of inner_group; session minted per
  testing.md and signed out after):
  - the editor rendered in headless Chrome with no console errors, its canvas
    drawing the five offer blocks for "Astrology Reading";
  - the drawer lists the five offer blocks, with no feed, offering card,
    people or Card;
  - the data route answers 401 signed out and 404 for a thread not in the
    org;
  - the hub's Published list shows four "Page look" links.

  Publish was not pressed. Nothing was written apart from the test session,
  which was signed out.
- **Not done:**
  - No Reset button: the reset action exists, but no UI calls it.
  - The save-time block check has not been exercised.
  - The cover picture showed broken in the preview, probably because the
    preview ran without Nextcloud credentials (assumed).
  - In the preview, the hub page drew without its styles. I didn't look into
    why.

## Open questions

1. Is a free booked conversation (a free consultation) paid work or a meeting?
   The booking module books free offers already.
2. Should RSVP's extra fields (flavour, promise next, attended) move onto
   `bookings`, with RSVP becoming `booking_offers.mode = 'rsvp'`, or stay in
   `thread_rsvps` as the community path?
3. One store for sessions: `booking_slots` (already has `session_thread_id`),
   `series_sessions`, or `workshop_sessions`?
4. One lead column for people and orgs, or keep both behind one call?
