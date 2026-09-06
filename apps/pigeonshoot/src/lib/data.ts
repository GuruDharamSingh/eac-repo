/**
 * Read layer.
 *
 * A card is a `threads` row with kind='pigeon' plus a `pigeon_cards` sidecar
 * (the workshop_pages precedent). Photos hang off `media` through
 * pigeon_card_images, which also carries each photo's job on the card.
 *
 * Two conventions carried from the amrit-canada template, both deliberate:
 *
 *  - Reads are FAIL-SOFT. Every exported function catches and returns []/null.
 *    A broken query should render an empty gallery, not a 500 — this site is
 *    read by strangers who will never report an error.
 *  - snake_case Row interfaces stay in this file. Callers get camelCase domain
 *    types from src/lib/types.ts, so database naming never leaks into
 *    components.
 */

import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import type {
  Area,
  Card,
  CardCriterion,
  CardImage,
  CardPin,
  City,
  Criterion,
  SiteSections,
  Species,
  Tier,
} from "@/lib/types";

const ORG = siteConfig.orgId;

// ─── shared SQL fragments ────────────────────────────────────────────────────

/**
 * What the public may see. `moderation_state` is the takedown lever — hidden
 * and removed cards stay in the table for appeal but never render.
 */
const PUBLIC_FILTER = db`
  t.org_id = ${ORG}
  AND t.kind = 'pigeon'
  AND t.status = 'published'
  AND t.visibility = 'PUBLIC'
  AND pc.moderation_state = 'live'
`;

const CARD_COLUMNS = db`
  t.id, t.slug, t.title, t.body AS story,
  t.created_at, t.published_at, t.view_count,
  pc.species_id, pc.proposed_species_name,
  pc.city_slug, pc.area_slug, pc.lat, pc.lng,
  pc.geo_source, pc.geo_precision, pc.place_note, pc.spotted_at,
  pc.auto_score, pc.auto_max, pc.owner_score, pc.tier_slug,
  pc.rating_note, pc.rated_at,
  pc.moderation_state, pc.open_report_count,
  pc.guest_id, pc.submitter_user_id,
  sp.slug AS species_slug, sp.name AS species_name, sp.accent_hex AS species_accent,
  ct.name AS city_name,
  ar.name AS area_name,
  COALESCE(g.handle, g.display_name, u.display_name) AS submitter_name
`;

const CARD_JOINS = db`
  FROM threads t
  JOIN pigeon_cards pc          ON pc.thread_id = t.id
  LEFT JOIN pigeon_species sp   ON sp.id = pc.species_id
  LEFT JOIN pigeon_cities ct    ON ct.slug = pc.city_slug
  LEFT JOIN pigeon_areas ar     ON ar.city_slug = pc.city_slug AND ar.slug = pc.area_slug
  LEFT JOIN pigeon_guests g     ON g.id = pc.guest_id
  LEFT JOIN users u             ON u.id = pc.submitter_user_id
`;

// ─── row shapes ──────────────────────────────────────────────────────────────

interface CardRow {
  id: string;
  slug: string;
  title: string;
  story: string | null;
  created_at: Date;
  published_at: Date | null;
  view_count: number;
  species_id: string | null;
  proposed_species_name: string | null;
  city_slug: string | null;
  area_slug: string | null;
  lat: number | null;
  lng: number | null;
  geo_source: Card["geoSource"];
  geo_precision: Card["geoPrecision"];
  place_note: string | null;
  spotted_at: Date | null;
  auto_score: number;
  auto_max: number;
  owner_score: number | null;
  tier_slug: string | null;
  rating_note: string | null;
  rated_at: Date | null;
  moderation_state: Card["moderationState"];
  open_report_count: number;
  guest_id: string | null;
  submitter_user_id: string | null;
  species_slug: string | null;
  species_name: string | null;
  species_accent: string | null;
  city_name: string | null;
  area_name: string | null;
  submitter_name: string | null;
}

interface ImageRow {
  thread_id: string;
  media_id: string;
  role: CardImage["role"];
  url: string;
  width: number | null;
  height: number | null;
  card_url: string | null;
  card_width: number | null;
  card_height: number | null;
  alt_text: string | null;
}

function mapCard(row: CardRow, images: CardImage[] = []): Card {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    story: row.story,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    viewCount: row.view_count,
    species:
      row.species_id && row.species_slug && row.species_name
        ? {
            id: row.species_id,
            slug: row.species_slug,
            name: row.species_name,
            accentHex: row.species_accent,
          }
        : null,
    proposedSpeciesName: row.proposed_species_name,
    citySlug: row.city_slug,
    cityName: row.city_name,
    areaSlug: row.area_slug,
    areaName: row.area_name,
    lat: row.lat,
    lng: row.lng,
    geoSource: row.geo_source,
    geoPrecision: row.geo_precision,
    placeNote: row.place_note,
    spottedAt: row.spotted_at,
    autoScore: row.auto_score,
    autoMax: row.auto_max,
    ownerScore: row.owner_score,
    tierSlug: row.tier_slug,
    ratingNote: row.rating_note,
    ratedAt: row.rated_at,
    submitterName: row.submitter_name,
    moderationState: row.moderation_state,
    openReportCount: row.open_report_count,
    images,
  };
}

function mapImage(row: ImageRow): CardImage {
  return {
    mediaId: row.media_id,
    role: row.role,
    url: row.url,
    width: row.width,
    height: row.height,
    cardUrl: row.card_url,
    cardWidth: row.card_width,
    cardHeight: row.card_height,
    altText: row.alt_text,
  };
}

/**
 * Photos for a set of cards, in one query rather than N.
 * Ordered so front comes first and the card face never has to sort.
 */
async function imagesForCards(threadIds: string[]): Promise<Map<string, CardImage[]>> {
  const out = new Map<string, CardImage[]>();
  if (threadIds.length === 0) return out;

  const rows = await db<ImageRow[]>`
    SELECT pci.thread_id, pci.media_id, pci.role,
           m.url, m.width, m.height, m.alt_text,
           pci.card_url, pci.card_width, pci.card_height
    FROM pigeon_card_images pci
    JOIN media m ON m.id = pci.media_id
    WHERE pci.thread_id = ANY(${threadIds})
    ORDER BY
      CASE pci.role WHEN 'front' THEN 0 WHEN 'side' THEN 1
                    WHEN 'detail' THEN 2 ELSE 3 END,
      pci.sort_order
  `;

  for (const row of rows) {
    const list = out.get(row.thread_id) ?? [];
    list.push(mapImage(row));
    out.set(row.thread_id, list);
  }
  return out;
}

// ─── cards ───────────────────────────────────────────────────────────────────

export interface CardFilters {
  city?: string;
  area?: string;
  species?: string;
  tier?: string;
  /** new = newest first, rated = owner-rated first, top = highest rated. */
  sort?: "new" | "rated" | "top";
  limit?: number;
  offset?: number;
}

export async function listCards(filters: CardFilters = {}): Promise<Card[]> {
  const { city, area, species, tier, sort = "new", limit = 48, offset = 0 } = filters;

  try {
    const rows = await db<CardRow[]>`
      SELECT ${CARD_COLUMNS} ${CARD_JOINS}
      WHERE ${PUBLIC_FILTER}
        ${city ? db`AND pc.city_slug = ${city}` : db``}
        ${area ? db`AND pc.area_slug = ${area}` : db``}
        ${species ? db`AND sp.slug = ${species}` : db``}
        ${tier ? db`AND pc.tier_slug = ${tier}` : db``}
      ORDER BY
        ${
          sort === "top"
            ? db`pc.owner_score DESC NULLS LAST, pc.auto_score DESC`
            : sort === "rated"
              ? db`pc.rated_at DESC NULLS LAST`
              : db`COALESCE(t.published_at, t.created_at) DESC`
        }
      LIMIT ${limit} OFFSET ${offset}
    `;

    const images = await imagesForCards(rows.map((r) => r.id));
    return rows.map((r) => mapCard(r, images.get(r.id) ?? []));
  } catch (err) {
    console.error("[pigeonshoot] listCards:", err);
    return [];
  }
}

export async function countCards(filters: CardFilters = {}): Promise<number> {
  const { city, area, species, tier } = filters;
  try {
    const rows = await db<{ n: string }[]>`
      SELECT COUNT(*) AS n ${CARD_JOINS}
      WHERE ${PUBLIC_FILTER}
        ${city ? db`AND pc.city_slug = ${city}` : db``}
        ${area ? db`AND pc.area_slug = ${area}` : db``}
        ${species ? db`AND sp.slug = ${species}` : db``}
        ${tier ? db`AND pc.tier_slug = ${tier}` : db``}
    `;
    return Number(rows[0]?.n ?? 0);
  } catch (err) {
    console.error("[pigeonshoot] countCards:", err);
    return 0;
  }
}

export async function getCardBySlug(slug: string): Promise<Card | null> {
  try {
    const rows = await db<CardRow[]>`
      SELECT ${CARD_COLUMNS} ${CARD_JOINS}
      WHERE ${PUBLIC_FILTER} AND t.slug = ${slug}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const images = await imagesForCards([rows[0].id]);
    return mapCard(rows[0], images.get(rows[0].id) ?? []);
  } catch (err) {
    console.error("[pigeonshoot] getCardBySlug:", err);
    return null;
  }
}

/**
 * Any card by id regardless of status or moderation state — for the owner's
 * manage screens and for a contributor viewing their own hidden card.
 * Callers MUST authorise before rendering.
 */
export async function getCardById(id: string): Promise<Card | null> {
  try {
    const rows = await db<CardRow[]>`
      SELECT ${CARD_COLUMNS} ${CARD_JOINS}
      WHERE t.org_id = ${ORG} AND t.kind = 'pigeon' AND t.id = ${id}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const images = await imagesForCards([id]);
    return mapCard(rows[0], images.get(id) ?? []);
  } catch (err) {
    console.error("[pigeonshoot] getCardById:", err);
    return null;
  }
}

/** Cards belonging to one contributor — guest cookie or signed-in account. */
export async function listCardsBySubmitter(opts: {
  guestId?: string | null;
  userId?: string | null;
}): Promise<Card[]> {
  const { guestId, userId } = opts;
  if (!guestId && !userId) return [];

  try {
    const rows = await db<CardRow[]>`
      SELECT ${CARD_COLUMNS} ${CARD_JOINS}
      WHERE t.org_id = ${ORG} AND t.kind = 'pigeon'
        AND pc.moderation_state <> 'removed'
        AND (
          ${guestId ? db`pc.guest_id = ${guestId}` : db`FALSE`}
          OR ${userId ? db`pc.submitter_user_id = ${userId}` : db`FALSE`}
        )
      ORDER BY t.created_at DESC
      LIMIT 200
    `;
    const images = await imagesForCards(rows.map((r) => r.id));
    return rows.map((r) => mapCard(r, images.get(r.id) ?? []));
  } catch (err) {
    console.error("[pigeonshoot] listCardsBySubmitter:", err);
    return [];
  }
}

/**
 * Map pins. Capped hard — a map that tries to draw every card in the city
 * would ship megabytes of JSON to a phone.
 */
export async function listCardPins(
  filters: CardFilters & { bbox?: [number, number, number, number] } = {}
): Promise<CardPin[]> {
  const { city, area, species, tier, bbox, limit = 2000 } = filters;
  try {
    const rows = await db<
      {
        slug: string;
        title: string;
        lat: number;
        lng: number;
        tier_slug: string | null;
        thumb_url: string | null;
        id: string;
        geo_precision: Card["geoPrecision"];
      }[]
    >`
      SELECT t.id, t.slug, t.title, pc.lat, pc.lng, pc.tier_slug, pc.geo_precision,
             (SELECT COALESCE(pci.card_url, m.url)
                FROM pigeon_card_images pci
                JOIN media m ON m.id = pci.media_id
               WHERE pci.thread_id = t.id
               ORDER BY CASE pci.role WHEN 'front' THEN 0 ELSE 1 END
               LIMIT 1) AS thumb_url
      ${CARD_JOINS}
      WHERE ${PUBLIC_FILTER}
        AND pc.lat IS NOT NULL AND pc.lng IS NOT NULL
        ${city ? db`AND pc.city_slug = ${city}` : db``}
        ${area ? db`AND pc.area_slug = ${area}` : db``}
        ${species ? db`AND sp.slug = ${species}` : db``}
        ${tier ? db`AND pc.tier_slug = ${tier}` : db``}
        ${
          bbox
            ? db`AND pc.lng BETWEEN ${bbox[0]} AND ${bbox[2]}
                 AND pc.lat BETWEEN ${bbox[1]} AND ${bbox[3]}`
            : db``
        }
      ORDER BY t.created_at DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => {
      // A 'block' pin is deliberately imprecise — someone shooting from their
      // own window shouldn't publish their address. Jitter is seeded from the
      // thread id so the pin doesn't wander between page loads.
      const [dLat, dLng] = r.geo_precision === "block" ? jitterFor(r.id) : [0, 0];
      return {
        slug: r.slug,
        title: r.title,
        lat: r.lat + dLat,
        lng: r.lng + dLng,
        tierSlug: r.tier_slug,
        thumbUrl: r.thumb_url,
      };
    });
  } catch (err) {
    console.error("[pigeonshoot] listCardPins:", err);
    return [];
  }
}

/** Deterministic ±~100m offset derived from an id. Same id, same offset, always. */
function jitterFor(seed: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 10000) / 10000;
  const b = ((Math.imul(h, 48271) >>> 0) % 10000) / 10000;
  // ~0.0009° latitude ≈ 100m; longitude scaled for Toronto's latitude.
  return [(a - 0.5) * 0.0018, (b - 0.5) * 0.0025];
}

// ─── species ─────────────────────────────────────────────────────────────────

interface SpeciesRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  traits: unknown;
  accent_hex: string | null;
  status: Species["status"];
  merged_into: string | null;
  hero_url: string | null;
  card_count?: string;
}

function mapSpecies(row: SpeciesRow): Species {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    traits: Array.isArray(row.traits) ? (row.traits as string[]) : [],
    accentHex: row.accent_hex,
    status: row.status,
    mergedInto: row.merged_into,
    heroUrl: row.hero_url,
    cardCount: row.card_count === undefined ? undefined : Number(row.card_count),
  };
}

/** The Pokédex index. Published species only, with live card counts. */
export async function listSpecies(): Promise<Species[]> {
  try {
    const rows = await db<SpeciesRow[]>`
      SELECT sp.id, sp.slug, sp.name, sp.tagline, sp.description, sp.traits,
             sp.accent_hex, sp.status, sp.merged_into,
             m.url AS hero_url,
             COUNT(pc.thread_id) FILTER (WHERE pc.moderation_state = 'live') AS card_count
      FROM pigeon_species sp
      LEFT JOIN media m ON m.id = sp.hero_media_id
      LEFT JOIN pigeon_cards pc ON pc.species_id = sp.id
      WHERE sp.org_id = ${ORG} AND sp.status = 'published'
      GROUP BY sp.id, m.url
      ORDER BY sp.sort_order, sp.name
    `;
    return rows.map(mapSpecies);
  } catch (err) {
    console.error("[pigeonshoot] listSpecies:", err);
    return [];
  }
}

export async function getSpeciesBySlug(slug: string): Promise<Species | null> {
  try {
    const rows = await db<SpeciesRow[]>`
      SELECT sp.id, sp.slug, sp.name, sp.tagline, sp.description, sp.traits,
             sp.accent_hex, sp.status, sp.merged_into, m.url AS hero_url
      FROM pigeon_species sp
      LEFT JOIN media m ON m.id = sp.hero_media_id
      WHERE sp.org_id = ${ORG} AND sp.slug = ${slug}
      LIMIT 1
    `;
    return rows.length > 0 ? mapSpecies(rows[0]) : null;
  } catch (err) {
    console.error("[pigeonshoot] getSpeciesBySlug:", err);
    return null;
  }
}

// ─── places ──────────────────────────────────────────────────────────────────

export async function listCities(): Promise<City[]> {
  try {
    const rows = await db<
      {
        slug: string;
        name: string;
        region: string | null;
        country: string;
        center_lat: number;
        center_lng: number;
        default_zoom: number;
        boundary_file: string | null;
        card_count: string;
      }[]
    >`
      SELECT c.slug, c.name, c.region, c.country, c.center_lat, c.center_lng,
             c.default_zoom, c.boundary_file,
             COUNT(pc.thread_id) FILTER (WHERE pc.moderation_state = 'live') AS card_count
      FROM pigeon_cities c
      LEFT JOIN pigeon_cards pc ON pc.city_slug = c.slug
      WHERE c.is_active
      GROUP BY c.slug
      ORDER BY c.sort_order, c.name
    `;
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      region: r.region,
      country: r.country,
      centerLat: r.center_lat,
      centerLng: r.center_lng,
      defaultZoom: r.default_zoom,
      boundaryFile: r.boundary_file,
      cardCount: Number(r.card_count),
    }));
  } catch (err) {
    console.error("[pigeonshoot] listCities:", err);
    return [];
  }
}

export async function getCity(slug: string): Promise<City | null> {
  const cities = await listCities();
  return cities.find((c) => c.slug === slug) ?? null;
}

/** Neighbourhoods of a city. `withCardsOnly` powers the "where to look" index. */
export async function listAreas(citySlug: string, withCardsOnly = false): Promise<Area[]> {
  try {
    const rows = await db<
      {
        city_slug: string;
        slug: string;
        name: string;
        centroid_lat: number | null;
        centroid_lng: number | null;
        card_count: string;
      }[]
    >`
      SELECT a.city_slug, a.slug, a.name, a.centroid_lat, a.centroid_lng,
             COUNT(pc.thread_id) FILTER (WHERE pc.moderation_state = 'live') AS card_count
      FROM pigeon_areas a
      LEFT JOIN pigeon_cards pc
        ON pc.city_slug = a.city_slug AND pc.area_slug = a.slug
      WHERE a.city_slug = ${citySlug} AND a.is_active
      GROUP BY a.city_slug, a.slug
      ${withCardsOnly ? db`HAVING COUNT(pc.thread_id) > 0` : db``}
      ORDER BY a.name
    `;
    return rows.map((r) => ({
      citySlug: r.city_slug,
      slug: r.slug,
      name: r.name,
      centroidLat: r.centroid_lat,
      centroidLng: r.centroid_lng,
      cardCount: Number(r.card_count),
    }));
  } catch (err) {
    console.error("[pigeonshoot] listAreas:", err);
    return [];
  }
}

export async function getArea(citySlug: string, slug: string): Promise<Area | null> {
  try {
    const rows = await db<
      { city_slug: string; slug: string; name: string; centroid_lat: number | null; centroid_lng: number | null }[]
    >`
      SELECT city_slug, slug, name, centroid_lat, centroid_lng
      FROM pigeon_areas
      WHERE city_slug = ${citySlug} AND slug = ${slug}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    return {
      citySlug: rows[0].city_slug,
      slug: rows[0].slug,
      name: rows[0].name,
      centroidLat: rows[0].centroid_lat,
      centroidLng: rows[0].centroid_lng,
    };
  } catch (err) {
    console.error("[pigeonshoot] getArea:", err);
    return null;
  }
}

// ─── rubric ──────────────────────────────────────────────────────────────────

/** The live rubric. `includeInactive` is for /manage/rubric only. */
export async function listCriteria(includeInactive = false): Promise<Criterion[]> {
  try {
    const rows = await db<
      {
        key: string;
        label: string;
        hint: string | null;
        category: string;
        points: number;
        source: Criterion["source"];
        auto_check: string | null;
        sort_order: number;
      }[]
    >`
      SELECT key, label, hint, category, points, source, auto_check, sort_order
      FROM pigeon_criteria
      WHERE org_id = ${ORG} ${includeInactive ? db`` : db`AND is_active`}
      ORDER BY sort_order, key
    `;
    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      hint: r.hint,
      category: r.category,
      points: r.points,
      source: r.source,
      autoCheck: r.auto_check,
      sortOrder: r.sort_order,
    }));
  } catch (err) {
    console.error("[pigeonshoot] listCriteria:", err);
    return [];
  }
}

export async function listTiers(includeInactive = false): Promise<Tier[]> {
  try {
    const rows = await db<
      {
        slug: string;
        label: string;
        blurb: string | null;
        min_score: number;
        accent_hex: string;
        frame_style: Tier["frameStyle"];
        sort_order: number;
      }[]
    >`
      SELECT slug, label, blurb, min_score, accent_hex, frame_style, sort_order
      FROM pigeon_tiers
      WHERE org_id = ${ORG} ${includeInactive ? db`` : db`AND is_active`}
      ORDER BY sort_order, min_score
    `;
    return rows.map((r) => ({
      slug: r.slug,
      label: r.label,
      blurb: r.blurb,
      minScore: r.min_score,
      accentHex: r.accent_hex,
      frameStyle: r.frame_style,
      sortOrder: r.sort_order,
    }));
  } catch (err) {
    console.error("[pigeonshoot] listTiers:", err);
    return [];
  }
}

/** How one card scored, line by line — the breakdown on the card detail page. */
export async function getCardCriteria(threadId: string): Promise<CardCriterion[]> {
  try {
    const rows = await db<
      {
        criterion_key: string;
        label: string;
        hint: string | null;
        points: number;
        source: Criterion["source"];
        claimed: boolean;
        confirmed: boolean | null;
        points_awarded: number | null;
        sort_order: number;
      }[]
    >`
      SELECT pcc.criterion_key, pcc.claimed, pcc.confirmed, pcc.points_awarded,
             c.label, c.hint, c.points, c.source, c.sort_order
      FROM pigeon_card_criteria pcc
      JOIN pigeon_criteria c
        ON c.org_id = ${ORG} AND c.key = pcc.criterion_key
      WHERE pcc.thread_id = ${threadId}
      ORDER BY c.sort_order, c.key
    `;
    return rows.map((r) => ({
      key: r.criterion_key,
      label: r.label,
      hint: r.hint,
      points: r.points,
      source: r.source,
      claimed: r.claimed,
      confirmed: r.confirmed,
      pointsAwarded: r.points_awarded,
    }));
  } catch (err) {
    console.error("[pigeonshoot] getCardCriteria:", err);
    return [];
  }
}

// ─── site copy ───────────────────────────────────────────────────────────────

export async function getSiteSections(): Promise<SiteSections> {
  try {
    const rows = await db<{ section_key: string; content: unknown }[]>`
      SELECT section_key, content FROM org_site_sections WHERE org_id = ${ORG}
    `;
    const out: SiteSections = {};
    for (const row of rows) {
      if (row.content && typeof row.content === "object") {
        out[row.section_key] = row.content as Record<string, string>;
      }
    }
    return out;
  } catch (err) {
    console.error("[pigeonshoot] getSiteSections:", err);
    return {};
  }
}

/** Counts for the home page. One round trip, all fail-soft to zero. */
export async function getSiteStats(): Promise<{
  cards: number;
  species: number;
  areas: number;
}> {
  try {
    const rows = await db<{ cards: string; species: string; areas: string }[]>`
      SELECT
        (SELECT COUNT(*) FROM threads t
           JOIN pigeon_cards pc ON pc.thread_id = t.id
          WHERE t.org_id = ${ORG} AND t.kind = 'pigeon'
            AND t.status = 'published' AND pc.moderation_state = 'live') AS cards,
        (SELECT COUNT(*) FROM pigeon_species
          WHERE org_id = ${ORG} AND status = 'published') AS species,
        (SELECT COUNT(DISTINCT (pc.city_slug, pc.area_slug))
           FROM pigeon_cards pc
          WHERE pc.area_slug IS NOT NULL AND pc.moderation_state = 'live') AS areas
    `;
    return {
      cards: Number(rows[0]?.cards ?? 0),
      species: Number(rows[0]?.species ?? 0),
      areas: Number(rows[0]?.areas ?? 0),
    };
  } catch (err) {
    console.error("[pigeonshoot] getSiteStats:", err);
    return { cards: 0, species: 0, areas: 0 };
  }
}
