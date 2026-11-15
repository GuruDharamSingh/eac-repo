-- 267: booking reminders (2026-11-15). How long before a booking its reminder
-- goes to the booker and the host (NULL = none; default one day), and the
-- claim that makes it go once: sendDueBookingReminders sets reminder_sent_at
-- with "WHERE reminder_sent_at IS NULL" before sending. Additive.
ALTER TABLE booking_offers
  ADD COLUMN IF NOT EXISTS reminder_minutes_before integer DEFAULT 1440
    CHECK (reminder_minutes_before IS NULL OR (reminder_minutes_before > 0 AND reminder_minutes_before <= 20160));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_due
  ON bookings (scheduled_at) WHERE status = 'confirmed' AND reminder_sent_at IS NULL;
