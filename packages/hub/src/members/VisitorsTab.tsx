'use client';

// Detail > Visitors (1m, owners): anonymous traffic as analytics. A hand-built bar chart
// (divs, dashed gridlines, hover chip), top pages, and where visits come from.

import * as React from 'react';
import type { HubNav } from '../contract';
import { BtnLink, Frame, Segmented } from '../ui/primitives';
import type { MembersHost } from './host';
import type { MembersDetailData, VisitorRange, VisitorsData } from './model';
import { hairline } from './parts';

const fmt = (n: number) => n.toLocaleString('en-US');

/** A round axis step so the chart has about eight steps (50 for a week of ~200s, 250 for 90 days). */
function niceStep(raw: number): number {
  if (raw <= 1) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const pick = [1, 2, 2.5, 5, 10].find((c) => f <= c) ?? 10;
  return Math.max(1, pick * mag);
}

const SOURCE_FILL: Record<VisitorsData['sources'][number]['group'], string> = {
  network: 'var(--hc-a-800)',
  search: 'var(--hc-a-600)',
  direct: 'var(--hc-a-400)',
  social: 'var(--hc-a-300)',
  other: 'var(--hc-n-300)',
};
const SOURCE_LABEL: Record<VisitorsData['sources'][number]['group'], string> = {
  network: 'Network sites',
  search: 'Search',
  direct: 'Direct',
  social: 'Social',
  other: 'Other',
};
const GROUPS = ['network', 'search', 'direct', 'social', 'other'] as const;

export function VisitorsTab({ data, host, nav }: { data: MembersDetailData; host: MembersHost; nav: HubNav }) {
  const v = data.visitors;
  const range = v?.range ?? '7d';
  const analytics = host.analyticsHref;
  const [hover, setHover] = React.useState(-1);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 18, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--hc-n-800)', maxWidth: '70ch' }}>
          Anonymous traffic to the {data.org.name} site. Signed-in people from other network sites show up under Arrivals instead.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
          {analytics ? <BtnLink href={analytics} target="_blank" rel="noreferrer">Full analytics ↗</BtnLink> : null}
          <Segmented<VisitorRange>
            label="Range"
            value={range}
            onChange={(r) => nav.openDetail('visitors', undefined, { range: r })}
            options={[
              { value: '7d', label: '7 days' },
              { value: '30d', label: '30 days' },
              { value: '90d', label: '90 days' },
            ]}
          />
        </div>
      </div>
      {v ? <Body v={v} hover={hover} setHover={setHover} /> : (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--hc-n-700)' }}>No visits recorded yet.</p>
      )}
    </div>
  );
}

function Body({ v, hover, setHover }: { v: VisitorsData; hover: number; setHover(i: number): void }) {
  const len = v.bars.length;
  const vmax = Math.max(1, ...v.bars.map((b) => b.n));
  const step = niceStep((vmax * 1.1) / 8);
  const niceMax = Math.max(step, Math.ceil((vmax * 1.1) / step) * step);
  const gap = len > 20 ? 3 : len > 10 ? 6 : 12;
  const showLabel = (i: number) => (len > 20 ? (len - 1 - i) % 7 === 0 : len > 10 ? (len - 1 - i) % 2 === 0 : true);
  const ticks = [0, niceMax / 2, niceMax];

  const topMax = Math.max(1, v.topPages[0]?.n ?? 1);
  const total = v.sources.reduce((a, s) => a + s.n, 0) || 1;
  const groups = GROUPS.map((g) => {
    const items = v.sources.filter((s) => s.group === g);
    const n = items.reduce((a, s) => a + s.n, 0);
    let sub: string | null = null;
    if (g === 'network' && items.length > 0) {
      const sorted = [...items].sort((a, b) => b.n - a.n);
      const head = sorted.slice(0, 3).map((s) => `${s.label} ${Math.round((s.n / total) * 100)}%`);
      const rest = sorted.slice(3);
      if (rest.length) head.push(`${rest.length} others ${Math.round((rest.reduce((a, s) => a + s.n, 0) / total) * 100)}%`);
      sub = head.join(' · ');
    }
    return { g, n, pct: (n / total) * 100, sub };
  }).filter((x) => x.n > 0);

  return (
    <>
      <Frame style={{ padding: '20px 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span className="hc-num" style={{ fontSize: 46, lineHeight: 1 }}>{fmt(v.total)}</span>
          <span style={{ fontSize: 14 }}>visits</span>
          <span style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>{v.changeLabel ?? 'No previous period to compare'}</span>
        </div>
        <div style={{ position: 'relative', height: 190, marginTop: 22 }}>
          {ticks.map((t) => (
            <div key={t} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(t / niceMax) * 100}%`, borderTop: '1px dashed var(--hc-n-300)' }}>
              <span style={{ position: 'absolute', right: 0, top: -17, fontSize: 11, color: 'var(--hc-n-600)' }}>{fmt(Math.round(t))}</span>
            </div>
          ))}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 48, display: 'flex', alignItems: 'flex-end', gap }}>
            {v.bars.map((b, i) => (
              <div
                key={`${b.label}-${i}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(-1)}
                role="img"
                aria-label={`${b.label}: ${fmt(b.n)}`}
                style={{
                  position: 'relative', flex: 1, height: `${(b.n / niceMax) * 100}%`,
                  background: hover === i ? 'var(--hc-a-700)' : 'var(--hc-accent)',
                }}
              >
                {hover === i ? (
                  <span
                    style={{
                      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6,
                      fontSize: 12, whiteSpace: 'nowrap', padding: '2px 7px', background: 'var(--hc-text)', color: 'var(--hc-bg)', zIndex: 2,
                    }}
                  >
                    {b.label} · {fmt(b.n)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap, marginRight: 48, marginTop: 8 }}>
          {v.bars.map((b, i) => (
            <div key={`${b.label}-${i}`} style={{ flex: 1, display: 'flex', justifyContent: 'center', fontSize: 11, color: 'var(--hc-n-700)', whiteSpace: 'nowrap' }}>
              {showLabel(i) ? b.label : ''}
            </div>
          ))}
        </div>
      </Frame>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 24, marginTop: 24 }}>
        <Frame style={{ padding: '18px 20px' }}>
          <h5 style={{ margin: '0 0 6px', fontSize: 18 }}>Top pages</h5>
          {v.topPages.map((pg) => (
            <div key={pg.path} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px', gap: 14, alignItems: 'center', padding: '8px 0', borderBottom: hairline }}>
              <div>
                <div style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{pg.path}</div>
                <div style={{ height: 4, marginTop: 6, background: 'var(--hc-n-200)' }}>
                  <div style={{ height: '100%', width: `${(pg.n / topMax) * 100}%`, background: 'var(--hc-accent)' }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmt(pg.n)}</div>
            </div>
          ))}
        </Frame>
        <Frame style={{ padding: '18px 20px' }}>
          <h5 style={{ margin: '0 0 12px', fontSize: 18 }}>Where visits come from</h5>
          <div style={{ display: 'flex', gap: 2, height: 14, marginBottom: 14 }}>
            {groups.map((s) => (
              <div key={s.g} style={{ flex: s.pct, background: SOURCE_FILL[s.g] }} />
            ))}
          </div>
          {groups.map((s) => (
            <div key={s.g} style={{ display: 'grid', gridTemplateColumns: '12px minmax(0,1fr) 48px', gap: 10, alignItems: 'baseline', padding: '7px 0', borderBottom: hairline }}>
              <span style={{ width: 10, height: 10, background: SOURCE_FILL[s.g] }} />
              <div>
                <div style={{ fontSize: 14 }}>{SOURCE_LABEL[s.g]}</div>
                {s.sub ? <div style={{ fontSize: 12, color: 'var(--hc-n-700)' }}>{s.sub}</div> : null}
              </div>
              <span style={{ textAlign: 'right', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{Math.round(s.pct)}%</span>
            </div>
          ))}
        </Frame>
      </div>
    </>
  );
}
