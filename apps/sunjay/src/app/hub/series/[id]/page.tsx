import { notFound } from "next/navigation";
import { SeriesPlannerPage } from "@elkdonis/series-site/hub";
import { getMeetingSeries } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { getForumViewer } from "@/lib/forum";

/** The Series planner as a page of the hub (members). */
export const dynamic = "force-dynamic";

export default async function HubSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireOrgMember(`/hub/series/${id}`);
  const series = await getMeetingSeries(siteConfig.orgId, { threadId: id }, { count: 1, viewer: await getForumViewer() });
  if (!series) notFound();
  return (
    <SeriesPlannerPage
      threadId={series.id}
      title={series.title}
      canPlan={viewer.canEdit}
      timeZone={series.timeZone ?? siteConfig.timeZone}
      publicHref={`/series/${series.slug}`}
    />
  );
}
