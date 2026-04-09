-- Migration 012: Unify public.users.id with Supabase auth.users.id
--
-- Goal:
--   Make `public.users.id` the canonical identity and equal to Supabase `auth.users.id`.
--   After this migration: `users.id == users.auth_user_id` (and `auth_user_id` is NOT NULL).
--
-- Notes:
--   - Intended for early dev environments.
--   - This updates all FK references to users(id) across the schema.
--   - Nextcloud credentials are cleared when they don't match the new canonical ID.

BEGIN;

-- Ensure auth_user_id is present and populated for legacy rows.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_user_id UUID;

UPDATE public.users
SET auth_user_id = id
WHERE auth_user_id IS NULL;

-- Build mapping of old internal ids -> canonical auth ids.
CREATE TEMP TABLE user_id_map AS
SELECT id AS old_id, auth_user_id AS new_id
FROM public.users
WHERE id <> auth_user_id;

-- Capture and drop all FKs that reference users(id), then rewrite referencing values.
DO $$
DECLARE
  r record;
  col text;
BEGIN
  CREATE TEMP TABLE fk_defs(
    table_name text NOT NULL,
    constraint_name text NOT NULL,
    constraint_def text NOT NULL,
    fk_cols text[] NOT NULL
  ) ON COMMIT DROP;

  FOR r IN
    SELECT
      c.oid AS constraint_oid,
      c.conrelid::regclass::text AS table_name,
      c.conname AS constraint_name,
      pg_get_constraintdef(c.oid) AS constraint_def
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.users'::regclass
    ORDER BY 2, 3
  LOOP
    INSERT INTO fk_defs(table_name, constraint_name, constraint_def, fk_cols)
    SELECT
      r.table_name,
      r.constraint_name,
      r.constraint_def,
      array_agg(a.attname ORDER BY k.ord)
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.oid = r.constraint_oid;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.constraint_name);
  END LOOP;

  -- Rewrite referencing columns in each table using user_id_map.
  FOR r IN
    SELECT table_name, fk_cols
    FROM fk_defs
  LOOP
    FOREACH col IN ARRAY r.fk_cols
    LOOP
      EXECUTE format(
        'UPDATE %s t SET %I = m.new_id FROM user_id_map m WHERE t.%I = m.old_id',
        r.table_name,
        col,
        col
      );
    END LOOP;
  END LOOP;

  -- Rewrite users primary keys to match auth_user_id.
  UPDATE public.users
  SET id = auth_user_id
  WHERE id <> auth_user_id;

  -- Recreate the dropped FKs.
  FOR r IN
    SELECT table_name, constraint_name, constraint_def
    FROM fk_defs
    ORDER BY 1, 2
  LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.table_name, r.constraint_name, r.constraint_def);
  END LOOP;
END $$;

-- Keep Nextcloud aligned with the canonical ID (auth uuid). If it doesn't match, clear so it can be reprovisioned.
UPDATE public.users
SET
  nextcloud_synced = FALSE,
  nextcloud_user_id = NULL,
  nextcloud_app_password = NULL,
  nextcloud_oidc_synced = FALSE
WHERE nextcloud_user_id IS NOT NULL
  AND nextcloud_user_id <> id::text;

UPDATE public.users
SET
  nextcloud_synced = FALSE,
  nextcloud_oidc_synced = FALSE
WHERE nextcloud_synced = TRUE
  AND (nextcloud_user_id IS NULL OR nextcloud_app_password IS NULL);

-- Enforce invariant going forward.
ALTER TABLE public.users
ALTER COLUMN auth_user_id SET NOT NULL;

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_auth_user_id_matches_id;

ALTER TABLE public.users
ADD CONSTRAINT users_auth_user_id_matches_id CHECK (auth_user_id = id);

-- Update trigger to insert canonical ids.
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
  SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists on auth.users (if it exists already).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

COMMIT;
