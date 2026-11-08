// ============================================================================
// Channel view model: what the server loader hands the Channel UI. Pure types
// and helpers, safe in client components. docs/open/channel.md §5.
// ============================================================================

/** Every outlet a piece can go to. `threads` is folded into the social columns. */
export type Outlet =
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

/** The seven columns of the Home list icons and the coverage matrix (1b). */
export const MATRIX_COLUMNS = ["site", "instagram", "facebook", "video", "writing", "live", "newsletter"] as const;
export type MatrixColumn = (typeof MATRIX_COLUMNS)[number];

export const MATRIX_LABELS: Record<MatrixColumn, string> = {
  site: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  video: "Video",
  writing: "Writing",
  live: "Live",
  newsletter: "Letter",
};

/** Columns of "Coverage by identity" on the piece pop-up (3a). */
export const COVERAGE_COLUMNS = ["site", "instagram", "facebook", "market", "newsletter"] as const;
export type CoverageColumn = (typeof COVERAGE_COLUMNS)[number];

/** Lanes of the piece board (2b). */
export const BOARD_LANES = ["dates", "site", "instagram", "facebook", "video", "writing", "live", "newsletter"] as const;
export type BoardLane = (typeof BOARD_LANES)[number];

export type ItemState = "published" | "scheduled" | "live" | "draft" | "failed" | "empty";

export type PieceKind = "artwork" | "product" | "writing" | "video" | "series" | "meeting" | "event" | "workshop";

export const PIECE_KINDS: Array<{ id: PieceKind; label: string; glyph: string }> = [
  { id: "artwork", label: "Artwork", glyph: "▣" },
  { id: "product", label: "Product", glyph: "▣" },
  { id: "writing", label: "Writing", glyph: "◉" },
  { id: "video", label: "Video", glyph: "▶" },
  { id: "series", label: "Series", glyph: "◈" },
  { id: "meeting", label: "Meeting", glyph: "◎" },
  { id: "event", label: "Event", glyph: "◆" },
  { id: "workshop", label: "Workshop", glyph: "◈" },
];

export function kindLabel(kind: PieceKind): string {
  return PIECE_KINDS.find((k) => k.id === kind)?.label ?? kind;
}
export function kindGlyph(kind: PieceKind): string {
  return PIECE_KINDS.find((k) => k.id === kind)?.glyph ?? "·";
}

export interface ChannelIdentity {
  /** `user:<uuid>` or `org:<org id>`. */
  id: string;
  kind: "user" | "org";
  name: string;
  /** "You" for the viewer, the org's short name otherwise. */
  shortName: string;
  initials: string;
  avatarUrl: string | null;
  orgId: string | null;
  /** The identity's own site, for library grouping. */
  siteName: string;
  siteHost: string | null;
  siteUrl: string | null;
}

export interface TimelineEntry {
  id: string;
  at: string;
  outlet: Outlet;
  identityId: string | null;
  label: string;
  sub: string;
  state: ItemState;
  href: string | null;
  /** A row Channel planned (channel_deliveries), as opposed to history read from the outlet's own record. */
  deliveryId: string | null;
}

export interface Suggestion {
  /** Stable: `<pieceKey>|<outlet>|<identityId>`. Dismissing stores it. */
  id: string;
  pieceKey: string;
  outlet: Outlet;
  identityId: string;
  /** Chip text: "+ Share", "+ Quote card", "+ Go live". */
  chip: string;
  /** Sentence: "Post Salt Marsh to Instagram". */
  text: string;
  /** Why here and now: "Fills your Friday Instagram slot". */
  reason: string;
  /** Placement in time, when a slot or a date gave one. */
  at: string | null;
  routineId: string | null;
}

export interface Cell {
  state: ItemState;
  at: string | null;
  label: string | null;
  href: string | null;
  suggestion: Suggestion | null;
}

export interface PiecePlan {
  id: string;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
  updatedByActor: "user" | "agent";
  updatedByViewer: boolean;
}

export interface Piece {
  /** `thread:<id>` or `artwork:<id>`. */
  key: string;
  subject: { kind: "thread" | "artwork"; id: string };
  kind: PieceKind;
  title: string;
  /** "Oil on linen · 60 × 90 cm · $2,400" */
  meta: string;
  excerpt: string;
  imageUrl: string | null;
  status: string;
  /** The identity it belongs to (author or owning org). */
  ownerIdentityId: string;
  /** An org that presents it, when the owner is a person: "presented by …". */
  presentedById: string | null;
  /** Where it lives: the site group in the library. */
  siteIdentityId: string;
  siteName: string;
  siteHost: string | null;
  href: string | null;
  studioHref: string | null;
  createdAt: string;
  /** The piece's own date ahead (an event, a meeting, a series start). */
  eventAt: string | null;
  timeline: TimelineEntry[];
  row: Record<MatrixColumn, Cell>;
  coverage: Record<string, Record<CoverageColumn, Cell>>;
  suggestions: Suggestion[];
  inMotion: { reason: string; at: string | null } | null;
  plan: PiecePlan | null;
  openTodos: number;
}

export interface RoutineView {
  id: string;
  name: string;
  outlet: Outlet;
  cadence: string;
  status: string;
  /** "open" when a slot this week is still empty. */
  tone: "open" | "booked" | "quiet";
  source: "channel" | "sophia";
  /** The stored cadence, for editing (the planner). */
  rule: { weekdays?: string[]; monthDay?: number; nthWeekday?: { n: number; weekday: string }; time?: string };
}

export type DayItem =
  | { type: "post"; id: string; pieceKey: string | null; pieceTitle: string; title: string; outlets: Outlet[]; at: string; state: ItemState; stage: string; routineName: string | null; deliveryId: string | null; href: string | null; important?: boolean }
  | { type: "slot"; id: string; routineId: string; routineName: string; cadence: string; outlet: Outlet; at: string; suggestion: Suggestion | null }
  | { type: "event"; id: string; pieceKey: string; title: string; at: string }
  | { type: "todo"; id: string; text: string; done: boolean }
  | { type: "suggestion"; id: string; text: string; suggestion: Suggestion };

export interface DayView {
  date: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  items: DayItem[];
}

export type TrayItem =
  | { type: "draft"; id: string; label: string; title: string; sub: string; pieceKey: string | null; deliveryId: string; outlet: Outlet; chip: string; important?: boolean }
  | { type: "gap"; id: string; label: string; title: string; sub: string; pieceKey: string; suggestion: Suggestion; chip: string }
  | { type: "note"; id: string; label: string; title: string; sub: string; todoId: string; chip: string };

export interface OutletStatus {
  id: "site" | "instagram" | "facebook" | "youtube" | "threads";
  label: string;
  connected: boolean;
  /** Instagram: posts left in the rolling 24 h, counted from our own publish log. */
  left: number | null;
  total: number | null;
  /** Under which identities it is connected. */
  identityIds: string[];
  /** The account names, for composer headers ("@elkdonis.arts"). */
  accounts: string[];
}

export interface ChannelLinks {
  hub: string;
  studio: string;
  site: string | null;
  newsletter: string | null;
  connections: string;
  people: string | null;
  pages: string | null;
  template: string | null;
  /** The org's own pieces screen (an own-app site), or the market studio for a person. */
  store: string | null;
  identity: string | null;
  writing: string;
  video: string;
  meeting: string;
  series: string | null;
  artwork: string;
  live: string;
}

export interface ChannelModel {
  ready: boolean;
  /** isAdmin: a network admin (users.is_admin); the broadcast booth is admin-only. */
  viewer: { userId: string; name: string; initials: string; slug: string | null; isAdmin: boolean };
  scope: { kind: "artist" } | { kind: "org"; orgId: string; name: string; slug: string };
  /** Orgs the viewer may run a channel for (owner or guide). */
  orgs: Array<{ orgId: string; name: string; slug: string; role: string }>;
  identities: ChannelIdentity[];
  links: ChannelLinks;
  counts: { writing: number; video: number; artwork: number; series: number; meeting: number; queue: number; people: number | null };
  outlets: OutletStatus[];
  nextLive: { at: string; title: string } | null;
  pieces: Piece[];
  routines: RoutineView[];
  week: { from: string; to: string; label: string; days: DayView[]; prev: string; next: string };
  tray: TrayItem[];
  timeZone: string;
  today: string;
  now: string;
  /** A one-off line after an action (redirected with ?notice=). */
  notice: string | null;
}

// ── formatting, shared by server and client ────────────────────────────────

export function fmtDay(at: string | null | undefined, timeZone: string): string {
  if (!at) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(new Date(at));
}

export function fmtTime(at: string | null | undefined, timeZone: string): string {
  if (!at) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone })
    .format(new Date(at))
    .replace(":00", "");
}

export function fmtWeekdayTime(at: string | null | undefined, timeZone: string): string {
  if (!at) return "";
  const d = new Date(at);
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(d);
  return `${wd} ${fmtTime(at, timeZone)}`;
}

export function fmtLong(at: string | null | undefined, timeZone: string): string {
  if (!at) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(new Date(at));
}

export function initialsOf(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function pieceHref(channelBase: string, piece: Pick<Piece, "subject">): string {
  return `${channelBase}/piece/${piece.subject.kind}/${encodeURIComponent(piece.subject.id)}`;
}

/** Instagram rules from packages/meta/src/instagram.ts, as the composer applies them. */
export const INSTAGRAM_RULES = {
  captionMax: 2200,
  dailyLimit: 25,
  linkNote: "Links aren't clickable on Instagram, so the link goes in bio.",
  jpegNote: "Pictures are sent as JPEG; Instagram drops PNG without an error.",
};

/** Swap URLs in a caption for "Link in bio" (Instagram). Returns the text and whether anything changed. */
export function linkInBio(text: string): { text: string; swapped: boolean } {
  const re = /\bhttps?:\/\/\S+|\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S*/gi;
  let swapped = false;
  const out = text.replace(re, () => {
    swapped = true;
    return "link in bio";
  });
  return { text: out, swapped };
}

// ── wall-clock helpers for <input type="datetime-local"> in the channel's zone ──

function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Math.round((Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - at.getTime()) / 60000);
}

/** ISO instant → "YYYY-MM-DDTHH:MM" on the wall clock of `timeZone`. */
export function toZonedInput(at: string | null | undefined, timeZone: string): string {
  if (!at) return "";
  const d = new Date(at);
  const local = new Date(d.getTime() + zoneOffsetMinutes(d, timeZone) * 60000);
  return local.toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:MM" on the wall clock of `timeZone` → ISO instant. */
export function fromZonedInput(value: string, timeZone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const guess = new Date(`${value}:00Z`);
  const first = new Date(guess.getTime() - zoneOffsetMinutes(guess, timeZone) * 60000);
  const second = new Date(guess.getTime() - zoneOffsetMinutes(first, timeZone) * 60000);
  return second.toISOString();
}
