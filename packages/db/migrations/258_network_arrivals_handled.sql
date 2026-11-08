-- 258 · The arrivals queue: welcomed / dismissed.
-- 2026-11-08. docs/open/hub-cards-handoff/PLAN.md §6 C.
--
-- Handled state is PER ARRIVAL ROW, deliberately: welcoming or dismissing marks
-- every open row of that person for that org, and a later arrival (a new row)
-- queues them again. The queue = rows with handled_at IS NULL whose person is
-- not already a member, guide or owner, oldest first.

ALTER TABLE network_arrivals
  ADD COLUMN IF NOT EXISTS handled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS handled_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outcome     text CHECK (outcome IN ('welcomed', 'dismissed'));

CREATE INDEX IF NOT EXISTS network_arrivals_queue
  ON network_arrivals (org_id, arrived_at) WHERE handled_at IS NULL;
