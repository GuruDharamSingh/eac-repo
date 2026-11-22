// CONTRACT: public places for the mobile catalogue, Discover shelf and place sheet. Server only.
// Wraps listPublicPlaces/getPublicPlace (lib/places.ts); adds tag order and favourites.
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getPublicPlace, listPublicPlaces, placeBusinessesFor } from "@/lib/places";
import type { PublicPlace } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;

export interface PlaceFeaturedBy {
  userId: string;
  name: string | null;
  slug: string | null;
}

/** A published tour that visits the place; `stop` is the 1-based stop number on that tour ("Stop IV"). */
export interface PlaceTourLink {
  title: string;
  slug: string;
  stop: number;
}

/**
 * A public place plus what the mobile screens add. `tags` is already on PublicPlace.
 * `tours` replaces PublicPlace.tours with the stop number added (title and slug are the same).
 */
export interface PlaceView extends Omit<PublicPlace, "tours"> {
  tours: PlaceTourLink[];
  /**
   * Opening hours in OSM opening_hours syntax, from the place's primary business listing
   * (business_listings.opening_hours via place_businesses, migration 242). Null when the place has no
   * business with hours: places have no hours column of their own.
   */
  hours: string | null;
  /** True when at least one guide has starred it. */
  favourite: boolean;
  featuredBy: PlaceFeaturedBy[];
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * Favourites by place id. The place_favourites table arrives in a later migration
 * (drafted in ELKTOURS_MOBILE_2026-11-15/migrations-draft); until then the query
 * fails and every place reads as not a favourite.
 */
async function favouritesFor(ids: string[]): Promise<Map<string, PlaceFeaturedBy[]>> {
  const out = new Map<string, PlaceFeaturedBy[]>();
  if (!ids.length) return out;
  try {
    const rows = (await db`
      SELECT f.place_id, u.id AS user_id, u.display_name, u.slug
      FROM place_favourites f JOIN users u ON u.id = f.user_id
      WHERE f.org_id = ${ORG} AND f.featured AND f.place_id = ANY(${ids})
      ORDER BY f.created_at
    `) as unknown as Row[];
    for (const r of rows) {
      const list = out.get(r.place_id as string) ?? [];
      list.push({ userId: r.user_id as string, name: (r.display_name as string | null) ?? null, slug: (r.slug as string | null) ?? null });
      out.set(r.place_id as string, list);
    }
  } catch {
    /* table not there yet */
  }
  return out;
}

/** Stop number of each place on each published tour: place id -> tour slug -> 1-based stop (the first, if a tour visits twice). */
async function stopNumbers(ids: string[]): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>();
  if (!ids.length) return out;
  try {
    const rows = (await db`
      SELECT s.place_id, t.slug,
             (SELECT COUNT(*) FROM tour_stops s2 WHERE s2.thread_id = s.thread_id AND s2.position <= s.position)::int AS stop_no
      FROM tour_stops s JOIN threads t ON t.id = s.thread_id
      WHERE s.place_id = ANY(${ids}::uuid[]) AND t.org_id = ${ORG} AND t.status = 'published' AND t.visibility = 'PUBLIC'
      ORDER BY s.position
    `) as unknown as Row[];
    for (const r of rows) {
      const m = out.get(r.place_id as string) ?? new Map<string, number>();
      if (!m.has(r.slug as string)) m.set(r.slug as string, Number(r.stop_no));
      out.set(r.place_id as string, m);
    }
  } catch (err) {
    console.error("[elktours] stopNumbers:", err);
  }
  return out;
}

/** Opening hours per place: the first current business (primary first) that has hours. */
async function hoursFor(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const m = await placeBusinessesFor(ids);
  for (const [pid, list] of m) {
    const b = list.find((x) => x.status !== "removed" && x.relation !== "former" && x.openingHours);
    if (b?.openingHours) out.set(pid, b.openingHours);
  }
  return out;
}

interface Extras { fav: Map<string, PlaceFeaturedBy[]>; stops: Map<string, Map<string, number>>; hours: Map<string, string> }

async function extrasFor(ids: string[]): Promise<Extras> {
  const [fav, stops, hours] = await Promise.all([favouritesFor(ids), stopNumbers(ids), hoursFor(ids)]);
  return { fav, stops, hours };
}

function view(p: PublicPlace, x: Extras): PlaceView {
  const featuredBy = x.fav.get(p.id) ?? [];
  const stops = x.stops.get(p.id);
  return {
    ...p,
    tours: p.tours.map((t) => ({ title: t.title, slug: t.slug, stop: stops?.get(t.slug) ?? 0 })),
    hours: x.hours.get(p.id) ?? null,
    favourite: featuredBy.length > 0,
    featuredBy,
  };
}

/** Tags in use on the given places, most used first, then A-Z. */
export function tagOrderOf(places: Pick<PublicPlace, "tags">[]): TagCount[] {
  const n = new Map<string, number>();
  for (const p of places) for (const t of new Set(p.tags ?? [])) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * The catalogue. `tagOrder` counts tags over ALL public places (not the filtered list), so the filter
 * chips do not shrink while filtering. `favouritesOnly` keeps starred places.
 */
export async function listPlacesPublic(
  filter: { q?: string; tag?: string; favouritesOnly?: boolean; limit?: number } = {}
): Promise<{ places: PlaceView[]; tagOrder: TagCount[]; favouriteCount: number }> {
  const filtered = Boolean(filter.q || filter.tag || filter.limit);
  const [all, shown] = await Promise.all([
    listPublicPlaces({ limit: 1000 }),
    filtered ? listPublicPlaces({ q: filter.q, tag: filter.tag, limit: filter.limit }) : Promise.resolve(null),
  ]);
  const x = await extrasFor(all.map((p) => p.id));
  const views = (shown ?? all).map((p) => view(p, x));
  return {
    places: filter.favouritesOnly ? views.filter((p) => p.favourite) : views,
    tagOrder: tagOrderOf(all),
    favouriteCount: all.filter((p) => (x.fav.get(p.id) ?? []).length > 0).length,
  };
}

/** The Discover shelf: places a guide has starred (empty until place_favourites exists). */
export async function listFavouritePlaces(limit = 8): Promise<PlaceView[]> {
  const { places } = await listPlacesPublic({ favouritesOnly: true });
  return places.slice(0, limit);
}

/** The place sheet. */
export async function getPlacePublic(slugOrId: string): Promise<PlaceView | null> {
  const p = await getPublicPlace(slugOrId);
  if (!p) return null;
  return view(p, await extrasFor([p.id]));
}

export type PlacePhotoSource = "stop_still" | "stop_image" | "custom" | "business" | "asset";

export interface PlacePhoto {
  url: string;
  /** "Tour title · Stop IV" for a stop's picture; the editor's caption (or null) for the rest. */
  caption: string | null;
  source: PlacePhotoSource;
}

/**
 * Every public photo of a public place, for a lightbox: Street View stills and pictures of its stops on
 * published tours (captioned "tour · Stop N"), the place's own pictures (custom place photos and other
 * visible place assets, never anything under the Private/ folder, whose EXIF-stripped public copy is
 * the visible row), and the photo of a business listed there. A still whose switch the guide turned off
 * is left out. Unique by url; stills first, then stop pictures, the place's own, then the business.
 * Empty for a place that is private, archived or unknown. Fail-soft.
 */
export async function listPlacePhotos(placeId: string): Promise<PlacePhoto[]> {
  if (!/^[0-9a-f-]{36}$/i.test(placeId)) return [];
  const privateKey = `EAC_Network/${ORG}/Private/%`;
  const privateUrl = `%/EAC_Network/${ORG}/Private/%`;
  try {
    const [place] = (await db`
      SELECT id FROM places WHERE id = ${placeId} AND org_id = ${ORG} AND is_public AND archived_at IS NULL
    `) as unknown as Row[];
    if (!place) return [];
    const [stops, own, biz] = await Promise.all([
      db`
        SELECT s.id, s.still_url, s.image_url, t.title AS tour_title,
               (SELECT COUNT(*) FROM tour_stops s2 WHERE s2.thread_id = s.thread_id AND s2.position <= s.position)::int AS stop_no,
               NOT EXISTS (SELECT 1 FROM tour_assets a WHERE a.stop_id = s.id AND a.kind = 'still' AND a.archived_at IS NULL AND NOT a.visible) AS still_on
        FROM tour_stops s JOIN threads t ON t.id = s.thread_id
        WHERE s.place_id = ${placeId} AND s.org_id = ${ORG} AND t.kind = 'tour' AND t.status = 'published' AND t.visibility = 'PUBLIC'
        ORDER BY t.title, s.position
      ` as unknown as Promise<Row[]>,
      db`
        SELECT a.url, a.caption, a.source
        FROM tour_assets a
        WHERE a.org_id = ${ORG} AND a.place_id = ${placeId} AND a.stop_id IS NULL AND a.thread_id IS NULL
          AND a.kind IN ('image', 'still') AND a.visible AND a.archived_at IS NULL AND a.url IS NOT NULL
          AND COALESCE(a.storage_key, '') NOT LIKE ${privateKey} AND a.url NOT LIKE ${privateUrl}
        ORDER BY a.position, a.created_at
      ` as unknown as Promise<Row[]>,
      db`
        SELECT b.photo_url
        FROM place_businesses pb JOIN business_listings b ON b.user_id = pb.business_user_id
        WHERE pb.place_id = ${placeId} AND b.photo_url IS NOT NULL AND b.status <> 'removed' AND b.removed_at IS NULL
        ORDER BY pb.is_primary DESC, pb.created_at
      ` as unknown as Promise<Row[]>,
    ]);
    const seen = new Set<string>();
    const out: PlacePhoto[] = [];
    const add = (url: unknown, caption: string | null, source: PlacePhotoSource) => {
      if (typeof url !== "string" || !url || seen.has(url)) return;
      seen.add(url);
      out.push({ url, caption, source });
    };
    const label = (r: Row) => `${r.tour_title as string} · Stop ${r.stop_no as number}`;
    for (const r of stops) if (r.still_on) add(r.still_url, label(r), "stop_still");
    for (const r of stops) add(r.image_url, label(r), "stop_image");
    for (const r of own) add(r.url, (r.caption as string | null) ?? null, r.source === "photo" ? "custom" : "asset");
    for (const r of biz) add(r.photo_url, null, "business");
    return out;
  } catch (err) {
    console.error("[elktours] listPlacePhotos:", err);
    return [];
  }
}
