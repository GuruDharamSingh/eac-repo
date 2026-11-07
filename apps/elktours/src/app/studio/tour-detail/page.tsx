import type { Metadata } from "next";
import { MAX_PARTY_SIZE } from "@elkdonis/commerce/server";
import type { TourPageData } from "@/blocks/tour/context";
import { LayoutStudio } from "@/components/studio/layout-studio";
import { toPuckData } from "@/components/studio/puck-data";
import { requireOrgEditor } from "@/lib/auth";
import { loadTourLayout } from "@/lib/tour-layout";
import { listTours, loadTourFull, nextDepartures } from "@/lib/tours";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Tour page layout",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The shared tour page layout (site_config `puck:tour-detail`), edited in
 * Puck over a sample tour. Editors only: gated here and again in the publish
 * action. `?tour=<slug>` picks the sample.
 */
export default async function TourDetailStudioPage({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  await requireOrgEditor("/studio/tour-detail");
  const { tour: wanted } = await searchParams;
  const [layout, tours] = await Promise.all([loadTourLayout(), listTours({ includeDrafts: true })]);

  // A tour with a film and stops shows every block; fall back to any tour.
  const pick = tours.find((t) => t.slug === wanted) ?? tours.find((t) => t.status === "published" && t.film) ?? tours[0];
  if (!pick) {
    return <p className="mx-auto max-w-2xl px-5 py-16 text-center text-muted-foreground">Write a tour first: the layout is arranged over one.</p>;
  }
  const full = await loadTourFull(pick, { upcomingOnly: true });
  const others = tours.filter((t) => t.id !== pick.id && t.status === "published").slice(0, 6);
  const next = await nextDepartures(others.map((t) => t.id));

  const sample: TourPageData = {
    // Guide notes never reach a client component, even an editor's.
    tour: { ...full, stops: full.stops.map((s) => ({ ...s, guideNotes: null })) },
    // The in-place Edit bar is the tour page's, not the layout's.
    canEdit: false,
    unavailable: "Booking is shown as it will appear; nothing can be booked from the layout editor.",
    maxParty: Math.min(MAX_PARTY_SIZE, full.details.maxParty ?? MAX_PARTY_SIZE),
    signedInEmail: null,
    googleMapsKey: siteConfig.googleMapsKey,
    others: others.map((t) => ({ tour: t, next: next.get(t.id) ?? null })),
  };

  return (
    <LayoutStudio
      target={{ kind: "tour-detail", sample }}
      initial={toPuckData(layout)}
      title="Tour page layout (every tour)"
      back={{ href: "/manage/tours", label: "Tours" }}
      sampleNote={`Shown over: ${pick.title}`}
    />
  );
}
