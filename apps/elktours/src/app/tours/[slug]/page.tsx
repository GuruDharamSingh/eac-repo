import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { bookingAvailability, BOOKING_UNAVAILABLE } from "@elkdonis/checkout/booking";
import { MAX_PARTY_SIZE } from "@elkdonis/commerce/server";
import { TourPageProvider, type TourPageData } from "@/blocks/tour/context";
import { TourLayout } from "@/blocks/tour/config";
import { TourEditBar } from "@/blocks/tour/edit-bar";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { getViewer } from "@/lib/auth";
import { loadTourLayout } from "@/lib/tour-layout";
import { getTourBySlug, listTours, loadTourFull, nextDepartures } from "@/lib/tours";
import { siteConfig } from "@/config/site";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Editors previewing a draft get its title; everyone else sees the site default (the page 404s for them anyway).
  const viewer = await getViewer().catch(() => null);
  const tour = await getTourBySlug(slug, { includeDrafts: Boolean(viewer?.canEdit) });
  if (!tour) return {};
  const image = tour.film?.poster ?? tour.coverImageUrl;
  return {
    title: tour.title,
    description: tour.excerpt ?? undefined,
    openGraph: {
      title: tour.title,
      description: tour.excerpt ?? undefined,
      images: image ? [image] : undefined,
      videos: tour.film ? [{ url: tour.film.url720 ?? tour.film.url, type: "video/mp4" }] : undefined,
    },
  };
}

export const dynamic = "force-dynamic";

/**
 * A tour page is the site's tour layout (a Puck document, lib/tour-layout.ts)
 * drawn over one tour thread. Editors edit the tour's own words in place
 * from the bar at the bottom (blocks/tour).
 */
export default async function TourPage({ params }: Props) {
  const { slug } = await params;
  const viewer = await getViewer().catch(() => null);
  // Editors may preview a draft; everyone else sees published tours only.
  const base = await getTourBySlug(slug, { includeDrafts: Boolean(viewer?.canEdit) });
  if (!base) notFound();
  const [full, layout, all] = await Promise.all([loadTourFull(base, { upcomingOnly: true }), loadTourLayout(), listTours()]);
  // Guide notes never leave the server on a public page.
  const tour = { ...full, stops: full.stops.map((s) => ({ ...s, guideNotes: null })) };

  let unavailable: string | null = null;
  if (!(tour.price && tour.price > 0)) {
    unavailable = "This tour is not priced yet; ask about it by email.";
  } else {
    const availability = await bookingAvailability(tour.authorId);
    if (availability.ok === false) unavailable = BOOKING_UNAVAILABLE[availability.reason];
  }

  const others = all.filter((t) => t.id !== tour.id).slice(0, 6);
  const next = await nextDepartures(others.map((t) => t.id));

  const data: TourPageData = {
    tour,
    canEdit: Boolean(viewer?.canEdit),
    unavailable,
    maxParty: Math.min(MAX_PARTY_SIZE, tour.details.maxParty ?? MAX_PARTY_SIZE),
    signedInEmail: viewer?.email ?? null,
    googleMapsKey: siteConfig.googleMapsKey,
    others: others.map((t) => ({ tour: t, next: next.get(t.id) ?? null })),
  };

  return (
    <TourPageProvider data={data}>
      <article className="pb-16">
        <TourLayout data={layout} />
        {/* Reviews sit under the layout, on every tour (not a Puck block yet). */}
        <div className="mx-auto mt-16 max-w-6xl px-5">
          <ReviewsSection target={{ type: "tour", id: tour.id }} />
        </div>
      </article>
      <TourEditBar />
    </TourPageProvider>
  );
}
