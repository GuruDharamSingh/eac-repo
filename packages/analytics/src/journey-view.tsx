import type { FunnelRow, ProgressionData } from './funnel';

// Funnel and common-routes panels. Server-renderable; styled by dashboard.css
// (render inside .eac-an, or alongside <AnalyticsDashboard>).

const nf = new Intl.NumberFormat('en-CA');
const pct = (v: number) => `${Math.round(v * 100)}%`;

export interface FunnelGroup {
  title: string;
  hint?: string;
  rows: FunnelRow[];
}

export function FunnelCard({ title, hint, rows }: FunnelGroup) {
  const first = rows[0]?.sessions ?? 0;
  return (
    <section className="eac-an__card">
      <h2>{title}</h2>
      {hint ? <p className="eac-an__hint">{hint}</p> : null}
      {first === 0 ? (
        <p className="eac-an__empty">No visits reached the first step in this range.</p>
      ) : (
        <ol className="eac-an__funnel">
          {rows.map((r, i) => (
            <li key={r.label}>
              <span className="eac-an__bar" style={{ width: `${Math.max(1.5, r.fromStart * 100)}%` }} aria-hidden />
              <span className="eac-an__label">{r.label}</span>
              <span className="eac-an__num">
                {nf.format(r.sessions)}
                {i > 0 ? <small> {pct(r.fromPrevious)} of previous</small> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Funnels plus the common routes. `data.funnel` is shown as the first funnel;
 * pass `more` for additional funnels (each from its own getFunnel call).
 */
export function ProgressionPanel({ data, title = 'How visitors progress', more = [] }: { data: ProgressionData; title?: string; more?: FunnelGroup[] }) {
  return (
    <div className="eac-an">
      <FunnelCard title={title} hint={`Visits (sessions) that reached each step in order. ${nf.format(data.sessions)} visits in range.`} rows={data.funnel} />
      {more.map((g) => <FunnelCard key={g.title} {...g} />)}

      <section className="eac-an__card">
        <h2>Common routes</h2>
        <p className="eac-an__hint">First pages of each visit, repeats collapsed; ids shown as :id. Visits to non-public pages are not included.</p>
        {data.journeys.length === 0 ? (
          <p className="eac-an__empty">Nothing recorded.</p>
        ) : (
          <ul className="eac-an__routes">
            {data.journeys.map((j) => (
              <li key={j.steps.join('>')}>
                <span className="eac-an__path">
                  {j.steps.map((s, i) => (
                    <span key={i}>{i > 0 ? <i aria-hidden>›</i> : null}<code>{s}</code></span>
                  ))}
                </span>
                <span className="eac-an__num">{nf.format(j.sessions)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
