-- 291: standing rules for set_dates offers, and dismissed overlap notices (2026-11-24).
--
-- A standing rule keeps a tour open for registration without the office marking each day: it names weekdays and
-- start times, and a materialiser creates the matching booking_slots up to `ahead_days` ahead (at most six months).
-- The slots are ordinary slots (source 'rule'): the tour's minimum to run, cutoff and cancel-or-run decision apply
-- to them exactly as to slots made by hand. Cancelled slots are not recreated (unique (offer_id, starts_at)).
-- Stopping a rule (active = false) stops generation; slots already made stay.
--
-- booking_rules (migration 265) is not reused: it holds open hours (a from/to window, computed on demand), not
-- fixed start times with a number of places.
--
-- Times are wall-clock HH:MM in the site's time zone (elktours: Europe/Paris), as in the schedule planner.
--
-- booking_clash_dismissals: an overlap of one guide's two slots is allowed (elktours warns, does not refuse) and is
-- listed as a notice until someone dismisses it. A notice is the pair of slots, so moving a slot to a new overlap
-- raises a new notice. Overlaps themselves are computed from booking_slots, not stored; only the dismissal is.

CREATE TABLE IF NOT EXISTS booking_standing_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id         uuid NOT NULL REFERENCES booking_offers(id) ON DELETE CASCADE,
  org_id           varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- ISO weekdays, Mon = 1 ... Sun = 7.
  weekdays         smallint[] NOT NULL,
  times            text[] NOT NULL,
  capacity         integer NOT NULL,
  -- NULL = the tour's author.
  guide_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  valid_from       date,
  valid_until      date,
  -- How far ahead slots are kept made: 1 to 183 days (six months).
  ahead_days       integer NOT NULL DEFAULT 90,
  active           boolean NOT NULL DEFAULT true,
  -- The last day the materialiser has covered (informational).
  generated_through date,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  CHECK (cardinality(times) BETWEEN 1 AND 4),
  CHECK (capacity BETWEEN 1 AND 500),
  CHECK (ahead_days BETWEEN 1 AND 183),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_booking_standing_rules_offer ON booking_standing_rules (offer_id);
CREATE INDEX IF NOT EXISTS idx_booking_standing_rules_active ON booking_standing_rules (org_id) WHERE active;

-- Which rule made a slot, so a rule's future empty slots can be found.
ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS standing_rule_id uuid REFERENCES booking_standing_rules(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_booking_slots_rule ON booking_slots (standing_rule_id) WHERE standing_rule_id IS NOT NULL;

-- Row-level security as migration 265: policies bind only eac_tenant.
ALTER TABLE booking_standing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON booking_standing_rules;
CREATE POLICY tenant_isolation ON booking_standing_rules FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id())
  WITH CHECK (org_id::text = app_org_id());

-- A dismissed overlap notice: the pair of slots, smaller id first.
CREATE TABLE IF NOT EXISTS booking_clash_dismissals (
  slot_a       uuid NOT NULL REFERENCES booking_slots(id) ON DELETE CASCADE,
  slot_b       uuid NOT NULL REFERENCES booking_slots(id) ON DELETE CASCADE,
  org_id       varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dismissed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slot_a, slot_b),
  CHECK (slot_a < slot_b)
);
CREATE INDEX IF NOT EXISTS idx_booking_clash_dismissals_org ON booking_clash_dismissals (org_id);
CREATE INDEX IF NOT EXISTS idx_booking_clash_dismissals_b ON booking_clash_dismissals (slot_b);

ALTER TABLE booking_clash_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON booking_clash_dismissals;
CREATE POLICY tenant_isolation ON booking_clash_dismissals FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id())
  WITH CHECK (org_id::text = app_org_id());
