-- DRAFT (not applied, not in packages/db/migrations). Gap 13 of
-- docs/open/ELKTOURS_MOBILE_2026-11-15/backend-map-booking.md.
--
-- Moves elktours departures onto the booking tables, keeping every id:
--   one booking_offers row per tour thread (set_dates, per person, Paris time)
--   tour_departures -> booking_slots   (same id, source 'departure')
--   tour_bookings   -> bookings        (same id, same buyer_token, same order)
--   service_commissions.departure_id and tour_stop_notes.departure_id repointed
--   to booking_slots (they keep working because the ids are kept).
-- The old tables are NOT touched or dropped; they stay as the rollback source.
--
-- Run AFTER booking_slots_per_slot_columns.sql, and apply ALONE (migration 263
-- is pending; never run a plain db:migrate). Next free number after listing
-- packages/db/migrations/ (269 at the time of writing). One transaction with
-- the app_schema_migrations row. Needs psql variable site_url:
--   psql -v site_url=https://elkdonisexperiences.com -f <this file>
-- (the elktours NEXT_PUBLIC_APP_URL, read from the container 2026-11-15; if the
-- migrate runner cannot pass variables, replace :'site_url' with the literal).
--
-- ── DRY RUN (read-only; run these first and compare) ────────────────────────
-- Expected 2026-11-15: departures 3, bookings 0, commissions-with-departure 0.
--   SELECT (SELECT count(*) FROM tour_departures)                          AS departures,      -- 3
--          (SELECT count(*) FROM tour_bookings)                            AS bookings,        -- 0
--          (SELECT count(*) FROM service_commissions WHERE departure_id IS NOT NULL) AS commissions, -- 0
--          (SELECT count(*) FROM tour_stop_notes WHERE departure_id IS NOT NULL)     AS stop_notes,  -- ?, must be carried
--          (SELECT count(*) FROM threads WHERE kind = 'tour' AND org_id = 'elktours') AS tour_threads;  -- 12 -> 12 offers
-- No two departures of one tour may share a start (booking_slots is unique on offer + start):
--   SELECT thread_id, starts_at, count(*) FROM tour_departures GROUP BY 1, 2 HAVING count(*) > 1;   -- expect 0 rows
-- Cancelled bookings whose order was paid: refund_status is set 'none' below, review by hand:
--   SELECT b.id, o.status FROM tour_bookings b JOIN commerce_order o ON o.id = b.order_id
--   WHERE b.status = 'cancelled' AND o.status IN ('paid','fulfilled','completed');                   -- expect 0 rows
-- Nothing may be mid-checkout when this runs: unpaid holds younger than 75 minutes would be copied
-- as awaiting_payment with a hold that has not lapsed:
--   SELECT count(*) FROM tour_bookings WHERE status = 'awaiting_payment' AND created_at > now() - interval '75 minutes';  -- expect 0
--
-- ── AFTER (verify, read-only) ───────────────────────────────────────────────
--   SELECT (SELECT count(*) FROM booking_slots WHERE source = 'departure') AS slots,            -- = departures
--          (SELECT count(*) FROM bookings b JOIN booking_offers o ON o.id = b.offer_id WHERE o.mode = 'set_dates') AS bookings,  -- = tour_bookings
--          (SELECT count(*) FROM booking_offers WHERE mode = 'set_dates') AS offers;            -- = tour threads
--
-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- Safe only if nothing was booked on the new tables since: copy any such rows back to
-- tour_bookings first, otherwise they are lost. Then, in one transaction:
--   ALTER TABLE service_commissions DROP CONSTRAINT service_commissions_departure_id_fkey;
--   ALTER TABLE service_commissions ADD CONSTRAINT service_commissions_departure_id_fkey
--     FOREIGN KEY (departure_id) REFERENCES tour_departures(id) ON DELETE SET NULL;
--   ALTER TABLE tour_stop_notes DROP CONSTRAINT tour_stop_notes_departure_id_fkey;
--   ALTER TABLE tour_stop_notes ADD CONSTRAINT tour_stop_notes_departure_id_fkey
--     FOREIGN KEY (departure_id) REFERENCES tour_departures(id) ON DELETE SET NULL;
--   DELETE FROM bookings WHERE offer_id IN (SELECT id FROM booking_offers WHERE mode = 'set_dates');
--   DELETE FROM booking_slots WHERE source = 'departure';
--   DELETE FROM booking_offers WHERE mode = 'set_dates';
-- and point the adapter back at tours.ts (CUTOVER.md, step 9). Delete the tracker row only
-- if the file is to be re-run.


-- 1. One offer per tour thread. Idempotent on thread_id.
--    Defaults come from the thread: duration, author (the host), metadata.tour.maxParty,
--    and the top-level metadata.tourBooking {minToRun, closeBeforeMinutes, waitlistCap}
--    that the adapter already reads (apps/elktours/src/lib/tour-slots.ts).
--    reminder_minutes_before is NULL: tours send no reminder today (no reminder code reads
--    tour bookings), and the booking reminder tick runs from artdirect for every org, so a
--    default of 1440 would start mailing tour guests from the wrong site. Set it per tour
--    later if reminders are wanted (and then bookings.site_url must be the elktours origin,
--    which step 3 sets).
INSERT INTO booking_offers (
  org_id, thread_id, host_user_id, mode, duration_minutes, time_zone, capacity_per_slot,
  min_party, max_party, min_to_run, lead_time_minutes, close_before_minutes, max_ahead_days,
  price_unit, hold_minutes, approval, cancel_free_until_minutes, cancel_refund_percent_after,
  waitlist, questions, status, reminder_minutes_before
)
SELECT
  t.org_id, t.id, t.author_id, 'set_dates',
  LEAST(1440, GREATEST(5, COALESCE(NULLIF(t.duration_minutes, 0), 120))),
  'Europe/Paris',
  COALESCE((SELECT max(d.capacity) FROM tour_departures d WHERE d.thread_id = t.id), 8),
  1,
  LEAST(500, GREATEST(1, CASE WHEN t.metadata #>> '{tour,maxParty}' ~ '^[0-9]+$' THEN (t.metadata #>> '{tour,maxParty}')::int ELSE 20 END)),
  CASE WHEN t.metadata #>> '{tourBooking,minToRun}' ~ '^[0-9]+$' AND (t.metadata #>> '{tourBooking,minToRun}')::int > 0
       THEN (t.metadata #>> '{tourBooking,minToRun}')::int END,
  0,
  CASE WHEN t.metadata #>> '{tourBooking,closeBeforeMinutes}' ~ '^[0-9]+$' THEN (t.metadata #>> '{tourBooking,closeBeforeMinutes}')::int ELSE 0 END,
  366,
  'per_person', 75, 'instant',
  -- "Free cancellation until booking closes" (the Pay screen's policy line).
  CASE WHEN t.metadata #>> '{tourBooking,closeBeforeMinutes}' ~ '^[0-9]+$' THEN (t.metadata #>> '{tourBooking,closeBeforeMinutes}')::int ELSE 0 END,
  0,
  COALESCE((t.metadata #>> '{tourBooking,waitlistCap}') ~ '^[0-9]+$' AND (t.metadata #>> '{tourBooking,waitlistCap}')::int > 0, false),
  '[]'::jsonb,
  CASE WHEN t.status = 'published' THEN 'open' ELSE 'paused' END,
  NULL
FROM threads t
WHERE t.kind = 'tour'
ON CONFLICT (thread_id) DO NOTHING;

-- 2. Departures -> slots, same id. A duplicate (offer, start) raises and aborts the whole
--    transaction on purpose (see the dry-run duplicate check).
--    waitlist_cap (a column of booking_slots_per_slot_columns.sql, so that file runs first) carries the
--    tour's metadata.tourBooking.waitlistCap: the offer only has an on/off flag, and the adapter reads the
--    size per slot. The other per-slot columns stay NULL and inherit the offer's values set in step 1.
INSERT INTO booking_slots (id, offer_id, org_id, starts_at, ends_at, capacity, guide_user_id, status, note, source, waitlist_cap, created_at, updated_at)
SELECT d.id, o.id, d.org_id, d.starts_at,
       d.starts_at + make_interval(mins => COALESCE(o.duration_minutes, 120)),
       d.capacity, d.guide_user_id, d.status, d.note, 'departure',
       CASE WHEN t.metadata #>> '{tourBooking,waitlistCap}' ~ '^[0-9]+$' THEN LEAST(100, (t.metadata #>> '{tourBooking,waitlistCap}')::int) END,
       d.created_at, d.updated_at
FROM tour_departures d
JOIN threads t ON t.id = d.thread_id
JOIN booking_offers o ON o.thread_id = d.thread_id
ON CONFLICT (id) DO NOTHING;

-- 3. Bookings, same id, same buyer_token (so every emailed /bookings/<token> link keeps
--    working), same order. status maps one to one; an unpaid hold gets the 75-minute window
--    from its creation (the CHECK needs hold_expires_at); cancelled ones record who cancelled
--    as 'seller' (only the office cancels a tour booking) and refund_status 'none' (the old
--    tables never tracked refunds; see the dry-run query for paid ones).
INSERT INTO bookings (
  id, org_id, offer_id, slot_id, thread_id, booker_user_id, booker_email, booker_name,
  party_size, status, source, order_id, hold_expires_at, scheduled_at, duration_minutes, notes,
  buyer_token, confirmed_at, cancelled_at, cancelled_by, refund_status, site_url, created_at, updated_at
)
SELECT
  b.id, b.org_id, o.id, b.departure_id, b.thread_id, b.buyer_user_id, b.buyer_email, b.buyer_name,
  b.party_size, b.status, 'web', b.order_id,
  CASE WHEN b.status = 'awaiting_payment' THEN b.created_at + interval '75 minutes' END,
  s.starts_at, o.duration_minutes, b.note,
  b.buyer_token,
  CASE WHEN b.status = 'confirmed' THEN b.updated_at END,
  CASE WHEN b.status = 'cancelled' THEN b.updated_at END,
  CASE WHEN b.status = 'cancelled' THEN 'seller' END,
  'none', :'site_url', b.created_at, b.updated_at
FROM tour_bookings b
JOIN booking_slots s ON s.id = b.departure_id
JOIN booking_offers o ON o.id = s.offer_id
ON CONFLICT (id) DO NOTHING;

-- 4. Repoint both foreign keys at booking_slots. The ids are the same, so existing rows stay valid.
ALTER TABLE service_commissions DROP CONSTRAINT IF EXISTS service_commissions_departure_id_fkey;
ALTER TABLE service_commissions ADD CONSTRAINT service_commissions_departure_id_fkey
  FOREIGN KEY (departure_id) REFERENCES booking_slots(id) ON DELETE SET NULL;
ALTER TABLE tour_stop_notes DROP CONSTRAINT IF EXISTS tour_stop_notes_departure_id_fkey;
ALTER TABLE tour_stop_notes ADD CONSTRAINT tour_stop_notes_departure_id_fkey
  FOREIGN KEY (departure_id) REFERENCES booking_slots(id) ON DELETE SET NULL;


-- Not done here: tour_bookings.departure_id still references tour_departures (RESTRICT);
-- it goes when the old tables are dropped in a later migration, one release after the switch.
