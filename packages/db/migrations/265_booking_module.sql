-- 265: booking module, schema (2026-11-15). Migration A of
-- docs/open/BOOKING_MODULE_2026-11-14.md section 3.
--
-- One model for what can be booked, used first by one-to-one open-hours
-- booking on ArtDirect (phase 1), later by elktours departures, meetings,
-- series and composites:
--   booking_offers      one per thread: how time is offered, capacity, terms
--   booking_rules       weekly open hours of an open_hours offer
--   booking_slots       one concrete occurrence; for open hours created on
--                       first booking (unique offer_id, starts_at), so the
--                       row is the lock target
--   bookings            one booking (party) on a slot, or a request for a time
--   booking_components  reserved for phase 4 (tour stops, event extras)
--
-- No price is stored: the price stays on the thread (threads.price, major
-- units) and becomes minor units at the order (createThreadOrder). Every
-- duration is integer minutes. Seats taken are computed (confirmed plus
-- unexpired holds), never stored.
--
-- Additive: nothing reads these tables until @elkdonis/booking does. The old
-- tables (tour_departures, tour_bookings, service_bookings) are untouched.
-- Rollback: DROP TABLE booking_components, bookings, booking_slots,
-- booking_rules, booking_offers.

CREATE TABLE IF NOT EXISTS booking_offers (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id                   varchar(21) NOT NULL UNIQUE REFERENCES threads(id) ON DELETE CASCADE,
  -- Whose time is booked (open hours): bookings of every offer with the same
  -- host block each other. Defaults to the thread's author in code.
  host_user_id                uuid REFERENCES users(id) ON DELETE SET NULL,
  mode                        text NOT NULL
                                CHECK (mode IN ('open_hours', 'set_dates', 'request_time', 'sessions', 'rsvp')),
  duration_minutes            integer CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 1440)),
  -- Minutes between possible start times; NULL = the duration.
  slot_step_minutes           integer CHECK (slot_step_minutes IS NULL OR (slot_step_minutes >= 5 AND slot_step_minutes <= 1440)),
  -- Kept free after each booking of this host.
  buffer_minutes              integer NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0 AND buffer_minutes <= 720),
  time_zone                   text NOT NULL DEFAULT 'America/Toronto',
  capacity_per_slot           integer CHECK (capacity_per_slot IS NULL OR capacity_per_slot > 0),
  min_party                   integer NOT NULL DEFAULT 1 CHECK (min_party > 0),
  max_party                   integer NOT NULL DEFAULT 1 CHECK (max_party >= min_party),
  min_to_run                  integer CHECK (min_to_run IS NULL OR min_to_run > 0),
  lead_time_minutes           integer NOT NULL DEFAULT 720 CHECK (lead_time_minutes >= 0),
  close_before_minutes        integer NOT NULL DEFAULT 0 CHECK (close_before_minutes >= 0),
  max_ahead_days              integer NOT NULL DEFAULT 60 CHECK (max_ahead_days > 0 AND max_ahead_days <= 366),
  price_unit                  text NOT NULL DEFAULT 'per_booking' CHECK (price_unit IN ('per_booking', 'per_person')),
  hold_minutes                integer NOT NULL DEFAULT 75 CHECK (hold_minutes > 0),
  -- Reserved (agents deferred, decision 7). NULL = agents may not hold.
  agent_hold_minutes          integer CHECK (agent_hold_minutes IS NULL OR agent_hold_minutes > 0),
  approval                    text NOT NULL DEFAULT 'instant' CHECK (approval IN ('instant', 'seller_confirms')),
  cancel_free_until_minutes   integer CHECK (cancel_free_until_minutes IS NULL OR cancel_free_until_minutes >= 0),
  cancel_refund_percent_after integer CHECK (cancel_refund_percent_after IS NULL OR cancel_refund_percent_after BETWEEN 0 AND 100),
  cancel_policy_text          text,
  waitlist                    boolean NOT NULL DEFAULT false,
  -- Intake questions: [{ key, label, required }]. Answers land in bookings.answers.
  questions                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  status                      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paused', 'closed')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_offers_org ON booking_offers (org_id);
CREATE INDEX IF NOT EXISTS idx_booking_offers_host ON booking_offers (host_user_id);

CREATE TABLE IF NOT EXISTS booking_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id    uuid NOT NULL REFERENCES booking_offers(id) ON DELETE CASCADE,
  org_id      varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- 0 = Sunday … 6 = Saturday, wall clock in the offer's time zone.
  weekday     smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  from_time   time NOT NULL,
  to_time     time NOT NULL,
  valid_from  date,
  valid_until date,
  capacity    integer CHECK (capacity IS NULL OR capacity > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (to_time > from_time),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
CREATE INDEX IF NOT EXISTS idx_booking_rules_offer ON booking_rules (offer_id, weekday);

CREATE TABLE IF NOT EXISTS booking_slots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id          uuid NOT NULL REFERENCES booking_offers(id) ON DELETE CASCADE,
  org_id            varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  capacity          integer NOT NULL CHECK (capacity > 0),
  guide_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  note              text,
  source            text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'rule', 'series', 'departure')),
  session_thread_id varchar(21) REFERENCES threads(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, starts_at),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_booking_slots_org_time ON booking_slots (org_id, starts_at);

CREATE TABLE IF NOT EXISTS bookings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  offer_id           uuid NOT NULL REFERENCES booking_offers(id) ON DELETE RESTRICT,
  slot_id            uuid REFERENCES booking_slots(id) ON DELETE RESTRICT,
  thread_id          varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  booker_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  booker_email       text NOT NULL,
  booker_name        text,
  booker_time_zone   text,
  party_size         integer NOT NULL DEFAULT 1 CHECK (party_size > 0),
  status             text NOT NULL CHECK (status IN (
                       'held', 'awaiting_payment', 'requested', 'awaiting_seller', 'awaiting_booker',
                       'confirmed', 'waitlisted', 'cancelled', 'expired', 'completed', 'no_show')),
  source             text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'agent', 'seller', 'rsvp')),
  -- Reserved (agents deferred, decision 7).
  agent_user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  agent_org_id       varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,
  -- NULL = free, or a hold with no order yet.
  order_id           uuid UNIQUE REFERENCES commerce_order(id) ON DELETE SET NULL,
  hold_expires_at    timestamptz,
  -- Request-a-time (the meanings of migration 174).
  proposed_by        text CHECK (proposed_by IN ('booker', 'seller')),
  proposed_times     timestamptz[] NOT NULL DEFAULT '{}',
  last_message       text,
  last_message_by    text CHECK (last_message_by IN ('booker', 'seller')),
  -- The agreed start: the slot's start, or the request's result.
  scheduled_at       timestamptz,
  duration_minutes   integer CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  notes              text,
  answers            jsonb NOT NULL DEFAULT '{}'::jsonb,
  buyer_token        text NOT NULL UNIQUE,
  confirmed_at       timestamptz,
  cancelled_at       timestamptz,
  cancelled_by       text CHECK (cancelled_by IN ('booker', 'seller', 'system')),
  cancel_reason      text,
  refund_status      text NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none', 'due', 'issued', 'declined')),
  refund_due_minor   integer CHECK (refund_due_minor IS NULL OR refund_due_minor >= 0),
  -- Reserved (phase 4 extras; agreements parked, no FK yet).
  parent_booking_id  uuid REFERENCES bookings(id) ON DELETE CASCADE,
  agreement_id       uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'confirmed' OR scheduled_at IS NOT NULL),
  CHECK (status NOT IN ('held', 'awaiting_payment') OR hold_expires_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (slot_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_org ON bookings (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_booker ON bookings (booker_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_offer ON bookings (offer_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON bookings (scheduled_at) WHERE scheduled_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS booking_components (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  offer_id           uuid NOT NULL REFERENCES booking_offers(id) ON DELETE CASCADE,
  component_offer_id uuid NOT NULL REFERENCES booking_offers(id) ON DELETE CASCADE,
  role               text NOT NULL CHECK (role IN ('stop', 'extra')),
  required           boolean NOT NULL DEFAULT false,
  per                text NOT NULL DEFAULT 'party' CHECK (per IN ('person', 'party')),
  position           integer NOT NULL DEFAULT 0,
  agreement_id       uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, component_offer_id),
  CHECK (offer_id <> component_offer_id)
);

-- Row-level security, as migration 227 does for org-owned tables: policies
-- bind only eac_tenant, so the postgres connections are unaffected.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['booking_offers', 'booking_rules', 'booking_slots', 'bookings', 'booking_components'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO eac_tenant
         USING (org_id::text = app_org_id())
         WITH CHECK (org_id::text = app_org_id())', t);
  END LOOP;
END $$;
