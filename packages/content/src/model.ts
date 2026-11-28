// ============================================================================
// @elkdonis/content/model: the content detail model (the item's "passport").
// Pure types and helpers, browser-safe: no db, no next/*, no React.
// docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md §3 "Contract".
//
// Pass 1 (2026-11-08): the model is filled client-side from Channel's
// already-loaded Piece (apps/arts-collective/src/lib/channel/content-detail.ts).
// Pass 2 fills the same shape server-side with loadContentDetail.
// ============================================================================

// Type-only import; search-types imports this file back (types only, no runtime cycle).
import type { ContentSale } from "./search-types";

/** Which table an item lives in. Kept apart from ContentType (how it is shown). */
/** v1 (2026-11-26, docs/open/CONTENT_CORNERSTONE_2026-11-26/CONTRACT.md §1) adds "file". */
/** v1.3 (2026-11-26, CONTRACT §15) adds "person": a directory identity (migration 298). */
export type ContentStore = "thread" | "artwork" | "file" | "person";

export interface ContentRef {
  store: ContentStore;
  id: string;
}

/** How an item is shown. Pass 1: Channel's piece kinds, one to one. */
export type ContentType =
  | "artwork" | "product" | "writing" | "video" | "series" | "meeting" | "event" | "workshop" | "questionnaire" | "poll"
  // v1 (CONTRACT.md §2): file families. A video file is type "video" with store "file".
  | "image" | "audio" | "document" | "file"
  // v1.3 (CONTRACT §15): a directory identity, store "person". Its entity type (person | organization) is item.person.entityType.
  | "person"
  // v1.4 (CONTRACT §16 revised): a bookable service thread. Read only through the "offers" view; published/all/people never return one.
  | "service";

/** The library's Published | Files | All toggle (CONTRACT.md §2). published = thread + artwork, files = file. */
/** v1.3 (CONTRACT §15) adds "people": the directory (store person). published, files and all never include people. */
/** v1.4 adds "offers": paid or RSVP work (store thread + artwork) with `item.offer`; the only view that returns type "service". */
export type ContentView = "published" | "files" | "all" | "people" | "offers";

/** Every outlet an item can go to (Channel's Outlet). */
export type ContentOutlet =
  | "site"
  | "page"
  | "market"
  | "instagram"
  | "facebook"
  | "threads"
  | "youtube"
  | "video"
  | "writing"
  | "live"
  | "newsletter";

/** State of a timeline event. "empty" exists only on coverage cells. */
export type ContentState = "published" | "scheduled" | "live" | "draft" | "failed" | "suggested" | "info";
export type ContentCellState = ContentState | "empty";

export type ContentLane = "site" | "social" | "email" | "video" | "writing" | "live" | "market" | "dates" | "plan" | "edit" | "comment";

export type ContentEventSource =
  | "thread"
  | "share"
  | "delivery"
  | "publish_job"
  | "email"
  | "plan_event"
  | "action_event"
  | "revision"
  | "content_event"
  | "comment"
  | "session"
  | "provenance"
  | "lineage"
  | "suggestion";

export interface ContentEvent {
  id: string;
  at: string;
  lane: ContentLane;
  source: ContentEventSource;
  /** published | shared | scheduled | failed | draft | ... */
  verb: string;
  /** The outlet whose mark the row shows (not in the first contract; the timeline draws it). */
  outlet: ContentOutlet;
  label: string;
  sub: string;
  state: ContentState;
  actor?: { kind: "person" | "agent" | "system"; name?: string };
  identityId?: string | null;
  href?: string | null;
  refs?: { deliveryId?: string; planEventId?: number; jobId?: number };
}

/** A person or an org an item is owned by, presented by, or went out under. */
export interface ContentIdentity {
  /** `user:<uuid>` or `org:<org id>`. */
  id: string;
  kind: "user" | "org";
  name: string;
  /** "You" for the viewer, the org's short name otherwise. */
  shortName: string;
  initials: string;
  avatarUrl?: string | null;
}

/** Something the board suggests doing next with the item. */
export interface ContentSuggestion {
  /** Stable: `<key>|<outlet>|<identityId>`. */
  id: string;
  outlet: ContentOutlet;
  identityId: string;
  /** Chip text: "+ Share", "+ Quote card". */
  chip: string;
  /** Sentence: "Post Salt Marsh to Instagram". */
  text: string;
  /** Why here and now. */
  reason: string;
  at: string | null;
}

// ── panels ─────────────────────────────────────────────────────────────────

export interface ContentCoverageCell {
  state: ContentCellState;
  at: string | null;
  /** What the board suggests for an empty cell. */
  suggestion: ContentSuggestion | null;
}

export interface ContentCoverageColumn {
  id: string;
  outlet: ContentOutlet;
  label: string;
}

export interface ContentCoveragePanel {
  columns: ContentCoverageColumn[];
  rows: Array<{ identityId: string; cells: Record<string, ContentCoverageCell> }>;
}

export interface ContentPlan {
  id: string;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
  updatedByActor: "user" | "agent";
  updatedByViewer: boolean;
}

export interface ContentPlanPanel {
  /** False until the planning tables exist (migration 252): plan writes are off. */
  ready: boolean;
  plan: ContentPlan | null;
  /** The board's waiting suggestions, in order. */
  suggestions: ContentSuggestion[];
}

export interface ContentPanelDataMap {
  coverage: ContentCoveragePanel;
  plan: ContentPlanPanel;
}
export type ContentPanelId = keyof ContentPanelDataMap;
export type ContentPanelData = { [I in ContentPanelId]: { id: I; data: ContentPanelDataMap[I] } }[ContentPanelId];

export interface ContentDetailModel {
  ref: ContentRef;
  /** `<store>:<id>`. */
  key: string;
  type: ContentType;
  title: string;
  /** "Oil on linen · 60 × 90 cm · $2,400" */
  meta: string;
  excerpt: string;
  media: { cover: string | null; images?: string[]; video?: string | null };
  status: { value: string; label: string };
  owner: ContentIdentity | null;
  presentedBy: ContentIdentity | null;
  site: { name: string; host: string | null; url: string | null };
  dates: { created: string; updated: string | null; published: string | null; next: string | null };
  /** compose = "New post about this" (not in the first contract; Channel's masthead has it). */
  links: { public: string | null; studio: string | null; board: string | null; manage: string | null; compose: string | null };
  can: { edit: boolean; plan: boolean; deliver: boolean; publish: boolean; archive: boolean };
  /** One list, past and ahead, sorted. */
  timeline: ContentEvent[];
  panels: ContentPanelData[];
  identities: ContentIdentity[];
  /** Sources that failed or tables absent: shown, never silently dropped. */
  missing: string[];
  timeZone: string;
  now: string;
}

// ── list items (the library, the recent rows, the lightbox) ────────────────

/** What a row, a brick or a chip says about where a piece stands. */
export type ContentStatus = "draft" | "scheduled" | "live" | "published" | "archived";

/** One outlet mark on a brick or in the lightbox: coloured by state. */
export interface ContentMark {
  outlet: ContentOutlet;
  state: ContentCellState;
  /** "Instagram": the mark's accessible name. */
  label: string;
}

/**
 * One piece as the library lists it: just enough for a brick, a row and the
 * lightbox. Not the passport (ContentDetailModel); the host fills one per
 * piece from whatever it already loaded, and the piece view loads the rest.
 */
export interface ContentListItem {
  /** `<store>:<id>`. */
  key: string;
  type: ContentType;
  title: string;
  /** "Oil on linen · 60 × 90 cm · $2,400" */
  meta: string;
  excerpt: string;
  cover: string | null;
  status: ContentStatus;
  /** Shown on the chip when the plain word is not enough ("Goes live Sun"). */
  statusNote?: string | null;
  /** The identity whose site it lives on: the library's grouping and scope. */
  siteIdentityId: string;
  siteName: string;
  siteHost: string | null;
  ownerIdentityId: string | null;
  series: { id: string; name: string } | null;
  createdAt: string;
  /** The date the row shows: the next one ahead, otherwise the last change. */
  date: string | null;
  marks: ContentMark[];
  /** The brick's last line: "In motion · Goes live Sun 2 PM" or "Quiet since Sep 30". */
  note: { text: string; motion: boolean } | null;
  /** Newest last. The lightbox shows the last four. */
  timeline: ContentEvent[];
  links: { public: string | null; studio: string | null; manage?: string | null };
  // ── v1 additions (CONTRACT.md §3), all optional so existing producers stay valid ──
  /** Filled by searchContent; derive from `key` when absent. */
  store?: ContentStore;
  /** Files only: where it sits. */
  file?: { source: string; path: string; mime: string | null; size: number | null; folder: string } | null;
  /** From the server only, never inferred client-side; the host's action allow-list narrows it further. */
  can?: { edit: boolean; hide: boolean; publish: boolean; archive: boolean; pick: boolean };
  /** v1.1 (CONTRACT.md §10.2): artwork sale state and price. */
  sale?: ContentSale | null;
  /** v1.1: hidden by a keeper. Sent to keepers only; the server decides. */
  hidden?: boolean;
  /** v1.1 (CONTRACT.md §10.10): the market store an artwork is listed in, for groupBy "store". Not `store` (that is the table). */
  storefront?: { id: string; name: string } | null;
  /** v1.2 (CONTRACT.md §11.4): the piece's public images, cover first, so a picker can take one image of it. */
  images?: string[];
  /** v1.2 (CONTRACT.md §11.3): the owner's public display name for attribution ("Photo: <ownerName> · <siteName>"). */
  ownerName?: string | null;
  /** v1.3 (CONTRACT §15): a directory identity's public card. Store "person" only. Never an email, never the account behind a pseudonym. */
  person?: ContentPerson | null;
  /** v1.4 (CONTRACT §16 revised): filled in the "offers" view only. How a visitor takes the offer up; never any money logic. */
  offer?: ContentOffer;
}

/** v1.4: the offers view's kinds. Meetings read as "event". */
export type ContentOfferKind = "event" | "service" | "series" | "artwork" | "workshop";

/** v1.4: how a visitor takes an offer up. The string values equal cms-ui's offer-surface TakeUp (types.ts); kept identical by hand. */
export type ContentTakeUp = "rsvp" | "pay" | "order" | "subscribe" | "enquire" | "none";

/** v1.4: what the offers view says about one offer. Prices are stored list prices in minor units. */
export interface ContentOffer {
  kind: ContentOfferKind;
  price: { amountMinor: number; currency: string } | null;
  /** Pay-what-you-can range in minor units (a workshop with a floor below its list price). */
  sliding?: { minMinor: number; maxMinor: number };
  takeUp: ContentTakeUp;
  /** True when takeUp is pay/order, card payments are on, and the payee has a payout route (checkout's bookingAvailability test). */
  checkout: boolean;
  /** Start of the next session or event; null for a service or an artwork. */
  when: { start: string } | null;
  /** Places and RSVPs so far; null when the offer has neither a limit nor RSVP. */
  capacity: { limit: number | null; coming: number } | null;
}

/** v1.3 §16 (Justin, 2026-11-27): the directory's three kinds of listing. */
export type ContentListingKind = "artist" | "organization" | "associated";

/** v1.3: what the directory shows for one public identity (users row with a slug, directory_listed). */
export interface ContentPerson {
  slug: string;
  entityType: "person" | "organization";
  /** v1.3 §16: artist; organization (an org-user: some organizations.profile_user_id); associated (a business or place with no org). */
  listingKind?: ContentListingKind;
  headline: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  /** oad_dossier.location, the directory's free-text place line. */
  location: string | null;
  verified: boolean;
  vouches: number;
  claimStatus: "unclaimed" | "pending" | "claimed";
}

// ── helpers ────────────────────────────────────────────────────────────────

export function contentKey(ref: ContentRef): string {
  return `${ref.store}:${ref.id}`;
}

export function parseContentKey(key: string): ContentRef | null {
  const i = key.indexOf(":");
  if (i <= 0) return null;
  const store = key.slice(0, i);
  const id = key.slice(i + 1);
  if ((store !== "thread" && store !== "artwork" && store !== "file") || !id) return null;
  return { store, id };
}

export function panelOf<I extends ContentPanelId>(model: Pick<ContentDetailModel, "panels">, id: I): ContentPanelDataMap[I] | null {
  const p = model.panels.find((x) => x.id === id);
  return p ? (p.data as ContentPanelDataMap[I]) : null;
}

/** "Nov 8" in the item's time zone. */
export function fmtDay(at: string | null | undefined, timeZone: string): string {
  if (!at) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(new Date(at));
}

/** "Sat, Nov 8" in the item's time zone. */
export function fmtDayLong(at: string | null | undefined, timeZone: string): string {
  if (!at) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(new Date(at));
}

export interface TimelineGroups {
  /** Scheduled or live, and still to come. Soonest first. */
  ahead: ContentEvent[];
  /** Live now, or within the last 24 hours. Newest first. */
  now: ContentEvent[];
  /** Everything else. Newest first. */
  past: ContentEvent[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Splits a timeline into Ahead / Now / Past around `now` (an ISO string, a Date
 * or epoch ms). Pure; the input is not changed.
 *  - Ahead: `at` is after now and the state is scheduled or live.
 *  - Now: the state is live, or `at` is no more than 24 h before now.
 *  - Past: everything else, newest first. An unparseable `at` goes last.
 */
export function groupTimeline(events: readonly ContentEvent[], now: string | number | Date): TimelineGroups {
  const t = now instanceof Date ? now.getTime() : typeof now === "number" ? now : Date.parse(now);
  const at = (e: ContentEvent) => Date.parse(e.at);
  const out: TimelineGroups = { ahead: [], now: [], past: [] };
  for (const e of events) {
    const a = at(e);
    if (a > t && (e.state === "scheduled" || e.state === "live")) out.ahead.push(e);
    else if (e.state === "live" || (a <= t && a >= t - DAY_MS)) out.now.push(e);
    else out.past.push(e);
  }
  const rank = (e: ContentEvent) => (Number.isNaN(at(e)) ? -Infinity : at(e));
  out.ahead.sort((x, y) => rank(x) - rank(y));
  out.now.sort((x, y) => rank(y) - rank(x));
  out.past.sort((x, y) => rank(y) - rank(x));
  return out;
}
