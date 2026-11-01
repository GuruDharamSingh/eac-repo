import { listSeriesLots } from "@elkdonis/commerce/queries";
import { loadWorkspace } from "../load";

export const dynamic = "force-dynamic";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : "not set");
const money = (n: number | null, c: string) => (n == null ? "—" : new Intl.NumberFormat("en-CA", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n / 100));

/** The live close: the presenter board link and the lot order with each lot's closing time. */
export default async function LiveClosePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const lots = await listSeriesLots(series.id);

  return (
    <>
      <div>
        <h1 className="sw-h1">Live close</h1>
        <p className="sw-sub">
          {fmt(series.liveAt)} ·{" "}
          {series.closeMode === "staggered"
            ? `lots close one after another, ${series.staggerSeconds} seconds apart, in lot order`
            : "every lot closes at once"}
          {series.softCloseMinutes > 0 ? ` · a bid in the last ${series.softCloseMinutes} minutes extends that lot` : ""}.
        </p>
      </div>

      <section className="sw-card is-tint" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 className="sw-h2" style={{ marginBottom: 4 }}>Presenter board</h2>
          <p style={{ margin: 0 }}>The lot closing next, its countdown and the bid feed, for the screen at the live event. Bidders appear as paddle numbers.</p>
          {series.status !== "published" && <p className="sw-small" style={{ margin: "6px 0 0" }}>The series is a draft: only editors can open the board until it is published.</p>}
        </div>
        <a href={`/series/${series.slug}/live`} target="_blank" rel="noopener" className="sw-btn">Open the presenter board ↗</a>
      </section>

      <section>
        <h2 className="sw-h2">Lot order</h2>
        <div className="sw-table-wrap">
          <table className="sw-table">
            <thead><tr><th>#</th><th>Lot</th><th>Closes</th><th>Status</th><th className="is-num">Current</th><th className="is-num">Bids</th></tr></thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id}>
                  <td>{l.lotNumber ?? "—"}</td>
                  <td><a href={`/lots/${l.id}`}>{l.title}</a>{l.artistName && <div className="sw-muted">{l.artistName}</div>}</td>
                  <td>{fmt(l.endAt)}</td>
                  <td>{l.status}</td>
                  <td className="is-num">{money(l.currentBidMinor, l.currency)}</td>
                  <td className="is-num">{l.bidCount}</td>
                </tr>
              ))}
              {lots.length === 0 && <tr><td colSpan={6} className="sw-muted" style={{ textAlign: "center", padding: 20 }}>No lots yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="sw-hint" style={{ marginTop: 8 }}>Change the order in Lots &amp; artworks; change the close time in Dates &amp; bidding.</p>
      </section>
    </>
  );
}
