-- 202: allow thread_rsvps.status = 'subscribed' (series subscriptions). 2026-10-10.
--
-- A subscription to a meeting series is a thread_rsvps row on the series'
-- own thread with status 'subscribed' (packages/services/src/meeting-series.ts).
-- A distinct status, not 'yes': every generic reader counts 'yes' as
-- attendance (calendar counts, /center, viewer alerts, the address book,
-- the meeting light, apps/inner-gathering's reminder tick).

ALTER TABLE thread_rsvps DROP CONSTRAINT IF EXISTS thread_rsvps_status_check;
ALTER TABLE thread_rsvps ADD CONSTRAINT thread_rsvps_status_check
  CHECK (status IN ('yes', 'no', 'maybe', 'waitlist', 'subscribed'));
