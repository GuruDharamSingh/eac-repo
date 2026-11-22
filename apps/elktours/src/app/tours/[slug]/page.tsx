import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TourPageProvider } from "@/blocks/tour/context";
import { TourLayout } from "@/blocks/tour/config";
import { TourEditBar } from "@/blocks/tour/edit-bar";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { getViewer } from "@/lib/auth";
import { loadTourLayout } from "@/lib/tour-layout";
import { getTourBySlug } from "@/lib/tours";
import { Split } from "@/components/mobile/split";
import { TourPhoneProvider, TourStagePhone } from "@/components/tours/stage/phone/tour-stage-phone";
import { TourPhoneIndex } from "@/components/tours/stage/phone/index/tour-phone-index";
import { GuideTakes } from "@/components/tours/guide-takes";
import { loadTourPageData } from "@/lib/tour-page-data";

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
  // The page data (guide notes stripped, booking state, takes, the stage's data) is shared with the tour popup's
  // stage route: lib/tour-page-data.ts.
  const [{ data, takes }, layout] = await Promise.all([loadTourPageData(base, viewer), loadTourLayout()]);
  const tour = data.tour;

  // Phone tree (2026-11-20, developer: "completely ignore Puck", "full page swipe to index … replacing full mobile
  // detail page"): the design's v2 flow in code — stage (TourStagePhone, on the cms-ui SurfaceStage phone layout)
  // → snap → index → the seven sections and reviews (TourPhoneIndex). The m-tour-detail phone document (Puck) is
  // no longer drawn here; it stays in the database. No overflow/transform on these wrappers (scroll snap, fixed dock).
  const phone = (
    <TourPhoneProvider>
      <TourStagePhone />
      <TourPhoneIndex />
    </TourPhoneProvider>
  );

  const desktop = (
      <article className="pb-16">
        <TourLayout data={layout} />
        <GuideTakes takes={takes} stops={tour.stops} className="mx-auto mt-16 max-w-6xl px-5" />
        {/* Reviews sit under the layout, on every tour (not a Puck block yet); hidden until there is one. */}
        <ReviewsSection target={{ type: "tour", id: tour.id }} hideWhenEmpty className="mx-auto mt-16 max-w-6xl px-5" />

      </article>
  );

  return (
    <TourPageProvider data={data}>
      <Split mobile={phone} desktop={desktop} />
      <TourEditBar />
    </TourPageProvider>
  );
}
