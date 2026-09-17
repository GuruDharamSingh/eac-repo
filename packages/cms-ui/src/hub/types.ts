import type {
  SurfaceDescriptor,
  SurfaceEvent,
  SurfaceKind,
  SurfaceMaterial,
} from "../surface";

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
    /**
     * Optional because this type only ever needed to COUNT cards, and a host
     * passing a shape it had already computed should not have to add a field
     * to satisfy a tile. The quick-add in PipelineFace needs it to file a
     * card into a list, and simply does not render when it is absent — a
     * board whose stacks carry no id is one this face cannot write to, which
     * is the honest reading either way. `OrgDeckBoard` supplies it.
     */
    id?: string | number;
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

// ── The standing meeting's opt-in parts ─────────────────────────────────────
// Everything below is switched on by a host passing it and is absent
// otherwise. The face is shared by three sites; a new behaviour that arrived
// by default would be changing two products that never asked for it.

/**
 * One answer on offer to "Will you make it?".
 *
 * `status` is what it COMMITS to — one of the statuses `thread_rsvps` already
 * allows — and `key` is the nuance stored beside it (migration 130). An early
 * yes and a certain yes are both a yes and are both counted as one; the
 * difference is a sentence, not a number. Structurally the `RsvpFlavour` of
 * @elkdonis/services, so a host passes those straight through.
 */
export interface RsvpFlavourOption {
  key: string;
  label: string;
  note?: string;
  status: "yes" | "no";
}

export interface StandingMeetingAttendance {
  /** What is on offer, firmest first. Defaults to the shared six. */
  options?: RsvpFlavourOption[];
  /** What this viewer has already said, when they have said anything. */
  answered?: { status?: string | null; flavour?: string | null } | null;
  /**
   * POST `{threadId, flavour}` to answer, `{threadId, clear:true}` to take it
   * back. May answer `{light}` with the recomputed light, since an answer can
   * be the one that meets the minimum.
   * Defaults to `/api/hub/meeting/attendance`.
   */
  endpoint?: string;
}

export interface StandingMeetingLight {
  state: "green" | "yellow" | "red";
  /**
   * Why, in words, and never optional: the dot is a non-text indicator, so
   * something has to say what it means for anyone who cannot see the colour.
   */
  reason: string;
  /** `host` — a guide said so; `derived` — from the attendance minimum. */
  source?: "host" | "derived" | "default";
  /**
   * Whether an editor may change it here. Defaults to true, gated by the
   * face's own `canEdit` — pass false to show the light read-only even to
   * owners.
   */
  canSet?: boolean;
  /**
   * POST `{threadId, state, note, occurrence}`, or `{threadId, clear:true}`.
   * Defaults to `/api/hub/meeting/light`.
   */
  endpoint?: string;
}

export interface StandingMeetingHistory {
  /**
   * GET `?threadId=&before=` → `{ occurrence }` or `{ occurrence: null }`.
   * Defaults to `/api/hub/meeting/history`.
   */
  endpoint?: string;
}

/**
 * An occurrence the arrow has paged back to. Structurally the
 * `PastMeetingOccurrence` of @elkdonis/services.
 */
export interface StandingMeetingPast {
  threadId: string;
  title: string;
  kind: string;
  /** ISO — the occurrence, not the series' first date. */
  at: string;
  /** An earlier occurrence of the same series, rather than another thread. */
  sameSeries: boolean;
  materials: SurfaceMaterial[];
}
