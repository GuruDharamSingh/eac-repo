'use client';

// Detail > Arrivals (1l): the oldest-first queue as cards.

import * as React from 'react';
import type { HubRole } from '../contract';
import { Btn, Frame, Tag } from '../ui/primitives';
import type { Live } from './live';
import type { MembersDetailData } from './model';
import { WelcomeSelect, defaultWelcomeRole, hairline, lowerRole } from './parts';
import { waitText, whenText } from './time';

export function ArrivalsTab({ data, live }: { data: MembersDetailData; live: Live }) {
  const [arrRole, setArrRole] = React.useState<Record<string, HubRole>>({});
  const welcomeAs = data.can.welcomeAs;
  const choose = welcomeAs.length > 1;
  const only = welcomeAs[0] ? lowerRole(welcomeAs[0]) : 'viewer';
  const label = choose ? 'Welcome' : `Welcome as ${only}`;

  return (
    <div>
      <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--hc-n-800)', maxWidth: '70ch', textWrap: 'pretty' } as React.CSSProperties}>
        {choose
          ? 'Signed-in people who came over from another site on the network. Welcome them as a viewer, or pick a role first. Every welcome queues a storage sync.'
          : 'Signed-in people who came over from another site on the network. Guides can welcome them as viewers; owners give other roles.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))', gap: 24 }}>
        {live.arrivals.map((a, i) => {
          const role = arrRole[a.id] ?? defaultWelcomeRole(welcomeAs);
          return (
            <Frame key={a.id} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="hc-avatar" data-arrival="true" aria-hidden="true" style={{ width: 40, height: 40, fontSize: 15, color: 'var(--hc-a-800)' }}>
                  {a.initials}
                </span>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                  <div className="hc-heading" style={{ fontSize: 19 }}>{a.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>
                    {a.handle} · signed in from <span style={{ color: 'var(--hc-a-700)' }}>{a.fromSite}</span> {whenText(a.arrivedAt)}
                  </div>
                </div>
                {i === 0 && live.arrivals.length > 1 ? <Tag tone="accent">Waiting {waitText(a.arrivedAt)}</Tag> : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 12, borderTop: hairline }}>
                {choose ? (
                  <>
                    <span style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>Join as</span>
                    <WelcomeSelect roles={welcomeAs} value={role} width={110} minHeight={32} onChange={(r) => setArrRole((m) => ({ ...m, [a.id]: r }))} />
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>Joins as {only}. An owner can change the role later.</span>
                )}
                {data.can.dismiss ? (
                  <Btn variant="ghost" style={{ marginLeft: 'auto', color: 'var(--hc-n-800)' }} onClick={() => void live.dismiss(a)}>Dismiss</Btn>
                ) : null}
                <Btn variant="primary" style={data.can.dismiss ? undefined : { marginLeft: 'auto' }} onClick={() => void live.welcome(a, role)}>{label}</Btn>
              </div>
            </Frame>
          );
        })}
      </div>
      {live.arrivals.length === 0 ? (
        <Frame style={{ padding: 36, maxWidth: 560 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 22 }}>No one waiting</h4>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--hc-n-700)', textWrap: 'pretty' } as React.CSSProperties}>
            People who sign in here from other sites on the network appear in this queue, ready to be welcomed.
          </p>
        </Frame>
      ) : null}
    </div>
  );
}
