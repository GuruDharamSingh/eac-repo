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
import type { ContentFacetCount, ContentQuery, ContentRefResult, ContentSaleState, ContentSearchResult } from "../search-types";
import { contentReadSql, isSiteKeeper, resolveRights, type ContentRights, type ContentViewer } from "./access";
import { drainContentQueue } from "@elkdonis/services";
import { hydrateRows, type IndexRow } from "./hydrate";
import { offerKindSql, offerRowSql, pricedSql } from "./offers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Frag = any;
type Sort = "recent" | "next" | "title" | "relevance" | "listed";

const KEY_RE = /^(thread|artwork|file):[A-Za-z0-9_-]{1,64}$/;
/** Keys a cursor may carry: the piece keys plus the people view's (v1.3). resolveContentRefs keeps KEY_RE. */
const CURSOR_KEY_RE = /^(thread|artwork|file|person):[A-Za-z0-9_-]{1,64}$/;

function encodeCursor(sort: Sort, k1: string, key: string): string {
  return Buffer.from(JSON.stringify([sort, k1, key])).toString("base64url");
}
function decodeCursor(c: string | null | undefined, sort: Sort): { k1: string; key: string } | null {
  if (!c) return null;
  try {
    const [s, k1, key] = JSON.parse(Buffer.from(c, "base64url").toString()) as [string, string, string];
    if (s !== sort || typeof k1 !== "string" || typeof key !== "string" || !CURSOR_KEY_RE.test(key)) return null;
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
  const view = query.view ?? "published";
  // v1.3: the people view browses in directory order ("listed"); "listed" anywhere else reads as "recent".
  const people = view === "people";
  // v1.4: the offers view reads threads and artwork that are paid or RSVP work, and is the only view that admits services.
  const offers = view === "offers";
  const asked = query.sort === "listed" && !people ? "recent" : query.sort;
  const sort: Sort = asked === "relevance" && !q ? (people ? "listed" : "recent") : asked ?? (q ? "relevance" : people ? "listed" : "recent");
  const keeper = isSiteKeeper(rights, host);
  const includeHidden = Boolean(query.includeHidden && keeper);

  // ── predicates ───────────────────────────────────────────────────────────
  const stores = view === "published" || offers ? ["thread", "artwork"] : view === "files" ? ["file"] : people ? ["person"] : ["thread", "artwork", "file"];
  const statuses = rawStatuses(query.statuses);
  // The people view admits identity rows by their own clause (access.ts); no other view ever does.
  const readSql = contentReadSql(rights, scope, host, { includeHidden, people, offers });
  const tsq: Frag = q ? db`websearch_to_tsquery('english', ${q})` : db`NULL::tsquery`;
  // Agrees with suggestContent: whole words, word prefixes ("Age" finds "AgentE5"), title substring, title trigram.
  const words = q.split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 8);
  const ptsq: Frag = words.length ? db`to_tsquery('english', ${words.map((w) => `${w}:*`).join(" & ")})` : db`NULL::tsquery`;
  const likeAny = "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const likePre = q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const matchSql: Frag = q ? db`(ci.tsv @@ ${tsq} OR ci.tsv @@ ${ptsq} OR ci.title ILIKE ${likeAny} OR ci.title % ${q})` : db`true`;
  const seriesSql: Frag = query.seriesId ? db`ci.series_id = ${query.seriesId}` : db`true`;
  // Facets ignore the selections they count (types, statuses, stores, sale) but keep rights, scope, view, q and series.
  const offerBase: Frag = offers ? offerRowSql() : db`true`;
  const baseSql = db`ci.store = ANY(${stores}::text[]) AND ${readSql} AND ${matchSql} AND ${seriesSql} AND ${offerBase}`;
  // The owner keeps seeing their own hidden pieces in `mine` (flagged hidden); a keeper asks with includeHidden.
  const hiddenStatus: Frag = includeHidden || scope.kind === "mine" ? db`OR ci.hidden` : db``;
  const statusSql = db`(ci.status = ANY(${statuses}::text[]) ${hiddenStatus})`;
  const typeSql: Frag = query.types?.length ? db`ci.type = ANY(${query.types}::text[])` : db`true`;
  const storeIdSql: Frag = query.storeIds?.length ? db`ci.store_id = ANY(${query.storeIds}::uuid[])` : db`true`;
  const saleSql: Frag = query.saleStates?.length ? db`ci.sale_state = ANY(${query.saleStates}::text[])` : db`true`;
  // People view filters (v1.3). Each is its own fragment so a facet can leave out its own dimension.
  const pf = {
    entity: people && query.entityTypes?.length ? db`ci.entity_type = ANY(${query.entityTypes}::text[])` : db`true`,
    region: people && query.region ? db`ci.place_region = ${query.region}` : db`true`,
    country: people && query.country ? db`ci.place_country = ${query.country}` : db`true`,
    city: people && query.city ? db`ci.place_city = ${query.city}` : db`true`,
    verified: people && query.verified !== undefined ? db`COALESCE(ci.verified, false) = ${query.verified}` : db`true`,
  };
  // v1.3 §16: the listing kind, derived from the live organizations table (an org-user is some org's profile_user_id).
  const kindExpr: Frag = db`(CASE WHEN EXISTS (SELECT 1 FROM organizations o WHERE o.profile_user_id::text = ci.id) THEN 'organization'
    WHEN ci.entity_type = 'organization' THEN 'associated' ELSE 'artist' END)`;
  const pk: Frag = people && query.listingKinds?.length ? db`${kindExpr} = ANY(${query.listingKinds}::text[])` : db`true`;
  const peopleSql = db`${pf.entity} AND ${pf.region} AND ${pf.country} AND ${pf.city} AND ${pf.verified} AND ${pk}`;
  // Offers view filters (v1.4); each its own fragment so the kinds and priced facets can leave out their own dimension.
  const of = {
    kinds: offers && query.offerKinds?.length ? db`${offerKindSql()} = ANY(${query.offerKinds}::text[])` : db`true`,
    priced: offers && query.priced !== undefined ? (query.priced ? db`${pricedSql()}` : db`NOT ${pricedSql()}`) : db`true`,
    upcoming: offers && query.upcoming ? db`ci.next_at > now()` : db`true`,
  };
  const offersSql = db`${of.kinds} AND ${of.priced} AND ${of.upcoming}`;
  const filterSql = db`${statusSql} AND ${typeSql} AND ${storeIdSql} AND ${saleSql} AND ${peopleSql} AND ${offersSql}`;

  // ── sort and keyset ──────────────────────────────────────────────────────
  const rank: Frag = q ? db`(ts_rank(ci.tsv, ${tsq}) + ts_rank(ci.tsv, ${ptsq}) * 0.5 + 0.5 * similarity(ci.title, ${q}) + CASE WHEN ci.title ILIKE ${likePre} THEN 0.5 ELSE 0 END)::float8` : db`0::float8`;
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
  } else if (sort === "listed") {
    k1Sql = db`COALESCE(ci.rank_key, lower(ci.title))`;
    orderSql = db`(COALESCE(ci.rank_key, lower(ci.title)) COLLATE "C") ASC, ${keyC} ASC`;
    if (cur) afterSql = db`((COALESCE(ci.rank_key, lower(ci.title)) COLLATE "C"), ${keyC}) > (${cur.k1}::text COLLATE "C", ${cur.key}::text COLLATE "C")`;
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
  // Facets apply every hard filter of the query, so each count sits inside the selection.
  const facetBase = db`${baseSql} AND ${filterSql}`;
  const wantStores = !people && (scope.kind === "site" || scope.kind === "org");
  const facetsP = Promise.all([
    db<Array<{ k: string; n: number }>>`SELECT ci.type AS k, count(*)::int AS n FROM content_index ci WHERE ${facetBase} GROUP BY 1`,
    db<Array<{ k: string; n: number }>>`SELECT ci.status AS k, count(*)::int AS n FROM content_index ci WHERE ${facetBase} GROUP BY 1`,
    wantStores
      ? db<Array<{ id: string; name: string; n: number }>>`
          SELECT ci.store_id::text AS id, COALESCE(NULLIF(s.display_name, ''), NULLIF(sou.display_name, ''), NULLIF(soo.name, ''), 'Store') AS name, count(*)::int AS n
          FROM content_index ci LEFT JOIN store s ON s.id = ci.store_id
          LEFT JOIN users sou ON sou.id = s.owner_user_id LEFT JOIN organizations soo ON soo.id = s.owner_org_id
          WHERE ci.store_id IS NOT NULL AND ${facetBase} GROUP BY 1, 2 ORDER BY n DESC, name`
      : Promise.resolve([] as Array<{ id: string; name: string; n: number }>),
    people
      ? Promise.resolve([] as Array<{ k: string; n: number }>)
      : db<Array<{ k: string; n: number }>>`SELECT ci.sale_state AS k, count(*)::int AS n FROM content_index ci WHERE ci.sale_state IS NOT NULL AND ${facetBase} GROUP BY 1`,
  ]);

  // People facets (v1.3): each dimension under every filter except its own; people view only.
  const peopleFacetsP = people
    ? (() => {
        const common = db`${baseSql} AND ${statusSql} AND ${typeSql}`;
        const count = (col: Frag, except: Frag) =>
          db<Array<{ k: string; n: number }>>`SELECT ${col} AS k, count(*)::int AS n FROM content_index ci
            WHERE ${common} AND ${except} AND ${col} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT 200`;
        const all = pf;
        return Promise.all([
          count(db`ci.entity_type`, db`${all.region} AND ${all.country} AND ${all.city} AND ${all.verified} AND ${pk}`),
          count(db`ci.place_region`, db`${all.entity} AND ${all.country} AND ${all.city} AND ${all.verified} AND ${pk}`),
          count(db`ci.place_country`, db`${all.entity} AND ${all.region} AND ${all.city} AND ${all.verified} AND ${pk}`),
          count(db`ci.place_city`, db`${all.entity} AND ${all.region} AND ${all.country} AND ${all.verified} AND ${pk}`),
          db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM content_index ci
            WHERE ${common} AND ${all.entity} AND ${all.region} AND ${all.country} AND ${all.city} AND ${pk} AND COALESCE(ci.verified, false)`,
          count(kindExpr, db`${all.entity} AND ${all.region} AND ${all.country} AND ${all.city} AND ${all.verified}`),
        ]);
      })()
    : Promise.resolve(null);

  // Offers facets (v1.4): kinds under every filter but offerKinds; paid/free under every filter but priced.
  const offersFacetsP = offers
    ? (() => {
        const common = db`${baseSql} AND ${statusSql} AND ${typeSql} AND ${storeIdSql} AND ${saleSql} AND ${of.upcoming}`;
        return Promise.all([
          db<Array<{ k: string; n: number }>>`SELECT ${offerKindSql()} AS k, count(*)::int AS n FROM content_index ci WHERE ${common} AND ${of.priced} GROUP BY 1 ORDER BY 2 DESC, 1`,
          db<Array<{ paid: number; free: number }>>`SELECT count(*) FILTER (WHERE ${pricedSql()})::int AS paid, count(*) FILTER (WHERE NOT ${pricedSql()})::int AS free
            FROM content_index ci WHERE ${common} AND ${of.kinds}`,
        ]);
      })()
    : Promise.resolve(null);

  const [found, [tf, sf, stf, saf], pfc, ofc] = await Promise.all([rowsP, facetsP, peopleFacetsP, offersFacetsP]);
  const fc = (list: Array<{ k: string; n: number }>): ContentFacetCount[] => list.map((x) => ({ value: x.k, count: x.n }));

  const pageRows = found.slice(0, limit);
  const last = pageRows[pageRows.length - 1];
  const nextCursor = found.length > limit && last ? encodeCursor(sort, last.k1, last.key) : null;

  const { items: byKey, missing, notes } = await hydrateRows(pageRows, { rights, scope, host, now: opts.now ?? new Date(), offers });
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
      ...(pfc
        ? { people: { entityTypes: fc(pfc[0]), listingKinds: fc(pfc[5]), regions: fc(pfc[1]), countries: fc(pfc[2]), cities: fc(pfc[3]), verified: pfc[4][0]?.n ?? 0 } }
        : {}),
      ...(ofc ? { offers: { kinds: fc(ofc[0]), priced: { paid: ofc[1][0]?.paid ?? 0, free: ofc[1][0]?.free ?? 0 } } } : {}),
    },
    missing,
    notes,
  };
}

/**
 * Resolve stored references at render time (CONTRACT s11.7): for each key, the current hydrated item, or
 * `{ key, gone: true }` when it is unpublished, hidden, deleted, or no longer readable by this viewer. One
 * indexed query over content_index (rights predicate, no scope), then hydration of the survivors. Result
 * order follows `keys`; duplicates and malformed keys resolve like missing ones. At most 200 keys.
 *
 * `opts.offers` (checkout only, 2026-11-27): also let a `service` row resolve, under the same rights as any thread
 * (published, public, not hidden for a stranger). Without it a service is "gone", as for every other caller
 * (the /resolve route, MCP): contentReadSql's `ci.type <> 'service'` stays on for them.
 */
export async function resolveContentRefs(
  viewer: ContentViewer | null,
  keys: string[],
  host: ContentHost,
  opts: { rights?: ContentRights; now?: Date; noDrain?: boolean; offers?: boolean } = {}
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
      WHERE ci.key = ANY(${wanted}::text[]) AND ${contentReadSql(rights, null, host, { offers: opts.offers === true })}`;
  }
  const { items, missing } = await hydrateRows(found, { rights, scope: { kind: "site" }, host, now: opts.now ?? new Date() });
  const results = keys.map((key): ContentRefResult => items.get(key) ?? { key, gone: true });
  return { results, missing };
}
