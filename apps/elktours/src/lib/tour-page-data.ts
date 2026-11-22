// Server only. What a tour page's blocks read (TourPageData), built once for the tour page and for the tour
// popup's stage (GET /api/surfaces/tour/[id]/stage, 2026-11-20), so both draw the same stage from the same data.
// Guide notes never leave the server: stops are returned with guideNotes null.

import { bookingAvailability, BOOKING_UNAVAILABLE } from "@elkdonis/checkout/booking";
import { MAX_PARTY_SIZE } from "@elkdonis/commerce/server";
import type { TourPageData } from "@/blocks/tour/context";
import type { Viewer } from "@/lib/auth";
import { listTours, loadTourFull, nextDepartures, type Tour } from "@/lib/tours";
import { publicTakesFor, type GuideTake } from "@/lib/guide-takes";
import { loadTourStageData } from "@/lib/tour-stage-data";
import { editableTourId } from "@/lib/tour-fields";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

export async function loadTourPageData(
  base: Tour,
  viewer: Viewer | null,
  opts: { others?: boolean } = {}
): Promise<{ data: TourPageData; takes: GuideTake[] }> {
  const [full, all] = await Promise.all([
    loadTourFull(base, { upcomingOnly: true }),
    opts.others === false ? Promise.resolve([] as Tour[]) : listTours(),
  ]);
  const tour = { ...full, stops: full.stops.map((s) => ({ ...s, guideNotes: null })) };

  let unavailable: string | null = null;
  if (!(tour.price && tour.price > 0)) {
    unavailable = "This tour is not priced yet.";
  } else {
    const availability = await bookingAvailability(tour.authorId);
    if (availability.ok === false) unavailable = BOOKING_UNAVAILABLE[availability.reason];
  }

  const others = all.filter((t) => t.id !== tour.id).slice(0, 6);
  // Guides' own takes, shown while that guide leads an upcoming run (2026-11-19).
  const takes = await publicTakesFor(tour.id, tour.authorId);
  const next = others.length ? await nextDepartures(others.map((t) => t.id)) : new Map();
  // The hero stage's data (stop narratives, place facts, pictures, walking minutes); fail-soft, never blocks the page.
  const stage = await loadTourStageData(full, { takes }).catch((err) => {
    console.error("[elktours] loadTourStageData:", err);
    return undefined;
  });

  const data: TourPageData = {
    tour,
    canEdit: Boolean(viewer?.canEdit),
    unavailable,
    maxParty: Math.min(MAX_PARTY_SIZE, tour.details.maxParty ?? MAX_PARTY_SIZE),
    signedInEmail: viewer?.email ?? null,
    googleMapsKey: siteConfig.googleMapsKey,
    others: others.map((t) => ({ tour: t, next: next.get(t.id) ?? null })),
    // Resolved here, on the server: the env override (ELKTOURS_OWNER_EMAIL) is not visible to client code.
    contactEmail: siteConfig.fallbackNotifyEmail,
    stage,
    // Only a signed-in owner or guide is ever asked (a visitor costs no query); the answer is the tour's id or null.
    fieldEditId: viewer?.canEdit ? await editableTourId(db, { userId: viewer.userId, role: viewer.role }, tour.id).catch(() => null) : null,
  };
  return { data, takes };
}
