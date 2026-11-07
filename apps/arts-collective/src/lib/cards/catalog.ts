// ============================================================================
// Feed cards (pass 3, 2026-11-02): one card designed once and drawn for every
// item of an org's live feed (its published public threads, getOrgFeed).
//
// Justin: "using this on a component, the layout of the card on a feed that is
// serving live data". The design is a classifieds block (lib/classifieds/
// catalog.ts): a node tree with a style family, a card template and
// overrides, edited with the same direct-editing panel. Its words name the
// item's fields as {{tokens}} ("{{when}} · {{place}}"), a picture's source is
// "{{cover}}"; the page fills them from each item at render time, so the
// stored design never holds item data and every new post gets the card.
//
// Pure data and functions: imported by the server page, the save action and
// the client editor alike. Stored per org in site_config under CARDS_KEY.
// ============================================================================

import type { FieldSpec, GridSpec, Item } from "@elkdonis/direct-edit/block";
import {
  BASE_TEMPLATES, cleanDoc,
  type AdOverrides, type ClassifiedsDoc, type Kind, type Theme,
} from "@/lib/classifieds/catalog";

export const CARDS_KEY = "cards:feed";
/** The card designs a member can start from (classifieds catalog, scope "card"). */
export const CARD_TEMPLATES = ["c-editorial", "c-picture", "c-index"];

export interface CardsDoc {
  v: 1;
  /** The section heading above the cards ("What's on"). */
  title?: string;
  theme?: Theme;
  /** The grid the cards sit on (absent: 6 columns, 10px gutter, 34px rows). */
  grid?: GridSpec;
  /** How many items are drawn (1-24, default 6). */
  limit?: number;
  card: { template: string; o: AdOverrides; link: { kind: "item" } | { kind: "none" } };
}

/** What a card may show of a thread. Values are display strings (feedItem). */
export const FEED_FIELDS: FieldSpec[] = [
  { key: "title", label: "Title", type: "text", sample: "Life drawing, Tuesday evenings" },
  { key: "kind", label: "Kind", type: "text", sample: "Workshop" },
  { key: "when", label: "Date and time", type: "text", sample: "Tue, Nov 4, 7:00 p.m." },
  { key: "place", label: "Place", type: "text", sample: "Salt Lane Studios" },
  { key: "excerpt", label: "Summary", type: "text", sample: "Long poses after the break." },
  { key: "price", label: "Price", type: "text", sample: "$15.00" },
  { key: "format", label: "In person or online", type: "text", sample: "In person" },
  { key: "duration", label: "Length", type: "text", sample: "2h 30m" },
  { key: "date", label: "Published", type: "text", sample: "Oct 28, 2026" },
  { key: "replies", label: "Replies", type: "text", sample: "3 replies" },
  { key: "cover", label: "Cover picture", type: "image" },
];
/** The kind of node a field becomes when it is added to the card. */
export const FEED_FIELD_KINDS: Record<string, Exclude<Kind, "frame" | "box" | "rule">> = {
  title: "title", kind: "header", when: "contact", place: "contact", excerpt: "body", price: "price",
  format: "contact", duration: "contact", date: "contact", replies: "contact", cover: "image",
};
/** What the kinds are called on a card. */
export const CARD_LABELS: Partial<Record<Kind, string>> = { frame: "Card", header: "Kicker", title: "Title", body: "Text", price: "Highlight", contact: "Meta", image: "Picture" };

const KIND_LABEL: Record<string, string> = {
  post: "Essay", meeting: "Gathering", event: "Event", service: "Offering", workshop: "Workshop", series: "Series",
};
const FORMAT_LABEL: Record<string, string> = { in_person: "In person", online: "Online", hybrid: "In person and online" };

/** The thread columns a card can use (a structural subset of lib/org.ts OrgFeedItem). */
export interface FeedRow {
  id: string; slug: string | null; title: string | null; kind: string;
  excerpt?: string | null; scheduled_at?: string | Date | null; duration_minutes?: number | null; location?: string | null;
  format?: string | null; price?: string | number | null; currency?: string | null;
  published_at?: string | Date | null; created_at?: string | Date | null; reply_count?: number | null; cover_image_url?: string | null;
}

const fmtDate = (v: string | Date | null | undefined, o: Intl.DateTimeFormatOptions, tz?: string): string => {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  try { return new Intl.DateTimeFormat("en-CA", { ...o, ...(tz ? { timeZone: tz } : {}) }).format(d); } catch { return new Intl.DateTimeFormat("en-CA", o).format(d); }
};
const fmtDuration = (m?: number | null) => (!m || m <= 0 ? "" : m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`);
function fmtPrice(p: string | number | null | undefined, cur: string | null | undefined): string {
  if (p === null || p === undefined || p === "") return "";
  const n = typeof p === "number" ? p : Number(p);
  if (!Number.isFinite(n)) return "";
  if (n <= 0) return "Free";
  try { return new Intl.NumberFormat("en-CA", { style: "currency", currency: (cur || "CAD").toUpperCase() }).format(n); } catch { return n.toFixed(2); }
}
const plain = (s: string | null | undefined, max: number) => {
  const t = String(s ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : t;
};

/**
 * One thread as the strings a card shows. Times are shown in ONE stated zone
 * (thread-feed's rule: 7 pm means 7 pm at the door), or the server's when none.
 */
export function feedItem(t: FeedRow, opts: { timeZone?: string } = {}): Item {
  const when = fmtDate(t.scheduled_at, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }, opts.timeZone);
  return {
    href: t.slug && /^[\w-]{1,200}$/.test(t.slug) ? `/${t.slug}` : "",
    title: plain(t.title, 160) || "Untitled",
    kind: KIND_LABEL[t.kind] ?? (t.kind ? t.kind[0]!.toUpperCase() + t.kind.slice(1) : ""),
    when,
    place: plain(t.location, 120),
    excerpt: plain(t.excerpt, 260),
    price: fmtPrice(t.price, t.currency),
    format: t.format ? FORMAT_LABEL[t.format] ?? "" : "",
    duration: fmtDuration(t.duration_minutes),
    date: fmtDate(t.published_at ?? t.created_at, { month: "short", day: "numeric", year: "numeric" }, opts.timeZone),
    replies: t.reply_count && t.reply_count > 0 ? `${t.reply_count} repl${t.reply_count === 1 ? "y" : "ies"}` : "",
    cover: t.cover_image_url ?? "",
  };
}

/** Items to design with when an org has published nothing yet (and for previews). Lengths differ on purpose. */
export const SAMPLE_ITEMS: Item[] = [
  { href: "#", title: "Life drawing, Tuesday evenings", kind: "Workshop", when: "Tue, Nov 4, 7:00 p.m.", place: "Salt Lane Studios", excerpt: "Long poses after the break. Bring paper and charcoal; boards and donkeys provided.", price: "$15.00", format: "In person", duration: "2h 30m", date: "Oct 28, 2026", replies: "3 replies", cover: "" },
  { href: "#", title: "On keeping a sketchbook for a whole winter, and what it taught me about looking", kind: "Essay", when: "", place: "", excerpt: "Notes from forty mornings at the same window: the light, the pigeons, the man with the red umbrella, and why the bad pages matter most.", price: "", format: "", duration: "", date: "Oct 21, 2026", replies: "", cover: "" },
  { href: "#", title: "Open studio", kind: "Gathering", when: "Sat, Nov 8, 11:00 a.m.", place: "Upstairs, 14 Salt Lane", excerpt: "Come in, look around, ask about the work on the walls.", price: "Free", format: "In person", duration: "5h", date: "Oct 30, 2026", replies: "1 reply", cover: "" },
  { href: "#", title: "Printmaking basics", kind: "Series", when: "Thu, Nov 13, 6:30 p.m.", place: "Online", excerpt: "Four sessions: relief, intaglio, monotype, and putting an edition together.", price: "$60.00", format: "Online", duration: "1h 30m", date: "Oct 25, 2026", replies: "", cover: "" },
];

export function starterCards(): CardsDoc {
  return { v: 1, title: "What's on", grid: { cols: 6, gap: 16, row: 24 }, limit: 6, card: { template: "c-editorial", o: {}, link: { kind: "item" } } };
}

/** The editor works on a one-block sheet: the design is its only ad. */
export function cardsToSheet(c: CardsDoc): ClassifiedsDoc {
  return {
    ...(c.title ? { title: c.title } : {}), ...(c.theme ? { theme: c.theme } : {}), ...(c.grid ? { grid: c.grid } : {}), ...(c.limit !== undefined ? { limit: c.limit } : {}),
    ads: [{ id: "ad1", template: c.card.template, o: c.card.o, link: c.card.link }], userTemplates: {}, next: 1,
  };
}
export function sheetToCards(d: ClassifiedsDoc): CardsDoc {
  const ad = d.ads[0];
  return {
    v: 1, ...(d.title ? { title: d.title } : {}), ...(d.theme ? { theme: d.theme } : {}), ...(d.grid ? { grid: d.grid } : {}), ...(d.limit !== undefined ? { limit: d.limit } : {}),
    card: { template: ad?.template ?? "c-editorial", o: ad?.o ?? {}, link: ad?.link?.kind === "item" ? { kind: "item" } : { kind: "none" } },
  };
}

/** What the save action accepts: the design through the classifieds cleaner (card templates only), a limit, a link. */
export function cleanCards(v: unknown): CardsDoc | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const c = v as Record<string, unknown>;
  const card = (c.card && typeof c.card === "object" ? c.card : {}) as Record<string, unknown>;
  const sheet = cleanDoc({ title: c.title, theme: c.theme, grid: c.grid, ads: [{ id: "ad1", template: card.template, o: card.o, link: card.link }], userTemplates: {}, next: 1 }, { scope: "card", allowItemLink: true });
  const ad = sheet?.ads[0];
  if (!sheet || !ad || !BASE_TEMPLATES[ad.template]) return null;
  const limit = typeof c.limit === "number" && Number.isFinite(c.limit) ? Math.round(Math.max(1, Math.min(24, c.limit))) : undefined;
  return {
    v: 1, ...(sheet.title ? { title: sheet.title } : {}), ...(sheet.theme ? { theme: sheet.theme } : {}), ...(sheet.grid ? { grid: sheet.grid } : {}), ...(limit !== undefined ? { limit } : {}),
    card: { template: ad.template, o: ad.o, link: ad.link?.kind === "item" ? { kind: "item" } : { kind: "none" } },
  };
}

/** A card's link: a path on the org's own site, or an http(s) address; anything else is not drawn as a link. */
export const safeHref = (h: string | null | undefined): string | null => {
  const s = String(h ?? "");
  return /^\/(?!\/)[^\s"'<>\\]{0,500}$/.test(s) || /^https?:\/\/[^\s"'<>\\]{1,500}$/i.test(s) ? s : null;
};
