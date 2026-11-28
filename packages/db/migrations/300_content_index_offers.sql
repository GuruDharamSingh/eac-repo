-- ============================================================================
-- 300: content_index freshness for paid work (offers view, CONTRACT §16 revised / v1.4)
--
-- The indexer now fills content_index.price_minor / currency for threads from
-- threads.price, threads.currency and workshop_pages.price_member, and indexes the
-- thread kind `service`. This migration only widens what enqueues a re-index:
--
--   1. threads: the UPDATE trigger from 294 listed no price column, so a price edit
--      would not refresh the row. Recreated with `price, currency` added; the
--      INSERT/DELETE trigger and the function are unchanged.
--   2. workshop_pages: price_member takes precedence over threads.price (commerce,
--      service-orders.ts), so a change there must re-index the workshop's thread.
--      New function content_index_enqueue_workshop_page + trigger.
--
-- No table or column changes. is_rsvp_enabled is read live by the offers view
-- (EXISTS on threads), so it needs no trigger. After applying, run a thread
-- reindex to fill prices and add service rows:
--   content-reindex.mts --stores=thread
--
-- Applied ALONE (file plus its app_schema_migrations row in one transaction under
-- the migrate lock); 263 and 295 stay pending. Trigger functions pin search_path
-- and qualify their tables (EXTENDING.md §7).
-- ============================================================================

DROP TRIGGER IF EXISTS trg_content_index_threads_u ON public.threads;
CREATE TRIGGER trg_content_index_threads_u
  AFTER UPDATE OF kind, org_id, author_id, title, body, excerpt, status, visibility, min_role, scheduled_at, published_at, updated_at, video_url, section, metadata, price, currency
  ON public.threads FOR EACH ROW EXECUTE FUNCTION public.content_index_enqueue_thread();

CREATE OR REPLACE FUNCTION public.content_index_enqueue_workshop_page() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.content_index_queue (key, queued_at)
  VALUES ('thread:' || COALESCE(NEW.thread_id, OLD.thread_id), clock_timestamp())
  ON CONFLICT (key) DO UPDATE SET queued_at = EXCLUDED.queued_at;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_content_index_workshop_pages_iud ON public.workshop_pages;
CREATE TRIGGER trg_content_index_workshop_pages_iud AFTER INSERT OR DELETE ON public.workshop_pages
  FOR EACH ROW EXECUTE FUNCTION public.content_index_enqueue_workshop_page();
DROP TRIGGER IF EXISTS trg_content_index_workshop_pages_u ON public.workshop_pages;
CREATE TRIGGER trg_content_index_workshop_pages_u AFTER UPDATE OF price_member, thread_id ON public.workshop_pages
  FOR EACH ROW EXECUTE FUNCTION public.content_index_enqueue_workshop_page();
