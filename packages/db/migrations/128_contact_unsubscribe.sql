-- 128: let a contact unsubscribe.
--
-- Bulk email needs this before it can be sent at all, not after. Canada's
-- CASL (and CAN-SPAM) require a working unsubscribe mechanism in every
-- commercial message; every org on this network is Canadian or sends to
-- Canadians. There was no unsubscribe anywhere in the codebase — the only
-- matches for the word were realtime subscriptions — so the newsletter
-- sender would have been unusable in practice the day it shipped.
--
-- A fourth status rather than a boolean column: `status` already carries a
-- contact's lifecycle (new → contacted → joined) and the send query filters
-- on it, so one more value keeps the decision in one place. It is terminal —
-- nothing moves a row out of 'unsubscribed' except the person asking again.
--
-- No token column: the unsubscribe link carries an HMAC of (org_id, email)
-- keyed by a server secret, so it is unguessable, needs no backfill for the
-- rows already here, and cannot be enumerated from the table.

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_status_check;

ALTER TABLE contacts ADD CONSTRAINT contacts_status_check
  CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'joined'::text, 'unsubscribed'::text]));

COMMENT ON COLUMN contacts.status IS
  'Lifecycle: new → contacted → joined. ''unsubscribed'' is terminal and excludes the row from every bulk send.';
