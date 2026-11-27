// ============================================================================
// The content index writer (docs/open/CONTENT_CORNERSTONE_2026-11-26/CONTRACT.md).
//
// content_index (migration 293) is derived data: one row per thread piece and
// per artwork, read by @elkdonis/content searchContent. It lives in services
// because commerce and services write paths call it and content depends on
// both, so there is no import cycle. This module imports only the db client.
//
// Every export that a write path calls (indexThread, indexArtwork,
// unindexContent) never throws: an index failure is logged and the caller's
// write is unaffected. Each is one SQL statement, so it adds a millisecond or
// two. The upserts are SELECT-driven, so they read the live row and cannot
// drift from it.
//
// Thread kinds map to types as packages/content/src/server/list.ts
// THREAD_TYPES does; keep the two in step.
// ============================================================================

import { db } from '@elkdonis/db';

/** Thread kind -> library type (list.ts THREAD_TYPES). Kinds not listed are not pieces. */
export const INDEXED_THREAD_KINDS: Record<string, string> = {
  writing: 'writing',
  post: 'writing',
  meeting: 'meeting',
  reading_group: 'meeting',
  series: 'series',
  workshop: 'workshop',
  event: 'event',
};
const KINDS = Object.keys(INDEXED_THREAD_KINDS);

const COLS = db.unsafe(
  'store, id, type, org_id, site_org_id, store_id, owner_user_id, owner_identity_id, visibility, min_role, status, sale_state, price_minor, currency, hidden, title, excerpt, body_text, sort_at, next_at, cover, series_id'
);
const UPDATE_SET = db.unsafe(
  `type = EXCLUDED.type, org_id = EXCLUDED.org_id, site_org_id = EXCLUDED.site_org_id, store_id = EXCLUDED.store_id,
   owner_user_id = EXCLUDED.owner_user_id, owner_identity_id = EXCLUDED.owner_identity_id,
   visibility = EXCLUDED.visibility, min_role = EXCLUDED.min_role, status = EXCLUDED.status,
   sale_state = EXCLUDED.sale_state, price_minor = EXCLUDED.price_minor, currency = EXCLUDED.currency,
   hidden = EXCLUDED.hidden, title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_text = EXCLUDED.body_text,
   sort_at = EXCLUDED.sort_at, next_at = EXCLUDED.next_at, cover = EXCLUDED.cover, series_id = EXCLUDED.series_id,
   updated_at = NOW()`
);
const FIELDS = ['type', 'org_id', 'site_org_id', 'store_id', 'owner_user_id', 'owner_identity_id', 'visibility', 'min_role', 'status', 'sale_state', 'price_minor', 'hidden', 'title', 'sort_at', 'next_at', 'cover', 'series_id'];
// True when none of the indexed columns differ (reconcile's stale test).
const SAME = (a: string, b: string) =>
  `(${FIELDS.map((f) => `${a}.${f}`).join(', ')}) IS NOT DISTINCT FROM (${FIELDS.map((f) => `${b}.${f}`).join(', ')})`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Frag = any;

/** SELECT of index columns for threads matching `where` (alias t). */
function threadSelect(where: Frag) {
  return db`
    SELECT 'thread'::text AS store, t.id::text AS id,
      CASE WHEN COALESCE(t.video_url, '') <> '' THEN 'video'
           ELSE CASE t.kind WHEN 'writing' THEN 'writing' WHEN 'post' THEN 'writing' WHEN 'meeting' THEN 'meeting'
                            WHEN 'reading_group' THEN 'meeting' WHEN 'series' THEN 'series'
                            WHEN 'workshop' THEN 'workshop' WHEN 'event' THEN 'event' END END AS type,
      t.org_id::text AS org_id, t.org_id::text AS site_org_id, NULL::uuid AS store_id,
      t.author_id AS owner_user_id, t.author_id AS owner_identity_id,
      COALESCE(t.visibility, 'PUBLIC')::text AS visibility, t.min_role::text AS min_role, t.status::text AS status,
      NULL::text AS sale_state, NULL::bigint AS price_minor, NULL::text AS currency, false AS hidden,
      COALESCE(t.title, '') AS title, LEFT(t.excerpt, 2000) AS excerpt,
      LEFT(REGEXP_REPLACE(COALESCE(t.body, ''), '<[^>]*>', ' ', 'g'), 20000) AS body_text,
      COALESCE(t.published_at, t.updated_at) AS sort_at,
      COALESCE(
        (SELECT min(s.scheduled_at) FROM threads s
          WHERE s.kind = 'series_session' AND s.status = 'published'
            AND s.metadata->>'seriesId' = t.id AND s.scheduled_at > now()),
        CASE WHEN t.scheduled_at > now() THEN t.scheduled_at END) AS next_at,
      t.metadata->>'coverImageUrl' AS cover, NULL::text AS series_id
    FROM threads t
    WHERE t.kind = ANY(${KINDS}) AND ${where}
  `;
}

/** SELECT of index columns for artwork matching `where` (alias a). */
function artworkSelect(where: Frag) {
  return db`
    SELECT 'artwork'::text AS store, a.id::text AS id,
      CASE WHEN a.kind IS NOT NULL AND a.kind <> 'original' THEN 'product' ELSE 'artwork' END AS type,
      s.owner_org_id::text AS org_id, s.org_id::text AS site_org_id, a.store_id,
      a.artist_user_id AS owner_user_id,
      CASE WHEN a.credit_status = 'credited' THEN a.credited_artist_user_id END AS owner_identity_id,
      'PUBLIC'::text AS visibility, NULL::text AS min_role,
      CASE a.status WHEN 'draft' THEN 'draft' WHEN 'archived' THEN 'archived' ELSE 'published' END AS status,
      CASE
        WHEN a.status = 'draft' THEN 'not_for_sale'
        WHEN a.status = 'archived' THEN 'withdrawn'
        WHEN a.status = 'sold' THEN 'sold'
        WHEN a.status = 'reserved' THEN 'reserved'
        WHEN EXISTS (SELECT 1 FROM auction_lot l JOIN artwork_variant v ON v.id = l.artwork_variant_id
                      WHERE v.artwork_id = a.id AND l.status IN ('scheduled', 'live')) THEN 'in_auction'
        WHEN (SELECT l.status FROM auction_lot l JOIN artwork_variant v ON v.id = l.artwork_variant_id
               WHERE v.artwork_id = a.id ORDER BY l.created_at DESC LIMIT 1) = 'passed' THEN 'passed'
        ELSE 'for_sale' END AS sale_state,
      pv.price_minor, pv.currency::text AS currency,
      (a.metadata->'hiddenByAdmin' IS NOT NULL) AS hidden,
      COALESCE(a.title, '') AS title,
      LEFT(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(a.description_html, ''), '<[^>]*>', ' ', 'g'), '\\s+', ' ', 'g')), 2000) AS excerpt,
      LEFT(CONCAT_WS(' ', a.medium, a.style, a.subject, u.display_name, s.display_name, a.metadata->>'artistName'), 4000) AS body_text,
      a.updated_at AS sort_at, NULL::timestamptz AS next_at, pm.url AS cover,
      (SELECT l.series_id::text FROM auction_lot l JOIN artwork_variant v ON v.id = l.artwork_variant_id
        WHERE v.artwork_id = a.id AND l.series_id IS NOT NULL ORDER BY l.created_at DESC LIMIT 1) AS series_id
    FROM artwork a
    LEFT JOIN store s ON s.id = a.store_id
    LEFT JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    LEFT JOIN LATERAL (
      SELECT v.price_minor, v.currency FROM artwork_variant v WHERE v.artwork_id = a.id
      ORDER BY v.price_minor ASC, v.position ASC LIMIT 1) pv ON true
    WHERE ${where}
  `;
}

const tw = (id: string | null): Frag => (id ? db`t.id = ${id}` : db`true`);
const aw = (id: string | null): Frag => (id ? db`a.id = ${id}::uuid` : db`true`);

function upsert(sel: Frag) {
  return db`INSERT INTO content_index (${COLS}) ${sel} ON CONFLICT (store, id) DO UPDATE SET ${UPDATE_SET}`;
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function safely(what: string, fn: () => Promise<unknown>): Promise<void> {
  try { await fn(); } catch (err) {
    console.error(`[content-index] ${what}:`, err instanceof Error ? err.message : err);
  }
}

async function doThread(id: string): Promise<void> {
  await upsert(threadSelect(tw(id)));
  await db`
    DELETE FROM content_index ci WHERE ci.store = 'thread' AND ci.id = ${id}
      AND NOT EXISTS (SELECT 1 FROM threads t WHERE t.id = ci.id AND t.kind = ANY(${KINDS}))`;
}

async function doArtwork(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await upsert(artworkSelect(aw(id)));
  await db`
    DELETE FROM content_index ci WHERE ci.store = 'artwork' AND ci.id = ${id}
      AND NOT EXISTS (SELECT 1 FROM artwork a WHERE a.id::text = ci.id)`;
}

/** Index (or re-index) one thread; removes the row when the thread is gone or not a piece. Never throws. */
export async function indexThread(id: string): Promise<void> {
  if (!id) return;
  await safely(`indexThread ${id}`, () => doThread(id));
}

/** Index (or re-index) one artwork (price, sale state and hidden included). Never throws. */
export async function indexArtwork(id: string): Promise<void> {
  if (!id || !isUuid(id)) return;
  await safely(`indexArtwork ${id}`, () => doArtwork(id));
}

/** Remove one row by key (`thread:<id>`, `artwork:<id>`, `file:<id>`). Never throws. */
export async function unindexContent(key: string): Promise<void> {
  if (!key) return;
  await safely(`unindexContent ${key}`, async () => { await db`DELETE FROM content_index WHERE key = ${key}`; });
}

export interface ReindexResult { thread?: number; artwork?: number; ms: number }

/** Rebuild whole stores from their source tables (the backfill). Writes only content_index. Throws on failure. */
export async function reindexAll(opts: { stores?: Array<'thread' | 'artwork'> } = {}): Promise<ReindexResult> {
  const t0 = Date.now();
  const stores = opts.stores?.length ? opts.stores : (['thread', 'artwork'] as Array<'thread' | 'artwork'>);
  const out: ReindexResult = { ms: 0 };
  if (stores.includes('thread')) {
    const r = await upsert(threadSelect(tw(null)));
    out.thread = r.count;
    await db`DELETE FROM content_index ci WHERE ci.store = 'thread'
      AND NOT EXISTS (SELECT 1 FROM threads t WHERE t.id = ci.id AND t.kind = ANY(${KINDS}))`;
  }
  if (stores.includes('artwork')) {
    const r = await upsert(artworkSelect(aw(null)));
    out.artwork = r.count;
    await db`DELETE FROM content_index ci WHERE ci.store = 'artwork'
      AND NOT EXISTS (SELECT 1 FROM artwork a WHERE a.id::text = ci.id)`;
  }
  out.ms = Date.now() - t0;
  return out;
}

export interface StoreDrift { source: number; indexed: number; missing: number; stale: number; orphan: number }
export interface ReconcileResult { thread: StoreDrift; artwork: StoreDrift; fixed: boolean }

async function drift(store: 'thread' | 'artwork', src: Frag): Promise<StoreDrift> {
  const [r] = await db<Array<{ source: number; missing: number; stale: number }>>`
    WITH src AS (${src})
    SELECT count(*)::int AS source,
           count(*) FILTER (WHERE ci.id IS NULL)::int AS missing,
           count(*) FILTER (WHERE ci.id IS NOT NULL AND NOT (${db.unsafe(SAME('src', 'ci'))}))::int AS stale
    FROM src LEFT JOIN content_index ci ON ci.store = src.store AND ci.id = src.id`;
  const [o] = await db<Array<{ indexed: number; orphan: number }>>`
    WITH src AS (${src})
    SELECT count(*)::int AS indexed,
           count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM src WHERE src.id = ci.id))::int AS orphan
    FROM content_index ci WHERE ci.store = ${store}`;
  return { source: r!.source, indexed: o!.indexed, missing: r!.missing, stale: r!.stale, orphan: o!.orphan };
}

/**
 * Compare the index with its source tables and report drift: rows missing from the index, rows whose
 * indexed columns differ from the source (stale), and rows with no source (orphan). `fix: true` repairs
 * by re-indexing and deleting orphans. File rows are not reconciled here (Step 5).
 */
export async function reconcileContentIndex(opts: { fix?: boolean } = {}): Promise<ReconcileResult> {
  let thread = await drift('thread', threadSelect(tw(null)));
  let artwork = await drift('artwork', artworkSelect(aw(null)));
  let fixed = false;
  if (opts.fix && thread.missing + thread.stale + thread.orphan + artwork.missing + artwork.stale + artwork.orphan > 0) {
    await reindexAll();
    fixed = true;
    thread = await drift('thread', threadSelect(tw(null)));
    artwork = await drift('artwork', artworkSelect(aw(null)));
  }
  return { thread, artwork, fixed };
}

// ── the queue (migration 294, CONTRACT §12) ─────────────────────────────────
// Triggers on threads, artwork and auction_lot enqueue keys; this is where they are indexed.

/** Re-index one key; throws on failure. File keys are not indexed yet (Step 5), so they just clear. */
async function reindexKey(key: string): Promise<void> {
  const i = key.indexOf(':');
  const store = key.slice(0, i), id = key.slice(i + 1);
  if (store === 'thread') await doThread(id);
  else if (store === 'artwork') await doArtwork(id);
}

export interface DrainResult { done: number; failed: number }

/**
 * Drain queued keys, oldest first. A key leaves the queue only after its re-index succeeded, and only if
 * it was not re-queued meanwhile. `limit` bounds one call (searchContent uses 25); `all: true` loops until
 * the queue is empty or a pass makes no progress. Never throws (a missing queue table counts as empty).
 */
export async function drainContentQueue(opts: { limit?: number; all?: boolean } = {}): Promise<DrainResult> {
  const total: DrainResult = { done: 0, failed: 0 };
  const batch = opts.all ? 200 : Math.max(1, Math.min(opts.limit ?? 25, 200));
  try {
    for (let pass = 0; pass < 1000; pass++) {
      const rows = await db<Array<{ key: string; at: string }>>`
        SELECT key, queued_at::text AS at FROM content_index_queue ORDER BY queued_at LIMIT ${batch}`;
      if (!rows.length) break;
      let progress = 0;
      for (const r of rows) {
        try {
          await reindexKey(r.key);
          await db`DELETE FROM content_index_queue WHERE key = ${r.key} AND queued_at::text = ${r.at}`;
          progress++; total.done++;
        } catch (err) {
          total.failed++;
          console.error(`[content-index] drain ${r.key}:`, err instanceof Error ? err.message : err);
        }
      }
      if (!opts.all || progress === 0) break;
    }
  } catch (err) {
    console.error('[content-index] drain:', err instanceof Error ? err.message : err);
  }
  return total;
}
