import Link from "next/link";
import { listSeriesLots } from "@elkdonis/commerce/queries";
import { seriesStore } from "@elkdonis/commerce/server";
import { loadWorkspace } from "../../load";
import { AddLotForm } from "../../panels";

export default async function AddLotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const [store, lots] = await Promise.all([seriesStore(series.id), listSeriesLots(series.id)]);
  const next = lots.reduce((m, l) => Math.max(m, l.lotNumber ?? 0), 0) + 1;
  return (
    <>
      <div>
        <p className="sw-muted" style={{ margin: 0 }}><Link href={`/series/${series.slug}/manage/lots`}>Lots &amp; artworks</Link> /</p>
        <h1 className="sw-h1">Add a lot</h1>
      </div>
      <AddLotForm
        series={series}
        presenterName={series.presenterName ?? "The presenting organisation"}
        storeReady={store?.status === "active"}
        nextLotNumber={next}
      />
    </>
  );
}
