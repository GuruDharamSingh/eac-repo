-- ============================================================================
-- 134: email_inbox + the address book — mail that comes BACK.
--
-- Until now the network has been write-only. Every RSVP confirmation, owner
-- notification, reminder and contact-form mail leaves; nothing returns, and an
-- org whose member simply replies to a letter has that reply land in whichever
-- personal Gmail happened to be in `replyTo` — invisible to the site, invisible
-- to the org's other guides, and gone the day that person stops reading it.
--
-- ── Why the org is in the ADDRESS, not in the routing ───────────────────────
--
-- SendGrid's Inbound Parse cannot route different addresses to different
-- endpoints: one MX host is one webhook, full stop. And the four domains that
-- already send (ifacgroup.com, amritcanada.ca, hiddenenneagram.com,
-- elkdonis-arts.org) all carry live Bluehost MX records, so taking their MX
-- over to receive would destroy mailboxes people use.
--
-- So inbound lands on ONE subdomain nobody uses —
--
--     inbound.elkdonis-arts.org.  MX 10 mx.sendgrid.net.
--
-- — and tenancy rides in the local part:
--
--     ifac@inbound.elkdonis-arts.org          a fresh enquiry for `ifac`
--     ifac.k3n9x2@inbound.elkdonis-arts.org   a reply on the thread that token names
--
-- One DNS record for the whole network, one webhook, and a new org has a
-- working reply address the hour it is created with no DNS work at all. An org
-- that wants mail to its OWN address in here forwards from the cPanel mailbox
-- it already has, which needs no MX change and so cannot break anything.
--
-- ── Inbound mail is untrusted ──────────────────────────────────────────────
--
-- Every text column below is third-party input: `from_email` is unverified
-- (SMTP lets anyone write any From), `subject` and `body_text` are attacker-
-- controlled, and `body_html` is live markup. Nothing here is rendered without
-- sanitising, and `from_email` is never treated as proof of identity — matching
-- it to a contact is a CONVENIENCE for the reader, not authentication. The
-- webhook itself is verified by ECDSA signature before a row is ever written.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_inbox (
  id             VARCHAR(21) PRIMARY KEY,
  org_id         VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- What it is about, when we can tell. Both nullable and both ON DELETE SET
  -- NULL: a letter outlives the thread it answered and the contact row that
  -- was matched to it, and losing either must not lose the letter.
  thread_id      VARCHAR(21) REFERENCES threads(id) ON DELETE SET NULL,
  contact_id     TEXT        REFERENCES contacts(id) ON DELETE SET NULL,

  from_email     TEXT NOT NULL,
  from_name      TEXT,
  -- The address it actually arrived at, verbatim, including the reply token.
  -- Kept because it is the evidence for how org_id and thread_id were derived.
  to_email       TEXT NOT NULL,
  subject        TEXT,
  body_text      TEXT,
  body_html      TEXT,

  -- What kind of arrival this is. `auto` is an out-of-office or vacation
  -- responder and `bounce` a delivery failure that reached us as mail rather
  -- than as a webhook event; both are separated from `enquiry` so that a
  -- guide's unread count means "people waiting on you", which is the only
  -- reading of a badge that anyone acts on.
  classification TEXT NOT NULL DEFAULT 'enquiry'
                   CHECK (classification IN ('reply','enquiry','auto','bounce','spam')),

  state          TEXT NOT NULL DEFAULT 'unread'
                   CHECK (state IN ('unread','read','archived')),

  -- [{name, type, size, url}] — files are put in the org's Nextcloud folder
  -- and referenced, never inlined, because Parse allows 30MB per message.
  attachments    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- SendGrid's SpamAssassin score when Parse is configured to supply it.
  spam_score     REAL,
  -- The parsed SMTP envelope, for working out later why something routed the
  -- way it did. Diagnostic; nothing reads it to make a decision.
  envelope       JSONB,
  -- The sender's own RFC 5322 Message-ID. The dedupe key: Parse has no
  -- delivery guarantee and a retried POST must not become a second letter.
  message_id     TEXT,

  received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The inbox as it is actually read: one org, newest first.
CREATE INDEX IF NOT EXISTS idx_email_inbox_org
  ON email_inbox(org_id, received_at DESC);

-- The unread badge, and the "needs an answer" filter behind it.
CREATE INDEX IF NOT EXISTS idx_email_inbox_unread
  ON email_inbox(org_id, state)
  WHERE state = 'unread';

-- A thread's correspondence, shown beside the thread itself.
CREATE INDEX IF NOT EXISTS idx_email_inbox_thread
  ON email_inbox(thread_id)
  WHERE thread_id IS NOT NULL;

-- Partial rather than a plain UNIQUE: plenty of mail arrives with no
-- Message-ID at all, and those must still be storable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_inbox_dedupe
  ON email_inbox(org_id, message_id)
  WHERE message_id IS NOT NULL;

COMMENT ON TABLE email_inbox IS
  'Mail received for an organisation via SendGrid Inbound Parse. Every text column is untrusted third-party input; from_email is not proof of identity.';


-- ── The address book ───────────────────────────────────────────────────────
--
-- `contacts` was built in migration 020 for one job: a visitor who filled in a
-- form. An org's actual mailing list is wider than that — its members, the
-- guests who RSVP'd, and the people whose addresses it simply knows and wants
-- to type in. The first two live in `user_organizations` and `thread_rsvps`
-- and are READ where they are, not copied here; what this adds is the third,
-- plus the shelf marks that make a hand-kept list usable.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags       TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes      TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS added_by   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Manual entry has to be idempotent — somebody pasting a list twice must not
-- double every address, and a form submission from an address already on the
-- list must update it rather than create a twin. Verified no duplicates exist
-- before adding this (2026-09-17: 6 contacts, 0 collisions), so it cannot fail
-- on live data. Lowercased because the local part is case-sensitive in the RFC
-- and case-insensitive at every mail provider anyone here actually uses.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_email
  ON contacts(org_id, lower(email));

COMMENT ON COLUMN contacts.tags IS
  'Free-form shelf marks an org applies to its own list. Not a permission and not a segment anything is gated on.';
