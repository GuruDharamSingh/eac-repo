-- 171_users_featured_thread.sql
-- A person's one featured offering on ArtDirect. 2026-09-27.
--
-- Developer decision (docs/open/ARTIST_FUNNEL_BRIEF_2026-09-27.md): each
-- artist has one featured offering with its own page (/<slug>/featured); the
-- rest appear as cards on the profile. threads.pinned is not reused: it is
-- org-feed pinning and puts a thread on every org's network feed.
-- Set only through setFeaturedOffering (packages/services/src/artist-offerings.ts),
-- which checks the person authored the thread.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS featured_thread_id varchar(21)
    REFERENCES public.threads(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.featured_thread_id IS
  'The person''s featured offering (a thread they authored, homed in oad). '
  'Rendered at ArtDirect /<slug>/featured. NULL = none.';
