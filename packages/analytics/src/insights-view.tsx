import { RANGES } from './index';
import type { ActivityItem, AuthorInsights, PostInsight } from './insights';

// Author insights page body. Server-renderable (no client state); styled by
// dashboard.css. The host page supplies the signed-in author's data and the
// path for range links, and a function that turns a post into a link.

export interface AuthorInsightsViewProps {
  data: AuthorInsights;
  title?: string;
  basePath: string;
  /** Link for a post title; omit for plain text. */
  postHref?: (p: { threadId: string; slug: string; orgId: string; kind: string }) => string | null;
}

const nf = new Intl.NumberFormat('en-CA');
const SOURCE: Record<string, string> = {
  direct: 'Direct or unknown', search: 'Search', social: 'Social', email: 'Email', network: 'Another network site', referral: 'Other sites',
};

function dur(sec: number): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  return m ? `${m}m ${String(sec % 60).padStart(2, '0')}s` : `${sec}s`;
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 14) return `${Math.round(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-CA');
}

function Spark({ points }: { points: number[] }) {
  const max = Math.max(1, ...points);
  const w = 600, h = 80, step = points.length > 1 ? w / (points.length - 1) : w;
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(h - 4 - (v / max) * (h - 12)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="eac-an__spark" role="img" aria-label={`Views per day, peak ${max}`} preserveAspectRatio="none">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="var(--an-accent)" fillOpacity="0.18" />
      <path d={d} fill="none" stroke="var(--an-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function AuthorInsightsView({ data, title = 'Your posts', basePath, postHref }: AuthorInsightsViewProps) {
  const { totals: t } = data;
  return (
    <div className="eac-an">
      <header className="eac-an__head">
        <div>
          <h1 className="eac-an__title">{title}</h1>
          <p className="eac-an__sub">
            {new Date(data.from).toLocaleDateString('en-CA')} – {new Date(data.to).toLocaleDateString('en-CA')} · only you can see this page
          </p>
        </div>
        <nav className="eac-an__ranges" aria-label="Range">
          {RANGES.map((r) => (
            <a key={r.key} href={`${basePath}?range=${r.key}`} aria-current={r.key === data.range ? 'true' : undefined}>{r.label}</a>
          ))}
        </nav>
      </header>

      <section className="eac-an__kpis" aria-label="Totals">
        <Kpi label="Published posts" value={nf.format(t.posts)} />
        <Kpi label="Views" value={nf.format(t.views)} hint="Public posts only" />
        <Kpi label="Readers" value={nf.format(t.visitors)} hint="Unique per day, summed over the range" />
        <Kpi label="Replies" value={nf.format(t.replies)} hint="From others, in range" />
        <Kpi label="Reactions" value={nf.format(t.reactions)} hint="From others, in range" />
        <Kpi label="Saved by others" value={nf.format(t.bookmarks)} hint="Bookmarks, all time" />
      </section>

      <div className="eac-an__grid eac-an__grid--2">
        <section className="eac-an__card">
          <h2>Views per day</h2>
          <p className="eac-an__hint">{t.signedInReaders > 0 ? `${nf.format(t.signedInReaders)} signed-in people read your posts in this range.` : 'No signed-in readers in this range.'}</p>
          <Spark points={data.daily.map((d) => d.views)} />
        </section>
        <section className="eac-an__card">
          <h2>Where readers came from</h2>
          {data.sources.length === 0 ? (
            <p className="eac-an__empty">No visits to your public posts in this range.</p>
          ) : (
            <ul className="eac-an__list">
              {data.sources.map((s) => (
                <li key={`${s.kind}:${s.referrerHost}`}>
                  <span className="eac-an__bar" style={{ width: `${Math.max(2, (s.visits / data.sources[0].visits) * 100)}%` }} aria-hidden />
                  <span className="eac-an__label">{s.referrerHost ?? SOURCE[s.kind]}{s.referrerHost ? <small>{SOURCE[s.kind]}</small> : null}</span>
                  <span className="eac-an__num">{nf.format(s.visits)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="eac-an__card">
        <h2>Each post</h2>
        <p className="eac-an__hint">Views and reading time cover public posts; replies, reactions and saves are counted for every post.</p>
        {data.posts.length === 0 ? (
          <p className="eac-an__empty">You have no published posts.</p>
        ) : (
          <div className="eac-an__scroll">
            <table className="eac-an__table">
              <thead>
                <tr><th>Post</th><th>Views</th><th>Readers</th><th>Read time</th><th>Mostly from</th><th>Replies</th><th>Reactions</th><th>Saved</th></tr>
              </thead>
              <tbody>
                {data.posts.map((p) => <Row key={p.threadId} p={p} href={postHref?.(p) ?? null} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="eac-an__card">
        <h2>What happened lately</h2>
        {data.activity.length === 0 ? (
          <p className="eac-an__empty">No replies, reactions or saves from others yet.</p>
        ) : (
          <ul className="eac-an__feed">
            {data.activity.map((a, i) => <Item key={i} a={a} />)}
          </ul>
        )}
      </section>

      <p className="eac-an__foot">Readers are counted, not named. Visitor ids are anonymous and change daily.</p>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="eac-an__kpi" title={hint}>
      <span className="eac-an__kpi-label">{label}</span>
      <strong className="eac-an__kpi-value">{value}</strong>
    </div>
  );
}

function Row({ p, href }: { p: PostInsight; href: string | null }) {
  const nonPublic = p.visibility !== 'PUBLIC';
  return (
    <tr>
      <td>
        {href ? <a href={href}>{p.title}</a> : p.title}
        <div className="eac-an__rowsub">{[p.orgName, p.kind, nonPublic ? 'not public' : null].filter(Boolean).join(' · ')}</div>
      </td>
      <td>{nonPublic ? '—' : nf.format(p.views)}</td>
      <td>{nonPublic ? '—' : nf.format(p.visitors)}</td>
      <td>{nonPublic ? '—' : dur(p.avgDurationSec)}</td>
      <td>{p.topSource ? (p.topSource.host ?? SOURCE[p.topSource.kind]) : '—'}</td>
      <td>{nf.format(p.repliesInRange)}{p.repliesTotal > p.repliesInRange ? <small> / {nf.format(p.repliesTotal)}</small> : null}</td>
      <td>{nf.format(p.reactionsInRange)}{p.reactionsTotal > p.reactionsInRange ? <small> / {nf.format(p.reactionsTotal)}</small> : null}</td>
      <td>{nf.format(p.bookmarksTotal)}</td>
    </tr>
  );
}

function Item({ a }: { a: ActivityItem }) {
  const verb = a.type === 'reply' ? 'replied to' : a.type === 'reaction' ? `reacted${a.text ? ` (${a.text})` : ''} to` : 'saved';
  return (
    <li>
      <span><strong>{a.who}</strong> {verb} <em>{a.threadTitle}</em></span>
      {a.type === 'reply' && a.text ? <q>{a.text}</q> : null}
      <time dateTime={a.at}>{ago(a.at)}</time>
    </li>
  );
}
