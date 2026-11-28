// ============================================================================
// Offer surfaces: the shared contract between the free-tier page, the surface
// kit, content-library checkout and the offers view (2026-11-27).
//
// Design: docs/open/OFFER_SURFACES_2026-11-27.md (the handoff README from
// "Single page publication template mockups"). Types only: browser-safe, no
// imports from server code. Not exported from package.json until the kit's
// implementation exists (the export lands last, so the tree stays green).
// ============================================================================

/** The kinds a single-page site can feature and open as surfaces. */
export type OfferKind = "event" | "service" | "series" | "artwork" | "writing";

/** How a visitor takes an offer up. Derived on the server from the offer's row. */
export type TakeUp =
  | "rsvp"      // free RSVP (may make the visitor a follower of the org)
  | "pay"       // priced: pay through content-library checkout
  | "order"     // artwork: delivery choice, then pay
  | "subscribe" // series
  | "enquire"   // no price and no RSVP: contact the host
  | "none";

export interface Money {
  /** Minor units (cents). */
  amountMinor: number;
  /** ISO 4217, upper case. */
  currency: string;
}

export interface SurfaceOffer {
  /** Content key: `thread:<id>` or `artwork:<id>`. */
  key: string;
  kind: OfferKind;
  title: string;
  standfirst?: string | null;
  /** Sanitised HTML or plain text. */
  description?: string | null;
  poster?: string | null;
  images?: string[];
  /** ISO times; tz is an IANA zone. */
  when?: { start: string; end?: string | null; timeZone?: string | null } | null;
  venue?: { name?: string | null; address?: string | null; online?: boolean } | null;
  price?: Money | null;
  /** Pay-what-you-can range, minor units. */
  sliding?: { minMinor: number; maxMinor: number; stepMinor?: number } | null;
  takeUp: TakeUp;
  capacity?: { limit: number | null; coming: number } | null;
  tags?: string[];
  /** Service: up to three open times offered to pick from. */
  slots?: Array<{ id: string; start: string; label?: string }>;
  durationMinutes?: number | null;
  /** Artwork details. */
  artwork?: { medium?: string | null; size?: string | null; edition?: string | null; shipping?: Money | null; collect?: boolean } | null;
  /** Who hosts or made it (opens their profile layer). */
  hostId: string;
  /** Others hosting with them: each name opens that person's profile layer (and the hover card on desktop). */
  coHostIds?: string[];
  /** Public page of this offer, when it has one ("Go to its page"). */
  href?: string | null;
  /** True for the site's one featured offer. */
  featured?: boolean;
}

export interface SurfaceProfile {
  /** users.id of the public identity (an artist, an org-user or an associated business). */
  id: string;
  name: string;
  role?: string | null;
  bio?: string | null;
  portrait?: string | null;
  links?: Array<{ label: string; href: string }>;
  followers?: number | null;
  /** The viewer already follows (null when signed out or unknown). */
  following?: boolean | null;
  /** The identity's own site, when it is not this one. */
  siteHref?: string | null;
  /** ArtDirect page. */
  directoryHref?: string | null;
}

export interface SurfaceWritingPiece {
  key: string;
  title: string;
  standfirst?: string | null;
  cover?: string | null;
  href?: string | null;
  minutes?: number | null;
}

/** Everything one single-page site needs to draw its page and surfaces. */
export interface SurfaceSiteData {
  site: { orgId: string; slug: string; name: string; origin: string };
  owner: SurfaceProfile;
  featured: SurfaceOffer | null;
  offers: SurfaceOffer[];
  writing: SurfaceWritingPiece[];
  people: Record<string, SurfaceProfile>;
  viewer: { signedIn: boolean; name?: string | null; email?: string | null } | null;
  look: SurfaceLook;
}

/** Site-level look settings, chosen in the hub by owners and guides. */
export interface SurfaceLook {
  /** Font template (handoff "Type"). */
  font: "para" | "gazette" | "quiet" | "marquee" | "ledger" | "rite";
  icons: "things" | "marks" | "stamps" | "glyph";
  /** Phone head mark. */
  mark: "inline" | "thumb" | "box";
  /** Kind colours on or off. */
  tint: boolean;
  /**
   * Phone sheet height (additive, default "natural"). "natural": each sheet takes the height it needs
   * (the packet). "level": the sheet keeps one high, level top edge while layers change inside it.
   * Reaches the root as `data-sheet`; the CSS is in offer.css.
   */
  sheet?: "natural" | "level";
}

export const DEFAULT_LOOK: SurfaceLook = { font: "para", icons: "things", mark: "inline", tint: true };

/** Results the surfaces' actions return. */
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; loginHref?: string };

/**
 * What the host page gives the surfaces to act. Each is a plain fetch to a
 * route on the host; rights always come from the session or the checkout, never
 * from these arguments.
 */
export interface SurfaceActions {
  /** Free RSVP. `follows` names the org the visitor now follows, when an RSVP made them a follower. */
  rsvp(offerKey: string, input: { going: boolean; name?: string; email?: string; remind?: boolean }): Promise<ActionResult<{ follows?: string | null }>>;
  follow(profileId: string, input: { follow: boolean; email?: string }): Promise<ActionResult<{ following: boolean }>>;
  /**
   * Start checkout for a priced offer through the content library
   * (POST /api/content/checkout). Returns Stripe's hosted URL; the surface
   * navigates there, and the return lands on `returnTo` with the done layer.
   */
  checkout(input: CheckoutRequest): Promise<ActionResult<{ url: string }>>;
  /**
   * The one quick sign-up (layer `join`; Decision 14: RSVP, Follow, Subscribe and Talk posts need an account).
   * Creates the account. `signedIn` says a session exists now; `confirm` says the email must be confirmed
   * first (no session yet). `returnTo` is the page address with the layer the visitor came from open, for a
   * host whose confirmation link needs somewhere to land. Optional: a host without it keeps the sign-in link.
   */
  join?(input: { name: string; email: string; password: string; turnstileToken?: string; returnTo?: string }): Promise<ActionResult<{ signedIn: boolean; confirm?: boolean }>>;
  /** "I have an account" on the `join` layer: email and password. Optional like `join`. */
  signIn?(input: { email: string; password: string }): Promise<ActionResult<{ signedIn: boolean }>>;
}

/** Body of POST /api/content/checkout (content library, CONTRACT v1.4). */
export interface CheckoutRequest {
  key: string;
  quantity?: number;
  /** Pay-what-you-can amount, minor units, within the offer's sliding range. */
  amountMinor?: number;
  slotId?: string;
  /** Artwork: ship or collect. */
  delivery?: "ship" | "collect";
  address?: string;
  email?: string;
  /** Absolute URL on the calling site to come back to; the server checks its host. */
  returnTo: string;
}
