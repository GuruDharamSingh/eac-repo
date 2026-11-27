import type { Metadata } from "next";
import { requireOrgEditor } from "@/lib/auth";
import { stepNumber } from "@/lib/office-links";
import { TourEditorPage } from "@/components/office/create-tour/tour-editor-page";

export const metadata: Metadata = { title: "Edit tour" };
export const dynamic = "force-dynamic";

const SAFE_ID = /^[A-Za-z0-9_-]{1,50}$/;

/** One page for making and editing a tour: `?tour=<id>[&step=route|details]`; no tour = a new one. */
export default async function TourEditRoute({ searchParams }: { searchParams: Promise<{ tour?: string; step?: string }> }) {
  // Gate in the page: its data must not stream to a visitor. The wizard's actions re-check the role.
  await requireOrgEditor("/hub/tours/edit");
  const { tour, step } = await searchParams;
  const tourId = tour && SAFE_ID.test(tour) ? tour : undefined;
  // No key on the tour id: a new tour gains its id in the address on first save, and must not remount.
  return <TourEditorPage tourId={tourId} step={tourId ? stepNumber(step) : undefined} />;
}
