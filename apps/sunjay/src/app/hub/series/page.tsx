import { SeriesPageEditorPage } from "@elkdonis/series-site/hub";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/** The public Series page's settings: intro copy, order, featured series. */
export const dynamic = "force-dynamic";

export default async function HubSeriesIndexPage() {
  await requireOrgMember("/hub/series");
  return <SeriesPageEditorPage defaultHeading={`Series from ${siteConfig.shortName}`} />;
}
