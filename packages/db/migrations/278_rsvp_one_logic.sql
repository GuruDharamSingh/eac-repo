-- 278: one RSVP logic (docs/open/RSVP_BOOKING_ONE_LOGIC_2026-11-16.md, step 1).
-- Written, not applied. The code runs without it: each use of a column or
-- table below is probed first, and the feature is simply off until this lands.
--
--   organizations.join_policy   private / invite-only orgs refuse follow-on-RSVP (decision 3c)
--   thread_rsvps.hold_expires_at, promoted_at
--                               a waitlist promotion on a priced thread holds the seat (3d)
--   thread_rsvps.attended_at, attended_by
--                               "attended" for workshops and events (3e)
--   rsvp_refund_due             a cancel of a paid place records the refund as due; one press issues it

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS join_policy text NOT NULL DEFAULT 'open'
  CHECK (join_policy IN ('open', 'invite_only', 'private'));

ALTER TABLE thread_rsvps
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS promoted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS attended_at     timestamptz,
  ADD COLUMN IF NOT EXISTS attended_by     uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_thread_rsvps_waitlist
  ON thread_rsvps (thread_id, updated_at) WHERE status = 'waitlist';

CREATE TABLE IF NOT EXISTS rsvp_refund_due (
  order_id     uuid PRIMARY KEY REFERENCES commerce_order(id) ON DELETE CASCADE,
  thread_id    varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id       varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  status       text NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'issued', 'declined')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  issued_at    timestamptz,
  issued_by    uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rsvp_refund_due_org ON rsvp_refund_due (org_id, status);
