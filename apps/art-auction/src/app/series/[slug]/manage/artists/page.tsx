import Link from "next/link";
import { listSeriesArtists } from "@elkdonis/commerce/server";
import { loadWorkspace } from "../load";

export const dynamic = "force-dynamic";

const money = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n / 100);

/** Every artist with work in the series, how they are attributed, and whether they can be paid. */
export default async function ArtistsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const artists = await listSeriesArtists(series.id);
  const presenter = series.presenterName ?? "the presenting organisation";
  const noPayout = artists.filter((a) => a.role === "maker" && !a.stripe && !a.payoutEmail).length;

  return (
    <>
      <div className="sw-head">
        <div>
          <h1 className="sw-h1">Artists</h1>
          <p className="sw-sub">{artists.length} artist{artists.length === 1 ? "" : "s"} in this series{noPayout ? ` · ${noPayout} without a payout method` : ""}.</p>
        </div>
        <Link href={`/series/${series.slug}/manage/lots/new`} className="sw-btn">+ Add a lot</Link>
      </div>

      <div className="sw-table-wrap">
        <table className="sw-table" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Artist</th>
              <th>Listed as</th>
              <th className="is-num">Lots</th>
              <th className="is-num">High bids</th>
              <th>Account</th>
              <th>Payouts</th>
            </tr>
          </thead>
          <tbody>
            {artists.map((a) => (
              <tr key={a.key}>
                <td>
                  {a.userId ? (
                    <a href={`/artists/${a.slug ?? a.userId}`} target="_blank" rel="noopener"><strong>{a.name}</strong></a>
                  ) : (
                    <strong>{a.name}</strong>
                  )}
                  {a.slug && <div className="sw-muted">@{a.slug}</div>}
                </td>
                <td>
                  {a.role === "maker" ? "Maker, paid for the sale" : a.role === "credited" ? `Credited; proceeds to ${presenter}` : `Name only; ${presenter} is paid`}
                </td>
                <td className="is-num">{a.lotCount}</td>
                <td className="is-num">{money(a.highBidsMinor)}</td>
                <td>
                  {a.role === "name-only" ? (
                    <span className="sw-pill is-plain">No account</span>
                  ) : a.hasStore ? (
                    <span className="sw-pill is-ok">Own store</span>
                  ) : (
                    <span className="sw-pill is-accent">Network account</span>
                  )}
                </td>
                <td>
                  {a.role !== "maker" ? (
                    <span className="sw-muted">n/a</span>
                  ) : a.stripe ? (
                    <span className="sw-pill is-ok">Stripe</span>
                  ) : a.payoutEmail ? (
                    <span className="sw-pill is-accent">E-transfer</span>
                  ) : (
                    <span className="sw-pill is-warn">None yet: share held</span>
                  )}
                </td>
              </tr>
            ))}
            {artists.length === 0 && (
              <tr><td colSpan={6} className="sw-muted" style={{ textAlign: "center", padding: 28 }}>No artists yet. Add a lot to list an artist&rsquo;s work.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="sw-hint">
        An artist without a payout method can still sell: their share is held and paid once they add one in My art → Payouts.
      </p>
    </>
  );
}
