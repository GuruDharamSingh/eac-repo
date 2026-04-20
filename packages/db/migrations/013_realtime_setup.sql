-- ============================================================================
-- EAC Network - Supabase Realtime Setup
-- ============================================================================
-- Configures PostgreSQL for Supabase Realtime (RLS mode):
-- 1. Creates publication for tables that Realtime will subscribe to
-- 2. Enables Row Level Security on those tables
-- 3. Creates RLS policies for org-level and user-level access control
-- ============================================================================

-- ============================================================================
-- 1. PUBLICATION
-- ============================================================================
-- Supabase Realtime watches this publication for changes.
-- Only tables listed here will broadcast changes over WebSocket.
-- ============================================================================

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE
  posts,
  meetings,
  meeting_attendees,
  replies,
  reactions,
  notifications,
  watches,
  availability_responses,
  availability_slots;

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================
-- RLS must be enabled for Realtime RLS mode to filter rows per-user.
-- Tables that already have RLS enabled will be unaffected by this.
-- ============================================================================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================
-- These policies control what rows each authenticated user can see via
-- Realtime subscriptions. They use auth.uid() which Supabase sets from
-- the JWT token on the WebSocket connection.
--
-- Pattern: org-level isolation for content, user-level for notifications.
-- ============================================================================

-- Helper: Check if a user belongs to an organization
CREATE OR REPLACE FUNCTION user_belongs_to_org(check_org_id VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----- POSTS -----
-- Users can see posts from organizations they belong to
CREATE POLICY "Users can view posts in their orgs"
  ON posts FOR SELECT
  USING (user_belongs_to_org(org_id));

-- ----- MEETINGS -----
-- Users can see meetings from organizations they belong to
CREATE POLICY "Users can view meetings in their orgs"
  ON meetings FOR SELECT
  USING (user_belongs_to_org(org_id));

-- ----- MEETING ATTENDEES -----
-- Users can see attendees for meetings in their orgs
CREATE POLICY "Users can view attendees in their orgs"
  ON meeting_attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_attendees.meeting_id
        AND user_belongs_to_org(m.org_id)
    )
  );

-- ----- REPLIES -----
-- Users can see replies on content in their orgs
CREATE POLICY "Users can view replies in their orgs"
  ON replies FOR SELECT
  USING (
    CASE
      WHEN parent_type = 'post' THEN
        EXISTS (SELECT 1 FROM posts p WHERE p.id = replies.parent_id AND user_belongs_to_org(p.org_id))
      WHEN parent_type = 'meeting' THEN
        EXISTS (SELECT 1 FROM meetings m WHERE m.id = replies.parent_id AND user_belongs_to_org(m.org_id))
      ELSE true
    END
  );

-- ----- REACTIONS -----
-- Users can see reactions on content in their orgs
CREATE POLICY "Users can view reactions in their orgs"
  ON reactions FOR SELECT
  USING (
    CASE
      WHEN reactable_type = 'post' THEN
        EXISTS (SELECT 1 FROM posts p WHERE p.id = reactions.reactable_id AND user_belongs_to_org(p.org_id))
      WHEN reactable_type = 'meeting' THEN
        EXISTS (SELECT 1 FROM meetings m WHERE m.id = reactions.reactable_id AND user_belongs_to_org(m.org_id))
      ELSE true
    END
  );

-- ----- NOTIFICATIONS -----
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- ----- WATCHES -----
-- Users can only see their own watches
CREATE POLICY "Users can view own watches"
  ON watches FOR SELECT
  USING (user_id = auth.uid());

-- ----- AVAILABILITY RESPONSES -----
-- Users can see responses for polls in their orgs
CREATE POLICY "Users can view poll responses in their orgs"
  ON availability_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM availability_polls ap
      WHERE ap.id = availability_responses.poll_id
        AND user_belongs_to_org(ap.org_id)
    )
  );

-- ----- AVAILABILITY SLOTS -----
-- Users can see slots for responses they can see (inherits from responses policy)
CREATE POLICY "Users can view poll slots in their orgs"
  ON availability_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM availability_responses ar
      JOIN availability_polls ap ON ap.id = ar.poll_id
      WHERE ar.id = availability_slots.response_id
        AND user_belongs_to_org(ap.org_id)
    )
  );

-- ============================================================================
-- 4. SERVICE ROLE & AUTH SETUP
-- ============================================================================
-- The application's server-side code uses direct postgres connections (not
-- Supabase client) as the postgres superuser, which bypasses RLS by default.
-- We intentionally do NOT use FORCE ROW LEVEL SECURITY so that server-side
-- API routes continue to work without modification.
--
-- RLS only applies to connections authenticated via Supabase (Realtime,
-- PostgREST with anon/authenticated role).
-- ============================================================================

DO $$
BEGIN
  -- Create the auth schema and uid() function if they don't exist
  -- (Supabase Realtime expects auth.uid() to resolve the user from JWT)
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
  END IF;
END $$;

-- auth.uid() extracts the user ID from the current JWT setting
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claims', true)::json->>'sub'
  )::UUID;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
