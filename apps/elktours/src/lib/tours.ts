import { db } from "@elkdonis/db";
import {
  listTourDepartures,
  listTourStops,
  type TourDeparture,
  type TourStop,
} from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";

/**
 * Read layer for tours.
 *
 * A tour is a `threads` row with `kind = 'tour'` in the `tours` section. The
 * thread carries what every thread has (title, slug, body, cover in metadata)
 * plus price per person (`price`, `currency`), length (`duration_minutes`) and
 * the meeting point (`location`). The rest of a tour's facts live in
 * `metadata.tour` (TourDetails); its stops and departures are the migration
 * 208 tables, read through @elkdonis/commerce.
 *
 * Fail-soft like lib/data.ts: a read logs and returns empty rather than
 * throwing, so one broken section does not 500 the page.
 */

const ORG = siteConfig.orgId;

/** Walking geometry between the meeting point and each stop, cached by lib/tour-cache.ts (lng,lat pairs). */
export interface TourRoute {
  legs: [number, number][][];
  fetchedAt: string;
  source: "osrm" | "straight";
}

export interface TourDetails {
  /** Short lines shown as a list on the tour page. */
  highlights: string[];
  /** What the price covers. */
  includes: string[];
  /** Languages the tour is given in. */
  languages: string[];
  /** Map position of the meeting point; its label is threads.location. */
  meetingPoint: { lat: number; lng: number } | null;
  /** Largest party one booking may hold on this tour (null = site default). */
  maxParty: number | null;
  /** Free text: "Easy walking, 3 km", "Some stairs". */
  effort: string | null;
  /** Cached walking route, or null until the stops have been saved once. */
  route: TourRoute | null;
}

export const EMPTY_DETAILS: TourDetails = {
  highlights: [],
  includes: [],
  languages: [],
  meetingPoint: null,
  maxParty: null,
  effort: null,
  route: null,
};

export interface Tour {
  id: string;
  title: string;
  slug: string;
  status: string;
  /** Sanitised HTML. */
  body: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  /** Price per person, major units. Null or 0 = not bookable yet. */
  price: number | null;
  currency: string;
  durationMinutes: number | null;
  /** Meeting point, as a sentence. */
  location: string | null;
  details: TourDetails;
  pinned: boolean;
  authorId: string | null;
  authorName: string | null;
  authorSlug: string | null;
  authorPhoto: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TourFull extends Tour {
  stops: TourStop[];
  departures: TourDeparture[];
}

interface TourRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  body: string | null;
  excerpt: string | null;
  metadata: Record<string, unknown> | null;
  price: string | number | null;
  currency: string | null;
  duration_minutes: number | null;
  location: string | null;
  pinned: boolean;
  author_id: string | null;
  author_name: string | null;
  author_slug: string | null;
  author_photo: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = db`
  t.id, t.title, t.slug, t.status, t.body, t.excerpt, t.metadata,
  t.price, t.currency, t.duration_minutes, t.location, t.pinned,
  t.author_id, t.published_at, t.created_at, t.updated_at,
  u.display_name AS author_name, u.slug AS author_slug,
  COALESCE(op.photo_override, u.avatar_url) AS author_photo
  FROM threads t
  LEFT JOIN users u ON u.id = t.author_id
  LEFT JOIN org_profiles op ON op.user_id = t.author_id AND op.org_id = t.org_id
`;

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()) : [];
}

export function readDetails(metadata: Record<string, unknown> | null | undefined): TourDetails {
  const raw = (metadata?.tour ?? {}) as Record<string, unknown>;
  const mp = raw.meetingPoint as { lat?: unknown; lng?: unknown } | null | undefined;
  const lat = mp && typeof mp.lat === "number" ? mp.lat : null;
  const lng = mp && typeof mp.lng === "number" ? mp.lng : null;
  const maxParty = typeof raw.maxParty === "number" && raw.maxParty > 0 ? Math.floor(raw.maxParty) : null;
  return {
    highlights: strings(raw.highlights),
    includes: strings(raw.includes),
    languages: strings(raw.languages),
    meetingPoint: lat != null && lng != null ? { lat, lng } : null,
    maxParty,
    effort: typeof raw.effort === "string" && raw.effort.trim() ? raw.effort.trim() : null,
    route: readRoute(raw.route),
  };
}

function readRoute(v: unknown): TourRoute | null {
  const r = v as { legs?: unknown; fetchedAt?: unknown; source?: unknown } | null;
  if (!r || !Array.isArray(r.legs)) return null;
  const legs = r.legs
    .filter((l): l is unknown[] => Array.isArray(l))
    .map((l) => l.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === "number")));
  if (legs.length === 0) return null;
  return { legs, fetchedAt: typeof r.fetchedAt === "string" ? r.fetchedAt : "", source: r.source === "osrm" ? "osrm" : "straight" };
}

function mapTour(r: TourRow): Tour {
  const meta = r.metadata ?? {};
  const price = r.price == null ? null : Number(r.price);
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    body: r.body,
    excerpt: r.excerpt,
    coverImageUrl: typeof meta.coverImageUrl === "string" ? meta.coverImageUrl : null,
    price: price != null && Number.isFinite(price) ? price : null,
    currency: r.currency ?? siteConfig.currency,
    durationMinutes: r.duration_minutes,
    location: r.location,
    details: readDetails(meta),
    pinned: r.pinned,
    authorId: r.author_id,
    authorName: r.author_name,
    authorSlug: r.author_slug,
    authorPhoto: r.author_photo,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Published tours for the public pages, pinned first. */
export async function listTours(opts: { includeDrafts?: boolean } = {}): Promise<Tour[]> {
  try {
    const rows = await db<TourRow[]>`
      SELECT ${COLUMNS}
      WHERE t.org_id = ${ORG} AND t.kind = 'tour'
        ${opts.includeDrafts ? db`AND t.status <> 'archived'` : db`AND t.status = 'published' AND t.visibility = 'PUBLIC'`}
      ORDER BY t.pinned DESC, t.published_at DESC NULLS LAST, t.created_at DESC
      LIMIT 100
    `;
    return rows.map(mapTour);
  } catch (err) {
    console.error("[elktours] listTours:", err);
    return [];
  }
}

export async function getTourBySlug(slug: string, opts: { includeDrafts?: boolean } = {}): Promise<Tour | null> {
  try {
    const [row] = await db<TourRow[]>`
      SELECT ${COLUMNS}
      WHERE t.org_id = ${ORG} AND t.kind = 'tour' AND (t.slug = ${slug} OR t.id = ${slug})
        ${opts.includeDrafts ? db`AND t.status <> 'archived'` : db`AND t.status = 'published' AND t.visibility = 'PUBLIC'`}
      LIMIT 1
    `;
    return row ? mapTour(row) : null;
  } catch (err) {
    console.error(`[elktours] getTourBySlug(${slug}):`, err);
    return null;
  }
}

export async function getTourById(id: string): Promise<Tour | null> {
  try {
    const [row] = await db<TourRow[]>`
      SELECT ${COLUMNS} WHERE t.org_id = ${ORG} AND t.kind = 'tour' AND t.id = ${id} LIMIT 1
    `;
    return row ? mapTour(row) : null;
  } catch (err) {
    console.error(`[elktours] getTourById(${id}):`, err);
    return null;
  }
}

/** A tour with its stops and departures — the tour page and the editor. */
export async function loadTourFull(tour: Tour, opts: { upcomingOnly?: boolean; includeCancelled?: boolean } = {}): Promise<TourFull> {
  const [stops, departures] = await Promise.all([
    listTourStops(tour.id).catch((err) => {
      console.error("[elktours] listTourStops:", err);
      return [] as TourStop[];
    }),
    listTourDepartures(tour.id, opts).catch((err) => {
      console.error("[elktours] listTourDepartures:", err);
      return [] as TourDeparture[];
    }),
  ]);
  return { ...tour, stops, departures };
}

/** The next scheduled departure per tour, for cards. */
export async function nextDepartures(tourIds: string[]): Promise<Map<string, TourDeparture>> {
  const out = new Map<string, TourDeparture>();
  if (tourIds.length === 0) return out;
  await Promise.all(
    tourIds.map(async (id) => {
      const [first] = await listTourDepartures(id, { upcomingOnly: true }).catch(() => []);
      if (first) out.set(id, first);
    })
  );
  return out;
}

/** People who may lead a tour: owners and guides of this org. */
export async function listGuides(): Promise<{ id: string; name: string; email: string; role: string }[]> {
  try {
    const rows = await db<{ id: string; display_name: string | null; email: string; role: string }[]>`
      SELECT u.id, u.display_name, u.email, uo.role
      FROM user_organizations uo JOIN users u ON u.id = uo.user_id
      WHERE uo.org_id = ${ORG} AND uo.role IN ('owner', 'guide')
      ORDER BY uo.role = 'owner' DESC, u.display_name
    `;
    return rows.map((r) => ({ id: r.id, name: r.display_name ?? r.email, email: r.email, role: r.role }));
  } catch (err) {
    console.error("[elktours] listGuides:", err);
    return [];
  }
}

// ── formatting: pure helpers live in tour-format.ts (client-safe) ─────────
export { formatPrice, formatDuration, formatDeparture, toParisInput } from "@/lib/tour-format";
