-- ============================================================================
-- 130: thread_rsvps.flavour — the words a person actually answers in.
--
-- "Will you make it?" has never had two answers. A member says "early yes",
-- "hesitant yes", "not this week, but next", and every one of those was being
-- flattened into a checkbox — so the one person who could tell a guide whether
-- the room would fill was the one person the schema had no room for.
--
-- The CHECK on `status` is deliberately NOT widened. Everything that counts a
-- gathering counts `status = 'yes'` (thread-rsvp.ts, listOrgEventsInRange's
-- rsvp_count subquery, the min_attendees notification), and a fifth status
-- would have made every one of those quietly wrong. So a nuanced answer is
-- TWO facts: the canonical status it commits to, which keeps counting exactly
-- as it was, and the flavour, which is the part a person means. An "early yes"
-- is a yes — that was the explicit instruction — it is just an honest one.
--
-- Untyped TEXT rather than an enum or a CHECK: the vocabulary is still
-- settling and it lives in one place in code (RSVP_FLAVOURS in
-- @elkdonis/services/standing-meeting), which is where a reader should look
-- for the list. A row whose flavour is no longer offered still reads as its
-- status, which is the property that matters.
--
-- NULL means "answered before this existed, or answered somewhere that does
-- not offer flavours" — the plain RSVP button on a thread surface still
-- writes exactly what it always did.
--
-- No new index: flavour is only ever read alongside a row already found by
-- the (thread_id, user_id) primary key, or aggregated over one thread.
-- ============================================================================

ALTER TABLE thread_rsvps
  ADD COLUMN IF NOT EXISTS flavour TEXT;

COMMENT ON COLUMN thread_rsvps.flavour IS
  'Optional nuance on top of status — the key of an RSVP_FLAVOURS entry in @elkdonis/services/standing-meeting (e.g. early, hesitant, next_time). Every flavour maps to one canonical status, so counting reads status alone.';
