-- 174: service_bookings — when a booked one-to-one service happens (buyer proposes, seller confirms). 2026-09-27.
--
-- One row per paid service order that needs a time agreed. The buyer proposes
-- up to three start times in the booking form; once the order is paid the
-- seller confirms one, or proposes others, and the buyer answers from a
-- private link (buyer_token) that needs no account. Code:
-- packages/commerce/src/server/service-bookings.ts.
--
-- status:
--   awaiting_payment  created with the card order; nobody is told yet
--   awaiting_seller   the buyer's proposal is open (after payment, or a reschedule)
--   awaiting_buyer    the seller's proposal is open
--   confirmed         scheduled_at is the agreed start
--   cancelled         by either side; a refund is not automatic
--
-- proposed_times holds the open proposal only; proposed_by says whose it is.

CREATE TABLE IF NOT EXISTS service_bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL UNIQUE REFERENCES commerce_order(id) ON DELETE CASCADE,
  thread_id         varchar(21) NOT NULL REFERENCES threads(id),
  org_id            varchar(50) NOT NULL,
  seller_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  buyer_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  buyer_email       text NOT NULL,
  buyer_name        text,
  buyer_time_zone   text NOT NULL DEFAULT 'America/Toronto',
  duration_minutes  integer,
  status            text NOT NULL DEFAULT 'awaiting_payment'
                    CHECK (status IN ('awaiting_payment', 'awaiting_seller', 'awaiting_buyer', 'confirmed', 'cancelled')),
  proposed_by       text CHECK (proposed_by IN ('buyer', 'seller')),
  proposed_times    timestamptz[] NOT NULL DEFAULT '{}',
  scheduled_at      timestamptz,
  last_message      text,
  last_message_by   text CHECK (last_message_by IN ('buyer', 'seller')),
  buyer_token       text NOT NULL UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT service_bookings_confirmed_has_time
    CHECK (status <> 'confirmed' OR scheduled_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_service_bookings_seller
  ON service_bookings (seller_user_id, status);
CREATE INDEX IF NOT EXISTS idx_service_bookings_thread
  ON service_bookings (thread_id);
