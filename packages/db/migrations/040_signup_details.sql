-- Migration 040: Add signup_details JSONB to users + extend handle_new_user trigger
--
-- Stores onboarding metadata (e.g. interests selected at signup) as a JSON blob
-- so it can be displayed in the admin user details modal without schema changes
-- per new field. Populated by the auth.users -> public.users trigger from
-- raw_user_meta_data on signup.

BEGIN;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS signup_details JSONB DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  details jsonb := '{}'::jsonb;
BEGIN
  IF meta ? 'interests' AND jsonb_typeof(meta->'interests') = 'array' THEN
    details := details || jsonb_build_object('interests', meta->'interests');
  END IF;

  IF meta ? 'signup_source' THEN
    details := details || jsonb_build_object('signup_source', meta->'signup_source');
  END IF;

  details := details || jsonb_build_object('signup_at', to_jsonb(NEW.created_at));

  INSERT INTO public.users (id, auth_user_id, email, display_name, signup_details, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(meta->>'display_name', split_part(NEW.email, '@', 1)),
    details,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    -- Preserve existing signup_details on conflict; only fill in if NULL.
    signup_details = COALESCE(public.users.signup_details, EXCLUDED.signup_details),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
