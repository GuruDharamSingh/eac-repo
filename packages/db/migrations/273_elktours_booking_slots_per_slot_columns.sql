-- DRAFT (not applied, not in packages/db/migrations). Gap 5 of
-- docs/open/ELKTOURS_MOBILE_2026-11-15/backend-map-booking.md.
--
-- Per-slot overrides on booking_slots, so one departure can have its own
-- minimum, cutoff, waitlist size, price and "run it anyway" decision (the
-- mobile Slot screen). NULL means "use the offer's value"; code reads
-- COALESCE(slot.x, offer.x). Additive: nothing existing reads these columns.
--
-- Apply ALONE (migration 263 is pending; never run a plain db:migrate):
-- take the next free number after listing packages/db/migrations/ (268 at
-- the time of writing), then in one transaction run this file and insert its
-- row into app_schema_migrations (filename, checksum) as migrate.mjs does.
--
-- Dry-run (read-only): the table must exist and none of the columns yet.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'booking_slots'
--     AND column_name IN ('run_decision','min_to_run','close_before_minutes','waitlist_cap','price_minor');   -- expect 0 rows
--
-- Rollback (safe while no code writes the columns; otherwise the overrides are lost):
--   ALTER TABLE booking_slots DROP COLUMN run_decision, DROP COLUMN min_to_run,
--     DROP COLUMN close_before_minutes, DROP COLUMN waitlist_cap, DROP COLUMN price_minor;
--
-- Not needed here: a duration (booking_slots has starts_at and ends_at).
-- Not in this file (gap 8, waitlist offers): the waitlist uses bookings.status
-- = 'waitlisted' plus a hold; if an "offered at / offer expires" pair is
-- wanted it can reuse bookings.hold_expires_at, so no column is proposed.

ALTER TABLE booking_slots
  -- 'run' = the guide chose to run the slot below its minimum.
  ADD COLUMN IF NOT EXISTS run_decision text
    CHECK (run_decision IS NULL OR run_decision = 'run'),
  -- "Runs with N or more" for this slot only.
  ADD COLUMN IF NOT EXISTS min_to_run integer
    CHECK (min_to_run IS NULL OR (min_to_run > 0 AND min_to_run <= capacity)),
  -- Booking closes this long before the start, for this slot only. Reopen and
  -- "close booking now" are writes to this column.
  ADD COLUMN IF NOT EXISTS close_before_minutes integer
    CHECK (close_before_minutes IS NULL OR close_before_minutes >= 0),
  -- Waitlist places for this slot: NULL = the offer's, 0 = no waitlist.
  ADD COLUMN IF NOT EXISTS waitlist_cap integer
    CHECK (waitlist_cap IS NULL OR (waitlist_cap >= 0 AND waitlist_cap <= 100)),
  -- Per-person price override, minor units; NULL = the thread's price.
  -- (How an order takes it is open: see the questions in CUTOVER.md.)
  ADD COLUMN IF NOT EXISTS price_minor integer
    CHECK (price_minor IS NULL OR price_minor >= 0);

-- RLS is per table and already covers new columns (migration 265, tenant_isolation).
