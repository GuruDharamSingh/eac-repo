// ============================================================================
// @elkdonis/content: the host adapter (CONTRACT.md §6).
//
// Each app supplies one ContentHost: who the viewer is, what its site covers,
// where pieces live and which actions it allows. `defaultHost()` reproduces
// what list.ts hard-coded before hosts existed (the MARKET / ARTDIRECT /
// NETWORK_HOST constants and the relative `/studio?id=` link), so a caller
// that passes no host sees no change.
//
// Browser-safe: no database import. The viewer type is imported as a type only.
// ============================================================================

import type { ContentRef } from "./model";
import type { ContentViewer } from "./server/access";

export type { ContentScope, ContentSort, ContentQuery, ContentSearchResult, ContentSale, ContentSaleState } from "./search-types";

export interface ContentHost {
  /** The session's viewer, or null. */
  viewer(req?: Request): Promise<ContentViewer | null>;
  site: {
    orgId: string; name: string; domain: string; timeZone: string;
    /** Extra orgs or stores the site scope spans (market: stores with org_id='market'). */
    storeOrgIds?: string[];
  };
  urls: {
    piece(ref: ContentRef, item: { orgId: string | null }): string | null;   // the public page on THIS host if it serves it, else the owning site
    studio(ref: ContentRef | null, ctx?: { kind?: string; org?: string }): string | null; // StudioHandoff.href
    manage?(ref: ContentRef): string | null;
    siteHome(orgId: string): string | null;                                   // org_domains, replacing OWN_APP_SITES and the hard-coded constants
    /** v1.3 (CONTRACT §15): a directory identity's public page. A host without it gets null links for people. */
    person?(p: { id: string; slug: string; entityType: "person" | "organization" }): string | null;
  };
  /** Registry action ids the lightbox may offer on this host (e.g. ["artwork-hide","artwork-show"]). */
  actions: string[];
  /** File roots by source key for the folders route (e.g. { mine: users/<f>/, org: <org root> }). */
  fileSources?(viewer: ContentViewer): Promise<Array<{ key: string; label: string; root: string; showPrivate?: boolean }>>;
}

const trimSlash = (u: string) => u.replace(/\/$/, "");

/** The market's public base (was list.ts MARKET). */
export const MARKET_URL = trimSlash((typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ART_AUCTION_URL) || "https://market.arts-collective.com");
/** The artist directory's public base (was list.ts ARTDIRECT). Personal pages and writing live here. */
export const ARTDIRECT_URL = trimSlash((typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ARTDIRECT_URL) || "https://directory.arts-collective.com");
/** The network host name without scheme or path (was list.ts NETWORK_HOST). */
export const NETWORK_HOST = ((typeof process !== "undefined" && process.env?.NEXT_PUBLIC_NETWORK_HOST) || "localhost:3007")
  .trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/\/.*$/, "");

/**
 * Today's behaviour as a host. `viewer` returns null (the caller already has a
 * viewer). `siteHome` returns null: the server resolves org sites from
 * org_domains itself, and falls back to `<slug>.<NETWORK_HOST>` as list.ts did.
 */
export function defaultHost(): ContentHost {
  return {
    viewer: async () => null,
    site: {
      orgId: "elkdonis",
      name: "Arts Collective",
      domain: NETWORK_HOST,
      timeZone: (typeof process !== "undefined" && process.env?.CHANNEL_TIME_ZONE) || "America/Toronto",
    },
    urls: {
      piece: (ref) => (ref.store === "artwork" ? `${MARKET_URL}/artworks/${ref.id}` : null),
      studio: (ref, ctx) => {
        if (!ref) return null;
        if (ref.store === "artwork") return `${MARKET_URL}/studio`;
        if (ref.store === "thread") {
          const org = ctx?.org && ctx.org !== "oad" ? `&org=${encodeURIComponent(ctx.org)}` : "";
          return `/studio?id=${encodeURIComponent(ref.id)}${org}`;
        }
        return null;
      },
      siteHome: () => null,
    },
    actions: [],
  };
}
