import type { SurfaceDescriptor, SurfaceEvent, SurfaceKind } from "../surface";

// ============================================================================
// Hub types.
//
// Declared HERE rather than imported from @elkdonis/services, for the same
// reason center/layout.ts re-declares CenterLayout: this package stays free
// of the data layer so it can be dropped into any host. Every shape below is
// STRUCTURAL, so a host passes the services object straight in with no
// adapter — `OrgCalendarEvent` already satisfies `SurfaceEvent`, and
// `OrgDeckBoard` already satisfies `HubPipelineBoard`.
// ============================================================================

/**
 * The standing gathering.
 *
 * `SurfaceEvent` is otherwise identical to the services `OrgCalendarEvent`,
 * but lacks `isRsvpEnabled` — which this face needs to decide whether "N
 * coming" is a true statement or a fabricated one — so it is intersected in
 * rather than added to the shared event type, which other surfaces rely on.
 */
export interface HubStandingMeeting {
  event: SurfaceEvent & { isRsvpEnabled: boolean };
  /** The occurrence a member is looking at now, not the series' first date. */
  at: Date;
  /**
   * Why this one is showing. `flagged` = an editor chose it; `weekly` =
   * inferred from a weekly series; `next` = simply the soonest thing coming
   * up. Only the first two may honestly be called "the weekly meeting".
   */
  source: "flagged" | "weekly" | "next";
}

/**
 * Just enough of a Deck board to draw it at tile size. Narrower than the
 * services `OrgDeckBoard` on purpose: the face reads four fields, so those
 * are the four it asks for.
 */
export interface HubPipelineBoard {
  title: string;
  stacks: Array<{
    title: string;
    cards?: Array<{ done?: boolean | null; archived?: boolean | null }> | null;
  }>;
}

/**
 * A hub tile, as data.
 *
 * A tile resolves its click one of two ways — `surface` opens a popup in the
 * shared dialog, `href` navigates for a feature whose depth is a page.
 */
export type HubCard = {
  id: string;
  title: string;
  blurb: string;
  kind: SurfaceKind;
  glyph?: string;
  href?: string;
  surface?: SurfaceDescriptor;
  /**
   * Whether this host actually has the feature. An unavailable tile renders
   * muted with no target, so the hub's full shape stays visible while the
   * rest is built — deliberately NOT a "Coming soon" button, which reads as
   * a thing you can press.
   */
  available: boolean;
  /** Hidden from anyone without canEdit. */
  adminOnly?: boolean;
  /** Renders full-width. */
  wide?: boolean;
};

/**
 * Who is signed in, at tile size.
 *
 * Deliberately not the whole `SurfaceProfile`: the face needs a portrait, a
 * name and what is waiting — and a hub page that had to load and serialise an
 * entire profile (bio, links, edit rights) to draw four words would be paying
 * for the surface twice. The surface loads the full record when it opens.
 */
export interface HubProfileSummary {
  displayName: string;
  avatarUrl?: string | null;
  headline?: string | null;
  /** Defaults to true; set false to hide the Edit door. */
  canEdit?: boolean;
  alerts?: {
    unreadMessages?: number;
    notifications?: number;
    upcoming?: number;
  };
}
