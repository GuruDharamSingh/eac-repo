-- Migration 024 (renumbered from server's 013): min_attendees + recurrence_until
-- Originally targeted `meetings`. Post-030 these columns live on `threads`.
-- IF NOT EXISTS makes this safe regardless of run order.

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS min_attendees integer,
  ADD COLUMN IF NOT EXISTS notify_on_min_attendees boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_attendees_notified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_until timestamp with time zone;
