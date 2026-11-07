import { requireOrgMember } from "@/lib/auth";
import { SeriesPageEditorPage } from "@elkdonis/series-site/hub";

/**
 * The public Series page's settings (members read, organisers write;
 * `/api/hub/series-page` enforces it): intro copy, order, featured series.
 */
export const dynamic = "force-dynamic";

export default async function HubSeriesIndexPage() {
  await requireOrgMember("/hub/series");
  return <SeriesPageEditorPage defaultHeading="Series from IFAC" />;
}
