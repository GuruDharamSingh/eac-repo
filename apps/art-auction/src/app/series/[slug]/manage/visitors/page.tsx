import { getSeriesVisitors } from "@elkdonis/commerce/server";
import { loadWorkspace } from "../load";

export const dynamic = "force-dynamic";

/**
 * Visits to the series page, the presenter board and the series' lot pages
 * over the last 60 days (analytics_events; workspace pages are not counted).
 * Visitors are unique per day, summed.
 */
export default async function VisitorsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const v = await getSeriesVisitors(series.id, series.slug, series.orgId, 60);
  const max = Math.max(1, ...v.days.map((d) => d.views));

  return (
    <>
      <div>
        <h1 className="sw-h1">Visitors</h1>
        <p className="sw-sub">The last 60 days. Visits are counted without cookies; a visitor is unique per day.</p>
      </div>
      <div className="sw-grid cols-4">
        <div className="sw-stat"><div className="sw-stat-label">Page views</div><div className="sw-stat-value">{v.totalViews}</div></div>
        <div className="sw-stat"><div className="sw-stat-label">Visitors (per day, summed)</div><div className="sw-stat-value">{v.totalVisitors}</div></div>
        <div className="sw-stat"><div className="sw-stat-label">Series page views</div><div className="sw-stat-value">{v.pageViews}</div></div>
        <div className="sw-stat"><div className="sw-stat-label">Presenter board views</div><div className="sw-stat-value">{v.liveViews}</div></div>
      </div>

      <section className="sw-card">
        <h2 className="sw-h2">Views per day</h2>
        {v.days.length === 0 ? (
          <p className="sw-muted">No visits recorded yet.</p>
        ) : (
          <div role="img" aria-label="Page views per day" style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 140 }}>
            {v.days.map((d) => (
              <div key={d.day} title={`${d.day}: ${d.views} views, ${d.visitors} visitors`} style={{ flex: "1 1 0", minWidth: 4, height: `${Math.max(4, (d.views / max) * 100)}%`, background: "var(--sw-accent)", borderRadius: "3px 3px 0 0" }} />
            ))}
          </div>
        )}
        {v.days.length > 0 && (
          <p className="sw-hint" style={{ marginTop: 8 }}>{v.days[0]!.day} to {v.days[v.days.length - 1]!.day}</p>
        )}
      </section>

      <section>
        <h2 className="sw-h2">Most viewed lots</h2>
        <div className="sw-table-wrap">
          <table className="sw-table">
            <thead><tr><th>Lot</th><th className="is-num">Views</th></tr></thead>
            <tbody>
              {v.topLots.map((l) => (
                <tr key={l.lotId}><td>{l.lotNumber ?? "—"} · <a href={`/lots/${l.lotId}`}>{l.title}</a></td><td className="is-num">{l.views}</td></tr>
              ))}
              {v.topLots.length === 0 && <tr><td colSpan={2} className="sw-muted" style={{ textAlign: "center", padding: 20 }}>No lots yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="sw-hint">Visits by the team are included. Where visitors came from and which devices they used are in Admin → Visitors for the whole marketplace.</p>
    </>
  );
}
