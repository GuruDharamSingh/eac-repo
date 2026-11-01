-- 212 — auction series: mirror forum thread and participating organisations.
-- 2026-10-28. docs/open/ART_AUCTION_PLAN_2026-10-18.md ("Series workspace").
--
-- thread_id: the series' thread in the forum (kind 'post', feed
-- 'auction-series' of the series' org), created when the series is published.
-- Discussion on the series page is that thread's replies; "Follow this series"
-- is a thread_rsvps row with status 'subscribed' on it (migration 202). The
-- auction itself stays in auction_series.
--
-- auction_series_org: organisations taking part in a series beyond the
-- presenter and host (their media libraries open to the desk; their owners are
-- asked first unless the inviter already runs the org).

ALTER TABLE auction_series
  ADD COLUMN IF NOT EXISTS thread_id varchar(21) REFERENCES threads(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_series_thread ON auction_series(thread_id) WHERE thread_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auction_series_org (
  series_id   uuid NOT NULL REFERENCES auction_series(id) ON DELETE CASCADE,
  org_id      varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  invited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  invited_at  timestamptz NOT NULL DEFAULT now(),
  decided_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at  timestamptz,
  -- The messaging conversation that carried the invitation, when one was sent.
  conversation_id uuid,
  note        text,
  PRIMARY KEY (series_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_auction_series_org_org ON auction_series_org(org_id, status);
