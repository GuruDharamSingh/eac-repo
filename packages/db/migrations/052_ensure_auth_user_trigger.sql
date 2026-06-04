-- 052_ensure_auth_user_trigger.sql
-- Guarantees the public.users mirror trigger exists for Supabase Auth signups.
--
-- Background / why this exists:
--   Migrations 009 and 012 define public.handle_new_user() and the
--   on_auth_user_created trigger, but they guard the trigger creation behind
--   "IF auth.users exists". If `db:migrate` runs BEFORE GoTrue (the
--   supabase-auth service) has created the `auth` schema + auth.users table,
--   the trigger is SILENTLY SKIPPED. Every later signup then lands in
--   auth.users with no matching public.users row, so getServerSession()
--   resolves to null and the user gets 401 on /account and every
--   session-gated route. (This bit the 2026-05-31 launch.)
--
-- This migration re-asserts the function + trigger and FAILS LOUDLY if
-- auth.users is missing, so the ordering mistake can never silently recur.
--
-- IMPORTANT: run `db:migrate` AFTER supabase-auth is healthy (see
-- startupguide.md / CLAUDE.md). If this migration errors with the message
-- below, start supabase-auth first and re-run migrations.

BEGIN;

-- Canonical-id new-user handler (matches migration 012).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, auth_user_id, email, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION
      'auth.users does not exist yet — start supabase-auth (GoTrue) BEFORE running db:migrate, then re-run. See migration 052_ensure_auth_user_trigger.sql.';
  END IF;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
END $$;

COMMIT;
