-- DRAFT (not applied, not numbered): service_commissions for experience invitations per departure.
-- Screen 36 Collaborate / 30 Board. Changes the migration-236 table so an invitation can exist without
-- a public `service` listing, knows its stop, and cannot be created twice for the same date.
-- Existing rows (0 today) all keep a service_thread_id, so nothing is lost.
-- App note: lib/commissions.ts SELECT does an INNER JOIN threads s ON s.id = c.service_thread_id and
-- proposeCommission requires a public service thread. Both need a follow-up edit (LEFT JOIN; a second
-- proposal path for experience invitations) before invitations without a service work.

ALTER TABLE service_commissions ALTER COLUMN service_thread_id DROP NOT NULL;

ALTER TABLE service_commissions ADD COLUMN IF NOT EXISTS stop_id uuid REFERENCES tour_stops(id) ON DELETE SET NULL;
-- When the group reaches the stop on that run (tour start + duration x index / stops, rounded to 5 min).
ALTER TABLE service_commissions ADD COLUMN IF NOT EXISTS arrival_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_commissions_has_subject') THEN
    ALTER TABLE service_commissions ADD CONSTRAINT service_commissions_has_subject
      CHECK (service_thread_id IS NOT NULL OR experience_thread_id IS NOT NULL);
  END IF;
END $$;

-- One live invitation per experience per date (declined and cancelled ones may be re-invited).
CREATE UNIQUE INDEX IF NOT EXISTS service_commissions_one_live_invite
  ON service_commissions (experience_thread_id, departure_id)
  WHERE experience_thread_id IS NOT NULL AND departure_id IS NOT NULL AND status IN ('proposed','accepted');
CREATE INDEX IF NOT EXISTS idx_service_commissions_stop ON service_commissions (stop_id) WHERE stop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_commissions_departure ON service_commissions (departure_id) WHERE departure_id IS NOT NULL;
