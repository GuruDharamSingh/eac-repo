/**
 * Every address on the marketplace, in one place.
 *
 * Art-Auction is a centralised app: it is both the headquarters of the
 * operation and a service the rest of the network calls into. Until now each
 * caller hand-built its own strings — IFAC's hub wrote `${market}/studio`,
 * amrit-canada wrote its own, ArtDirect another — which is how IFAC ended up
 * shipping a bare `/studio/apply` when the base URL it meant to interpolate
 * was never passed through, pointing members at a 404 on IFAC's own domain.
 *
 * A caller now asks for `marketplaceLinks(url, { from })` and gets links that
 * are correct by construction and that tell the marketplace where the person
 * came from, so it can send them back when they are done.
 *
 * Pure string building: safe on the client, on the server, and inside a
 * template renderer.
 */

export interface MarketplaceLinkOptions {
  /**
   * The app the visitor is arriving from, e.g. "ifac" or "amrit_canada".
   * Surfaced as `?from=` so the marketplace can name it ("Back to IFAC") and
   * attribute the referral.
   */
  from?: string | null;
  /**
   * An absolute URL to return to once the errand is finished — applying for a
   * store, adding a piece. Passed as `?next=`.
   */
  returnTo?: string | null;
}

export interface MarketplaceLinks {
  /** The marketplace's front page. */
  home: string;
  /** Everything for sale — the marketplace root, which IS the catalogue. */
  browse: string;
  /** Live auctions. */
  auctions: string;
  /** The seller directory. */
  artists: string;
  /** One piece. */
  artwork(artworkId: string): string;
  /** One seller's public store page, by slug or id. */
  store(handle: string): string;
  /** One auction lot. */
  lot(lotId: string): string;
  /** The seller's own dashboard. Optionally a specific store of theirs. */
  studio(storeId?: string | null): string;
  /** Where a member goes to get a store — apply, or open an org's. */
  openStore: string;
  /** Start a new listing. */
  newListing: string;
  /** The seller's orders. */
  sales: string;
  /** Payouts and balance. */
  payouts: string;
  /** The person's own buying history. */
  myOrders: string;
  cart: string;
}

/**
 * Build the marketplace's links off one base URL.
 *
 * `baseUrl` is the marketplace's origin — `NEXT_PUBLIC_ART_AUCTION_URL` in
 * every app that has adopted it. An empty base produces app-relative links,
 * which is what art-auction itself wants.
 */
export function marketplaceLinks(
  baseUrl: string,
  opts: MarketplaceLinkOptions = {}
): MarketplaceLinks {
  const base = (baseUrl ?? "").replace(/\/+$/, "");
  const params: Array<[string, string]> = [];
  if (opts.from) params.push(["from", opts.from]);
  if (opts.returnTo) params.push(["next", opts.returnTo]);

  const at = (path: string, extra?: Array<[string, string]>): string => {
    const all = extra ? [...params, ...extra] : params;
    if (all.length === 0) return `${base}${path}`;
    const q = all
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    // Split the fragment off first. `/studio#sales` + `?from=ifac` naively
    // concatenated gives `/studio#sales?from=ifac`, where the query is part of
    // the fragment and the server never sees it.
    const hash = path.indexOf("#");
    const route = hash === -1 ? path : path.slice(0, hash);
    const frag = hash === -1 ? "" : path.slice(hash);
    return `${base}${route}${route.includes("?") ? "&" : "?"}${q}${frag}`;
  };

  return {
    home: at("/"),
    // The catalogue is the site root; /artworks still permanently redirects
    // here, but there is no reason to send anyone through the extra hop.
    browse: at("/"),
    auctions: at("/lots"),
    artists: at("/artists"),
    artwork: (id) => at(`/artworks/${encodeURIComponent(id)}`),
    store: (handle) => at(`/artists/${encodeURIComponent(handle)}`),
    lot: (id) => at(`/lots/${encodeURIComponent(id)}`),
    studio: (storeId) =>
      storeId ? at("/studio", [["store", storeId]]) : at("/studio"),
    openStore: at("/studio/apply"),
    newListing: at("/studio/artworks/new"),
    sales: at("/studio/sales"),
    payouts: at("/studio/payouts"),
    myOrders: at("/account"),
    cart: at("/cart"),
  };
}

/**
 * Where a member should be sent when they press "my store" on a host app,
 * given what the network already knows about them.
 *
 * Host apps kept re-deriving this and getting it subtly different: IFAC showed
 * "Open a store" to anyone without one, including people whose application was
 * already pending, and offered no route at all to an org store they help run.
 */
export type StoreEntryState =
  | "none"        // no store, nothing pending — apply
  | "pending"     // applied, under review
  | "rejected"    // declined, may reapply
  | "paused"      // exists but not trading
  | "active";     // trading

export interface StoreEntry {
  href: string;
  label: string;
  /** One line of context for the host app to show under the button. */
  hint: string;
  /** False when the link leads to a status page rather than a working store. */
  ready: boolean;
}

export function storeEntry(
  links: MarketplaceLinks,
  state: StoreEntryState,
  opts: { storeId?: string | null; storeName?: string | null } = {}
): StoreEntry {
  switch (state) {
    case "active":
      return {
        href: links.studio(opts.storeId),
        label: opts.storeName ? `Manage ${opts.storeName}` : "Manage my store",
        hint: "Add work, set prices, run an auction and see your sales.",
        ready: true,
      };
    case "paused":
      return {
        href: links.studio(opts.storeId),
        label: "Reopen my store",
        hint: "Your store is paused, so nothing in it is on sale right now.",
        ready: false,
      };
    case "pending":
      return {
        href: links.openStore,
        label: "Check my application",
        hint: "Your store is being reviewed. We'll email you when it opens.",
        ready: false,
      };
    case "rejected":
      return {
        href: links.openStore,
        label: "Reapply for a store",
        hint: "Your last application was declined. You can apply again.",
        ready: false,
      };
    default:
      return {
        href: links.openStore,
        label: "Open a store",
        hint: "Sell original work across the network. You are paid directly.",
        ready: false,
      };
  }
}
