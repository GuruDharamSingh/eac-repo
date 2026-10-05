'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { RANGES, type RangeKey } from './index';
import type { BreakdownRow, DashboardData, PageRow, Totals } from './types';

// ---------------------------------------------------------------------------
// Shared analytics dashboard. Presentational: the host page authorises the
// viewer, calls getDashboardData() (server) and passes the result here.
// Navigation is plain links (?range=…&org=…) so the page stays a server
// component. Styled by dashboard.css on the --eac-control-* tokens.
// ---------------------------------------------------------------------------

export interface AnalyticsDashboardProps {
  data: DashboardData;
  title?: string;
  /** Path of the page hosting the dashboard, for range and org links. */
  basePath: string;
  /** Network view: orgs to choose between, and the current choice (null = all). */
  orgs?: Array<{ id: string; name: string }>;
  selectedOrg?: string | null;
}

const nf = new Intl.NumberFormat('en-CA');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dur(sec: number): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

function delta(cur: number, prev: number): { text: string; dir: 'up' | 'down' | 'flat' } {
  if (!prev) return cur ? { text: 'new', dir: 'up' } : { text: '—', dir: 'flat' };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { text: `${pct > 0 ? '+' : ''}${pct}%`, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

function country(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const SOURCE_LABEL: Record<string, string> = {
  direct: 'Direct or unknown', search: 'Search', social: 'Social', email: 'Email',
  network: 'Another network site', referral: 'Other sites',
};

function href(basePath: string, range: RangeKey, org: string | null | undefined): string {
  const q = new URLSearchParams({ range });
  if (org) q.set('org', org);
  return `${basePath}?${q.toString()}`;
}

export function AnalyticsDashboard({ data, title = 'Visitors', basePath, orgs, selectedOrg }: AnalyticsDashboardProps) {
  const { totals: t, previous: p } = data;
  const empty = t.pageviews === 0 && data.privateViews === 0;
  const maxHour = Math.max(1, ...data.hours.map((h) => h.pageviews));

  return (
    <div className="eac-an">
      <header className="eac-an__head">
        <div>
          <h1 className="eac-an__title">{title}</h1>
          <p className="eac-an__sub">
            {new Date(data.from).toLocaleDateString('en-CA')} – {new Date(data.to).toLocaleDateString('en-CA')} ({data.timeZone})
            {' · '}
            <span className="eac-an__live" title="Distinct visitors in the last five minutes">
              <i aria-hidden /> {data.liveVisitors} now
            </span>
          </p>
        </div>
        <nav className="eac-an__ranges" aria-label="Range">
          {RANGES.map((r) => (
            <a key={r.key} href={href(basePath, r.key, selectedOrg)} aria-current={r.key === data.range ? 'true' : undefined}>
              {r.label}
            </a>
          ))}
        </nav>
      </header>

      {orgs && orgs.length > 0 ? (
        <nav className="eac-an__orgs" aria-label="Organisation">
          <a href={href(basePath, data.range, null)} aria-current={!selectedOrg ? 'true' : undefined}>Whole network</a>
          {orgs.map((o) => (
            <a key={o.id} href={href(basePath, data.range, o.id)} aria-current={selectedOrg === o.id ? 'true' : undefined}>
              {o.name}
            </a>
          ))}
        </nav>
      ) : null}

      <section className="eac-an__kpis" aria-label="Totals">
        <Kpi label="Visitors" value={nf.format(t.visitors)} d={delta(t.visitors, p.visitors)} hint="Unique per day, summed over the range" />
        <Kpi label="Visits" value={nf.format(t.visits)} d={delta(t.visits, p.visits)} hint="Sessions; a visit ends after 30 minutes idle" />
        <Kpi label="Page views" value={nf.format(t.pageviews)} d={delta(t.pageviews, p.pageviews)} />
        <Kpi label="Bounce rate" value={`${Math.round(t.bounceRate * 100)}%`} d={deltaRate(t, p)} hint="Visits with one page view" />
        <Kpi label="Time on page" value={dur(t.avgDurationSec)} d={delta(t.avgDurationSec, p.avgDurationSec)} hint="Average visible time" />
        <Kpi label="Signed-in people" value={nf.format(t.members)} d={delta(t.members, p.members)} />
      </section>

      {empty ? (
        <p className="eac-an__empty">
          No visits recorded in this range. Collection starts when the site includes the analytics beacon;
          visitors who send Do Not Track or Global Privacy Control are not counted.
        </p>
      ) : (
        <>
          <section className="eac-an__card">
            <h2>Visitors and page views</h2>
            <div className="eac-an__chart">
              <ResponsiveContainer width="100%" height={260} minWidth={0}>
                <AreaChart data={data.daily} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--an-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--an-muted)' }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} stroke="var(--an-line)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--an-muted)' }} stroke="var(--an-line)" />
                  <Tooltip contentStyle={{ background: 'var(--an-bg)', border: '1px solid var(--an-line)', color: 'var(--an-fg)', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="pageviews" name="Page views" stroke="var(--an-accent-2)" fill="var(--an-accent-2)" fillOpacity={0.14} strokeWidth={2} />
                  <Area type="monotone" dataKey="visitors" name="Visitors" stroke="var(--an-accent)" fill="var(--an-accent)" fillOpacity={0.22} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="eac-an__grid">
            <Pages title="Top pages" rows={data.pages} />
            <Pages title="Entry pages" rows={data.entryPages} hint="Where visits begin" />
            <List
              title="Where visitors came from"
              hint="Entry of each visit"
              rows={data.sources.map((s) => ({
                key: `${s.kind}:${s.referrerHost}`,
                label: s.referrerHost ?? SOURCE_LABEL[s.kind],
                sub: s.referrerHost ? SOURCE_LABEL[s.kind] : undefined,
                value: s.visits,
              }))}
            />
            <List
              title="Campaigns"
              hint="From utm_ parameters on links"
              rows={data.campaigns.map((c) => ({
                key: `${c.source}|${c.medium}|${c.campaign}`,
                label: c.campaign ?? c.source ?? c.medium ?? '—',
                sub: [c.source, c.medium].filter(Boolean).join(' / ') || undefined,
                value: c.visits,
              }))}
              empty="No tagged links yet. Add ?utm_source=…&utm_medium=…&utm_campaign=… to links you share."
            />
            <List
              title="Countries"
              rows={data.countries.map((c) => ({ key: c.country, label: country(c.country), value: c.visitors }))}
              empty="No location data. It needs the GeoLite2 database (packages/analytics/README.md)."
            />
            <List
              title="Regions"
              rows={data.regions.map((c) => ({ key: `${c.country}-${c.region}`, label: c.region ?? '—', sub: country(c.country), value: c.visitors }))}
              empty="No region data."
            />
            <Breakdown title="Devices" rows={data.devices} />
            <Breakdown title="Browsers" rows={data.browsers} />
            <Breakdown title="Systems" rows={data.systems} />
            <List
              title="Actions"
              hint="Named events (RSVP, sign-up, purchase…)"
              rows={data.events.map((e) => ({ key: e.name, label: e.name, sub: `${nf.format(e.visitors)} visitors`, value: e.count }))}
              empty="No events recorded. Call trackEvent(name) from the beacon module where an action completes."
            />
            {data.sites.length > 1 ? (
              <List
                title="Sites"
                rows={data.sites.map((s) => ({ key: s.host, label: s.host, sub: s.orgName ?? undefined, value: s.pageviews }))}
              />
            ) : null}
          </div>

          <div className="eac-an__grid eac-an__grid--2">
            <section className="eac-an__card">
              <h2>When: hour of day</h2>
              <div className="eac-an__chart">
                <ResponsiveContainer width="100%" height={180} minWidth={0}>
                  <BarChart data={data.hours} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--an-muted)' }} interval={2} stroke="var(--an-line)" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--an-muted)' }} stroke="var(--an-line)" />
                    <Tooltip cursor={{ fill: 'var(--an-soft)' }} contentStyle={{ background: 'var(--an-bg)', border: '1px solid var(--an-line)', color: 'var(--an-fg)', borderRadius: 8 }} labelFormatter={(h) => `${h}:00`} />
                    <Bar dataKey="pageviews" name="Page views" fill="var(--an-accent)" radius={[3, 3, 0, 0]} fillOpacity={maxHour ? 1 : 0.4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="eac-an__card">
              <h2>When: day of week</h2>
              <div className="eac-an__chart">
                <ResponsiveContainer width="100%" height={180} minWidth={0}>
                  <BarChart data={data.weekdays.map((d) => ({ ...d, label: WEEKDAYS[d.dow] }))} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--an-muted)' }} stroke="var(--an-line)" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--an-muted)' }} stroke="var(--an-line)" />
                    <Tooltip cursor={{ fill: 'var(--an-soft)' }} contentStyle={{ background: 'var(--an-bg)', border: '1px solid var(--an-line)', color: 'var(--an-fg)', borderRadius: 8 }} />
                    <Bar dataKey="pageviews" name="Page views" fill="var(--an-accent-2)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {data.privateViews > 0 ? (
            <p className="eac-an__note">
              {nf.format(data.privateViews)} page views were on members-only pages. They are counted in the totals
              but their pages, sources and campaigns are not recorded.
            </p>
          ) : null}
        </>
      )}

      {data.people ? (
        <section className="eac-an__card">
          <h2>Signed-in people</h2>
          <p className="eac-an__hint">Members who visited in this range, most recent first. Visits and page views are lifetime counts for the site.</p>
          {data.people.length === 0 ? (
            <p className="eac-an__empty">No signed-in visits recorded yet.</p>
          ) : (
            <div className="eac-an__scroll">
              <table className="eac-an__table">
                <thead>
                  <tr><th>Person</th><th>Visits</th><th>Page views</th><th>First seen</th><th>Last seen</th></tr>
                </thead>
                <tbody>
                  {data.people.map((r) => (
                    <tr key={r.userId}>
                      <td>{r.name}</td>
                      <td>{nf.format(r.visits)}</td>
                      <td>{nf.format(r.pageviews)}</td>
                      <td>{new Date(r.firstSeen).toLocaleDateString('en-CA')}</td>
                      <td>{new Date(r.lastSeen).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <p className="eac-an__foot">
        Collected without cookies. Visitor ids are anonymous hashes that change daily; IP addresses are not stored.
        Returning visitors are only recognised when signed in.
      </p>
    </div>
  );
}

function deltaRate(c: Totals, p: Totals) {
  const diff = Math.round((c.bounceRate - p.bounceRate) * 100);
  // A lower bounce rate is better, so the direction flips.
  return { text: diff ? `${diff > 0 ? '+' : ''}${diff} pts` : '—', dir: (diff > 0 ? 'down' : diff < 0 ? 'up' : 'flat') as 'up' | 'down' | 'flat' };
}

function Kpi({ label, value, d, hint }: { label: string; value: string; d: { text: string; dir: 'up' | 'down' | 'flat' }; hint?: string }) {
  return (
    <div className="eac-an__kpi" title={hint}>
      <span className="eac-an__kpi-label">{label}</span>
      <strong className="eac-an__kpi-value">{value}</strong>
      <span className={`eac-an__delta eac-an__delta--${d.dir}`}>{d.text} <small>vs previous</small></span>
    </div>
  );
}

interface ListRow { key: string; label: string; sub?: string; value: number }

function List({ title, hint, rows, empty }: { title: string; hint?: string; rows: ListRow[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="eac-an__card">
      <h2>{title}</h2>
      {hint ? <p className="eac-an__hint">{hint}</p> : null}
      {rows.length === 0 ? (
        <p className="eac-an__empty">{empty ?? 'Nothing recorded.'}</p>
      ) : (
        <ul className="eac-an__list">
          {rows.map((r) => (
            <li key={r.key}>
              <span className="eac-an__bar" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} aria-hidden />
              <span className="eac-an__label" title={r.label}>
                {r.label}
                {r.sub ? <small>{r.sub}</small> : null}
              </span>
              <span className="eac-an__num">{nf.format(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Breakdown({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return <List title={title} rows={rows.map((r) => ({ key: r.label, label: r.label, value: r.visitors }))} />;
}

function Pages({ title, rows, hint }: { title: string; rows: PageRow[]; hint?: string }) {
  return (
    <List
      title={title}
      hint={hint}
      rows={rows.map((r) => ({
        key: `${r.path}:${r.threadId}`,
        label: r.title ?? r.path,
        sub: r.title ? `${r.path} · ${dur(r.avgDurationSec)}` : dur(r.avgDurationSec) === '—' ? undefined : dur(r.avgDurationSec),
        value: r.views,
      }))}
    />
  );
}
