import { getTourBySlug, loadTourFull } from "@/lib/tours";
import { routeMapPng, type ItineraryInput } from "@/lib/itinerary-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The tour's route on a map, no text (lib/itinerary-image.ts routeMapPng): the picture on a phone list card when the
 * tour has no cover photo. Public tours only, like the itinerary beside it. Shown inline, cached for an hour.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = await getTourBySlug(slug);
  if (!base) return new Response("Not found", { status: 404 });
  const tour = await loadTourFull(base, { upcomingOnly: true });
  const placed = tour.stops.filter((s) => s.lat != null && s.lng != null);
  if (placed.length === 0) return new Response("This tour has no mapped stops yet.", { status: 404 });

  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const input: ItineraryInput = {
    slug: tour.slug,
    title: tour.title,
    guide: tour.authorName,
    meet: tour.location,
    durationMinutes: tour.durationMinutes,
    stops: placed.map((s) => ({ name: s.title, lat: s.lat!, lng: s.lng!, minutes: s.durationMinutes ?? null })),
    meeting: tour.details.meetingPoint ? { lat: tour.details.meetingPoint.lat, lng: tour.details.meetingPoint.lng } : null,
    // Stored legs line up with the meeting point and every stop; with any stop unplaced they would not, and the builder draws straight lines.
    legs: placed.length === tour.stops.length ? (tour.details.route?.legs ?? null) : null,
    url: `${proto}://${host}/tours/${tour.slug}`,
  };
  const png = await routeMapPng(input);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}
