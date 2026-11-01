import { listSeriesLots, listUnassignedOpenLots } from "@elkdonis/commerce/queries";
import { loadWorkspace } from "../load";
import { LotsBoard } from "../panels";

export default async function LotsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const [lots, unassigned] = await Promise.all([listSeriesLots(series.id), listUnassignedOpenLots(series.orgId)]);
  return (
    <>
      <div>
        <h1 className="sw-h1">Lots &amp; artworks</h1>
        <p className="sw-sub">Every piece in the series, in close order.</p>
      </div>
      <LotsBoard series={series} lots={lots} unassigned={unassigned} />
    </>
  );
}
