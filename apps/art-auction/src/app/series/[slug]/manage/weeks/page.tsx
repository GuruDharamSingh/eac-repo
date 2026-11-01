import { listSeriesLots } from "@elkdonis/commerce/queries";
import { listWeekBoards } from "@elkdonis/commerce/server";
import { loadWorkspace } from "../load";
import { WeeksBoard } from "../panels";

export default async function WeeksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const [weeks, lots] = await Promise.all([listWeekBoards(series.id), listSeriesLots(series.id)]);
  return (
    <>
      <div>
        <h1 className="sw-h1">Weeks &amp; content</h1>
        <p className="sw-sub">Plan each week&rsquo;s theme and what goes out. Published items appear on the series page; contributors&rsquo; submissions wait for approval here.</p>
      </div>
      {weeks.length === 0
        ? <p className="sw-card">Set the number of weeks under Dates &amp; bidding.</p>
        : <WeeksBoard series={series} weeks={weeks} lots={lots} />}
    </>
  );
}
