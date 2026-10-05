-- 169_users_storage_folder.sql
-- A person's Nextcloud folder name (EAC_Network/users/<storage_folder>),
-- decoupled from users.slug. 2026-09-27.
--
-- Until now the folder was addressed by users.slug, which the /center profile
-- editor lets a person change (saveProfileDetails, services/center.ts). A
-- rename left the files under the old name and pointed every storage call at
-- a new, empty folder; four such orphans exist (ario, ericbrummel,
-- justin-gillis, rev-dr-sunjye-...). A freed slug could also be taken by
-- someone else, whose storage would then resolve to the first person's files.
--
-- storage_folder is assigned once, from the slug, and is never derived again.
-- It is unique across all rows, so a name is never handed to a second person
-- even after the first person's slug has moved on.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS storage_folder varchar(80);

COMMENT ON COLUMN public.users.storage_folder IS
  'Folder name under EAC_Network/users/. Set once from slug by '
  'trg_users_storage_folder; never follows a slug rename. Unique.';

-- Existing rows: the folder name is the current slug (slugs are unique, so
-- this cannot collide).
UPDATE public.users
   SET storage_folder = slug
 WHERE storage_folder IS NULL
   AND slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_storage_folder
  ON public.users (storage_folder)
  WHERE storage_folder IS NOT NULL;

-- Assign on the first write that gives the row a slug: signup (handle_new_user
-- inserts with a slug), stub profiles, pseudonyms, or a slug set later.
-- Only fills a NULL; an assigned folder is left alone.
CREATE OR REPLACE FUNCTION public.users_assign_storage_folder()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  candidate text;
  n int := 1;
BEGIN
  IF NEW.storage_folder IS NOT NULL OR NEW.slug IS NULL THEN
    RETURN NEW;
  END IF;

  candidate := NEW.slug;
  WHILE EXISTS (
    SELECT 1 FROM public.users
     WHERE storage_folder = candidate
       AND id <> NEW.id
  ) LOOP
    n := n + 1;
    candidate := left(NEW.slug, 74) || '-' || n;
  END LOOP;

  NEW.storage_folder := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_storage_folder ON public.users;
CREATE TRIGGER trg_users_storage_folder
  BEFORE INSERT OR UPDATE OF slug, storage_folder ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_assign_storage_folder();
