import { getMarketplaceSettings } from "@elkdonis/commerce/server";
import { SeriesHelp } from "@/app/admin/series/series-help";
import { loadWorkspace } from "../load";

export default async function HelpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const settings = await getMarketplaceSettings(series.orgId);
  return (
    <>
      <h1 className="sw-h1">Help</h1>
      <div className="sw-card">
        <SeriesHelp series={series} commissionPercent={settings.defaultCommissionRate} ladder={settings.incrementLadder} />
      </div>
    </>
  );
}
