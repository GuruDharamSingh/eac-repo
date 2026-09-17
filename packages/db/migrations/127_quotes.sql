-- ============================================================================
-- 127: quotes — the line that turns over on a person's center.
--
-- A quote is the smallest piece of content on the network: a body, who said
-- it, and where it came from. It has no thread, no slug and no page of its
-- own, because it is never read on its own — it appears in the rotating band
-- on /center, one at a time, and that is the whole of its life. Making it a
-- `threads` kind would have given it a permalink, a feed position, an RSVP
-- eligibility check and a place in forum search, all of which are wrong for
-- a line of text that shows for twelve seconds.
--
-- `org_id` NULL means the network: the line belongs to the collective and
-- shows on every org's center. A row with an org shows only there, above the
-- network's own, so an organisation's own words lead on its own site.
--
-- Anyone signed in may submit one from the band itself; it lands `pending`
-- and shows to nobody but its author until an owner or guide publishes it.
-- Seeded rows are `published` because they are the collective's own
-- already-published copy, verbatim from the manifesto and about pages on
-- elkdonis-arts.org. Nothing here is attributed to a person. No org is
-- seeded: migration 074's per-feed pull quotes are no longer in
-- `site_config` on this database, and inventing words for an organisation
-- is not a migration's job — an org's first line comes from its own guide,
-- through the band.
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotes (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = the network's own. Otherwise the org whose center it leads on.
  org_id       VARCHAR(50)  REFERENCES organizations(id) ON DELETE CASCADE,
  body         TEXT         NOT NULL,
  -- Who said it. NULL is honest for a line the collective speaks in its own
  -- voice; the band then shows the source alone, or nothing.
  attribution  TEXT,
  -- Where it is from: a book, a page, a talk. Shown small, after the name.
  source       TEXT,
  submitted_by UUID         REFERENCES users(id) ON DELETE SET NULL,
  status       TEXT         NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'published', 'hidden')),
  -- Higher sorts earlier in the rotation. 0 for everything ordinary.
  weight       INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- The band's read: published rows for this org plus the network's, newest
-- first within weight. One index covers it.
CREATE INDEX IF NOT EXISTS idx_quotes_live
  ON quotes (status, org_id, weight DESC, created_at DESC);

-- The moderation queue's read, and "did I already submit this?".
CREATE INDEX IF NOT EXISTS idx_quotes_submitted_by
  ON quotes (submitted_by, created_at DESC)
  WHERE submitted_by IS NOT NULL;

-- The same line twice in one rotation reads as a bug. Case- and
-- whitespace-insensitive within a scope (the network counts as its own).
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_unique_body
  ON quotes (COALESCE(org_id, '~network'), lower(btrim(body)));

-- ── The collective's own words ─────────────────────────────────────────────
-- Verbatim from the manifesto and about pages already published on
-- elkdonis-arts.org. Attributed to the collective because that is who says
-- them; nothing here is attributed to a person.

INSERT INTO quotes (org_id, body, attribution, source, status, weight)
VALUES
  (NULL,
   'Our works are intended to be experienced, not sold.',
   'Elkdonis Arts Collective', 'Three Commitments', 'published', 10),
  (NULL,
   'Our works are timeless, essential, reductionist — and often violate scale. We typically explore the vertical dimension of time, which contains the creative act itself, and by orienting everything toward the viewer, bring one into a relationship with it.',
   'Elkdonis Arts Collective', 'Manifesto', 'published', 5),
  (NULL,
   'Creating art as the medium to inquire into our shared human existence. New works are often created in public spaces in response to a proposed inquiry.',
   'Elkdonis Arts Collective', 'Inquiry Through Making', 'published', 0),
  (NULL,
   'Providing a place where beauty and inquiry can meet. The collective is committed to using art as the means, not the end.',
   'Elkdonis Arts Collective', 'Sanctuary', 'published', 0)
ON CONFLICT DO NOTHING;
