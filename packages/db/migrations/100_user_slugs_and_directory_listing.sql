-- 100_user_slugs_and_directory_listing.sql
--
-- Two problems, one root cause.
--
-- 1. `handle_new_user` (migration 052) creates the public.users row from an
--    auth.users insert and never sets `slug`. Every person who signs up through
--    the app therefore has slug = NULL.
--
-- 2. ArtDirect's only visibility gate is `WHERE u.slug IS NOT NULL`
--    (packages/services/src/profiles.ts listPublicProfiles). So "has a stable
--    profile URL" and "is publicly listed in the directory" are the same fact.
--
-- Together those mean app signups are invisible in the directory forever, and
-- the fix (backfill slugs) would publish accounts that must stay unlisted --
-- notably pigeonshoot's anonymity sentinel (anonymous@pigeonshoot.invalid).
--
-- This migration splits the two concerns, gives every principal a slug, and
-- makes the trigger assign one so no signup path can bypass it.
--
-- Listing behaviour is deliberately preserved, not widened: everyone visible
-- in the directory today stays visible, everyone invisible today stays
-- invisible. Only NEW signups are listed by default, which is the intended
-- product behaviour (an account puts you in the directory). To make listing
-- opt-in instead, change the column default to false.

-- ---------------------------------------------------------------------------
-- Slug helpers (SQL-level, so the trigger can use them without app code)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(both '-' from
      regexp_replace(
        regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
        '-{2,}', '-', 'g'
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.slugify(text) IS
  'Lowercase ASCII slug. Returns NULL for input with no usable characters '
  '(e.g. a display name that is entirely non-Latin) so callers can fall back.';

-- Mirrors ensureUniqueUserSlug() in packages/services/src/profiles.ts.
-- Kept in SQL as well because the users row is created by a trigger on
-- auth.users, which no application code sits in front of.
CREATE OR REPLACE FUNCTION public.ensure_unique_user_slug(
  base text,
  exclude_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  root      text;
  candidate text;
  n         integer := 1;
BEGIN
  -- Strip any domain part: display_name is frequently an email address, and
  -- these slugs become public URLs.
  root := public.slugify(split_part(coalesce(base, ''), '@', 1));

  -- Non-Latin or empty names still need a stable, non-colliding handle.
  IF root IS NULL OR length(root) < 2 THEN
    root := 'member-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  END IF;

  candidate := root;
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE slug = candidate
        AND (exclude_id IS NULL OR id <> exclude_id)
    );
    n := n + 1;
    candidate := root || '-' || n;
  END LOOP;

  RETURN candidate;
END;
$$;

-- ---------------------------------------------------------------------------
-- Split "listed in the directory" out of "has a slug"
-- ---------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS directory_listed BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.directory_listed IS
  'Whether this principal appears in the public ArtDirect listing. Separate '
  'from slug, which is the stable profile URL and storage folder name and '
  'exists for every principal including unlisted ones.';

-- Preserve today's behaviour exactly: anyone without a slug is invisible in
-- the directory right now, so they must stay unlisted once we grant them one.
UPDATE public.users
SET directory_listed = false
WHERE slug IS NULL;

-- Sentinel / system accounts must never be listed, regardless of the above.
-- The .invalid TLD is reserved (RFC 2606) and is how these are marked.
UPDATE public.users
SET directory_listed = false
WHERE email LIKE '%.invalid';

-- ---------------------------------------------------------------------------
-- Backfill slugs for every principal still missing one
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, display_name, email
    FROM public.users
    WHERE slug IS NULL
    ORDER BY created_at NULLS LAST, id
  LOOP
    UPDATE public.users
    SET slug = public.ensure_unique_user_slug(
          COALESCE(NULLIF(r.display_name, ''), r.email),
          r.id
        )
    WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Assign a slug at creation time, so no signup path can produce a slugless row
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_display text;
BEGIN
  v_display := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.users (
    id, auth_user_id, email, display_name, slug, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    v_display,
    public.ensure_unique_user_slug(v_display),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        updated_at = NOW(),
        -- Never overwrite an established slug: it is a public URL and a
        -- Nextcloud folder name.
        slug       = COALESCE(public.users.slug, EXCLUDED.slug);

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Index the directory query (slug IS NOT NULL AND directory_listed)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_directory_listed
  ON public.users (display_name)
  WHERE slug IS NOT NULL AND directory_listed;
