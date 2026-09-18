-- ============================================================================
-- 136: meeting_hosts + meeting_occurrence_notes — who is running which week.
--
-- A recurring gathering is ONE `threads` row. Its occurrences are derived, not
-- stored: `expandOccurrences` walks `scheduled_at` forward by
-- `recurrence_pattern`, so "next Monday's meeting" has no id and nothing can
-- be attached to it. That is fine while every occurrence is identical — and
-- useless the moment a group wants to say "Dana has the 21st, Jason has the
-- 28th".
--
-- So an occurrence is addressed the only way a derived thing can be: by the
-- pair (thread, instant). `occurrence_at` is exactly the timestamp
-- `expandOccurrences` produces, which is `scheduled_at` plus a whole number of
-- intervals — never an arbitrary time. A row here is therefore an annotation
-- ON a derived occurrence, and it survives as long as that occurrence is still
-- derivable. Move the series' start time and the old rows strand; that is the
-- honest behaviour, because the meeting they described no longer happens.
--
-- ── Why a table and not `threads.metadata` ─────────────────────────────────
--
-- The rota is queried the other way round: "what am I hosting", across every
-- thread, for reminder mail and for a person's own view. Inside a JSONB blob
-- on one row that is a scan of every meeting in the network; as rows it is an
-- index lookup. Assignments also have their own authorship and lifetime, and
-- burying them in the thread's metadata would put them inside the same
-- optimistic write that saving the meeting's description performs.
--
-- ── `role` ─────────────────────────────────────────────────────────────────
--
-- Today there is exactly one role, 'host', and the product need is exactly
-- that: five people rotating who runs Monday. It is a column rather than a
-- boolean because the same table answers "who is responsible for WHAT" — notes,
-- tech, welcoming — the moment that is asked for, and retro-fitting a second
-- responsibility onto a `host_user_id` column means a migration and a rewrite
-- of every reader. The primary key is (thread, occurrence, role): one person
-- per role per occurrence, several roles per occurrence.
-- ============================================================================

CREATE TABLE IF NOT EXISTS meeting_hosts (
  thread_id      VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  occurrence_at  TIMESTAMPTZ  NOT NULL,
  role           VARCHAR(32)  NOT NULL DEFAULT 'host',
  -- Nullable: "nobody yet" is a real, and common, state. A row with a null
  -- user still carries the note, so a group can write "needs someone" against
  -- a date before anyone has agreed to it.
  user_id        UUID         REFERENCES users(id) ON DELETE SET NULL,
  note           TEXT,
  assigned_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, occurrence_at, role)
);

-- "What am I hosting, soon" — the reminder tick's query and a member's own
-- view, both of which start from the person rather than the thread.
CREATE INDEX IF NOT EXISTS idx_meeting_hosts_user_upcoming
  ON meeting_hosts (user_id, occurrence_at)
  WHERE user_id IS NOT NULL;

-- ============================================================================
-- What actually happened at one occurrence.
--
-- Separate from `thread_rsvps`, which is a promise made beforehand and belongs
-- to the person who made it. This is a record written afterwards by whoever
-- ran the session, and the two disagree often enough that collapsing them
-- would destroy information: someone who said yes and did not come is exactly
-- the case a rota needs to see.
--
-- `attended` is JSONB rather than a join table because the people at a meeting
-- are not all `users` rows — a Talk guest has an actor id and a display name
-- and nothing else, and the whole point of reading attendance off the call is
-- to capture those. Each entry records where it came from, so a name typed by
-- the host is never silently presented as evidence from the call.
-- ============================================================================

CREATE TABLE IF NOT EXISTS meeting_occurrence_notes (
  thread_id      VARCHAR(21)  NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  occurrence_at  TIMESTAMPTZ  NOT NULL,
  note           TEXT,
  attended       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  recorded_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, occurrence_at)
);

-- ============================================================================
-- `thread_reminder_sends` gains a kind.
--
-- Its primary key is (thread_id, occurrence_at), which was right while the
-- only reminder was "tell the people coming". A host reminder is a DIFFERENT
-- letter to a different person about the same occurrence, so under the old key
-- the second send would silently lose the insert race against the first and
-- simply never go out — a failure that looks exactly like a working system.
-- ============================================================================

ALTER TABLE thread_reminder_sends
  ADD COLUMN IF NOT EXISTS kind VARCHAR(24) NOT NULL DEFAULT 'attendees';

ALTER TABLE thread_reminder_sends
  DROP CONSTRAINT IF EXISTS thread_reminder_sends_pkey;

ALTER TABLE thread_reminder_sends
  ADD CONSTRAINT thread_reminder_sends_pkey
  PRIMARY KEY (thread_id, occurrence_at, kind);
