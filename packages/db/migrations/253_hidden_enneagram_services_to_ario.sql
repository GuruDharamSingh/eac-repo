-- Migration 253: Ario becomes the author (and so the payee) of hidden-enneagram's services.
-- 2026-11-07. Justin's decision: bookings of Ario's services (e.g. the One-on-One
-- Enneagram Reading) pay Ario, not the account that first created the threads.
-- Payee resolution is threads.author_id via resolveSettlement (@elkdonis/commerce),
-- so this is a data change only. Idempotent; touches kind = 'service' rows of
-- org hidden-enneagram only, and only if Ario's user exists.
UPDATE threads t
SET author_id = u.id
FROM users u
WHERE u.email = 'aeon.g963@gmail.com'
  AND t.org_id = 'hidden-enneagram'
  AND t.kind = 'service'
  AND t.author_id IS DISTINCT FROM u.id;
