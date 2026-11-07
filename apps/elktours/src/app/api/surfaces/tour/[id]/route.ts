import { NextResponse } from "next/server";
import { bookingAvailability, BOOKING_UNAVAILABLE } from "@elkdonis/checkout/booking";
import { getViewer } from "@/lib/auth";
import { getTourById, loadTourFull } from "@/lib/tours";
import { listPublicPlaces } from "@/lib/places";
import type { TourPopupData } from "@/components/surfaces/tour-popup-types";
import type { StopExtras } from "@/lib/catalogue-types";

export const dynamic = "force-dynamic";

/** Plain text from sanitised HTML, cut at a word near `max`. */
function excerptOf(html: string | null, max = 180): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30))}…`;
}

/**
 * The tour popup's data (Overview · Stops · Dates). Published tours are
 * public; drafts only for editors. Guide notes never leave the server.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer().catch(() => null);
  const canEdit = Boolean(viewer?.canEdit);
  const base = await getTourById(id);
  if (!base || (base.status !== "published" && !canEdit)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const tour = await loadTourFull(base, { upcomingOnly: true });
  // The stop's own public excerpt and its place's links (round 6). Read defensively: absent until the tour read carries it.
  const extras = (tour as { stopExtras?: Record<string, StopExtras> | Map<string, StopExtras> }).stopExtras;
  const extraOf = (id: string): StopExtras | undefined => (extras instanceof Map ? extras.get(id) : extras?.[id]);
  // Public places' excerpts, for stops with none of their own.
  const placeExcerpt = tour.stops.some((s) => s.placeId)
    ? new Map<string, string | null>((await listPublicPlaces({ limit: 1000 }).catch(() => [])).map((p) => [p.id, p.excerpt] as [string, string | null]))
    : new Map<string, string | null>();

  let unavailable: string | null = null;
  if (!(tour.price && tour.price > 0)) {
    unavailable = "This tour is not priced yet; ask about it by email.";
  } else {
    const availability = await bookingAvailability(tour.authorId);
    if (availability.ok === false) unavailable = BOOKING_UNAVAILABLE[availability.reason];
  }

  const data: TourPopupData = {
    tour: {
      id: tour.id,
      slug: tour.slug,
      title: tour.title,
      status: tour.status,
      excerpt: tour.excerpt,
      coverImageUrl: tour.coverImageUrl,
      film: tour.film,
      price: tour.price,
      currency: tour.currency,
      durationMinutes: tour.durationMinutes,
      location: tour.location,
      languages: tour.details.languages,
      highlights: tour.details.highlights,
      effort: tour.details.effort,
      maxParty: tour.details.maxParty,
      meetingPoint: tour.details.meetingPoint,
    },
    stops: tour.stops.map((s) => ({
      id: s.id,
      position: s.position,
      title: s.title,
      excerpt: extraOf(s.id)?.excerpt ?? (s.placeId ? placeExcerpt.get(s.placeId) : null) ?? excerptOf(s.body),
      body: s.body,
      links: extraOf(s.id)?.links ?? [],
      business: extraOf(s.id)?.business ?? null,
      stillUrl: s.stillUrl ?? s.imageUrl ?? null,
      lat: s.lat,
      lng: s.lng,
      experienceId: s.experienceId ?? null,
      placeId: s.placeId ?? null,
    })),
    departures: tour.departures
      .filter((d) => d.status === "scheduled" && new Date(d.startsAt) >= new Date())
      .slice(0, 8)
      .map((d) => ({ id: d.id, startsAt: d.startsAt, seatsLeft: d.seatsLeft })),
    unavailable,
    canEdit,
  };
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
