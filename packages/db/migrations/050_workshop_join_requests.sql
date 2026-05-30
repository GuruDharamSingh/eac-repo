-- Migration 050: workshop_join_requests
--
-- A single row per paid join intent. Captures who's joining which workshop,
-- the amount owed, the eTransfer reference, and the payment status. Free
-- joins do NOT live here — they're tracked in `thread_rsvps` (existing).
--
-- Lifecycle:
--   pending  → buyer received eTransfer instructions, payment not yet received
--   paid     → admin / webhook confirmed transfer; RSVP can be auto-created
--   cancelled→ buyer abandoned or admin cancelled (e.g. payment didn't arrive)

CREATE TABLE IF NOT EXISTS workshop_join_requests (
  id                 VARCHAR(21) PRIMARY KEY,
  workshop_id        VARCHAR(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  contact_name       TEXT,
  contact_email      TEXT NOT NULL,
  notes              TEXT,
  amount_minor       INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency           VARCHAR(3) NOT NULL DEFAULT 'CAD',
  payment_reference  TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'paid', 'cancelled')),
  due_at             TIMESTAMPTZ NOT NULL,
  paid_at            TIMESTAMPTZ,
  cancelled_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_join_requests_workshop
  ON workshop_join_requests (workshop_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workshop_join_requests_user
  ON workshop_join_requests (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workshop_join_requests_email
  ON workshop_join_requests (contact_email);
