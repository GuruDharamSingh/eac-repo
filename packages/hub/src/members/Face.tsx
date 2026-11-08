'use client';

// The collapsed Members card: the ledger (1a), small org (1e), solo (1f), and the
// needs-attention line. Clicking the card opens the pop-up.

import * as React from 'react';
import type { HubCardProps } from '../contract';
import { Frame, Icon, RoleChip } from '../ui/primitives';
import type { MembersHost } from './host';
import type { MembersFaceData } from './model';
import { ROLE_PLURAL } from './model';
import { ROLES, sizeKind } from './parts';
import { plural, waitText } from './time';

function attention(data: MembersFaceData): { text: string; on: boolean } {
  if (data.arrivalsWaiting > 0) {
    const oldest = [...data.arrivals].sort((a, b) => new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime())[0];
    const n = `${plural(data.arrivalsWaiting, 'arrival')} waiting`;
    return { text: oldest ? `${n} · ${oldest.name} for ${waitText(oldest.arrivedAt)}` : n, on: true };
  }
  if (data.can.seeStorage && (data.syncsInFlight ?? 0) > 0) {
    return { text: `${plural(data.syncsInFlight ?? 0, 'storage sync')} in flight`, on: true };
  }
  return { text: data.total <= 1 ? 'Nothing needs attention' : 'All caught up', on: false };
}

const cellNum: React.CSSProperties = { fontFamily: 'var(--hc-font-heading)', fontWeight: 'var(--hc-heading-weight)', lineHeight: 1 };

export function Face({ data, nav }: HubCardProps<MembersFaceData, MembersHost>) {
  const kind = sizeKind(data.total);
  const attn = attention(data);
  const showVisitors = data.can.seeVisitors && data.visitorsWeek !== null;
  const open = () => nav.openPopup();

  const strip = (
    <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--hc-n-800)' }}>
      <span>{data.arrivalsWaiting} new arrivals</span>
      {showVisitors ? <span>{(data.visitorsWeek ?? 0).toLocaleString('en-US')} visitors this week</span> : null}
    </div>
  );

  return (
    <Frame
      className="hc-card"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      style={{ minHeight: 268, padding: '18px 18px 14px', gap: 14 }}
    >
      <div className="hc-card-head">
        <span className="hc-icon-accent"><Icon name="users" size={18} /></span>
        <span className="hc-card-title" style={{ fontSize: 21 }}>Members</span>
        <span className="hc-go"><Icon name="external" size={16} /></span>
      </div>

      {kind === 'large' ? (
        <>
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1,
              background: 'var(--hc-divider)', border: '1px solid var(--hc-divider)',
            }}
          >
            {ROLES.map((r) => (
              <div key={r} style={{ background: 'var(--hc-bg)', padding: '10px 10px 8px' }}>
                <div style={{ ...cellNum, fontSize: 30 }}>{data.counts[r]}</div>
                <div className="hc-overline" style={{ marginTop: 5, fontSize: 10 }}>{ROLE_PLURAL[r]}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 1, background: 'var(--hc-divider)', border: '1px solid var(--hc-divider)' }}>
            <div style={{ flex: 1, background: 'var(--hc-bg)', padding: 10, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ ...cellNum, fontSize: 24 }}>{data.arrivalsWaiting}</span>
              <span style={{ fontSize: 12, color: 'var(--hc-n-700)' }}>new arrivals</span>
            </div>
            {showVisitors ? (
              <div style={{ flex: 1, background: 'var(--hc-bg)', padding: 10, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ ...cellNum, fontSize: 24 }}>{(data.visitorsWeek ?? 0).toLocaleString('en-US')}</span>
                <span style={{ fontSize: 12, color: 'var(--hc-n-700)' }}>visitors this week</span>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {kind === 'small' ? (
        <>
          <div style={{ display: 'grid', gap: 1, background: 'var(--hc-divider)', border: '1px solid var(--hc-divider)' }}>
            {data.people.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--hc-bg)' }}>
                <span className="hc-avatar" style={{ width: 26, height: 26, fontSize: 11 }} aria-hidden="true">{p.initials}</span>
                <span style={{ fontSize: 14 }}>{p.name}</span>
                {p.isYou ? <span style={{ fontSize: 11, color: 'var(--hc-n-600)' }}>you</span> : null}
                <span style={{ marginLeft: 'auto' }}><RoleChip role={p.role} /></span>
              </div>
            ))}
          </div>
          {strip}
        </>
      ) : null}

      {kind === 'solo' ? (
        <>
          <div style={{ ...cellNum, fontSize: 28, lineHeight: 1.1, marginTop: 6 }}>Just you so far</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--hc-n-700)', textWrap: 'pretty', maxWidth: '34ch' } as React.CSSProperties}>
            People who sign in from other sites on the network land here as arrivals, ready to be welcomed.
          </p>
        </>
      ) : null}

      <div
        style={{
          marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12,
          borderTop: '1px solid var(--hc-divider)', fontSize: 13,
        }}
      >
        <span style={{ width: 7, height: 7, flex: 'none', background: attn.on ? 'var(--hc-accent)' : 'var(--hc-n-400)' }} />
        <span style={{ color: attn.on ? 'var(--hc-text)' : 'var(--hc-n-700)' }}>{attn.text}</span>
      </div>
    </Frame>
  );
}
