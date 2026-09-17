-- ============================================================================
-- 135: email_sends + email_events — what actually happened to a letter.
--
-- The Mail Send API returns 202 Accepted, which means "queued" and nothing
-- more. Delivered, bounced, blocked, marked as spam and unsubscribed are
-- knowable ONLY through the Event Webhook, and no such endpoint has ever
-- existed in this repo. Three consequences, all of them live today:
--
--   * a hard-bounced address stays in `contacts` forever and is retried on
--     every single send, which is precisely the behaviour that destroys a
--     sending reputation;
--   * the newsletter's `sentCount` counts ATTEMPTS and is shown to the editor
--     as though it were deliveries — an editor reading "sent to 240" has no
--     way to learn that 31 of them bounced;
--   * a spam complaint is invisible until the damage is already done.
--
-- Two tables rather than one because they answer to different owners. A SEND
-- is ours: written at the moment we call SendGrid, one row per recipient, and
-- true whether or not anything ever comes back. An EVENT is SendGrid's: it
-- arrives later, out of order, possibly several times, and possibly about a
-- send we have no row for (a suppression bounce fires with no prior accepted
-- send). Folding them together would mean either dropping events we cannot
-- match or inventing send rows for them; both are worse than a join.
--
-- ── Bodies are deliberately NOT stored ─────────────────────────────────────
--
-- This is a delivery ledger, not an archive. A newsletter to 600 people is 600
-- rows here and one stored layout in `site_config`; storing the rendered HTML
-- per recipient would multiply a 60KB letter by the list. What a row carries
-- is enough to answer "did it arrive, and if not why" — the subject for a
-- human reading the log, and nothing else.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_sends (
  id            VARCHAR(21) PRIMARY KEY,
  org_id        VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Which letter this was. Matches the EmailKind union in @elkdonis/email;
  -- deliberately NOT a CHECK constraint, because a new kind of letter should
  -- be a template file and a send, not a migration — and an unrecognised kind
  -- here degrades to an unfamiliar label in a log, which is harmless.
  kind          TEXT NOT NULL,
  -- What it was about, when it was about something.
  thread_id     VARCHAR(21) REFERENCES threads(id) ON DELETE SET NULL,

  to_email      TEXT NOT NULL,
  subject       TEXT,

  -- SendGrid's x-message-id from the send response. The join key to
  -- email_events. Null when the send was sandboxed or the call failed before
  -- a response, and those rows are still worth keeping: a failed send is the
  -- fact somebody is looking for.
  sg_message_id TEXT,

  -- Our own last word on it, folded down from the events as they arrive so a
  -- list can be drawn without aggregating the event table per row.
  status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','sandboxed','failed','delivered',
                                    'bounced','blocked','spam','unsubscribed','opened')),
  -- Why, when status is a failure. Untrusted: it is text written by a third
  -- party's mail server and it is displayed, never parsed for a decision.
  error         TEXT,

  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_sends_org
  ON email_sends(org_id, sent_at DESC);

-- The lookup every webhook event performs. Partial because a sandboxed or
-- failed send has no message id and no event will ever arrive for it.
CREATE INDEX IF NOT EXISTS idx_email_sends_message
  ON email_sends(sg_message_id)
  WHERE sg_message_id IS NOT NULL;

-- "Has this person been having trouble receiving us" — the question asked
-- when an org wonders why one member never replies.
CREATE INDEX IF NOT EXISTS idx_email_sends_to
  ON email_sends(org_id, lower(to_email));


CREATE TABLE IF NOT EXISTS email_events (
  -- SendGrid's own sg_event_id is the primary key, which is the whole dedupe
  -- strategy: the webhook retries for 24 hours on any non-2xx and re-POSTs the
  -- same ids, so an ON CONFLICT DO NOTHING insert makes redelivery free.
  sg_event_id   TEXT PRIMARY KEY,
  sg_message_id TEXT,
  -- Denormalised from the send's customArgs so an org's delivery history can
  -- be read without joining through a send row that may not exist.
  org_id        VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
  email         TEXT,
  event         TEXT NOT NULL,
  -- Third-party text. Displayed, never parsed.
  reason        TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload       JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_events_message
  ON email_events(sg_message_id)
  WHERE sg_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_events_org
  ON email_events(org_id, occurred_at DESC);

COMMENT ON TABLE email_sends IS
  'One row per recipient per send. Our record, written at call time. Bodies are not stored — this is a delivery ledger, not an archive.';
COMMENT ON TABLE email_events IS
  'SendGrid Event Webhook deliveries, deduped on sg_event_id. Arrive late, out of order, and sometimes for sends we have no row for.';
