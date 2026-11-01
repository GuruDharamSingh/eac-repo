import Link from "next/link";
import { listSeriesOrders, seriesOrderStage, canConfirmSeriesPayment, isNetworkAdmin, getSeriesMoney } from "@elkdonis/commerce/server";
import { loadWorkspace } from "../load";
import { OrdersTable } from "./orders-panel";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "unsold", label: "Unsold / passed" },
  { key: "complete", label: "Complete" },
  { key: "all", label: "All" },
] as const;

const money = (n: number, c = "CAD") => new Intl.NumberFormat("en-CA", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n / 100);

/**
 * Orders & fulfilment (mock-up 3): each sold lot from the buyer's payment to
 * the hand-over, receipt and the artist's payout. The workspace stays open
 * after the series closes until every row is complete.
 */
export default async function OrdersPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ filter?: string }> }) {
  const { slug } = await params;
  const { filter: f } = await searchParams;
  const filter = FILTERS.some((x) => x.key === f) ? (f as (typeof FILTERS)[number]["key"]) : "open";
  const { series, userId } = await loadWorkspace(slug);
  const [rows, admin, m] = await Promise.all([listSeriesOrders(series.id), isNetworkAdmin(userId), getSeriesMoney(series.id)]);

  const staged = rows.map((r) => ({ r, stage: seriesOrderStage(r) }));
  const count = (s: string) => staged.filter((x) => x.stage === s).length;
  const shown = staged
    .filter(({ stage }) =>
      filter === "all" ? true : filter === "unsold" ? stage === "unsold" || stage === "lapsed" : filter === "complete" ? stage === "complete" : !["unsold", "lapsed", "complete"].includes(stage)
    )
    .map((x) => x.r);
  const confirmable = (
    await Promise.all(
      shown
        .filter((r) => r.order && !r.order.paidAt && r.order.status !== "cancelled")
        .map(async (r) => ((await canConfirmSeriesPayment(userId, series.id, r.order!.id)) ? r.order!.id : null))
    )
  ).filter((x): x is string => Boolean(x));

  const base = `/series/${series.slug}/manage/orders`;
  const tiles = [
    ["Awaiting payment", count("awaiting")],
    ["Paid, to hand over", count("handover")],
    ["In transit", count("transit")],
    ["Artist to be paid", count("artist")],
    ["Complete", count("complete")],
  ] as const;

  return (
    <>
      <div className="sw-head">
        <div>
          <h1 className="sw-h1">Orders &amp; fulfilment</h1>
          <p className="sw-sub">Each sold lot until the buyer has it and the artist is paid. The workspace stays open until every row is done.</p>
        </div>
      </div>

      <div className="sw-grid cols-5">
        {tiles.map(([label, n]) => (
          <div key={label} className="sw-stat">
            <div className="sw-stat-label">{label}</div>
            <div className="sw-stat-value">{n}</div>
          </div>
        ))}
      </div>

      <nav aria-label="Filter" className="sw-filters">
        {FILTERS.map((x) => {
          const n = x.key === "all" ? rows.length : x.key === "unsold" ? count("unsold") + count("lapsed") : x.key === "complete" ? count("complete") : rows.length - count("unsold") - count("lapsed") - count("complete");
          return (
            <Link key={x.key} href={`${base}?filter=${x.key}`} className="sw-filter" aria-current={filter === x.key ? "true" : undefined}>
              {x.label} ({n})
            </Link>
          );
        })}
      </nav>

      <OrdersTable rows={shown} seriesId={series.id} slug={series.slug} confirmable={confirmable} isAdmin={admin} />

      <section className="sw-card">
        <h2 className="sw-h2">Money for this series</h2>
        <div className="sw-grid cols-4">
          <div><div className="sw-stat-label">Collected from buyers</div><div className="sw-stat-value">{money(m.collectedMinor, m.currency)}</div></div>
          <div><div className="sw-stat-label">To {series.presenterName ?? "organisations"} and beneficiaries</div><div className="sw-stat-value">{money(m.toOrgsMinor, m.currency)}</div></div>
          <div><div className="sw-stat-label">Paid to artists at sale</div><div className="sw-stat-value">{money(m.paidAtSourceMinor, m.currency)}</div></div>
          <div><div className="sw-stat-label">Artists&rsquo; share, settled by the collective</div><div className="sw-stat-value">{money(Math.max(0, m.toArtistsMinor - m.paidAtSourceMinor), m.currency)}</div></div>
        </div>
        <p className="sw-hint" style={{ marginTop: 12 }}>
          Details per artist in <Link href={`/series/${series.slug}/manage/money`}>Money</Link>.
          {admin ? "" : " Payouts are recorded by a network admin; confirming an e-transfer needs a manager of the selling store."}
        </p>
      </section>
    </>
  );
}
