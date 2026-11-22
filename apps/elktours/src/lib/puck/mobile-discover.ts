import { listTours, nextDepartures, formatDeparture, formatDuration } from "@/lib/tours";
import { realCover } from "@/lib/cover";
import { listTourSlots } from "@/lib/tour-slots";
import { listPeople, getPerson } from "@/lib/people";
import { listFavouritePlaces, listPlacesPublic } from "@/lib/places-public";
import { listFeedPosts } from "@/lib/feed";
import { listExperiences } from "@/lib/experiences";
import { getViewer } from "@/lib/auth";
import { getProfile } from "@elkdonis/services";
import { tourType } from "./mobile-data";
import type { MobileDiscover, MobileFeatured } from "@/blocks/mobile/types";

// ============================================================================
// The Discover screen's data (G3a). Reads only, through Jay's modules; each read fails soft to "nothing", and the
// blocks hide themselves (or show a quiet line) when their list is empty. Server only. A page that has already
// read it passes it as metadata.mobileDiscover.
// ============================================================================

const TYPE_LABEL: Record<string, string> = { walk: "Walking tour", atelier: "Atelier", museum: "Museum", food: "Food & markets", private: "Private" };
const soft = <T,>(p: Promise<T>, empty: T): Promise<T> => p.catch(() => empty);

export async function readMobileDiscover(): Promise<MobileDiscover> {
  const tours = await soft(listTours(), []);
  const next = await soft(nextDepartures(tours.map((t) => t.id)), new Map());
  const slots = await Promise.all(tours.map((t) => soft(listTourSlots(t.id), [])));
  const featuredBySlug: Record<string, MobileFeatured> = {};
  let bestAt = Infinity;
  let featuredDefault: MobileFeatured | null = null;
  tours.forEach((t, i) => {
    const slot = slots[i]!.find((s) => s.state === "open" || s.state === "full_waitlist" || s.state === "full");
    const dep = next.get(t.id);
    const startsAt = slot?.startsAt ?? dep?.startsAt ?? null;
    const f: MobileFeatured = {
      slug: t.slug,
      title: t.title,
      typeLabel: TYPE_LABEL[tourType(t)] ?? "Tour",
      duration: formatDuration(t.durationMinutes),
      guide: slot?.guide?.name ?? dep?.guideName ?? t.authorName ?? null,
      nextLabel: startsAt ? `Next · ${formatDeparture(startsAt)}` : "Dates coming",
      placesLabel: slot ? (slot.seatsLeft > 0 ? `${slot.seatsLeft} places left` : "Full") : null,
      // No fly-over stills (developer, 2026-11-17): the cover photo; without one the card plays the 3D route, which
      // the m-featured-tour resolver adds for the chosen tour only (mobileFeaturedMap).
      img: realCover(t.coverImageUrl, t.film?.poster),
      imgFrame: realCover(t.coverImageUrl, t.film?.poster) ? t.coverFrame : null,
      filmPoster: null,
    };
    featuredBySlug[t.slug] = f;
    const at = startsAt ? Date.parse(startsAt) : Infinity;
    if (!featuredDefault || at < bestAt) { featuredDefault = f; bestAt = at; }
  });

  const [favs, allPlaces, exps, guideCards, feedPosts] = await Promise.all([
    soft(listFavouritePlaces(8), []),
    soft(listPlacesPublic(), { places: [], tagOrder: [], favouriteCount: 0 }),
    soft(listExperiences(), []),
    soft(listPeople({ kind: "guide" }), []),
    soft(listFeedPosts({ limit: 50 }), []),
  ]);
  const guides = await Promise.all(
    guideCards.slice(0, 6).map(async (g) => {
      const p = await soft(getPerson(g.slug), null);
      return {
        id: g.userId, slug: g.slug, name: g.name, craft: g.craft, bio: g.bio, initial: g.name.slice(0, 1).toUpperCase(), photo: g.photoUrl,
        tours: (p?.tours ?? []).map(({ tour, next: n }) => ({ slug: tour.slug, title: tour.title, sub: n ? formatDeparture(n.startsAt) : "Dates coming" })),
      };
    }),
  );
  const lead = feedPosts[0];
  const v = await soft(getViewer(), null);
  const prof = v ? await soft(getProfile(v.userId), null) : null;
  const first = (prof?.displayName ?? "").trim().split(/\s+/)[0] || null;
  return {
    featuredDefault,
    featuredBySlug,
    places: favs.map((p) => ({ id: p.id, slug: p.slug, name: p.title, kind: p.tags[0] ?? "Place", area: p.address, img: p.imageUrl })),
    placesCount: allPlaces.places.length,
    experiences: exps.slice(0, 3).map((e) => ({
      id: e.id, slug: e.slug, title: e.title, artist: e.people[0]?.name ?? null, craft: null,
      where: e.isOnline ? "Online" : e.location ?? "By request", img: e.coverImageUrl,
    })),
    guides,
    feed: lead
      ? { count: feedPosts.length, title: lead.title, excerpt: lead.excerpt, by: lead.author.name ?? "A guide", initial: (lead.author.name ?? "G").slice(0, 1).toUpperCase(), href: "/feed" }
      : null,
    viewer: v ? { name: first, office: Boolean(v.canEdit) } : null,
  };
}

export async function discoverFor(metadata: Record<string, unknown> | undefined): Promise<MobileDiscover> {
  const given = metadata?.mobileDiscover as MobileDiscover | undefined;
  return given && "featuredBySlug" in given ? given : readMobileDiscover();
}
