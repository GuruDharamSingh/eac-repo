// ============================================================================
// @elkdonis/content/model: the content detail model (the item's "passport").
// Pure types and helpers, browser-safe: no db, no next/*, no React.
// docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md §3 "Contract".
//
// Pass 1 (2026-11-08): the model is filled client-side from Channel's
// already-loaded Piece (apps/arts-collective/src/lib/channel/content-detail.ts).
// Pass 2 fills the same shape server-side with loadContentDetail.
// ============================================================================

/** Which table an item lives in. Kept apart from ContentType (how it is shown). */
export type ContentStore = "thread" | "artwork";

export interface ContentRef {
  store: ContentStore;
  id: string;
}

/** How an item is shown. Pass 1: Channel's piece kinds, one to one. */
export type ContentType = "artwork" | "product" | "writing" | "video" | "series" | "meeting" | "event" | "workshop";

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

// ── helpers ────────────────────────────────────────────────────────────────

export function contentKey(ref: ContentRef): string {
  return `${ref.store}:${ref.id}`;
}

export function parseContentKey(key: string): ContentRef | null {
  const i = key.indexOf(":");
  if (i <= 0) return null;
  const store = key.slice(0, i);
  const id = key.slice(i + 1);
  if ((store !== "thread" && store !== "artwork") || !id) return null;
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
