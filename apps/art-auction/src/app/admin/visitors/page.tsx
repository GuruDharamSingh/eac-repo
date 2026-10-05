import { db } from "@elkdonis/db";
import { AnalyticsDashboard } from "@elkdonis/analytics/dashboard";
import { ProgressionPanel } from "@elkdonis/analytics/journey";
import { getDashboardData, getFunnel, getProgression, type FunnelStep } from "@elkdonis/analytics/server";
import { RANGES, parseRangeKey } from "@elkdonis/analytics";
import "@elkdonis/analytics/dashboard.css";
import { analyticsOptions } from "@/lib/analytics";

// The admin layout already gates on requireAdmin().
export const dynamic = "force-dynamic";
export const metadata = { title: "Visitors · Admin" };

const ARTWORK = "^/artworks/[0-9a-f-]{36}$";
const LOT = "^/lots/[0-9a-f-]{36}$";

const BUYING: FunnelStep[] = [
  { label: "Browsed the market", path: "^/(artworks|lots|artists|gallery)?$" },
  { label: "Opened an artwork or lot", path: "^/(artworks|lots)/[0-9a-f-]{36}$" },
  { label: "Added to cart", event: "add_to_cart" },
  { label: "Opened checkout", path: "^/checkout$" },
  { label: "Placed an order", event: "order_placed" },
];

export default async function AdminVisitorsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const range = parseRangeKey(sp.range);
  const scope = { orgId: analyticsOptions.defaultOrgId as string };
  const days = RANGES.find((r) => r.key === range)?.days ?? 30;

  const [data, progression, bidding, interest, orders] = await Promise.all([
    getDashboardData({ scope, range, includePeople: true }),
    getProgression({ scope, range, steps: BUYING }),
    getFunnel({ scope, range, steps: [{ label: "Opened a lot", path: LOT }, { label: "Placed a bid", event: "bid_placed" }] }),
    getFunnel({
      scope, range,
      steps: [
        { label: "Opened an artwork", path: ARTWORK },
        { label: "Favourited it", event: "favourite_added" },
        { label: "Messaged the artist", event: "artist_messaged" },
      ],
    }),
    // Outcomes come from the orders themselves, not from visits.
    db<Array<Record<string, unknown>>>`
      SELECT count(*) AS placed,
             count(*) FILTER (WHERE paid_at IS NOT NULL) AS paid,
             count(*) FILTER (WHERE cancelled_at IS NOT NULL AND paid_at IS NULL) AS lapsed,
             COALESCE(sum(total_minor) FILTER (WHERE paid_at IS NOT NULL), 0) AS paid_minor
      FROM commerce_order WHERE created_at >= now() - (${days} * interval '1 day')`,
  ]);
  const o = orders[0] ?? {};

  return (
    <div className="space-y-6">
      <AnalyticsDashboard data={data} title="Visitors · Collective Market" basePath="/admin/visitors" />
      <ProgressionPanel
        data={progression}
        title="From browsing to an order"
        more={[
          { title: "Auctions", hint: "Visits that opened a lot and then bid.", rows: bidding },
          { title: "Interest in a piece", hint: "Visits that opened an artwork, then favourited it or wrote to the artist.", rows: interest },
        ]}
      />
      <div className="eac-an">
        <section className="eac-an__card">
          <h2>What the orders say</h2>
          <p className="eac-an__hint">From the order records, last {days} days. Visits above are anonymous; these are not tied to them.</p>
          <div className="eac-an__kpis">
            <div className="eac-an__kpi"><span className="eac-an__kpi-label">Orders placed</span><strong className="eac-an__kpi-value">{Number(o.placed ?? 0)}</strong></div>
            <div className="eac-an__kpi"><span className="eac-an__kpi-label">Paid</span><strong className="eac-an__kpi-value">{Number(o.paid ?? 0)}</strong></div>
            <div className="eac-an__kpi"><span className="eac-an__kpi-label">Lapsed or cancelled</span><strong className="eac-an__kpi-value">{Number(o.lapsed ?? 0)}</strong></div>
            <div className="eac-an__kpi"><span className="eac-an__kpi-label">Paid total</span><strong className="eac-an__kpi-value">{new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(o.paid_minor ?? 0) / 100)}</strong></div>
          </div>
        </section>
      </div>
    </div>
  );
}
