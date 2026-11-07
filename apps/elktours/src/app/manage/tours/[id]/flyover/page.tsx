import { notFound } from "next/navigation";
import { FlyoverPanel } from "@/components/manage/flyover-panel";
import { TourSubnav } from "@/components/manage/tour-subnav";
import { listRenderRequests } from "@/lib/render-requests";
import { canAcceptFlyoversAction } from "@/lib/render-request-actions";
import { getTourById, loadTourFull } from "@/lib/tours";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TourFlyoverPage({ params }: { params: Promise<{ id: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { id } = await params;
  const base = await getTourById(id);
  if (!base) notFound();
  const tour = await loadTourFull(base, { upcomingOnly: true });

  const stops = tour.stops.map((s) => ({ id: s.id, title: s.title, hasCoords: s.lat != null && s.lng != null }));
  const mapped = stops.filter((s) => s.hasCoords).length;
  const renderable = mapped < 2 ? "A fly-over needs at least two stops on the map." : null;

  const [requests, canAccept] = await Promise.all([listRenderRequests({ threadId: tour.id, limit: 50 }), canAcceptFlyoversAction()]);

  return (
    <>
      <TourSubnav tour={tour} current="flyover" counts={{ stops: tour.stops.length }} />
      <div className="mt-6">
        <FlyoverPanel tourId={tour.id} stops={stops} requests={requests} canAccept={canAccept} renderable={renderable} />
      </div>
    </>
  );
}
