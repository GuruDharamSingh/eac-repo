// ============================================================================
// @elkdonis/content/server: searchContent (CONTRACT.md §3 and §10).
//
// One keyset-paged SQL query over content_index returns the page of keys,
// already ordered, under one rights predicate (access.ts contentReadSql).
// Facets are counted under the same predicate. Then hydrate.ts fills the page's
// items (thread and artwork rows, owner-only marks), so listContent and
// searchContent produce identical items.
//
// `viewer = null` is allowed for the network scope only; any other scope throws.
// Limits: default 40, at most `opts.maxLimit` (100; listContent passes 200).
// Routes cap at 100 themselves.
//
// Known limits (logged in LEDGER): the index holds the raw status (draft,
// published, archived). The statuses `scheduled` and `live` come from the owner's
// timeline at hydration, so asking for them filters as `published` in SQL and
// the item's status may read scheduled or live. Facets count raw statuses.
// ============================================================================

import { db } from "@elkdonis/db";
import type { ContentListItem, ContentStatus, ContentType } from "../model";
import type { ContentHost } from "../host";
import type { ContentQuery, ContentRefResult, ContentSaleState, ContentSearchResult } from "../search-types";
import { contentReadSql, isSiteKeeper, resolveRights, type ContentRights, type ContentViewer } from "./access";
import { drainContentQueue } from "@elkdonis/services";
import { hydrateRows, type IndexRow } from "./hydrate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Frag = any;
type Sort = "recent" | "next" | "title" | "relevance";

const KEY_RE = /^(thread|artwork|file):[A-Za-z0-9_-]{1,64}$/;

function encodeCursor(sort: Sort, k1: string, key: string): string {
  return Buffer.from(JSON.stringify([sort, k1, key])).toString("base64url");
}
function decodeCursor(c: string | null | undefined, sort: Sort): { k1: string; key: string } | null {
  if (!c) return null;
  try {
    const [s, k1, key] = JSON.parse(Buffer.from(c, "base64url").toString()) as [string, string, string];
    if (s !== sort || typeof k1 !== "string" || typeof key !== "string" || !KEY_RE.test(key)) return null;
    return { k1, key };
  } catch {
    return null;
  }
}

/** content_index status values a ContentStatus list asks for. scheduled and live are published rows in the index. */
function rawStatuses(want: ContentStatus[] | undefined): string[] {
  const set = new Set<string>();
  for (const s of want?.length ? want : (["draft", "scheduled", "live", "published"] as ContentStatus[])) {
    if (s === "draft") set.add("draft");
    else if (s === "archived") set.add("archived");
    else set.add("published");
  }
  return [...set];
}

export async function searchContent(
  viewer: ContentViewer | null,
  query: ContentQuery,
  host: ContentHost,
  opts: { maxLimit?: number; now?: Date; /** Tests: do not drain the index queue first. */ noDrain?: boolean; /** Tests: skip resolveRights and use these (synthetic) rights. */ rights?: ContentRights } = {}
): Promise<ContentSearchResult> {
  let scope = query.scope;
  if (!viewer && !opts.rights && scope.kind !== "network" && scope.kind !== "person") throw new Error("searchContent: only the network and person scopes are open to signed-out visitors");
  // Index freshness (CONTRACT s12): re-index what the triggers queued since the last search.
  if (!opts.noDrain) await drainContentQueue({ limit: 25 });
  const rights = opts.rights ?? (viewer ? await resolveRights(viewer) : null);
  // A person's own scope is `mine`: the same rows, and the viewer's pseudonyms count.
  if (scope.kind === "person" && rights && scope.userId === rights.userId) scope = { kind: "mine" };
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 40), 1), opts.maxLimit ?? 100);
  const q = (query.q ?? "").trim().slice(0, 200);
  const sort: Sort = query.sort === "relevance" && !q ? "recent" : query.sort ?? (q ? "relevance" : "recent");
  const keeper = isSiteKeeper(rights, host);
  const includeHidden = Boolean(query.includeHidden && keeper);

  // ── predicates ───────────────────────────────────────────────────────────
  const view = query.view ?? "published";
  const stores = view === "published" ? ["thread", "artwork"] : view === "files" ? ["file"] : ["thread", "artwork", "file"];
  const statuses = rawStatuses(query.statuses);
  const readSql = contentReadSql(rights, scope, host, { includeHidden });
  const tsq: Frag = q ? db`websearch_to_tsquery('english', ${q})` : db`NULL::tsquery`;
  const matchSql: Frag = q ? db`(ci.tsv @@ ${tsq} OR ci.title % ${q})` : db`true`;
  const seriesSql: Frag = query.seriesId ? db`ci.series_id = ${query.seriesId}` : db`true`;
  // Facets ignore the selections they count (types, statuses, stores, sale) but keep rights, scope, view, q and series.
  const baseSql = db`ci.store = ANY(${stores}::text[]) AND ${readSql} AND ${matchSql} AND ${seriesSql}`;
  const hiddenStatus: Frag = includeHidden ? db`OR ci.hidden` : db``;
  const statusSql = db`(ci.status = ANY(${statuses}::text[]) ${hiddenStatus})`;
  const typeSql: Frag = query.types?.length ? db`ci.type = ANY(${query.types}::text[])` : db`true`;
  const storeIdSql: Frag = query.storeIds?.length ? db`ci.store_id = ANY(${query.storeIds}::uuid[])` : db`true`;
  const saleSql: Frag = query.saleStates?.length ? db`ci.sale_state = ANY(${query.saleStates}::text[])` : db`true`;
  const filterSql = db`${statusSql} AND ${typeSql} AND ${storeIdSql} AND ${saleSql}`;

  // ── sort and keyset ──────────────────────────────────────────────────────
  const rank: Frag = q ? db`(ts_rank(ci.tsv, ${tsq}) + 0.5 * similarity(ci.title, ${q}))::float8` : db`0::float8`;
  const cur = decodeCursor(query.cursor, sort);
  const keyC = db`(ci.key COLLATE "C")`;
  let k1Sql: Frag;
  let orderSql: Frag;
  let afterSql: Frag = db`true`;
  if (sort === "recent") {
    k1Sql = db`to_char(ci.sort_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
    orderSql = db`ci.sort_at DESC, ${keyC} DESC`;
    if (cur) afterSql = db`(ci.sort_at, ${keyC}) < (${cur.k1}::timestamptz, ${cur.key}::text COLLATE "C")`;
  } else if (sort === "relevance") {
    k1Sql = db`${rank}::text`;
    orderSql = db`${rank} DESC, ${keyC} DESC`;
    if (cur) afterSql = db`(${rank}, ${keyC}) < (${cur.k1}::float8, ${cur.key}::text COLLATE "C")`;
  } else if (sort === "title") {
    k1Sql = db`lower(ci.title)`;
    orderSql = db`(lower(ci.title) COLLATE "C") ASC, ${keyC} ASC`;
    if (cur) afterSql = db`((lower(ci.title) COLLATE "C"), ${keyC}) > (${cur.k1}::text COLLATE "C", ${cur.key}::text COLLATE "C")`;
  } else {
    k1Sql = db`COALESCE(ci.next_at, 'infinity'::timestamptz)::text`;
    orderSql = db`COALESCE(ci.next_at, 'infinity'::timestamptz) ASC, ${keyC} ASC`;
    if (cur) afterSql = db`(COALESCE(ci.next_at, 'infinity'::timestamptz), ${keyC}) > (${cur.k1}::timestamptz, ${cur.key}::text COLLATE "C")`;
  }

  type Found = IndexRow & { k1: string };
  const rowsP = db<Found[]>`
    SELECT ci.key, ci.store, ci.id, ci.type, ci.org_id, ci.site_org_id, ci.store_id::text AS store_id,
           ci.owner_user_id::text AS owner_user_id, ci.owner_identity_id::text AS owner_identity_id,
           ci.status, ci.visibility, ci.sale_state, ci.hidden, ci.series_id,
           to_char(ci.sort_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sort_iso,
           ${k1Sql} AS k1
    FROM content_index ci
    WHERE ${baseSql} AND ${filterSql} AND ${afterSql}
    ORDER BY ${orderSql}
    LIMIT ${limit + 1}
  `;

  // ── facets: same rights predicate ────────────────────────────────────────
  const facetBase = db`${baseSql} AND (ci.status = ANY(${rawStatuses(query.statuses?.includes("archived") ? ["draft", "published", "archived"] : undefined)}::text[]) ${hiddenStatus})`;
  const wantStores = scope.kind === "site" || scope.kind === "org";
  const facetsP = Promise.all([
    db<Array<{ k: string; n: number }>>`SELECT ci.type AS k, count(*)::int AS n FROM content_index ci WHERE ${facetBase} GROUP BY 1`,
    db<Array<{ k: string; n: number }>>`SELECT ci.status AS k, count(*)::int AS n FROM content_index ci WHERE ${facetBase} GROUP BY 1`,
    wantStores
      ? db<Array<{ id: string; name: string; n: number }>>`
          SELECT ci.store_id::text AS id, COALESCE(s.display_name, ci.store_id::text) AS name, count(*)::int AS n
          FROM content_index ci LEFT JOIN store s ON s.id = ci.store_id
          WHERE ci.store_id IS NOT NULL AND ${facetBase} GROUP BY 1, 2 ORDER BY n DESC, name`
      : Promise.resolve([] as Array<{ id: string; name: string; n: number }>),
    db<Array<{ k: string; n: number }>>`SELECT ci.sale_state AS k, count(*)::int AS n FROM content_index ci WHERE ci.sale_state IS NOT NULL AND ${facetBase} GROUP BY 1`,
  ]);

  const [found, [tf, sf, stf, saf]] = await Promise.all([rowsP, facetsP]);

  const pageRows = found.slice(0, limit);
  const last = pageRows[pageRows.length - 1];
  const nextCursor = found.length > limit && last ? encodeCursor(sort, last.k1, last.key) : null;

  const { items: byKey, missing } = await hydrateRows(pageRows, { rights, scope, host, now: opts.now ?? new Date() });
  const items: ContentListItem[] = [];
  for (const r of pageRows) {
    const it = byKey.get(r.key);
    if (it) items.push(it);
  }

  const toMap = <K extends string>(list: Array<{ k: string; n: number }>) => Object.fromEntries(list.map((x) => [x.k, x.n])) as Partial<Record<K, number>>;
  return {
    items,
    nextCursor,
    facets: {
      types: toMap<ContentType>(tf),
      statuses: toMap<ContentStatus>(sf),
      stores: stf.map((s) => ({ id: s.id, name: s.name, count: s.n })),
      sale: toMap<ContentSaleState>(saf),
    },
    missing,
  };
}

/**
 * Resolve stored references at render time (CONTRACT s11.7): for each key, the current hydrated item, or
 * `{ key, gone: true }` when it is unpublished, hidden, deleted, or no longer readable by this viewer. One
 * indexed query over content_index (rights predicate, no scope), then hydration of the survivors. Result
 * order follows `keys`; duplicates and malformed keys resolve like missing ones. At most 200 keys.
 */
export async function resolveContentRefs(
  viewer: ContentViewer | null,
  keys: string[],
  host: ContentHost,
  opts: { rights?: ContentRights; now?: Date; noDrain?: boolean } = {}
): Promise<{ results: ContentRefResult[]; missing: string[] }> {
  const wanted = [...new Set(keys.filter((k) => KEY_RE.test(k)))].slice(0, 200);
  if (!opts.noDrain) await drainContentQueue({ limit: 25 });
  const rights = opts.rights ?? (viewer ? await resolveRights(viewer) : null);
  let found: IndexRow[] = [];
  if (wanted.length) {
    found = await db<IndexRow[]>`
      SELECT ci.key, ci.store, ci.id, ci.type, ci.org_id, ci.site_org_id, ci.store_id::text AS store_id,
             ci.owner_user_id::text AS owner_user_id, ci.owner_identity_id::text AS owner_identity_id,
             ci.status, ci.visibility, ci.sale_state, ci.hidden, ci.series_id,
             to_char(ci.sort_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sort_iso
      FROM content_index ci
      WHERE ci.key = ANY(${wanted}::text[]) AND ${contentReadSql(rights, null, host)}`;
  }
  const { items, missing } = await hydrateRows(found, { rights, scope: { kind: "site" }, host, now: opts.now ?? new Date() });
  const results = keys.map((key): ContentRefResult => items.get(key) ?? { key, gone: true });
  return { results, missing };
}
