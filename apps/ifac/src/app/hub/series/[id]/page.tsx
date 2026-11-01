import { notFound } from "next/navigation";
import { getMeetingSeries } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { requireOrgMember } from "@/lib/auth";
import { SeriesPlannerPage } from "@/components/hub/SeriesPlannerPage";

/**
 * The Series planner as a page of the hub (members), reached from the
 * Series card. The same planner the popup shows, with a way back to the hub.
 */
export const dynamic = "force-dynamic";

export default async function HubSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireOrgMember(`/hub/series/${id}`);
  const series = await getMeetingSeries(siteConfig.orgId, { threadId: id }, { count: 1 });
  if (!series) notFound();
  return (
    <SeriesPlannerPage
      threadId={series.id}
      title={series.title}
      canPlan={viewer.canEdit}
      timeZone={series.timeZone ?? "America/New_York"}
      publicHref={`/series/${series.slug}`}
    />
  );
}
