// CONTRACT: people reads for the mobile tree (/people, /people/[slug], Local Artists, artist shelves). Server only.
import { listPlacesPublic, type PlaceView } from "@/lib/places-public";
import { departuresSql } from "@/lib/departures";
import { db } from "@elkdonis/db";
import type { TourDeparture } from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";
import { getGuides } from "@/lib/data";
import { listTours, nextDepartures, type Tour } from "@/lib/tours";
import { artistProfileUrl } from "@/lib/experiences";
import { listFeedPosts, type FeedPost } from "@/lib/feed";

/**
 * Guides and artists as one directory (design screens 08, 09, 10, 11).
 *   guide   an owner or guide of this org with a public org_profiles row (getGuides).
 *   artist  a person linked as `artist` to a published experience (experience_people),
 *           or to a draft one ("Coming soon").
 * A person can be both: `isGuide` and `isArtist` say so, `kind` is the primary role.
 * Nothing is stored: roles and status are derived on read.
 */
const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;

export type PeopleKind = "guide" | "artist";
export type ArtistStatus = "Presenting on tours" | "By request" | "Coming soon";

export interface PersonCard {
  userId: string;
  slug: string;
  name: string;
  kind: PeopleKind;
  isGuide: boolean;
  isArtist: boolean;
  /** Craft (role title). */
  craft: string | null;
  area: string | null;
  bio: string | null;
  photoUrl: string | null;
  /** Artists: "Presenting on tours" | "By request" | "Coming soon". Pure guides: null. */
  status: ArtistStatus | null;
}

export interface PersonExperience {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  durationMinutes: number | null;
}

export interface PersonProfile extends PersonCard {
  /** Guide: published tours they author or lead, with the next departure. */
  tours: Array<{ tour: Tour; next: TourDeparture | null }>;
  /** Guide: their published feed posts, newest first. */
  posts: FeedPost[];
  /** Artist: their public, published experiences. */
  experiences: PersonExperience[];
  /** ArtDirect profile, when the person has a slug and ArtDirect is configured. */
  artDirectUrl: string | null;
  /** Guide: places they starred (design 09, "starring a place features it ... on the starring guide's profile"). */
  favouritePlaces: PlaceView[];
}

async function artistRows(): Promise<Row[]> {
  return (await db`
    SELECT u.id, u.slug, u.display_name, u.avatar_url, u.bio, u.city,
           op.role_title,
           bool_or(t.status = 'published' AND t.visibility = 'PUBLIC') AS has_public,
           bool_or(EXISTS (SELECT 1 FROM tour_stops s WHERE s.experience_id = t.id)
                   AND t.status = 'published' AND t.visibility = 'PUBLIC') AS on_tour
    FROM experience_people ep
    JOIN threads t ON t.id = ep.thread_id AND t.org_id = ${ORG} AND t.kind = 'experience' AND t.status IN ('published','draft')
    JOIN users u ON u.id = ep.user_id
    LEFT JOIN org_profiles op ON op.org_id = ${ORG} AND op.user_id = u.id
    WHERE ep.role = 'artist'
    GROUP BY u.id, u.slug, u.display_name, u.avatar_url, u.bio, u.city, op.role_title
    ORDER BY u.display_name
  `) as unknown as Row[];
}

const statusOf = (r: Row): ArtistStatus => (r.on_tour ? "Presenting on tours" : r.has_public ? "By request" : "Coming soon");

async function loadAll(): Promise<PersonCard[]> {
  const [guides, artists] = await Promise.all([getGuides().catch(() => []), artistRows().catch(() => [] as Row[])]);
  const byUser = new Map<string, PersonCard>();
  for (const g of guides) {
    byUser.set(g.userId, {
      userId: g.userId, slug: g.slug, name: g.displayName, kind: "guide", isGuide: true, isArtist: false,
      craft: g.roleTitle, area: g.city, bio: g.bio, photoUrl: g.photoUrl, status: null,
    });
  }
  for (const a of artists) {
    const id = a.id as string;
    const status = statusOf(a);
    const held = byUser.get(id);
    if (held) {
      held.isArtist = true;
      held.status = status;
      continue;
    }
    byUser.set(id, {
      userId: id, slug: (a.slug as string | null) ?? id, name: (a.display_name as string | null) ?? "Artist", kind: "artist",
      isGuide: false, isArtist: true, craft: (a.role_title as string | null) ?? null, area: (a.city as string | null) ?? null,
      bio: (a.bio as string | null) ?? null, photoUrl: (a.avatar_url as string | null) ?? null, status,
    });
  }
  return [...byUser.values()];
}

/** The directory behind Local Artists and the artist shelves. Guides first, then artists, each by name. */
export async function listPeople(filter: { kind: PeopleKind | "all" } = { kind: "all" }): Promise<PersonCard[]> {
  const all = await loadAll();
  const pick = filter.kind === "guide" ? all.filter((p) => p.isGuide) : filter.kind === "artist" ? all.filter((p) => p.isArtist) : all;
  return pick.sort((a, b) => Number(b.isGuide) - Number(a.isGuide) || a.name.localeCompare(b.name));
}

async function toursFor(userId: string): Promise<Array<{ tour: Tour; next: TourDeparture | null }>> {
  const [tours, led] = await Promise.all([
    listTours(),
    db`SELECT DISTINCT thread_id FROM ${departuresSql()} d WHERE org_id = ${ORG} AND guide_user_id = ${userId} AND starts_at > NOW() AND status <> 'cancelled'`
      .then((r) => new Set((r as unknown as Row[]).map((x) => x.thread_id as string)))
      .catch(() => new Set<string>()),
  ]);
  const mine = tours.filter((t) => t.authorId === userId || led.has(t.id));
  const next = await nextDepartures(mine.map((t) => t.id));
  return mine.map((tour) => ({ tour, next: next.get(tour.id) ?? null }));
}

async function experiencesFor(userId: string): Promise<PersonExperience[]> {
  const rows = (await db`
    SELECT t.id, t.slug, t.title, t.excerpt, t.duration_minutes, t.metadata->>'coverImageUrl' AS cover
    FROM experience_people ep JOIN threads t ON t.id = ep.thread_id
    WHERE ep.user_id = ${userId} AND ep.role = 'artist' AND t.org_id = ${ORG} AND t.kind = 'experience'
      AND t.status = 'published' AND t.visibility = 'PUBLIC'
    ORDER BY t.published_at DESC NULLS LAST
  `) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id as string, slug: r.slug as string, title: r.title as string, excerpt: (r.excerpt as string | null) ?? null,
    coverImageUrl: (r.cover as string | null) ?? null, durationMinutes: r.duration_minutes == null ? null : Number(r.duration_minutes),
  }));
}

/** One person for /people/[slug]; slug or user id. Null when they are neither a public guide nor an artist here. */
export async function getPerson(slug: string): Promise<PersonProfile | null> {
  try {
    const card = (await loadAll()).find((p) => p.slug === slug || p.userId === slug);
    if (!card) return null;
    const [tours, posts, experiences, favouritePlaces] = await Promise.all([
      card.isGuide ? toursFor(card.userId) : Promise.resolve([]),
      card.isGuide ? listFeedPosts({ authorUserId: card.userId, limit: 20 }) : Promise.resolve([]),
      card.isArtist ? experiencesFor(card.userId) : Promise.resolve([]),
      card.isGuide
        ? listPlacesPublic({ favouritesOnly: true }).then((r) => r.places.filter((pl) => pl.featuredBy.some((f) => f.userId === card.userId)))
        : Promise.resolve([] as PlaceView[]),
    ]);
    return { ...card, tours, posts, experiences, favouritePlaces, artDirectUrl: artistProfileUrl(card.slug) };
  } catch (err) {
    console.error(`[elktours] getPerson(${slug}):`, err);
    return null;
  }
}
