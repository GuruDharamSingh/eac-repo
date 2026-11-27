// ============================================================================
// @elkdonis/content: the search query and result types (CONTRACT.md §3, §10).
// Browser-safe: types only, no database import, so a UI may import them
// without pulling in the server.
// ============================================================================

import type { ContentListItem, ContentStatus, ContentType, ContentView } from "./model";

export type ContentScope =
  | { kind: "mine" }                       // the viewer plus every live pseudonym (getIdentityIds)
  | { kind: "org"; orgId: string }         // one org's pieces
  | { kind: "site" }                       // what the host's site covers (ContentHost.site)
  | { kind: "person"; userId: string }   // one person's work under the normal rights predicate (v1.2 s11.2); open to signed-out visitors
  | { kind: "network" };                   // public, published only; the only scope open to signed-out visitors

export type ContentSort = "recent" | "next" | "title" | "relevance";

/** Where an artwork stands commercially (CONTRACT §10.2). */
export type ContentSaleState = "for_sale" | "in_auction" | "sold" | "reserved" | "passed" | "withdrawn" | "not_for_sale";

export interface ContentSale {
  state: ContentSaleState;
  price: string | null;
}

export interface ContentQuery {
  q?: string;                               // websearch_to_tsquery plus trigram on title; empty means browse
  scope: ContentScope;
  view?: ContentView;                       // default "published"
  types?: ContentType[];
  statuses?: ContentStatus[];               // default: draft, scheduled, live, published (archived only when asked)
  seriesId?: string;
  sort?: ContentSort;                       // default "relevance" when q is set, else "recent"
  cursor?: string | null;                   // opaque keyset cursor; never an offset
  limit?: number;                           // default 40, max 100
  // ── v1.1 (CONTRACT §10) ──
  /** Artwork by store (index column store_id). */
  storeIds?: string[];
  saleStates?: ContentSaleState[];
  /** Keepers only: also return hidden rows. Checked against rights on the server; ignored otherwise. */
  includeHidden?: boolean;
}

/** What resolveContentRefs returns per key (CONTRACT s11.7). */
export type ContentRefResult = ContentListItem | { key: string; gone: true };

export interface ContentSearchResult {
  /** Items carry `sale` (artwork) and `hidden` (keepers only), both optional on ContentListItem. */
  items: ContentListItem[];
  nextCursor: string | null;
  /** Counts under the SAME rights predicate as `items` (never leaks hidden or private rows). */
  facets: {
    types: Partial<Record<ContentType, number>>;
    statuses: Partial<Record<ContentStatus, number>>;
    /** Site and org scopes only; empty elsewhere. */
    stores: Array<{ id: string; name: string; count: number }>;
    sale: Partial<Record<ContentSaleState, number>>;
  };
  /** Sources not read or failed; the UI shows them, never drops them silently. */
  missing: string[];
}
