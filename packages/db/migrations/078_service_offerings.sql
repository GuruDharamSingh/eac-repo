-- ============================================================================
-- Migration 078: `service` thread kind + service order lines
-- ============================================================================
-- A "service" is an offering a person sells — a workshop seat, a one-on-one
-- reading, a lesson. Piloted on hidden-enneagram, but deliberately
-- org-agnostic (same posture as 073): the kind, the order-line linkage and
-- the query layer take an org_id; nothing here bakes one site's structure in.
--
-- (a) threads.kind gains 'service'. Services reuse the workshop_pages
--     sidecar (pricing incl. sliding scale, registration_status, media
--     slots) — the table is workshop-named but structurally an "offering
--     page". No new sidecar. Booking type (one_on_one | group | async)
--     rides in threads.metadata; purely presentational for now.
--
--     Services are sold, not RSVP'd: is_rsvp_enabled stays false and the
--     kind never enters the RSVP-gated routes. Payment IS the registration.
--
-- (b) commerce_order_line.thread_id — lets an order line sell a thread
--     (service) instead of an artwork_variant. The artwork columns were
--     already nullable, so the table becomes polymorphic-by-nullability:
--     exactly one of artwork_variant_id / thread_id is set per line.
--     confirmEtransferReceived is already safe for such lines (its artwork
--     UPDATEs match zero rows when artwork_variant_id IS NULL).
--
-- (c) Seeds the hidden-enneagram 'services' feed so threads.section can
--     name a real org_feeds row (the 073 invariant). Tolerates a missing
--     org row — hidden-enneagram is provisioned at runtime, not migrated.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- (a) threads.kind: widen the CHECK (073 precedent: drop + re-add)
-- ---------------------------------------------------------------------------

-- 077 (pigeonshoot) already widened this to add 'pigeon' — preserve it here
-- rather than reverting to the four-kind set from migration 030.
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_kind_check;
ALTER TABLE threads ADD CONSTRAINT threads_kind_check
  CHECK (kind IN ('post', 'meeting', 'workshop', 'event', 'pigeon', 'service'));

COMMENT ON CONSTRAINT threads_kind_check ON threads IS
  'service = a sellable offering (workshop seat, 1-on-1 session, lesson). Uses workshop_pages sidecar + commerce orders; never RSVP.';

-- ---------------------------------------------------------------------------
-- (b) commerce_order_line → threads
-- ---------------------------------------------------------------------------

ALTER TABLE commerce_order_line
  ADD COLUMN IF NOT EXISTS thread_id VARCHAR(21) REFERENCES threads(id);

CREATE INDEX IF NOT EXISTS idx_order_line_thread
  ON commerce_order_line(thread_id) WHERE thread_id IS NOT NULL;

COMMENT ON COLUMN commerce_order_line.thread_id IS
  'Set when this line sells a thread (kind=service) rather than an artwork variant. Exactly one of thread_id / artwork_variant_id per line.';

-- ---------------------------------------------------------------------------
-- (c) Seed: hidden-enneagram services feed (skipped if org not provisioned)
-- ---------------------------------------------------------------------------

INSERT INTO org_feeds (org_id, slug, name, tagline, description, accent, sort_order, is_public)
SELECT 'hidden-enneagram', 'services', 'Services & Sessions',
       'Workshops and one-on-one enneagram work',
       'Readings, workshops and ongoing work with the enneagram — booked directly.',
       '#3aa99c', 0, TRUE
 WHERE EXISTS (SELECT 1 FROM organizations WHERE id = 'hidden-enneagram')
ON CONFLICT (org_id, slug) DO NOTHING;

COMMIT;
