// ============================================================================
// @elkdonis/content: ContentQuery <-> query string (CONTRACT.md §5).
// Browser-safe: no database import. The route parses with parseContentQuery; the card's remote source
// (and any client) serialises with contentQueryParams, so the two cannot drift.
//
//   ?q=&scope=mine|org:<id>|site|network&view=&types=a,b&statuses=&series=&sort=&cursor=&limit=
//   v1.1: &stores=a,b&sale=a,b&hidden=1
//
// Parsing is lenient about junk (an unknown word is dropped) and never throws. Rights are NOT in here:
// the viewer comes from the session, and `hidden=1` is only a request the server checks against rights.
// ============================================================================

import type { ContentStatus, ContentType, ContentView } from "./model";
import type { ContentQuery, ContentSaleState, ContentScope, ContentSort } from "./search-types";

const TYPES: readonly ContentType[] = [
  "artwork", "product", "writing", "video", "series", "meeting", "event", "workshop", "questionnaire", "poll",
  "image", "audio", "document", "file",
];
const STATUSES: readonly ContentStatus[] = ["draft", "scheduled", "live", "published", "archived"];
const VIEWS: readonly ContentView[] = ["published", "files", "all"];
const SORTS: readonly ContentSort[] = ["recent", "next", "title", "relevance"];
const SALE: readonly ContentSaleState[] = ["for_sale", "in_auction", "sold", "reserved", "passed", "withdrawn", "not_for_sale"];

const pick = <T extends string>(raw: string | null, allowed: readonly T[]): T[] | undefined => {
  if (!raw) return undefined;
  const out = raw.split(",").map((s) => s.trim()).filter((s): s is T => (allowed as readonly string[]).includes(s));
  return out.length ? out : undefined;
};
const one = <T extends string>(raw: string | null, allowed: readonly T[]): T | undefined =>
  raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;

/** "mine" | "site" | "network" | "org:<id>". Anything else is null. */
export function parseScope(raw: string | null): ContentScope | null {
  if (!raw) return null;
  if (raw === "mine" || raw === "site" || raw === "network") return { kind: raw };
  if (raw.startsWith("org:") && raw.length > 4 && raw.length <= 80) return { kind: "org", orgId: raw.slice(4) };
  // v1.2 (CONTRACT 11): another person's public work. Written against the contract; A adds the variant to search-types.ts.
  if (raw.startsWith("person:") && raw.length > 7 && raw.length <= 80) return { kind: "person", userId: raw.slice(7) } as ContentScope;
  return null;
}

export function scopeParam(s: ContentScope): string {
  const x = s as { kind: string; orgId?: string; userId?: string };
  return x.kind === "org" ? `org:${x.orgId}` : x.kind === "person" ? `person:${x.userId}` : x.kind;
}

/** A ContentQuery from the request's query string. `scope` is required: a missing or unknown one is `null`. */
export function parseContentQuery(sp: URLSearchParams): ContentQuery | null {
  const scope = parseScope(sp.get("scope"));
  if (!scope) return null;
  const q = sp.get("q")?.trim().slice(0, 200);
  const limit = Number(sp.get("limit"));
  const cursor = sp.get("cursor");
  const out: ContentQuery = { scope };
  if (q) out.q = q;
  const view = one(sp.get("view"), VIEWS);
  if (view) out.view = view;
  const types = pick(sp.get("types"), TYPES);
  if (types) out.types = types;
  const statuses = pick(sp.get("statuses"), STATUSES);
  if (statuses) out.statuses = statuses;
  const series = sp.get("series");
  if (series && series.length <= 80) out.seriesId = series;
  const sort = one(sp.get("sort"), SORTS);
  if (sort) out.sort = sort;
  if (cursor && cursor.length <= 512) out.cursor = cursor;
  if (Number.isFinite(limit) && limit > 0) out.limit = Math.min(100, Math.floor(limit));
  const stores = sp.get("stores")?.split(",").map((s) => s.trim()).filter((s) => s && s.length <= 80).slice(0, 50);
  if (stores?.length) out.storeIds = stores;
  const sale = pick(sp.get("sale"), SALE);
  if (sale) out.saleStates = sale;
  if (sp.get("hidden") === "1") out.includeHidden = true;
  return out;
}

/** The query as URL params (the inverse of parseContentQuery). */
export function contentQueryParams(q: ContentQuery): URLSearchParams {
  const p = new URLSearchParams();
  p.set("scope", scopeParam(q.scope));
  if (q.q) p.set("q", q.q);
  if (q.view) p.set("view", q.view);
  if (q.types?.length) p.set("types", q.types.join(","));
  if (q.statuses?.length) p.set("statuses", q.statuses.join(","));
  if (q.seriesId) p.set("series", q.seriesId);
  if (q.sort) p.set("sort", q.sort);
  if (q.cursor) p.set("cursor", q.cursor);
  if (q.limit) p.set("limit", String(q.limit));
  if (q.storeIds?.length) p.set("stores", q.storeIds.join(","));
  if (q.saleStates?.length) p.set("sale", q.saleStates.join(","));
  if (q.includeHidden) p.set("hidden", "1");
  return p;
}
