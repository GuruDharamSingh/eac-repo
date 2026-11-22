import { listTours, nextDepartures, formatDeparture, formatDuration, formatPrice, type Tour } from "@/lib/tours";
import type { TourDeparture } from "@elkdonis/commerce/server";
import type { MobileTourRow } from "@/blocks/mobile/types";
import { mappedTours, realCover, routeMapUrl } from "@/lib/cover";

// ============================================================================
// What the phone blocks' resolvers read (G2). Read only: lib/tours.ts is not changed. A page that already holds
// the tours passes `metadata.mobileTours` (fetch once in page.tsx); otherwise the resolver reads them itself.
// Server only.
// ============================================================================

export interface MobileToursData {
  rows: MobileTourRow[];
  count: number;
}

export const TYPE_LABEL: Record<string, string> = { walk: "Walk", atelier: "Atelier", museum: "Museum", food: "Food & markets", private: "Private" };

/**
 * Tours have no `type` column yet, so the kind is a guess from the words on the record. Nothing is stored. The
 * day tours gain a real field, replace this one function.
 */
export function tourType(t: Pick<Tour, "title" | "excerpt"> & { tourType?: string | null }): string {
  // The guide's own choice (threads.metadata.tourType) wins; the keyword guess covers tours without one.
  if (t.tourType) return t.tourType;
  const s = `${t.title} ${t.excerpt ?? ""}`.toLowerCase();
  if (/\bprivate\b/.test(s)) return "private";
  if (/\b(museum|musee|musée|gallery|galerie|louvre|orsay)\b/.test(s)) return "museum";
  if (/\b(atelier|studio|workshop|workshops|pottery|ceramic)\b/.test(s)) return "atelier";
  if (/\b(food|market|markets|taste|tasting|cheese|wine|bakery|table)\b/.test(s)) return "food";
  return "walk";
}

/** The rows from tours a page already holds (page.tsx fetches once and hands them over). */
/** `mapped` (lib/cover.ts mappedTours): tours whose card falls back to the route map when they have no cover photo. */
export function mobileRows(tours: Tour[], next: Map<string, TourDeparture>, mapped?: Set<string>): MobileToursData {
  const rows: MobileTourRow[] = tours.map((t) => {
    const n = next.get(t.id);
    const typeKey = tourType(t);
    return {
      id: t.id,
      slug: t.slug,
      title: t.title,
      typeKey,
      typeLabel: TYPE_LABEL[typeKey] ?? "Tour",
      duration: formatDuration(t.durationMinutes),
      guide: n?.guideName ?? t.authorName ?? null,
      nextLabel: n ? formatDeparture(n.startsAt) : "Dates coming",
      priceLabel: t.price != null && t.price > 0 ? formatPrice(t.price, t.currency) : "",
      // No fly-over stills and no Street View (developer, 2026-11-17): the cover photo, else the route map.
      ...(() => {
        const cover = realCover(t.coverImageUrl, t.film?.poster);
        return { img: cover ?? (mapped?.has(t.id) ? routeMapUrl(t.slug) : null), imgFrame: cover ? t.coverFrame : null };
      })(),
    };
  });
  return { rows, count: rows.length };
}

export async function readMobileTours(): Promise<MobileToursData> {
  const tours = await listTours();
  const ids = tours.map((t) => t.id);
  const [next, mapped] = await Promise.all([nextDepartures(ids), mappedTours(ids)]);
  return mobileRows(tours, next, mapped);
}

/** The tours for a resolver: from the page's metadata when it passed them, else read now. */
export async function toursFor(metadata: Record<string, unknown> | undefined): Promise<MobileToursData> {
  const given = metadata?.mobileTours as MobileToursData | undefined;
  return given && Array.isArray(given.rows) ? given : readMobileTours();
}
