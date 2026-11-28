import "server-only";
import { db } from "@elkdonis/db";
import { countConfirmedRsvps, getOrgFollowerCount, getOrgIdentity } from "@elkdonis/services";
import { getOfferingThread, getOrgBySlug, type OrgFeedItem } from "@/lib/org";
import type {
  OfferKind,
  SurfaceLook,
  SurfaceOffer,
  SurfaceProfile,
  SurfaceSiteData,
  SurfaceWritingPiece,
  TakeUp,
} from "@elkdonis/cms-ui/offer-surface";

/**
 * Data for the free-tier single-offer page (`/sites/<slug>`, new look):
 * the owner's profile, the featured offer, the org's other offers, writing,
 * follower count and the viewer's follow state.
 *
 * Reads only. The viewer comes from the session (callers pass it), never from
 * request parameters. Public rows only: published, `visibility = 'PUBLIC'`,
 * no `min_role`, so a members-only post never reaches a signed-out page.
 *
 * Take-up rules are mirrored from the offers view (agent D, content-index.ts);
 * once `searchContent` `view: "offers"` exists, replace `readOfferRows` with it
 * (2026-11-27: direct read, noted on the board).
 */

export const LOOK_KEY = "offer:look";

const EVENT_KINDS = new Set(["event", "meeting", "workshop", "reading_group"]);
const OFFER_KINDS = ["event", "meeting", "workshop", "reading_group", "series", "service"];
const WRITING_KINDS = ["writing", "post"];

export interface OfferSiteViewer {
  userId: string;
  name?: string | null;
  email?: string | null;
}

const FONTS: SurfaceLook["font"][] = ["para", "gazette", "quiet", "marquee", "ledger", "rite"];
const ICONS: SurfaceLook["icons"][] = ["things", "marks", "stamps", "glyph"];
const MARKS: SurfaceLook["mark"][] = ["inline", "thumb", "box"];

/** The fallback when a site has no look yet; equal to the contract's DEFAULT_LOOK. */
export const FALLBACK_LOOK: SurfaceLook = { font: "para", icons: "things", mark: "inline", tint: true };

/** Reads `offer:look` and keeps only known values; null when the row is absent or unreadable. */
export function cleanLook(value: unknown): SurfaceLook | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const pick = <T extends string>(x: unknown, allowed: T[], d: T): T => (allowed.includes(x as T) ? (x as T) : d);
  return {
    font: pick(v.font, FONTS, FALLBACK_LOOK.font),
    icons: pick(v.icons, ICONS, FALLBACK_LOOK.icons),
    mark: pick(v.mark, MARKS, FALLBACK_LOOK.mark),
    tint: typeof v.tint === "boolean" ? v.tint : FALLBACK_LOOK.tint,
    // The hub's Current Work Page card sets it (phone sheet height); an older row has none and reads as natural.
    sheet: v.sheet === "level" ? "level" : "natural",
  };
}

/** Whether the site opted in: the `offer:look` row exists and says `enabled: true`. */
export async function readOfferLook(orgId: string): Promise<{ enabled: boolean; look: SurfaceLook } | null> {
  try {
    const rows = await db<Array<{ value: unknown }>>`
      SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${LOOK_KEY} LIMIT 1
    `;
    if (!rows[0]) return null;
    const look = cleanLook(rows[0].value) ?? FALLBACK_LOOK;
    const enabled = (rows[0].value as Record<string, unknown> | null)?.enabled === true;
    return { enabled, look };
  } catch (err) {
    console.error("[offer-site] look read:", err);
    return null;
  }
}

type Row = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  excerpt: string | null;
  body: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  location: string | null;
  format: string | null;
  is_online: boolean | null;
  is_rsvp_enabled: boolean | null;
  attendee_limit: number | null;
  price: string | number | null;
  currency: string | null;
  author_id: string;
  cover: string | null;
};

function kindOf(kind: string): OfferKind {
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

function toOffer(r: Row, featuredId: string | null, coming: number | null): SurfaceOffer {
  const kind = kindOf(r.kind);
  const priceMinor = r.price == null ? 0 : Math.round(Number(r.price) * 100);
  const rsvp = Boolean(r.is_rsvp_enabled);
  const start = r.scheduled_at ? new Date(r.scheduled_at) : null;
  const end = start && r.duration_minutes ? new Date(start.getTime() + r.duration_minutes * 60_000) : null;
  const online = r.format === "online" || r.is_online === true;
  return {
    key: `thread:${r.id}`,
    kind,
    title: r.title,
    standfirst: r.excerpt,
    // Bodies are sanitised on write; a very long one is left to the offer's own page.
    description: r.body && r.body.length <= 20_000 ? r.body : null,
    poster: r.cover,
    when: start ? { start: start.toISOString(), end: end ? end.toISOString() : null, timeZone: null } : null,
    venue: r.location || online ? { name: r.location, address: null, online } : null,
    price: priceMinor > 0 ? { amountMinor: priceMinor, currency: (r.currency ?? "USD").toUpperCase() } : null,
    takeUp: takeUpOf(kind, priceMinor, rsvp),
    capacity: rsvp ? { limit: r.attendee_limit, coming: coming ?? 0 } : null,
    durationMinutes: r.duration_minutes,
    hostId: r.author_id,
    href: `/${r.slug}`,
    featured: featuredId === r.id,
  };
}

function toOfferFromFeed(t: OrgFeedItem, authorId: string): Row {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    kind: t.kind,
    excerpt: t.excerpt,
    body: t.body,
    scheduled_at: t.scheduled_at,
    duration_minutes: t.duration_minutes,
    location: t.location,
    format: t.format,
    is_online: null,
    is_rsvp_enabled: t.is_rsvp_enabled,
    attendee_limit: t.attendee_limit,
    price: t.price,
    currency: t.currency,
    author_id: authorId,
    cover: t.cover_image_url ?? null,
  };
}

async function readOfferRows(orgId: string, limit: number): Promise<Row[]> {
  try {
    return await db<Row[]>`
      SELECT id, slug, title, kind, excerpt, body, scheduled_at, duration_minutes, location,
             format, is_online, is_rsvp_enabled, attendee_limit, price, currency, author_id,
             metadata->>'coverImageUrl' AS cover
      FROM threads
      WHERE org_id = ${orgId}
        AND status = 'published'
        AND visibility = 'PUBLIC'
        AND min_role IS NULL
        AND kind = ANY(${OFFER_KINDS})
      ORDER BY pinned DESC, COALESCE(scheduled_at, published_at, created_at) DESC
      LIMIT ${limit}
    `;
  } catch (err) {
    console.error("[offer-site] offers read:", err);
    return [];
  }
}

async function readWriting(orgId: string, limit: number): Promise<SurfaceWritingPiece[]> {
  try {
    const rows = await db<Array<{ id: string; slug: string; title: string; excerpt: string | null; cover: string | null; len: number }>>`
      SELECT id, slug, title, excerpt, metadata->>'coverImageUrl' AS cover,
             length(regexp_replace(COALESCE(body, ''), '<[^>]*>', ' ', 'g')) AS len
      FROM threads
      WHERE org_id = ${orgId}
        AND status = 'published'
        AND visibility = 'PUBLIC'
        AND min_role IS NULL
        AND kind = ANY(${WRITING_KINDS})
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      key: `thread:${r.id}`,
      title: r.title,
      standfirst: r.excerpt,
      cover: r.cover,
      href: `/${r.slug}`,
      // About 220 words a minute, rounded up; at least one.
      minutes: Math.max(1, Math.ceil(Number(r.len) / 1300)),
    }));
  } catch (err) {
    console.error("[offer-site] writing read:", err);
    return [];
  }
}

/** Profile of an author who is not the site's owner (hosts of other offers), from `users`. */
async function readPeople(ids: string[]): Promise<Record<string, SurfaceProfile>> {
  if (!ids.length) return {};
  try {
    const rows = await db<Array<{ id: string; name: string | null; headline: string | null; bio: string | null; avatar: string | null; slug: string | null }>>`
      SELECT id, display_name AS name, headline, bio, avatar_url AS avatar, slug
      FROM users WHERE id = ANY(${ids}::uuid[])
    `;
    return Object.fromEntries(
      rows.map((r) => [
        r.id,
        { id: r.id, name: r.name ?? "Host", role: r.headline, bio: r.bio, portrait: r.avatar, links: [] } satisfies SurfaceProfile,
      ])
    );
  } catch (err) {
    console.error("[offer-site] people read:", err);
    return {};
  }
}


/**
 * Everything the single-offer page needs. Returns null when the org does not
 * exist. `origin` is the site's public origin (`https://<slug>.<root>`).
 *
 * Since 2026-11-27 this is `loadOfferPage` (lib/offer-load): the featured piece
 * by content key, artworks and writing, the template, and the public test on
 * every lookup. Imported lazily because that module reads `readOfferLook` from here.
 * The first-pass helpers above (`readOfferRows`, `toOffer`, ...) are no longer
 * called and can go in a later cleanup.
 */
export async function loadSurfaceSite(
  slug: string,
  viewer: OfferSiteViewer | null,
  origin: string
): Promise<SurfaceSiteData | null> {
  const { loadOfferPage } = await import("./offer-load");
  return loadOfferPage(slug, viewer, origin);
}
