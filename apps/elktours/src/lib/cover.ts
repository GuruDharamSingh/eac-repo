// Reads only (a plain server module). The cover write is setTourCoverAction in lib/hero-actions.ts.
//
// Tour covers on the phone pages (developer, 2026-11-17): a picture the guide chose, never a still from the rendered
// fly-over film. On 2026-11-17 every published tour's metadata.coverImageUrl held the film's poster frame
// (`…/tour-<id>-poster-<hash>.jpg`, the same file as metadata.film.poster), so those are read as "no cover".
// Without a cover the tour page and the Discover featured card play the 3D route; list cards show the route map.

import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

const ORG = siteConfig.orgId;

/** The renderer's poster frames are named `tour-<thread id>-poster-<hash>.<ext>`. */
const FLYOVER_STILL = /\/tour-[A-Za-z0-9_-]+-poster-[A-Za-z0-9]+\.(?:jpe?g|png|webp)$/i;

/** True when `url` is a frame of the tour's fly-over film rather than a photo. */
export function isFlyoverStill(url: string | null | undefined, filmPoster?: string | null): boolean {
  if (!url) return false;
  return (!!filmPoster && url === filmPoster) || FLYOVER_STILL.test(url.split("?")[0]!);
}

/** The tour's cover photo, or null when it has none (an empty field or a fly-over still). */
export function realCover(url: string | null | undefined, filmPoster?: string | null): string | null {
  return url && !isFlyoverStill(url, filmPoster) ? url : null;
}

/** Tours with at least one stop on the map: they have a route map (`/tours/<slug>/route-map.png`) and a 3D route. */
export async function mappedTours(threadIds: string[]): Promise<Set<string>> {
  if (threadIds.length === 0) return new Set();
  try {
    const rows = (await db`
      SELECT DISTINCT thread_id FROM tour_stops
      WHERE org_id = ${ORG} AND thread_id = ANY(${threadIds}) AND lat IS NOT NULL
    `) as unknown as { thread_id: string }[];
    return new Set(rows.map((r) => r.thread_id));
  } catch (err) {
    console.error("[elktours] mappedTours:", err);
    return new Set();
  }
}

/** The still for a list card without a cover photo: the tour's route map (developer, 2026-11-17: not Street View). */
export const routeMapUrl = (slug: string) => `/tours/${encodeURIComponent(slug)}/route-map.png`;
