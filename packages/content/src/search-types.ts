// ============================================================================
// @elkdonis/content: the search query and result types (CONTRACT.md §3, §10).
// Browser-safe: types only, no database import, so a UI may import them
// without pulling in the server.
// ============================================================================

import type { ContentListingKind, ContentListItem, ContentOfferKind, ContentStatus, ContentType, ContentView } from "./model";

export type ContentScope =
  | { kind: "mine"; /** Also the pieces of orgs the viewer owns or guides (not "oad"), whoever wrote them; the manager rule still applies. */ includeManagedOrgs?: boolean } // the viewer plus every live pseudonym (getIdentityIds)
  | { kind: "org"; orgId: string }         // one org's pieces
  | { kind: "site" }                       // what the host's site covers (ContentHost.site)
  | { kind: "person"; userId: string }   // one person's work under the normal rights predicate (v1.2 s11.2); open to signed-out visitors
  | { kind: "network" };                   // public, published only; the only scope open to signed-out visitors

/** v1.3 adds "listed": the directory order (verified, then vouches, then name); people view only, else it reads as "recent". */
export type ContentSort = "recent" | "next" | "title" | "relevance" | "listed";

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
  // ── v1.3 (CONTRACT §15): people view filters; ignored in every other view ──
  /** Exact match on the identity's city, region or country. */
  city?: string;
  region?: string;
  country?: string;
  entityTypes?: Array<"person" | "organization">;
  verified?: boolean;
  /** v1.3 §16: artist | organization (org-user) | associated. Derived in the query, people view only. */
  listingKinds?: ContentListingKind[];
  // ── v1.4 (CONTRACT §16 revised): offers view filters; ignored in every other view ──
  /** Offer kinds to keep (meetings count as "event"). */
  offerKinds?: ContentOfferKind[];
  /** true: only priced offers; false: only unpriced ones. */
  priced?: boolean;
  /** true: only offers with a start after now. */
  upcoming?: boolean;
}

/** v1.3: one facet value and its count. */
export interface ContentFacetCount { value: string; count: number }

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
    /**
     * v1.3, people view only (absent in every other view). Each dimension is counted under every filter of the
     * query except its own, so a region list still shows the other regions while one is chosen.
     */
    people?: {
      entityTypes: ContentFacetCount[];
      /** v1.3 §16: artist, organization, associated. */
      listingKinds?: ContentFacetCount[];
      regions: ContentFacetCount[];
      countries: ContentFacetCount[];
      cities: ContentFacetCount[];
      verified: number;
    };
    /**
     * v1.4, offers view only (absent elsewhere). `kinds` is counted under every filter except offerKinds, `priced`
     * under every filter except `priced`.
     */
    offers?: {
      kinds: ContentFacetCount[];
      priced: { paid: number; free: number };
    };
  };
  /** Sources not read or failed; the UI shows them, never drops them silently. Real failures only. */
  missing: string[];
  /** By-design notes (what this viewer is not given, what is not built). The UI does not show them. */
  notes?: string[];
}
