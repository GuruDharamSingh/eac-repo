// CONTRACT: places catalogue reads (server only). Types in lib/catalogue-types.ts.
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { listBusinessesForPlaces, type PlaceBusinessLink } from "@elkdonis/services/businesses";
import type { PlaceBusinessSummary, PublicPlace, PlaceLink, Place, PlaceListFilter, PlaceSource, PlaceStats, PlaceUsage, PlaceWithStats, StopDraft } from "@/lib/catalogue-types";

/**
 * The places catalogue (migration 235). Editor-only data: `privateNotes` and
 * the stats never go to a public page. Copy on pick: a stop keeps its own
 * copy of the place's fields (stopDraftFromPlace); nothing propagates.
 */

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());
const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** Equirectangular distance in metres; plenty for a few km in Paris. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const y = b.lat - a.lat;
  return Math.round(Math.sqrt(x * x + y * y) * 111_320);
}

export function mapPlace(r: Row): Place {
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    slug: r.slug as string,
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    excerpt: (r.excerpt as string | null) ?? null,
    isPublic: r.is_public == null ? true : Boolean(r.is_public),
    operating: r.operating == null ? null : Boolean(r.operating),
    operatingKind: (r.operating_kind as string | null) ?? null,
    privateNotes: (r.private_notes as string | null) ?? null,
    lat: num(r.lat),
    lng: num(r.lng),
    heading: num(r.heading),
    pitch: num(r.pitch),
    fov: num(r.fov),
    address: (r.address as string | null) ?? null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    source: r.source as PlaceSource,
    sourceRef: (r.source_ref as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
    suggestedBy: r.suggested_by ? { userId: r.suggested_by as string, name: (r.suggested_by_name as string | null) ?? null } : null,
    archivedAt: iso(r.archived_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

function mapStats(r: Row): PlaceStats {
  return {
    placeId: r.place_id as string,
    toursCount: Number(r.tours_count ?? 0),
    publishedToursCount: Number(r.published_tours_count ?? 0),
    runsCount: Number(r.runs_count ?? 0),
    guestsCount: Number(r.guests_count ?? 0),
    lastVisitedAt: iso(r.last_visited_at),
    experiencesCount: Number(r.experiences_count ?? 0),
  };
}

const emptyStats = (placeId: string): PlaceStats => ({
  placeId,
  toursCount: 0,
  publishedToursCount: 0,
  runsCount: 0,
  guestsCount: 0,
  lastVisitedAt: null,
  experiencesCount: 0,
});

/** The place's card image: first visible image asset, else the still of its most recent linked stop. */
const IMAGE_SQL = db`
  COALESCE(
    (SELECT a.url FROM tour_assets a
      WHERE a.place_id = p.id AND a.stop_id IS NULL AND a.kind IN ('image','still') AND a.visible AND a.archived_at IS NULL
      ORDER BY a.position, a.created_at LIMIT 1),
    (SELECT s.still_url FROM tour_stops s WHERE s.place_id = p.id AND s.still_url IS NOT NULL
      ORDER BY s.updated_at DESC LIMIT 1)
  ) AS image_url
`;

/** Catalogue rows with stats. Filters: text, tag, used/unused, near a point (nearest first). */
export async function listPlaces(filter: PlaceListFilter = {}): Promise<PlaceWithStats[]> {
  const q = filter.q?.trim() ? `%${filter.q.trim().toLowerCase()}%` : null;
  const near = filter.near && Number.isFinite(filter.near.lat) && Number.isFinite(filter.near.lng) ? filter.near : null;
  const radius = Math.min(Math.max(near?.radiusM ?? 600, 50), 20_000);
  const limit = Math.min(Math.max(filter.limit ?? 500, 1), 1000);
  // Degrees box around `near` for the index, then the exact distance.
  const dLat = radius / 111_320;
  const dLng = near ? radius / (111_320 * Math.cos((near.lat * Math.PI) / 180)) : 0;
  try {
    const rows = (await db`
      SELECT p.*, ${IMAGE_SQL}, st.tours_count, st.published_tours_count, st.runs_count, st.guests_count,
             st.last_visited_at, st.experiences_count
      FROM places p
      LEFT JOIN place_stats st ON st.place_id = p.id
      WHERE p.org_id = ${ORG}
        ${filter.includeArchived ? db`` : db`AND p.archived_at IS NULL`}
        ${q ? db`AND (lower(p.title) LIKE ${q} OR lower(COALESCE(p.address, '')) LIKE ${q} OR lower(array_to_string(p.tags, ' ')) LIKE ${q})` : db``}
        ${filter.tag ? db`AND ${filter.tag} = ANY(p.tags)` : db``}
        ${filter.used === true ? db`AND EXISTS (SELECT 1 FROM tour_stops s WHERE s.place_id = p.id)` : db``}
        ${filter.used === false ? db`AND NOT EXISTS (SELECT 1 FROM tour_stops s WHERE s.place_id = p.id)` : db``}
        ${near ? db`AND p.lat BETWEEN ${near.lat - dLat} AND ${near.lat + dLat} AND p.lng BETWEEN ${near.lng - dLng} AND ${near.lng + dLng}` : db``}
      ORDER BY lower(p.title)
      LIMIT ${near ? 1000 : limit}
    `) as unknown as Row[];
    let out = rows.map((r) => ({ ...mapPlace(r), stats: mapStats({ ...r, place_id: r.id }) }));
    if (near) {
      out = out
        .filter((p) => p.lat != null && p.lng != null && distanceM(near, { lat: p.lat, lng: p.lng }) <= radius)
        .sort((a, b) => distanceM(near, { lat: a.lat!, lng: a.lng! }) - distanceM(near, { lat: b.lat!, lng: b.lng! }))
        .slice(0, limit);
    }
    const [links, biz] = await Promise.all([placeLinksFor(out.map((p) => p.id)), placeBusinessesFor(out.map((p) => p.id))]);
    return out.map((p) => ({ ...p, links: links.get(p.id) ?? [], businesses: biz.get(p.id) ?? [] }));
  } catch (err) {
    console.error("[elktours] listPlaces:", err);
    return [];
  }
}

export async function getPlace(id: string): Promise<PlaceWithStats | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const [r] = (await db`
      SELECT p.*, ${IMAGE_SQL}, st.tours_count, st.published_tours_count, st.runs_count, st.guests_count,
             st.last_visited_at, st.experiences_count, sb.display_name AS suggested_by_name
      FROM places p LEFT JOIN place_stats st ON st.place_id = p.id
      LEFT JOIN users sb ON sb.id = p.suggested_by
      WHERE p.id = ${id} AND p.org_id = ${ORG}
    `) as unknown as Row[];
    if (!r) return null;
    const [links, biz] = await Promise.all([placeLinksFor([id]), placeBusinessesFor([id])]);
    return { ...mapPlace(r), stats: mapStats({ ...r, place_id: r.id }), links: links.get(id) ?? [], businesses: biz.get(id) ?? [] };
  } catch (err) {
    console.error(`[elktours] getPlace(${id}):`, err);
    return null;
  }
}

export async function getPlaceStats(ids: string[]): Promise<Map<string, PlaceStats>> {
  const out = new Map<string, PlaceStats>();
  const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (valid.length === 0) return out;
  try {
    const rows = (await db`
      SELECT * FROM place_stats WHERE org_id = ${ORG} AND place_id = ANY(${valid}::uuid[])
    `) as unknown as Row[];
    for (const r of rows) out.set(r.place_id as string, mapStats(r));
  } catch (err) {
    console.error("[elktours] getPlaceStats:", err);
  }
  for (const id of valid) if (!out.has(id)) out.set(id, emptyStats(id));
  return out;
}

/** Tour stops that link to this place (editor view: drafts included). */
export async function listPlaceUsage(placeId: string): Promise<PlaceUsage[]> {
  if (!/^[0-9a-f-]{36}$/i.test(placeId)) return [];
  try {
    const rows = (await db`
      SELECT s.id AS stop_id, s.thread_id, s.position, t.title, t.slug, t.status
      FROM tour_stops s JOIN threads t ON t.id = s.thread_id
      WHERE s.place_id = ${placeId} AND s.org_id = ${ORG}
      ORDER BY t.status = 'published' DESC, t.title, s.position
    `) as unknown as Row[];
    return rows.map((r) => ({
      stopId: r.stop_id as string,
      threadId: r.thread_id as string,
      tourTitle: r.title as string,
      tourSlug: r.slug as string,
      tourStatus: r.status as string,
      position: Number(r.position),
    }));
  } catch (err) {
    console.error("[elktours] listPlaceUsage:", err);
    return [];
  }
}

export async function listPlaceTags(): Promise<string[]> {
  try {
    const rows = (await db`
      SELECT DISTINCT unnest(tags) AS tag FROM places WHERE org_id = ${ORG} AND archived_at IS NULL ORDER BY 1
    `) as unknown as Row[];
    return rows.map((r) => r.tag as string);
  } catch (err) {
    console.error("[elktours] listPlaceTags:", err);
    return [];
  }
}

/** Copy on pick: the stop gets its own copy of the place's public fields. */
export function stopDraftFromPlace(place: Place): StopDraft {
  return {
    id: null,
    title: place.title,
    body: place.body,
    lat: place.lat,
    lng: place.lng,
    heading: place.heading,
    pitch: place.pitch,
    fov: place.fov,
    imageUrl: null,
    durationMinutes: null,
    placeId: place.id,
    experienceId: null,
  };
}

/** Slug from a title, unique in the org (suffix -2, -3 ... on collision). */
export async function uniquePlaceSlug(title: string, exceptId?: string): Promise<string> {
  const base =
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[’']/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "place";
  const rows = (await db`
    SELECT slug FROM places WHERE org_id = ${ORG} AND (slug = ${base} OR slug LIKE ${base + "-%"})
      ${exceptId ? db`AND id <> ${exceptId}` : db``}
  `) as unknown as Row[];
  const taken = new Set(rows.map((r) => r.slug as string));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now().toString(36)}`;
}

/** Batch listPlaceUsage: one query for many places (the /manage/places list). Every id gets an entry. */
export async function listPlaceUsageMany(placeIds: string[]): Promise<Map<string, PlaceUsage[]>> {
  const out = new Map<string, PlaceUsage[]>();
  const valid = placeIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  for (const id of valid) out.set(id, []);
  if (valid.length === 0) return out;
  try {
    const rows = (await db`
      SELECT s.place_id, s.id AS stop_id, s.thread_id, s.position, t.title, t.slug, t.status
      FROM tour_stops s JOIN threads t ON t.id = s.thread_id
      WHERE s.place_id = ANY(${valid}::uuid[]) AND s.org_id = ${ORG}
      ORDER BY t.status = 'published' DESC, t.title, s.position
    `) as unknown as Row[];
    for (const r of rows) {
      out.get(r.place_id as string)?.push({
        stopId: r.stop_id as string,
        threadId: r.thread_id as string,
        tourTitle: r.title as string,
        tourSlug: r.slug as string,
        tourStatus: r.status as string,
        position: Number(r.position),
      });
    }
  } catch (err) {
    console.error("[elktours] listPlaceUsageMany:", err);
  }
  return out;
}

const LINK_ORDER = ["website", "wikipedia_en", "wikipedia_fr", "wikidata", "osm"];

/** Confident outbound links per place (place_links, migration 239). One website: Wikidata's P856 is preferred over OSM's. */
export async function placeLinksFor(placeIds: string[]): Promise<Map<string, PlaceLink[]>> {
  const out = new Map<string, PlaceLink[]>();
  const valid = placeIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (valid.length === 0) return out;
  try {
    const rows = (await db`
      SELECT place_id, kind, url, source, source_ref FROM place_links
      WHERE confident AND place_id = ANY(${valid}::uuid[])
      ORDER BY place_id, kind, CASE source WHEN 'manual' THEN 0 WHEN 'wikidata' THEN 1 ELSE 2 END
    `) as unknown as Row[];
    for (const r of rows) {
      const list = out.get(r.place_id as string) ?? [];
      if (list.some((l) => l.kind === r.kind)) continue;
      const web = r.source === "web";
      list.push({
        kind: r.kind as PlaceLink["kind"],
        url: r.url as string,
        source: (web ? "manual" : r.source) as PlaceLink["source"],
        sourceRef: web ? "web:" + ((r.source_ref as string | null) ?? "") : ((r.source_ref as string | null) ?? null),
      });
      out.set(r.place_id as string, list);
    }
    for (const list of out.values()) list.sort((a, b) => LINK_ORDER.indexOf(a.kind) - LINK_ORDER.indexOf(b.kind));
  } catch (err) {
    console.error("[elktours] placeLinksFor:", err);
  }
  return out;
}

/**
 * Public places read: is_public and not archived only, without private notes, stats or
 * provenance. Safe to pass to public pages and client components.
 */
export async function listPublicPlaces(filter: { q?: string; tag?: string; limit?: number } = {}): Promise<PublicPlace[]> {
  const q = filter.q?.trim() ? `%${filter.q.trim().toLowerCase()}%` : null;
  const limit = Math.min(Math.max(filter.limit ?? 500, 1), 1000);
  try {
    const rows = (await db`
      SELECT p.id, p.slug, p.title, p.excerpt, p.body, p.lat, p.lng, p.heading, p.pitch, p.fov, p.address, p.tags, ${IMAGE_SQL}
      FROM places p
      WHERE p.org_id = ${ORG} AND p.is_public AND p.archived_at IS NULL
        ${q ? db`AND (lower(p.title) LIKE ${q} OR lower(COALESCE(p.address, '')) LIKE ${q})` : db``}
        ${filter.tag ? db`AND ${filter.tag} = ANY(p.tags)` : db``}
      ORDER BY lower(p.title)
      LIMIT ${limit}
    `) as unknown as Row[];
    return await toPublic(rows);
  } catch (err) {
    console.error("[elktours] listPublicPlaces:", err);
    return [];
  }
}

export async function getPublicPlace(slugOrId: string): Promise<PublicPlace | null> {
  try {
    const rows = (await db`
      SELECT p.id, p.slug, p.title, p.excerpt, p.body, p.lat, p.lng, p.heading, p.pitch, p.fov, p.address, p.tags, ${IMAGE_SQL}
      FROM places p
      WHERE p.org_id = ${ORG} AND p.is_public AND p.archived_at IS NULL
        AND (p.slug = ${slugOrId} ${/^[0-9a-f-]{36}$/i.test(slugOrId) ? db`OR p.id = ${slugOrId}` : db``})
      LIMIT 1
    `) as unknown as Row[];
    return (await toPublic(rows))[0] ?? null;
  } catch (err) {
    console.error(`[elktours] getPublicPlace(${slugOrId}):`, err);
    return null;
  }
}

async function toPublic(rows: Row[]): Promise<PublicPlace[]> {
  const ids = rows.map((r) => r.id as string);
  const [links, tourRows] = await Promise.all([
    placeLinksFor(ids),
    ids.length
      ? (db`
          SELECT DISTINCT s.place_id, t.title, t.slug FROM tour_stops s JOIN threads t ON t.id = s.thread_id
          WHERE s.place_id = ANY(${ids}::uuid[]) AND t.status = 'published' AND t.visibility = 'PUBLIC'
          ORDER BY t.title
        ` as unknown as Promise<Row[]>)
      : Promise.resolve([] as Row[]),
  ]);
  const tours = new Map<string, { title: string; slug: string }[]>();
  for (const t of tourRows) (tours.get(t.place_id as string) ?? tours.set(t.place_id as string, []).get(t.place_id as string)!).push({ title: t.title as string, slug: t.slug as string });
  return rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    excerpt: (r.excerpt as string | null) ?? null,
    body: (r.body as string | null) ?? null,
    lat: num(r.lat),
    lng: num(r.lng),
    heading: num(r.heading),
    pitch: num(r.pitch),
    fov: num(r.fov),
    address: (r.address as string | null) ?? null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    imageUrl: (r.image_url as string | null) ?? null,
    links: links.get(r.id as string) ?? [],
    tours: tours.get(r.id as string) ?? [],
  }));
}

const ARTDIRECT = (process.env.ARTDIRECT_URL ?? process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");

export function toBusinessSummary(l: PlaceBusinessLink): PlaceBusinessSummary {
  const b = l.business;
  return {
    userId: b.userId,
    slug: b.slug,
    name: b.name,
    category: b.category,
    categoryLabel: b.categoryLabel,
    streetAddress: b.streetAddress,
    postalCode: b.postalCode,
    city: b.city,
    website: b.website,
    websiteStatus: b.websiteStatus,
    phone: b.phone,
    openingHours: b.openingHours,
    status: b.status,
    marking: b.marking,
    steward: b.steward,
    attributions: b.attributions,
    relation: l.relation,
    isPrimary: l.isPrimary,
    pageUrl: ARTDIRECT ? `${ARTDIRECT}/${b.slug}` : null,
  };
}

/** Current businesses per place (primary first), public facts only. Fail-soft. */
export async function placeBusinessesFor(placeIds: string[]): Promise<Map<string, PlaceBusinessSummary[]>> {
  const out = new Map<string, PlaceBusinessSummary[]>();
  try {
    const m = await listBusinessesForPlaces(placeIds);
    for (const [pid, links] of m) out.set(pid, links.map(toBusinessSummary));
  } catch (err) {
    console.error("[elktours] placeBusinessesFor:", err);
  }
  return out;
}
