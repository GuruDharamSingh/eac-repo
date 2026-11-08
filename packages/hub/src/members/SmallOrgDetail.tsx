'use client';

// Detail for a small org (2–5 people, 1p) and a solo org (1q): no tabs, so it doesn't
// feel like an enterprise console. People left; arrivals, visitors and the matrix toggle right.

import * as React from 'react';
import type { HubRole } from '../contract';
import { Btn, Frame, Toggle } from '../ui/primitives';
import type { MembersHost } from './host';
import type { Live } from './live';
import type { Member, MembersDetailData } from './model';
import { Matrix, StorageBlock } from './PermissionsTab';
import { RoleCell, StorageCell, hairline } from './parts';
import { joinedText, seenText } from './time';

export interface SmallActions {
  pickRole(m: Member, to: HubRole): void;
  askRemove(m: Member): void;
}

export function SmallOrgDetail({ data, host, live, actions }: {
  data: MembersDetailData;
  host: MembersHost;
  live: Live;
  actions: SmallActions;
}) {
  const [showMatrix, setShowMatrix] = React.useState(false);
  const showStorage = data.can.seeStorage && live.people.some((p) => p.storage !== null);
  const showRemove = live.people.some((p) => p.can.remove);
  const cols = `minmax(0,1fr) 124px 116px${showStorage ? " 116px" : ""}${showRemove ? " 32px" : ""}`;
  const solo = data.total <= 1;
  const week = data.visitors?.range === '7d' ? data.visitors.bars : null;
  const wmax = Math.max(1, ...(week ?? []).map((b) => b.n));

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 22 }}>People</h4>
          <Frame style={{ display: 'grid', gap: 1, background: 'var(--hc-divider)' }}>
            {live.people.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'grid', gridTemplateColumns: cols, gap: 16, alignItems: 'center', padding: '14px 16px',
                  background: 'var(--hc-bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span className="hc-avatar" style={{ width: 38, height: 38, fontSize: 14 }} aria-hidden="true">{m.initials}</span>
                  <div style={{ minWidth: 0, lineHeight: 1.3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500 }}>
                      {m.name}
                      {m.isYou ? <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--hc-n-600)' }}>you</span> : null}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--hc-n-700)' }}>
                      Joined {joinedText(m.joinedAt)}{seenText(m.lastSeenAt) ? ` · seen ${seenText(m.lastSeenAt)?.toLowerCase()}` : ''}
                    </div>
                  </div>
                </div>
                <div><RoleCell member={m} width={124} minHeight={32} onPick={(to) => actions.pickRole(m, to)} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle checked={m.listed} disabled={!m.can.list} label="Listed publicly" onChange={(v) => void live.setListed(m, v)} />
                  <span style={{ fontSize: 13 }}>{m.listed ? 'Listed' : 'Unlisted'}</span>
                </div>
                {showStorage ? <div><StorageCell status={m.storage} /></div> : null}
                {showRemove ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {m.can.remove ? (
                      <Btn
                        variant="ghost"
                        square
                        icon="user-minus"
                        aria-label={`Remove ${m.name}`}
                        title={`Remove from ${data.org.name}`}
                        style={{ width: 32, height: 32, color: 'var(--hc-n-700)' }}
                        onClick={() => actions.askRemove(m)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </Frame>
          {solo ? (
            <p style={{ margin: '16px 0 0', fontSize: 14, color: 'var(--hc-n-700)', maxWidth: '56ch', textWrap: 'pretty' } as React.CSSProperties}>
              It’s just you for now. When someone signs in from another site on the network, they’ll show up under Arrivals and you can welcome them with a role.
            </p>
          ) : null}
        </div>

        <div style={{ flex: '0 1 330px', minWidth: 'min(100%, 280px)', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Frame style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <h5 style={{ margin: 0, fontSize: 18 }}>Arrivals</h5>
              <span style={{ fontSize: 12, color: 'var(--hc-n-700)' }}>{live.waiting} waiting</span>
            </div>
            {live.arrivals.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: hairline }}>
                <span className="hc-avatar" data-arrival="true" aria-hidden="true" style={{ width: 28, height: 28, fontSize: 11, color: 'var(--hc-a-800)' }}>{a.initials}</span>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                  <div style={{ fontSize: 14 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--hc-n-700)' }}>From {a.fromSite}</div>
                </div>
                <Btn variant="primary" style={{ padding: '4px 10px' }} onClick={() => void live.welcome(a, data.can.welcomeAs.includes('viewer') ? 'viewer' : (data.can.welcomeAs[0] ?? 'viewer'))}>
                  Welcome
                </Btn>
              </div>
            ))}
            {live.arrivals.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--hc-n-700)', textWrap: 'pretty' } as React.CSSProperties}>
                No one waiting. People who sign in from other sites on the network appear here, ready to be welcomed.
              </p>
            ) : null}
          </Frame>

          {data.can.seeVisitors ? (
            <Frame style={{ padding: '16px 18px' }}>
              <h5 style={{ margin: '0 0 8px', fontSize: 18 }}>Visitors this week</h5>
              {(data.visitorsWeek ?? 0) > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                    <span className="hc-num" style={{ fontSize: 36, lineHeight: 1 }}>{(data.visitorsWeek ?? 0).toLocaleString('en-US')}</span>
                    {week ? (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36, width: 112, borderBottom: '1px solid var(--hc-divider)' }} aria-hidden="true">
                        {week.map((b, i) => (
                          <div key={i} style={{ flex: 1, height: `${Math.max((b.n / wmax) * 100, 2)}%`, background: 'var(--hc-accent)' }} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {data.visitors?.topPages[0] ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--hc-n-700)' }}>Most visited: {data.visitors.topPages[0].path}</div>
                  ) : null}
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--hc-n-700)' }}>No visits recorded yet.</p>
              )}
            </Frame>
          ) : null}

          <Btn variant="secondary" style={{ alignSelf: 'flex-start' }} aria-expanded={showMatrix} onClick={() => setShowMatrix((s) => !s)}>
            {showMatrix ? 'Hide who can do what' : 'Who can do what'}
          </Btn>
        </div>
      </div>

      {showMatrix ? <Matrix mine={data.viewer.role} style={{ marginTop: 36 }} /> : null}
      <StorageBlock data={data} host={host} style={{ marginTop: 36 }} />
    </>
  );
}
