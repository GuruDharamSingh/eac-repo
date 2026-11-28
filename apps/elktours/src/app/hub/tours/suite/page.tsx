import type { Metadata } from "next";
import { requireOrgEditor } from "@/lib/auth";
import { TourSuitePage } from "@/components/office/tour-suite/tour-suite-page";

export const metadata: Metadata = { title: "Tour edit suite" };
export const dynamic = "force-dynamic";

const SAFE_ID = /^[A-Za-z0-9_-]{1,50}$/;

/** The tour edit suite (take B, 2026-11-26): `?tour=<id>`; no id = a list of the tours the viewer can edit. */
export default async function TourSuiteRoute({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  // Gate in the page: its data must not stream to a visitor. The actions re-check the role.
  await requireOrgEditor("/hub/tours/suite");
  const { tour } = await searchParams;
  const tourId = tour && SAFE_ID.test(tour) ? tour : undefined;
  return <TourSuitePage tourId={tourId} />;
}
