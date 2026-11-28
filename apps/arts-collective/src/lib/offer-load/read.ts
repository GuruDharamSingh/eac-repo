import "server-only";
import { db } from "@elkdonis/db";
import { OFF_FEED_KINDS } from "@elkdonis/services";
import type { EssayDoc } from "@elkdonis/utils/essay";
import type { OfferKind, SurfaceOffer, SurfaceWritingPiece, TakeUp } from "@elkdonis/cms-ui/offer-surface";
import type { OfferExtras, TemplatePiece } from "@elkdonis/cms-ui/offer-templates/types";
import { bodyFromDoc, bodyFromHtml, descriptionOf, minutesOf, textOfHtml } from "./blocks";
import { cleanProgram } from "./keys";

/**
 * Read-only readers for the free-tier offer page. Every reader that can reach a signed-out
 * visitor applies the one public test of the offers list:
 *
 *     status = 'published' AND visibility = 'PUBLIC' AND min_role IS NULL
 *
 * and leaves out anything a site keeper has hidden in the content library (content_index.hidden).
 * Nothing here writes.
 */

const EVENT_KINDS = new Set(["event", "meeting", "workshop", "reading_group"]);
export const OFFER_KINDS = ["event", "meeting", "workshop", "reading_group", "series", "service"];
const WRITING_KINDS = ["writing", "post"];
/** Kinds `offer:featured` may point at: offers and writing. */
const FEATURABLE_KINDS = [...OFFER_KINDS, ...WRITING_KINDS];
const LISTED_ARTWORK = ["available", "reserved", "sold"];
const MARKET_URL = (process.env.NEXT_PUBLIC_ART_AUCTION_URL || "https://market.arts-collective.com").replace(/\/+$/, "");

// ── the public test, as fragments ────────────────────────────────────────────
const PUBLIC_THREAD = () => db`t.status = 'published' AND t.visibility = 'PUBLIC' AND t.min_role IS NULL`;
const NOT_HIDDEN_THREAD = () => db`NOT EXISTS (SELECT 1 FROM content_index ci WHERE ci.key = 'thread:' || t.id AND ci.hidden)`;
const listedOn = (orgId: string) =>
  db`(t.org_id = ${orgId} OR EXISTS (SELECT 1 FROM thread_orgs x WHERE x.thread_id = t.id AND x.org_id = ${orgId} AND x.status = 'approved'))`;

export type ThreadRow = {
  id: string;
  org_id: string;
  slug: string;
  title: string;
  kind: string;
  excerpt: string | null;
  body: string | null;
  body_doc: EssayDoc | null;
  body_format: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  location: string | null;
  format: string | null;
  is_online: boolean | null;
  is_rsvp_enabled: boolean | null;
  attendee_limit: number | null;
  /** COALESCE(workshop_pages.price_member, threads.price): the amount commerce charges (content hydrate.ts). */
  price_major: string | null;
  currency: string | null;
  /** workshop_pages.price_sliding_min */
  sliding_min: string | null;
  address: string | null;
  gallery: unknown;
  author_id: string;
  published_at: string | null;
  created_at: string;
  reply_count: number | null;
  pinned: boolean;
  metadata: Record<string, unknown> | null;
  cover: string | null;
};

const THREAD_COLS = () => db`
  t.id, t.org_id, t.slug, t.title, t.kind, t.excerpt, t.body, t.body_doc, t.body_format, t.scheduled_at, t.duration_minutes,
  t.location, t.format, t.is_online, t.is_rsvp_enabled, t.attendee_limit,
  COALESCE(wp.price_member, t.price)::text AS price_major, t.currency, wp.price_sliding_min::text AS sliding_min,
  wp.location_address AS address, wp.gallery_image_urls AS gallery,
  t.author_id, t.published_at, t.created_at, t.reply_count, t.pinned, t.metadata,
  COALESCE(t.metadata->>'coverImageUrl', wp.cover_image_url) AS cover`;

/** Today's featured fallback, with the public test it lacked: pinned first, else the newest, never an off-feed kind. */
export async function readFallbackFeatured(orgId: string): Promise<ThreadRow | null> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLS()} FROM threads t LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId} AND ${PUBLIC_THREAD()} AND t.kind <> ALL(${OFF_FEED_KINDS}) AND ${NOT_HIDDEN_THREAD()}
      ORDER BY t.pinned DESC, COALESCE(t.published_at, t.created_at) DESC
      LIMIT 1`;
    return rows[0] ?? null;
  } catch (err) {
    console.error("[offer-load] fallback featured:", err);
    return null;
  }
}

/** One thread by id, only when it is public, featurable and homed on or approved-listed on the org. */
export async function readFeaturedThread(orgId: string, id: string): Promise<ThreadRow | null> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLS()} FROM threads t LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.id = ${id} AND ${PUBLIC_THREAD()} AND t.kind = ANY(${FEATURABLE_KINDS}) AND ${listedOn(orgId)} AND ${NOT_HIDDEN_THREAD()}
      LIMIT 1`;
    return rows[0] ?? null;
  } catch (err) {
    console.error("[offer-load] featured thread:", err);
    return null;
  }
}

export async function readOfferThreads(orgId: string, limit: number): Promise<ThreadRow[]> {
  try {
    return await db<ThreadRow[]>`
      SELECT ${THREAD_COLS()} FROM threads t LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId} AND ${PUBLIC_THREAD()} AND t.kind = ANY(${OFFER_KINDS}) AND ${NOT_HIDDEN_THREAD()}
      ORDER BY t.pinned DESC, COALESCE(t.scheduled_at, t.published_at, t.created_at) DESC
      LIMIT ${limit}`;
  } catch (err) {
    console.error("[offer-load] offers:", err);
    return [];
  }
}

// ── mapping a thread row to the offer ────────────────────────────────────────

export function kindOf(kind: string): OfferKind {
  if (EVENT_KINDS.has(kind)) return "event";
  if (kind === "service") return "service";
  if (kind === "series") return "series";
  return "writing";
}

function takeUpOf(kind: OfferKind, priceMinor: number, rsvp: boolean): TakeUp {
  if (kind === "series") return "subscribe";
  if (kind === "artwork") return priceMinor > 0 ? "order" : "none";
  if (priceMinor > 0) return "pay";
  if (rsvp) return "rsvp";
  if (kind === "service") return "enquire";
  return "none";
}

const metaStr = (m: Record<string, unknown> | null, k: string): string | null => {
  const v = m?.[k];
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

function galleryUrls(g: unknown): string[] {
  return Array.isArray(g) ? g.filter((u): u is string => typeof u === "string" && /^(https?:\/\/|\/(?!\/))/.test(u)) : [];
}

/** A description that only repeats the standfirst (the excerpt) is left out, so the page does not say it twice. */
function sameAsStandfirst(desc: string, excerpt: string | null): string | null {
  if (!desc) return null;
  return textOfHtml(desc).toLowerCase() === (excerpt ?? "").trim().toLowerCase() ? null : desc;
}

export interface OfferInputs {
  coming: number | null;
  coHostIds: string[];
  nextSessionIso?: string | null;
}

export function toOffer(r: ThreadRow, featuredId: string | null, x: OfferInputs): SurfaceOffer {
  const kind = kindOf(r.kind);
  const tz = metaStr(r.metadata, "timeZone");
  const major = r.price_major == null ? 0 : Number(r.price_major);
  const priceMinor = Number.isFinite(major) && major > 0 ? Math.round(major * 100) : 0;
  // Commerce charges `r.currency || "CAD"` (content hydrate.ts); the page shows the same.
  const currency = (r.currency || "CAD").toUpperCase();
  const floorMajor = r.sliding_min == null ? 0 : Number(r.sliding_min);
  const floor = Number.isFinite(floorMajor) && floorMajor > 0 ? Math.round(floorMajor * 100) : 0;
  const rsvp = Boolean(r.is_rsvp_enabled);
  const startIso = x.nextSessionIso ?? (r.scheduled_at ? new Date(r.scheduled_at).toISOString() : null);
  const start = startIso ? new Date(startIso) : null;
  const end = start && r.duration_minutes && kind !== "series" ? new Date(start.getTime() + r.duration_minutes * 60_000) : null;
  const online = r.format === "online" || r.is_online === true;
  const poster = r.cover;
  const images = [...new Set([...(poster ? [poster] : []), ...galleryUrls(r.gallery)])];
  const isWriting = kind === "writing";
  return {
    key: `thread:${r.id}`,
    kind,
    title: r.title,
    standfirst: r.excerpt,
    // Writing is drawn from the piece itself (`pieces`), not as a description.
    description: isWriting ? null : r.body && r.body.length <= 20_000 ? sameAsStandfirst(descriptionOf(r.body), r.excerpt) : null,
    poster,
    ...(images.length ? { images } : {}),
    when: start && !isWriting ? { start: start.toISOString(), end: end ? end.toISOString() : null, timeZone: tz } : null,
    venue: !isWriting && (r.location || r.address || online) ? { name: r.location, address: r.address, online } : null,
    price: priceMinor > 0 ? { amountMinor: priceMinor, currency } : null,
    // Only a floor below the list price is a sliding scale (as the offers view reads it).
    sliding: priceMinor > 0 && floor > 0 && floor < priceMinor ? { minMinor: floor, maxMinor: priceMinor } : null,
    takeUp: isWriting ? "none" : takeUpOf(kind, priceMinor, rsvp),
    capacity: rsvp ? { limit: r.attendee_limit, coming: x.coming ?? 0 } : null,
    durationMinutes: r.duration_minutes,
    hostId: r.author_id,
    ...(x.coHostIds.length ? { coHostIds: x.coHostIds } : {}),
    href: `/${r.slug}`,
    featured: featuredId === r.id,
  };
}

/** Co-hosts: `meeting_hosts` rows with role 'co-host' for the series' or meeting's next occurrence (else its latest). */
export async function readCoHosts(threadIds: string[], authorOf: Map<string, string>): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!threadIds.length) return out;
  try {
    const rows = await db<Array<{ thread_id: string; user_id: string }>>`
      WITH pick AS (
        SELECT thread_id,
               COALESCE(MIN(occurrence_at) FILTER (WHERE occurrence_at >= now() - interval '1 day'), MAX(occurrence_at)) AS at
        FROM meeting_hosts WHERE thread_id = ANY(${threadIds}) GROUP BY thread_id
      )
      SELECT h.thread_id, h.user_id::text AS user_id
      FROM meeting_hosts h JOIN pick p ON p.thread_id = h.thread_id AND p.at = h.occurrence_at
      WHERE h.role = 'co-host' AND h.user_id IS NOT NULL
      ORDER BY h.created_at`;
    for (const r of rows) {
      if (r.user_id === authorOf.get(r.thread_id)) continue;
      out.set(r.thread_id, [...(out.get(r.thread_id) ?? []), r.user_id]);
    }
  } catch (err) {
    console.error("[offer-load] co-hosts:", err);
  }
  return out;
}

// ── series sessions ──────────────────────────────────────────────────────────

function zoned(iso: string, tz: string | null, o: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("en-US", { ...o, timeZone: tz || undefined }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", o).format(new Date(iso));
  }
}

/** "Mon 14 Dec" */
function dayLabel(iso: string, tz: string | null): string {
  const d = zoned(iso, tz, { weekday: "short", month: "short", day: "numeric" }); // "Mon, Dec 14"
  const m = /^(\w+),? (\w+) (\d+)$/.exec(d);
  return m ? `${m[1]} ${m[3]} ${m[2]}` : d;
}

/** "Mon 14 Dec · 6 pm PST" */
function dayTimeLabel(iso: string, tz: string | null): string {
  const t = zoned(iso, tz, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).replace(":00", "").replace(/ (AM|PM)/, (s) => s.toLowerCase());
  return `${dayLabel(iso, tz)} · ${t}`;
}

/** The weeks the series has published (a title and `published_at`, not cancelled), newest first. */
export async function readSeriesSessions(seriesId: string, tz: string | null): Promise<{ sessions: NonNullable<OfferExtras["sessions"]>; nextIso: string | null }> {
  try {
    const rows = await db<Array<{ number: number; starts_at: string; title: string | null; thread_title: string }>>`
      SELECT ss.number, ss.starts_at, NULLIF(trim(n.title), '') AS title, st.title AS thread_title
      FROM series_sessions ss
      JOIN threads st ON st.id = ss.session_thread_id AND st.status = 'published' AND st.visibility = 'PUBLIC' AND st.min_role IS NULL
      LEFT JOIN meeting_occurrence_notes n ON n.thread_id = ss.series_id AND n.occurrence_at = COALESCE(ss.slot_at, ss.starts_at)
      WHERE ss.series_id = ${seriesId} AND ss.status = 'scheduled' AND ss.published_at IS NOT NULL
      ORDER BY ss.starts_at DESC
      LIMIT 12`;
    const now = Date.now();
    // A session is over three hours after it starts (the same default as hasEnded for an event with no end).
    const isPast = (r: { starts_at: string }) => new Date(r.starts_at).getTime() + 3 * 3_600_000 < now;
    const upcoming = rows.filter((r) => !isPast(r));
    const nextRow = upcoming.length ? upcoming[upcoming.length - 1]! : null;
    const sessions = rows.map((r) => {
      const iso = new Date(r.starts_at).toISOString();
      const isNext = r === nextRow;
      return {
        n: r.number,
        title: r.title ?? r.thread_title.replace(/^.*? · /, ""),
        when: isNext || !isPast(r) ? dayTimeLabel(iso, tz) : dayLabel(iso, tz),
        ...(isNext ? { next: true } : {}),
        ...(isPast(r) ? { past: true } : {}),
      };
    });
    return { sessions, nextIso: nextRow ? new Date(nextRow.starts_at).toISOString() : null };
  } catch (err) {
    console.error("[offer-load] series sessions:", err);
    return { sessions: [], nextIso: null };
  }
}

/** Extras of a featured thread: only what is stored. Nothing is invented. */
export function extrasOf(r: ThreadRow, offer: SurfaceOffer, sessions?: OfferExtras["sessions"]): OfferExtras {
  const page = (r.metadata?.page ?? null) as Record<string, unknown> | null;
  const program = offer.kind === "event" ? cleanProgram(page?.program) : undefined;
  return {
    ...(program ? { program } : {}),
    talkCount: r.reply_count ?? 0,
    ...(sessions && sessions.length ? { sessions } : {}),
  };
}

/** The template id stored with a piece homed on the org (`metadata.page.template`). */
export function storedTemplateOf(r: ThreadRow): unknown {
  const page = r.metadata?.page;
  return page && typeof page === "object" ? (page as Record<string, unknown>).template : undefined;
}

// ── writing ──────────────────────────────────────────────────────────────────

type PieceRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  author_id: string;
  published_at: string | null;
  created_at: string;
  cover: string | null;
  series: string | null;
  byline_id: string | null;
  len: number;
};

const iso = (v: string | null): string | null => (v ? new Date(v).toISOString() : null);

/** The org's public writing (homed on it or approved-listed on it), newest first: light rows, no bodies. */
export async function readWritingIndex(orgId: string, limit: number): Promise<TemplatePiece[]> {
  try {
    const rows = await db<PieceRow[]>`
      SELECT t.id, t.slug, t.title, t.excerpt, t.author_id, t.published_at, t.created_at,
             t.metadata->>'coverImageUrl' AS cover, t.metadata->>'series' AS series, t.metadata->'byline'->>'userId' AS byline_id,
             length(regexp_replace(COALESCE(t.body, ''), '<[^>]*>', ' ', 'g')) AS len
      FROM threads t
      WHERE ${listedOn(orgId)} AND ${PUBLIC_THREAD()} AND t.kind = ANY(${WRITING_KINDS}) AND ${NOT_HIDDEN_THREAD()}
      ORDER BY COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}`;
    return rows.map((r) => ({
      key: `thread:${r.id}`,
      title: r.title,
      standfirst: r.excerpt,
      cover: r.cover,
      href: `/${r.slug}`,
      // About 220 words a minute (1300 characters), rounded up; at least one.
      minutes: Math.max(1, Math.ceil(Number(r.len) / 1300)),
      series: r.series,
      date: iso(r.published_at ?? r.created_at),
      authorId: r.byline_id ?? r.author_id,
    }));
  } catch (err) {
    console.error("[offer-load] writing index:", err);
    return [];
  }
}

export const toWritingShelf = (p: TemplatePiece): SurfaceWritingPiece => ({
  key: p.key,
  title: p.title,
  standfirst: p.standfirst,
  cover: p.cover,
  href: p.href,
  minutes: p.minutes,
});

/** The featured piece in full: the block document mapped to sections / pullQuote / picture, or the stored HTML. */
export async function pieceOf(r: ThreadRow, index: TemplatePiece[]): Promise<TemplatePiece> {
  const doc = r.body_format === "doc" && r.body_doc && typeof r.body_doc === "object" && r.body_doc.type === "doc" ? r.body_doc : null;
  const b = doc ? bodyFromDoc(doc) : bodyFromHtml(r.body);
  const series = metaStr(r.metadata, "series");
  const byline = (r.metadata?.byline ?? null) as { userId?: unknown } | null;
  const authorId = typeof byline?.userId === "string" ? byline.userId : r.author_id;
  let n: number | undefined;
  let total: number | undefined;
  if (series) {
    try {
      const [c] = await db<Array<{ total: number; n: number }>>`
        SELECT count(*)::int AS total,
               (count(*) FILTER (WHERE COALESCE(t.published_at, t.created_at) <= COALESCE(${r.published_at ?? r.created_at}::timestamptz, now())))::int AS n
        FROM threads t
        WHERE t.author_id = ${r.author_id} AND t.kind = ANY(${WRITING_KINDS}) AND ${PUBLIC_THREAD()} AND t.metadata->>'series' = ${series}`;
      if (c && c.total > 1) {
        n = c.n;
        total = c.total;
      }
    } catch (err) {
      console.error("[offer-load] series position:", err);
    }
  }
  const tags = Array.isArray(r.metadata?.tags) ? (r.metadata!.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 8) : [];
  const text = textOfHtml(b.bodyHtml);
  const fromIndex = index.find((p) => p.key === `thread:${r.id}`);
  return {
    key: `thread:${r.id}`,
    title: r.title,
    standfirst: r.excerpt,
    cover: r.cover,
    href: `/${r.slug}`,
    minutes: text ? minutesOf(text) : fromIndex?.minutes ?? null,
    series,
    ...(n && total ? { n, total } : {}),
    date: iso(r.published_at ?? r.created_at),
    authorId,
    bodyHtml: b.bodyHtml || null,
    sections: b.sections,
    pullQuote: b.pullQuote,
    picture: b.picture,
    caption: b.caption,
    ...(tags.length ? { tags } : {}),
  };
}

// ── artworks ─────────────────────────────────────────────────────────────────

type ArtRow = {
  id: string;
  slug: string;
  title: string;
  description_html: string | null;
  medium: string | null;
  kind: string | null;
  height_cm: string | null;
  width_cm: string | null;
  depth_cm: string | null;
  status: string;
  maker_id: string | null;
  price_minor: string | null;
  currency: string | null;
  edition_number: number | null;
  edition_total: number | null;
  cover: string | null;
};

const ART_COLS = () => db`
  a.id::text AS id, a.slug, a.title, a.description_html, a.medium, a.kind, a.height_cm::text AS height_cm, a.width_cm::text AS width_cm,
  a.depth_cm::text AS depth_cm, a.status,
  CASE WHEN a.credit_status = 'credited' THEN COALESCE(a.credited_artist_user_id, a.artist_user_id) ELSE a.artist_user_id END::text AS maker_id,
  pv.price_minor::text AS price_minor, pv.currency, pv.edition_number, pv.edition_total, pm.url AS cover`;

/**
 * The org's artworks, by the content library's own org scope: the artwork's store is owned by the org, or the
 * store is the one the org pinned (`site_config` `shop:store`). Listed means available, reserved or sold.
 */
function artFrom(orgId: string) {
  return db`
    FROM artwork a
    JOIN store s ON s.id = a.store_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    LEFT JOIN LATERAL (SELECT v.price_minor, v.currency, v.edition_number, v.edition_total FROM artwork_variant v
                       WHERE v.artwork_id = a.id ORDER BY v.price_minor ASC, v.position ASC LIMIT 1) pv ON true
    WHERE (s.owner_org_id = ${orgId}
           OR a.store_id::text IN (SELECT c.value->>'storeId' FROM site_config c WHERE c.org_id = ${orgId} AND c.key = 'shop:store'))
      AND NOT EXISTS (SELECT 1 FROM content_index ci WHERE ci.key = 'artwork:' || a.id::text AND ci.hidden)`;
}

export async function readArtworks(orgId: string, limit: number, onlyId?: string): Promise<{ rows: ArtRow[]; images: Map<string, string[]> }> {
  try {
    const rows = onlyId
      ? await db<ArtRow[]>`SELECT ${ART_COLS()} ${artFrom(orgId)} AND a.id = ${onlyId}::uuid AND a.status = ANY(${LISTED_ARTWORK}) LIMIT 1`
      : await db<ArtRow[]>`SELECT ${ART_COLS()} ${artFrom(orgId)} AND a.status = 'available' ORDER BY a.created_at DESC LIMIT ${limit}`;
    const images = new Map<string, string[]>();
    if (rows.length) {
      const m = await db<Array<{ id: string; url: string }>>`
        SELECT am.artwork_id::text AS id, am.url FROM artwork_media am
        WHERE am.artwork_id = ANY(${rows.map((r) => r.id)}::uuid[]) AND am.url IS NOT NULL
        ORDER BY am.position, am.created_at`;
      for (const x of m) images.set(x.id, [...(images.get(x.id) ?? []), x.url]);
    }
    return { rows, images };
  } catch (err) {
    console.error("[offer-load] artworks:", err);
    return { rows: [], images: new Map() };
  }
}

const cm = (v: string | null): string | null => (v && Number(v) > 0 ? String(Number(v)) : null);

export function artworkOffer(a: ArtRow, images: string[], ownerId: string, featured: boolean): SurfaceOffer {
  const priceMinor = a.price_minor == null ? 0 : Number(a.price_minor);
  const dims = [cm(a.height_cm), cm(a.width_cm), cm(a.depth_cm)].filter((d): d is string => Boolean(d));
  const size = dims.length ? `${dims.join(" × ")} cm` : null;
  const edition =
    a.edition_total && a.edition_total > 1
      ? a.edition_number
        ? `${a.edition_number} of ${a.edition_total}`
        : `Edition of ${a.edition_total}`
      : a.kind === "original"
        ? "Original"
        : null;
  const cover = a.cover ?? images[0] ?? null;
  const all = [...new Set([...(cover ? [cover] : []), ...images])];
  const forSale = a.status === "available" && priceMinor > 0;
  return {
    key: `artwork:${a.id}`,
    kind: "artwork",
    title: a.title,
    standfirst: null,
    description: a.description_html ? descriptionOf(a.description_html) || null : null,
    poster: cover,
    ...(all.length ? { images: all } : {}),
    price: priceMinor > 0 ? { amountMinor: priceMinor, currency: (a.currency || "CAD").toUpperCase() } : null,
    takeUp: forSale ? "order" : "none",
    hostId: a.maker_id ?? ownerId,
    artwork: { medium: a.medium, size, edition },
    href: `${MARKET_URL}/artworks/${a.id}`,
    featured,
  };
}
