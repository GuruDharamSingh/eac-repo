import { getTourBySlug, listTours, loadTourFull, formatDeparture, formatDuration, formatPrice, type TourFull } from "@/lib/tours";
import { listTourSlots } from "@/lib/tour-slots";
import { getHeroLead } from "@/lib/hero";
import { realCover } from "@/lib/cover";
import { publicExperiencesAtStops } from "@/lib/collaborate";
import { getGuides } from "@/lib/data";
import { tourType, TYPE_LABEL } from "@/lib/puck/mobile-data";
import { siteConfig } from "@/config/site";
import type { MobileTourDetail, MobileStop } from "@/blocks/mobile/types";

// ============================================================================
// The tour template's data for the phone blocks (G3a): one payload built from the tour record the page already
// loaded (loadTourFull), plus the next slots, the guide's hero choice and the experiences at stops. Server only.
// The page passes it as metadata.mobileTour; the Studio gets a sample (the first published tour) through
// mobileTourSampleAction.
// ============================================================================

const plain = (html: string | null | undefined) => (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "") || null;

export async function buildMobileTour(tour: TourFull): Promise<MobileTourDetail> {
  const [slots, lead, guides] = await Promise.all([
    listTourSlots(tour.id).catch(() => []),
    getHeroLead(tour.id).catch(() => null),
    getGuides().catch(() => []),
  ]);
  const guide = guides.find((g) => g.userId === tour.authorId) ?? null;
  const stops = tour.stops.map((s) => ({ ...s, guideNotes: null }));
  // Published and PUBLIC experiences only, so a guest page never shows a draft or members-only one.
  const atStops = await publicExperiencesAtStops(stops.map((x) => x.id)).catch(() => new Map());

  let elapsed = 0;
  const stopRows: MobileStop[] = [];
  for (const s of stops) {
    const exp = atStops.get(s.id) ?? null;
    const extra = tour.stopExtras?.[s.id];
    stopRows.push({
      id: s.id,
      name: s.title,
      when: elapsed === 0 ? "Where it starts" : `About ${formatDuration(elapsed)} in`,
      note: extra?.excerpt ?? plain(s.body),
      still: tour.assets.streetview[s.id] === false ? null : tour.assets.stills[s.id] ?? s.stillUrl,
      pose: tour.assets.streetview[s.id] === false || s.lat == null || s.lng == null ? null : { lat: s.lat, lng: s.lng, heading: s.heading, pitch: s.pitch, fov: s.fov },
      placeId: s.placeId,
      experience: exp ? { slug: exp.slug, title: exp.title, artist: exp.artistName } : null,
    });
    elapsed += s.durationMinutes ?? 0;
  }

  const placed = stops.some((s) => s.lat != null);
  const gallery = tour.assets.images.map((i) => ({ url: i.url, alt: i.altText ?? i.caption }));
  // The cover photo leads the gallery (the hero opens on it), unless it is already one of the pictures. A fly-over
  // still is not a cover (lib/cover.ts): with no photos the hero opens on the 3D route.
  const cover = realCover(tour.coverImageUrl, tour.assets.film?.poster);
  const framed = gallery.map((g) => (g.url === cover ? { ...g, frame: tour.coverFrame } : g));
  const photos = cover && !gallery.some((g) => g.url === cover) ? [{ url: cover, alt: tour.title, frame: tour.coverFrame }, ...framed] : cover ? [...framed.filter((g) => g.url === cover), ...framed.filter((g) => g.url !== cover)] : framed;
  const group = tour.details.maxParty ?? null;
  const live = slots.filter((s) => s.state !== "cancelled" && s.stateKey !== "past").slice(0, 3);
  const facts = [
    { label: "Length", value: formatDuration(tour.durationMinutes) ?? "to come" },
    { label: "Price", value: formatPrice(tour.price, tour.currency) },
    { label: "Group", value: group ? `up to ${group}` : "small" },
    { label: "Language", value: tour.details.languages.length ? tour.details.languages.map((l) => l.slice(0, 2).toUpperCase()).join(" · ") : "to come" },
  ];

  return {
    slug: tour.slug,
    mapsKey: siteConfig.googleMapsKey ?? null,
    typeLabel: TYPE_LABEL[tourType(tour)] ?? "Tour",
    title: tour.title,
    guide: tour.authorName || guide
      ? { name: guide?.displayName ?? tour.authorName ?? "", craft: guide?.roleTitle ?? null, photo: guide?.photoUrl ?? tour.authorPhoto, languages: tour.details.languages.length ? tour.details.languages.join(" · ") : null }
      : null,
    bodyHtml: tour.body,
    facts,
    meetAt: tour.location,
    priceLabel: formatPrice(tour.price, tour.currency),
    priced: !!(tour.price && tour.price > 0),
    slots: live.map((s) => ({ slotId: s.slotId, day: formatDeparture(s.startsAt), left: s.seatsLeft > 0 ? `${s.seatsLeft} left` : "Full" })),
    stops: stopRows,
    hero: {
      lead,
      film: tour.assets.film ? { url: tour.assets.film.url, url720: tour.assets.film.url720, poster: tour.assets.film.poster, seconds: tour.assets.film.seconds ?? null } : null,
      photos,
      map:
        placed && tour.assets.map3d
          ? {
              durationMinutes: tour.durationMinutes ?? null,
              experiences: Object.fromEntries(stopRows.filter((r) => r.experience).map((r) => [r.id, { title: r.experience!.title, artist: r.experience!.artist }])),
              stops,
              meetingPoint: tour.details.meetingPoint ? { ...tour.details.meetingPoint, label: tour.location } : null,
              route: tour.details.route,
              googleMapsKey: siteConfig.googleMapsKey ?? null,
              cover: cover ?? stops.find((s) => s.stillUrl)?.stillUrl ?? null,
            }
          : null,
      stopCount: stops.length,
      title: tour.title,
    },
  };
}

/** The 3D route of one tour, for the Discover featured card when the tour has no cover photo (2026-11-17). */
export async function mobileFeaturedMap(slug: string): Promise<MobileTourDetail["hero"]["map"]> {
  const base = await getTourBySlug(slug).catch(() => null);
  if (!base) return null;
  const tour = await buildMobileTour(await loadTourFull(base, { upcomingOnly: true })).catch(() => null);
  return tour?.hero.map ?? null;
}

/** The Studio's sample: the first published tour (or null when there are none). */
export async function sampleMobileTour(): Promise<MobileTourDetail | null> {
  const [first] = await listTours();
  if (!first) return null;
  const base = await getTourBySlug(first.slug);
  return base ? buildMobileTour(await loadTourFull(base, { upcomingOnly: true })) : null;
}

export async function tourFor(metadata: Record<string, unknown> | undefined): Promise<MobileTourDetail | null> {
  const given = metadata?.mobileTour as MobileTourDetail | undefined;
  return given && "slug" in given ? given : sampleMobileTour();
}
