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

import { createHash } from 'node:crypto';
import { db } from '@elkdonis/db';
import { davConfigured, davList, davListDeep, type DavEntry } from './dav';
import { mediaFamilyOf } from './media-source';

/** Thread kind -> library type (list.ts THREAD_TYPES). Kinds not listed are not pieces. */
export const INDEXED_THREAD_KINDS: Record<string, string> = {
  writing: 'writing',
  post: 'writing',
  meeting: 'meeting',
  reading_group: 'meeting',
  series: 'series',
  workshop: 'workshop',
  event: 'event',
  // v1.4: a bookable service. Type 'service' is read only by the offers view (content access.ts hides it elsewhere).
  service: 'service',
};
// Service rows are written by default since 2026-11-27 (Justin's go, relayed by the content library PM): every
// app that reads the index is rebuilt with the v1.4 access rule (content access.ts hides type 'service' outside
// the offers view). CONTENT_INDEX_SERVICES=0 is the off-switch: a queued service thread is then not indexed, and
// doThread/reindexAll remove any service row (they delete rows whose kind is not in KINDS). Before this date the
// default was off and only CONTENT_INDEX_SERVICES=1 turned it on; an app built before then still drains with
// services off and removes a service row it meets, until it is rebuilt.
const SERVICES_ON = process.env.CONTENT_INDEX_SERVICES !== '0';
const KINDS = Object.keys(INDEXED_THREAD_KINDS).filter((k) => SERVICES_ON || k !== 'service');

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
const FIELDS = ['type', 'org_id', 'site_org_id', 'store_id', 'owner_user_id', 'owner_identity_id', 'visibility', 'min_role', 'status', 'sale_state', 'price_minor', 'currency', 'hidden', 'title', 'sort_at', 'next_at', 'cover', 'series_id'];
// True when none of the indexed columns differ (reconcile's stale test).
const SAME = (a: string, b: string) =>
  `(${FIELDS.map((f) => `${a}.${f}`).join(', ')}) IS NOT DISTINCT FROM (${FIELDS.map((f) => `${b}.${f}`).join(', ')})`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Frag = any;

/**
 * A thread's list price in MAJOR units (alias t): workshop_pages.price_member first, else threads.price, as
 * commerce's createServiceBooking reads it (service-orders.ts). Indexed as price_minor; the currency is the
 * thread's, defaulting to CAD as commerce does.
 */
const THREAD_PRICE = db`COALESCE((SELECT wp.price_member FROM workshop_pages wp WHERE wp.thread_id = t.id), t.price)`;

/** SELECT of index columns for threads matching `where` (alias t). */
function threadSelect(where: Frag) {
  return db`
    SELECT 'thread'::text AS store, t.id::text AS id,
      CASE WHEN t.kind = 'service' THEN 'service'
           WHEN COALESCE(t.video_url, '') <> '' THEN 'video'
           ELSE CASE t.kind WHEN 'writing' THEN 'writing' WHEN 'post' THEN 'writing' WHEN 'meeting' THEN 'meeting'
                            WHEN 'reading_group' THEN 'meeting' WHEN 'series' THEN 'series'
                            WHEN 'workshop' THEN 'workshop' WHEN 'event' THEN 'event' END END AS type,
      t.org_id::text AS org_id, t.org_id::text AS site_org_id, NULL::uuid AS store_id,
      t.author_id AS owner_user_id, t.author_id AS owner_identity_id,
      COALESCE(t.visibility, 'PUBLIC')::text AS visibility, t.min_role::text AS min_role, t.status::text AS status,
      NULL::text AS sale_state,
      CASE WHEN ${THREAD_PRICE} > 0 THEN ROUND(${THREAD_PRICE} * 100)::bigint END AS price_minor,
      CASE WHEN ${THREAD_PRICE} > 0 THEN COALESCE(NULLIF(t.currency, ''), 'CAD') END AS currency, false AS hidden,
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

// ── people (migration 298, CONTRACT v1.3) ────────────────────────────────────
// One row per public identity the directory lists: users with a slug and
// directory_listed, either entity_type, keyed by the identity's own id. A pseudonym
// is its own users row and so its own index row. Privacy rules (EXTENDING.md s3):
// identity_control is never read, email is never read, and the owner columns stay
// NULL so nothing in the index ties an identity to an account. Rows are PUBLIC and
// published by construction; an identity that stops being listed loses its row.
//
// rank_key spells the directory order of listPublicProfiles (verified first, then
// vouches, then name) as one text key, so the search can keyset-page on it.

const PERSON_COLS = db.unsafe(
  'store, id, type, org_id, site_org_id, store_id, owner_user_id, owner_identity_id, visibility, min_role, status, sale_state, price_minor, currency, hidden, title, excerpt, body_text, sort_at, next_at, cover, series_id, place_city, place_region, place_country, entity_type, verified, rank_key'
);
const PERSON_UPDATE = db.unsafe(
  `type = EXCLUDED.type, visibility = EXCLUDED.visibility, status = EXCLUDED.status, hidden = EXCLUDED.hidden,
   title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_text = EXCLUDED.body_text, sort_at = EXCLUDED.sort_at,
   cover = EXCLUDED.cover, place_city = EXCLUDED.place_city, place_region = EXCLUDED.place_region,
   place_country = EXCLUDED.place_country, entity_type = EXCLUDED.entity_type, verified = EXCLUDED.verified,
   rank_key = EXCLUDED.rank_key, updated_at = NOW()`
);
const PERSON_FIELDS = ['type', 'visibility', 'status', 'hidden', 'title', 'excerpt', 'cover', 'place_city', 'place_region', 'place_country', 'entity_type', 'verified', 'rank_key'];
const SAME_PERSON = (a: string, b: string) =>
  `(${PERSON_FIELDS.map((f) => `${a}.${f}`).join(', ')}) IS NOT DISTINCT FROM (${PERSON_FIELDS.map((f) => `${b}.${f}`).join(', ')})`;

/** The directory's rule for who is listed (alias u). The same as listPublicProfiles. */
const LISTED = db`u.slug IS NOT NULL AND u.directory_listed`;

/** SELECT of index columns for listed identities matching `where` (alias u). */
function personSelect(where: Frag) {
  return db`
    SELECT 'person'::text AS store, u.id::text AS id, 'person'::text AS type,
      NULL::text AS org_id, NULL::text AS site_org_id, NULL::uuid AS store_id,
      NULL::uuid AS owner_user_id, NULL::uuid AS owner_identity_id,
      'PUBLIC'::text AS visibility, NULL::text AS min_role, 'published'::text AS status,
      NULL::text AS sale_state, NULL::bigint AS price_minor, NULL::text AS currency, false AS hidden,
      COALESCE(NULLIF(u.display_name, ''), u.slug) AS title,
      LEFT(u.headline, 2000) AS excerpt,
      LEFT(CONCAT_WS(' ',
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(u.bio, ''), '<[^>]*>', ' ', 'g'), '\\s+', ' ', 'g')),
        u.city, u.region, u.country, u.oad_dossier->>'location', u.slug), 8000) AS body_text,
      u.updated_at AS sort_at, NULL::timestamptz AS next_at, NULLIF(u.avatar_url, '') AS cover, NULL::text AS series_id,
      NULLIF(u.city, '') AS place_city, NULLIF(u.region, '') AS place_region, NULLIF(u.country, '') AS place_country,
      COALESCE(u.entity_type, 'person') AS entity_type, COALESCE(u.verified, false) AS verified,
      (CASE WHEN COALESCE(u.verified, false) THEN '0' ELSE '1' END)
        || LPAD((999999 - LEAST(COALESCE(v.n, 0), 999999))::text, 6, '0')
        || LOWER(COALESCE(NULLIF(u.display_name, ''), u.slug)) AS rank_key
    FROM users u
    LEFT JOIN (SELECT subject_id, COUNT(*)::int AS n FROM profile_vouches GROUP BY subject_id) v ON v.subject_id = u.id
    WHERE ${LISTED} AND ${where}
  `;
}

const pw = (id: string | null): Frag => (id ? db`u.id = ${id}::uuid` : db`true`);

async function doPerson(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await db`INSERT INTO content_index (${PERSON_COLS}) ${personSelect(pw(id))} ON CONFLICT (store, id) DO UPDATE SET ${PERSON_UPDATE}`;
  // Unlisted, slug removed or deleted: the row goes.
  await db`
    DELETE FROM content_index ci WHERE ci.store = 'person' AND ci.id = ${id}
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id::text = ci.id AND ${LISTED})`;
}

/** Index (or re-index) one directory identity; removes its row when it is no longer listed. Never throws. */
export async function indexPerson(id: string): Promise<void> {
  if (!id || !isUuid(id)) return;
  await safely(`indexPerson ${id}`, () => doPerson(id));
}

async function reindexPeople(): Promise<number> {
  const r = await db`INSERT INTO content_index (${PERSON_COLS}) ${personSelect(pw(null))} ON CONFLICT (store, id) DO UPDATE SET ${PERSON_UPDATE}`;
  await db`DELETE FROM content_index ci WHERE ci.store = 'person'
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id::text = ci.id AND ${LISTED})`;
  return r.count;
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

export interface ReindexResult { thread?: number; artwork?: number; person?: number; ms: number }

/** Rebuild whole stores from their source tables (the backfill). Writes only content_index. Throws on failure. */
export async function reindexAll(opts: { stores?: Array<'thread' | 'artwork' | 'person'> } = {}): Promise<ReindexResult> {
  const t0 = Date.now();
  const stores = opts.stores?.length ? opts.stores : (['thread', 'artwork', 'person'] as Array<'thread' | 'artwork' | 'person'>);
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
  if (stores.includes('person')) {
    // Asked for by name: a failure throws. In the default set (no stores given), a database without
    // migration 298 skips people with a log line, so the nightly run keeps working either way.
    if (opts.stores?.length) out.person = await reindexPeople();
    else out.person = await reindexPeople().catch((err) => {
      console.error('[content-index] reindex people (migration 298 applied?):', err instanceof Error ? err.message : err);
      return undefined;
    });
  }
  out.ms = Date.now() - t0;
  return out;
}

export interface StoreDrift { source: number; indexed: number; missing: number; stale: number; orphan: number }
export interface ReconcileResult { thread: StoreDrift; artwork: StoreDrift; /** Directory identities (migration 298); absent before it. */ person?: StoreDrift; fixed: boolean }

async function drift(store: 'thread' | 'artwork' | 'person', src: Frag): Promise<StoreDrift> {
  const same = store === 'person' ? SAME_PERSON('src', 'ci') : SAME('src', 'ci');
  const [r] = await db<Array<{ source: number; missing: number; stale: number }>>`
    WITH src AS (${src})
    SELECT count(*)::int AS source,
           count(*) FILTER (WHERE ci.id IS NULL)::int AS missing,
           count(*) FILTER (WHERE ci.id IS NOT NULL AND NOT (${db.unsafe(same)}))::int AS stale
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
 * by re-indexing and deleting orphans. File rows are not reconciled here (indexFilesUnder does that, per storage root).
 */
export async function reconcileContentIndex(opts: { fix?: boolean } = {}): Promise<ReconcileResult> {
  let thread = await drift('thread', threadSelect(tw(null)));
  let artwork = await drift('artwork', artworkSelect(aw(null)));
  // People need migration 298 (the columns); before it, reconcile reports threads and artwork as it did.
  const people = () => drift('person', personSelect(pw(null))).catch(() => undefined);
  let person = await people();
  const off = (d?: StoreDrift) => (d ? d.missing + d.stale + d.orphan : 0);
  let fixed = false;
  if (opts.fix && off(thread) + off(artwork) + off(person) > 0) {
    await reindexAll({ stores: person ? ['thread', 'artwork', 'person'] : ['thread', 'artwork'] });
    fixed = true;
    thread = await drift('thread', threadSelect(tw(null)));
    artwork = await drift('artwork', artworkSelect(aw(null)));
    person = await people();
  }
  return person ? { thread, artwork, person, fixed } : { thread, artwork, fixed };
}

// ── the queue (migration 294, CONTRACT §12) ─────────────────────────────────
// Triggers on threads, artwork and auction_lot enqueue keys; this is where they are indexed.

/** Re-index one key; throws on failure. File keys are indexed by indexFilesUnder / indexFilePath, not the queue, so they just clear. */
async function reindexKey(key: string): Promise<void> {
  const i = key.indexOf(':');
  const store = key.slice(0, i), id = key.slice(i + 1);
  if (store === 'thread') await doThread(id);
  else if (store === 'artwork') await doArtwork(id);
  else if (store === 'person') await doPerson(id);
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

// ── files (Step 5, CONTRACT §1, §4, §11) ────────────────────────────────────
// A Nextcloud file is one content_index row, store 'file', id = Nextcloud's file id (oc:fileid, stable across
// moves and renames; a hash of the path only when a listing carries none). NOT a `media` row: apps' media
// libraries read that table. Rows come from WebDAV listings only (never file bytes). Rights are columns, from
// the path, in the same terms as media-authz canReadMedia:
//   users/<folder>/...        owner_user_id = the person; org_id and site_org_id null
//   <org>/...                 org_id = site_org_id = the org
//   a `Private` segment       visibility PRIVATE  (owner; org affiliates; people sharing an org with the owner)
//   <org>/workshops/<id>/...  visibility WORKSHOP (org managers only: stricter than canReadMedia, by design)
//   anything else             visibility PUBLIC
// classifyFilePath mirrors media-authz parseMediaPath; it is repeated here because media-authz pulls in
// modules that import this one. check-files.mts asserts the two agree.

const FILE_ROOT = process.env.NEXTCLOUD_ORG_ROOT_FOLDER || 'EAC_Network';
const FILE_ROOT_RE = /^EAC[_-]Network$/i;

export interface FileClass {
  /** The org the file sits under (org and workshop paths); null for a person's tree. */
  orgId: string | null;
  /** users.storage_folder for a person's tree; null otherwise. */
  userFolder: string | null;
  visibility: 'PUBLIC' | 'PRIVATE' | 'WORKSHOP';
}

/** Where a storage path belongs, or null for anything malformed, outside the network root, or hidden (dotfiles). */
export function classifyFilePath(rawPath: string): FileClass | null {
  if (!rawPath || rawPath.includes('..') || rawPath.includes('\\') || rawPath.includes('\0')) return null;
  const seg = rawPath.split('/').filter(Boolean);
  if (seg.length < 3 || !FILE_ROOT_RE.test(seg[0])) return null;
  if (seg.some((s) => s.startsWith('.'))) return null;
  const isPrivate = seg.some((s) => s.toLowerCase() === 'private');
  if (seg[1].toLowerCase() === 'users') {
    if (seg.length < 4) return null;
    return { orgId: null, userFolder: seg[2], visibility: isPrivate ? 'PRIVATE' : 'PUBLIC' };
  }
  if (seg[2]?.toLowerCase() === 'workshops' && seg.length >= 5) {
    const sub = seg[3].toLowerCase();
    if (sub !== 'covers' && sub !== 'videos') return { orgId: seg[1], userFolder: null, visibility: 'WORKSHOP' };
  }
  return { orgId: seg[1], userFolder: null, visibility: isPrivate ? 'PRIVATE' : 'PUBLIC' };
}

const FILE_TYPE: Record<string, string> = { image: 'image', video: 'video', audio: 'audio', document: 'document', other: 'file' };

/** The stable key id for a listed file: Nextcloud's file id, else a hash of the full path. */
export function fileIndexId(e: { fileId?: string; path: string }): string {
  return e.fileId ? e.fileId : 'p' + createHash('sha1').update(e.path).digest('hex').slice(0, 24);
}

const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')));

interface FileRow {
  store: 'file'; id: string; type: string; org_id: string | null; site_org_id: string | null;
  owner_user_id: string | null; owner_identity_id: string | null; visibility: string; status: 'published'; hidden: false;
  title: string; body_text: string; sort_at: Date; cover: string | null;
  file_source: string; file_path: string; file_mime: string | null; file_size: number; file_folder: string;
}

const folderCache = new Map<string, string | null>();
async function userIdOfFolder(folder: string): Promise<string | null> {
  if (folderCache.has(folder)) return folderCache.get(folder)!;
  const [r] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE storage_folder = ${folder} LIMIT 1`;
  folderCache.set(folder, r?.id ?? null);
  return r?.id ?? null;
}

/** One listed file as an index row, or null when it is not indexable (outside the root, hidden, no owner). */
async function fileRowOf(e: DavEntry): Promise<FileRow | null> {
  const c = classifyFilePath(e.path);
  if (!c) return null;
  let owner: string | null = null;
  if (c.userFolder) {
    owner = await userIdOfFolder(c.userFolder);
    if (!owner) return null; // a folder no account claims is nobody's file
  }
  const family = mediaFamilyOf(e.name, e.mimeType);
  const folder = parentOf(e.path);
  const seg = folder.split('/').filter(Boolean);
  // Words that help a name search: the name with separators opened up, then the folder names below the root.
  const below = seg.slice(c.userFolder ? 3 : 2).filter((s) => s.toLowerCase() !== 'private');
  const words = [e.name.replace(/\.[a-z0-9]{1,8}$/i, '').replace(/[._-]+/g, ' '), ...below.map((s) => s.replace(/[._-]+/g, ' '))].join(' ');
  const t = e.lastModified ? new Date(e.lastModified) : null;
  return {
    store: 'file', id: fileIndexId(e), type: FILE_TYPE[family] ?? 'file',
    org_id: c.orgId, site_org_id: c.visibility === 'WORKSHOP' ? null : c.orgId,
    owner_user_id: owner, owner_identity_id: owner, visibility: c.visibility, status: 'published', hidden: false,
    title: e.name.slice(0, 300), body_text: words.slice(0, 2000),
    sort_at: t && !Number.isNaN(t.getTime()) ? t : new Date(),
    cover: family === 'image' ? `/api/media/${e.path}` : null,
    file_source: c.userFolder ? `${FILE_ROOT}/users/${c.userFolder}` : `${FILE_ROOT}/${c.orgId}`,
    file_path: e.path, file_mime: e.mimeType, file_size: e.size, file_folder: folder,
  };
}

const FILE_COLS = ['store', 'id', 'type', 'org_id', 'site_org_id', 'owner_user_id', 'owner_identity_id', 'visibility', 'status', 'hidden', 'title', 'body_text', 'sort_at', 'cover', 'file_source', 'file_path', 'file_mime', 'file_size', 'file_folder'] as const;
const FILE_UPDATE = db.unsafe(
  `${FILE_COLS.filter((c) => c !== 'store' && c !== 'id').map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()`
);

async function upsertFileRows(rows: FileRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const part = rows.slice(i, i + 500) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db`INSERT INTO content_index ${(db as any)(part, ...FILE_COLS)} ON CONFLICT (store, id) DO UPDATE SET ${FILE_UPDATE}`;
  }
}

export interface IndexFilesResult { listed: number; upserted: number; skipped: number; removed: number; truncated: boolean; ms: number }

/**
 * Index the files under one storage root (a person's tree or an org's), from ONE depth-infinity listing:
 * no file bytes are read. Incremental: an entry whose id, path, size and modified time match its row is
 * skipped. Rows under the root whose file is gone are removed, unless the listing was empty or hit `limit`
 * (an empty answer cannot be told from a failed read, so it never deletes). `principal` is only a label for
 * logs: ownership always comes from the path. Never throws.
 */
export async function indexFilesUnder(
  root: string,
  opts: { principal?: { kind: 'user'; userId: string } | { kind: 'org'; orgId: string }; limit?: number } = {}
): Promise<IndexFilesResult> {
  const t0 = Date.now();
  const out: IndexFilesResult = { listed: 0, upserted: 0, skipped: 0, removed: 0, truncated: false, ms: 0 };
  try {
    if (!davConfigured()) return out;
    const cap = Math.max(1, opts.limit ?? 5000);
    const base = root.replace(/\/+$/, '');
    const listed = await davListDeep(base, cap);
    out.listed = listed.length;
    out.truncated = listed.length >= cap;
    const have = new Map(
      (await db<Array<{ id: string; file_path: string | null; file_size: string | null; at: string }>>`
        SELECT id, file_path, file_size::text AS file_size, extract(epoch from sort_at)::bigint::text AS at
        FROM content_index WHERE store = 'file' AND starts_with(file_path, ${base + '/'})`).map((r) => [r.id, r])
    );
    const seen = new Set<string>();
    const fresh: FileRow[] = [];
    for (const e of listed) {
      const id = fileIndexId(e);
      seen.add(id);
      const h = have.get(id);
      const at = e.lastModified ? Math.floor(new Date(e.lastModified).getTime() / 1000) : null;
      if (h && h.file_path === e.path && h.file_size === String(e.size) && (at === null || h.at === String(at))) { out.skipped++; continue; }
      const row = await fileRowOf(e);
      if (row) fresh.push(row); else out.skipped++;
    }
    await upsertFileRows(fresh);
    out.upserted = fresh.length;
    if (!out.truncated && listed.length > 0) {
      const gone = [...have.keys()].filter((id) => !seen.has(id)).map((id) => `file:${id}`);
      for (let i = 0; i < gone.length; i += 500) await db`DELETE FROM content_index WHERE key = ANY(${gone.slice(i, i + 500)}::text[])`;
      out.removed = gone.length;
    }
  } catch (err) {
    console.error(`[content-index] indexFilesUnder ${root}:`, err instanceof Error ? err.message : err);
  }
  out.ms = Date.now() - t0;
  return out;
}

/**
 * Index (or re-index) one stored file by path, after an upload. One folder listing (Depth 1) finds its
 * file id; no bytes are read. Never throws, so an upload never fails on indexing.
 */
export async function indexFilePath(path: string): Promise<void> {
  await safely(`indexFilePath ${path}`, async () => {
    if (!davConfigured() || !classifyFilePath(path)) return;
    const entry = (await davList(parentOf(path))).find((e) => e.path === path && !e.isFolder);
    if (!entry) return;
    const row = await fileRowOf(entry);
    if (row) await upsertFileRows([row]);
  });
}
