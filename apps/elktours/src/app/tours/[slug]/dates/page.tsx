import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DatesView } from "@/components/mobile/dates-view";
import { getTourBySlug } from "@/lib/tours";
import { listTourSlots } from "@/lib/tour-slots";

export const metadata: Metadata = { title: "Choose a date", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Screen 04 (G3b): month grid, slot cards, party stepper. Phone design; desktop gets the same page in a 480px column. */
export default async function DatesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ slot?: string }> }) {
  const { slug } = await params;
  const { slot } = await searchParams;
  const tour = await getTourBySlug(slug);
  if (!tour) notFound();
  const slots = await listTourSlots(tour.id).catch(() => []);
  return <DatesView slug={tour.slug} title={tour.title} slots={slots} initialSlot={slot ?? null} />;
}
