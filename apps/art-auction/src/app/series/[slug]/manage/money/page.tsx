import Link from "next/link";
import { getSeriesMoney, isNetworkAdmin } from "@elkdonis/commerce/server";
import { loadWorkspace } from "../load";
import { RecordPayoutButton } from "../orders/orders-panel";

export const dynamic = "force-dynamic";

const money = (n: number, c = "CAD") => new Intl.NumberFormat("en-CA", { style: "currency", currency: c }).format(n / 100);

/**
 * Money for one series: what buyers paid, where it went, and what each artist
 * is still owed. Figures are sums of payout_ledger rows on the series' orders.
 * Payouts made by hand are not tied to an order, so "Owed now" is the artist's
 * whole marketplace balance.
 */
export default async function MoneyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series, userId } = await loadWorkspace(slug);
  const [m, admin] = await Promise.all([getSeriesMoney(series.id), isNetworkAdmin(userId)]);
  const c = m.currency;
  const tiles = [
    ["Collected from buyers", m.collectedMinor],
    ["Awaiting payment", m.awaitingMinor],
    [`To ${series.presenterName ?? "organisations"} and beneficiaries`, m.toOrgsMinor],
    ["To the platform", m.toPlatformMinor],
    ["Artists' share", m.toArtistsMinor],
    ["Paid to artists at sale", m.paidAtSourceMinor],
    ["Held", m.heldMinor],
  ] as const;

  return (
    <>
      <div>
        <h1 className="sw-h1">Money</h1>
        <p className="sw-sub">Sales in this series and where the money goes. Card payments and e-transfers arrive in the collective&rsquo;s account; artists are paid from it.</p>
      </div>

      <div className="sw-grid cols-4">
        {tiles.map(([label, n]) => (
          <div key={label} className="sw-stat">
            <div className="sw-stat-label">{label}</div>
            <div className="sw-stat-value">{money(n, c)}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="sw-h2">Artists</h2>
        <div className="sw-table-wrap">
          <table className="sw-table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Artist</th>
                <th>Payout method</th>
                <th className="is-num">Share in this series</th>
                <th className="is-num">Paid at sale</th>
                <th className="is-num">Owed now (all sales)</th>
                <th className="is-num">Held</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {m.artists.map((a) => (
                <tr key={a.userId}>
                  <td><strong>{a.name}</strong>{a.slug && <div className="sw-muted">@{a.slug}</div>}</td>
                  <td>{a.stripe ? <span className="sw-pill is-ok">Stripe</span> : a.payoutEmail ? <span className="sw-pill is-accent">E-transfer · {a.payoutEmail}</span> : <span className="sw-pill is-warn">None yet</span>}</td>
                  <td className="is-num">{money(a.accruedMinor, c)}</td>
                  <td className="is-num">{money(a.paidAtSourceMinor, c)}</td>
                  <td className="is-num">{money(a.payableMinor, c)}</td>
                  <td className="is-num">{money(a.heldMinor, c)}</td>
                  <td className="is-num">
                    {admin && a.payableMinor > 0 && (
                      <RecordPayoutButton seriesId={series.id} slug={series.slug} artistUserId={a.userId} artistName={a.name} suggestedMinor={a.payableMinor} />
                    )}
                  </td>
                </tr>
              ))}
              {m.artists.length === 0 && (
                <tr><td colSpan={7} className="sw-muted" style={{ textAlign: "center", padding: 28 }}>No sales yet. Artists appear here once their lots are paid for.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="sw-hint" style={{ marginTop: 8 }}>
          {admin
            ? "Held amounts (dispute window, no payout account) are released in Admin → Money before they can be paid."
            : "Payouts are recorded by a network admin."}{" "}
          Name-only artists have no account: {series.presenterName ?? "the presenting organisation"} is paid for their pieces and settles with them directly.
          See <Link href={`/series/${series.slug}/manage/orders`}>Orders &amp; fulfilment</Link> for each sale.
        </p>
      </section>
    </>
  );
}
