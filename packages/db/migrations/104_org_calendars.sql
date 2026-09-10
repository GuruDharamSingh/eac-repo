-- 104: one CalDAV calendar per organization.
--
-- Same defect, same fix as migration 101 did for Deck. Every function in
-- packages/nextcloud/src/calendar.ts defaults `calendarName` to a single
-- shared 'eac-meetings' calendar, so two orgs syncing a meeting would land in
-- one collection and see each other's schedule. A calendar, like a board, is a
-- per-org resource and needs a per-org pointer.
--
-- What this column does NOT mean: it is not the source of truth for events.
-- Events live in `threads` with their RSVPs, replies and purchases attached;
-- moving them into CalDAV would strand all of that. The Nextcloud calendar is
-- a *projection* — a read-only mirror members can subscribe to from a phone.
-- That direction was chosen deliberately; see packages/services/src/org-calendar.ts.
--
-- Store the URI segment ('ifac'), never a full URL. The base URL and the
-- service account both come from env and differ between dev and production;
-- freezing either into a row is how you get rows that stop resolving.
--
-- Sharing note (live-tested 2026-09-07 against Nextcloud 33 / circles 33):
-- a DAV share to `principals/circles/<id>` returns HTTP 200 and persists
-- NOTHING. A Circle cannot receive a calendar share. Shares are therefore
-- fanned out per user principal, with `user_organizations` as the membership
-- authority — the same conclusion migration 101 reached for Deck ACLs.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS calendar_uri VARCHAR(64),
  ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ;

-- One org per calendar. Partial, so the many un-provisioned orgs don't collide
-- with each other on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_calendar_uri
  ON organizations (calendar_uri) WHERE calendar_uri IS NOT NULL;

COMMENT ON COLUMN organizations.calendar_uri IS
  'CalDAV collection segment under the service account, e.g. ''ifac''. NULL = not provisioned. Never a full URL.';
COMMENT ON COLUMN organizations.calendar_synced_at IS
  'Last time the calendar''s events and per-user shares were reconciled from Postgres.';
