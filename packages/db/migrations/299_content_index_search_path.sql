-- ============================================================================
-- 299: pin search_path on the content_index trigger functions.
--
-- Incident 2026-11-27: GoTrue inserts into public.users with a search_path that
-- excludes "public". Migration 298's trigger on users (content_index_enqueue_person)
-- writes to the unqualified content_index_queue, so every sign-up failed with
-- 'relation "content_index_queue" does not exist' ("Database error creating new
-- user"). Pinning search_path on every content_index* function fixes 298's
-- person/vouch triggers and hardens 294's thread/artwork/auction_lot triggers the
-- same way. No function bodies change; applied files (294, 298) are not edited.
-- Content cornerstone, docs/open/CONTENT_CORNERSTONE_2026-11-26/.
-- ============================================================================

DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'content\_index%'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f);
  END LOOP;
END
$$;
