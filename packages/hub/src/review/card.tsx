'use client';

// The review queue as its own small hub card, until the Content card hosts the
// section (PLAN §8). Face: what's waiting. Pop-up: the queue, compact. Detail:
// the queue with filters and the two switches.

import * as React from 'react';
import { defineHubCard, type HubCardProps } from '../contract';
import { Btn, Frame, Icon, Popup as PopupShell, stop } from '../ui/primitives';
import { REVIEW_ACTIONS, type ReviewQueueData } from './model';
import { ReviewQueue } from './ReviewQueue';

function Face({ data, nav }: HubCardProps<ReviewQueueData>) {
  const n = data.items.length;
  return (
    <Frame as="div" className="hc-card" role="button" tabIndex={0} onClick={() => nav.openPopup()} onKeyDown={(e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && nav.openPopup()} style={{ minHeight: 180 }}>
      <div className="hc-card-head">
        <span className="hc-icon-accent"><Icon name="list" size={18} /></span>
        <span className="hc-card-title" style={{ fontSize: 21 }}>Review queue</span>
        <span className="hc-go"><Icon name="external" size={16} /></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="hc-num" style={{ fontSize: 46 }}>{n}</span>
        <span style={{ fontSize: 17 }}>waiting</span>
      </div>
      <div className="hc-card-actions" style={{ fontSize: 13, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <i style={{ width: 7, height: 7, display: 'inline-block', background: n ? 'var(--hc-accent)' : 'var(--hc-n-400)' }} />
          {n ? `Oldest from ${new Date(data.items[data.items.length - 1].at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'All caught up'}
        </span>
        <span style={{ flex: 1 }} />
        <Btn variant="ghost" small onClick={(e) => { stop(e); nav.openDetail(); }}>Open ↗</Btn>
      </div>
    </Frame>
  );
}

function Popup({ data, host, nav }: HubCardProps<ReviewQueueData>) {
  return (
    <PopupShell icon="list" title="Review queue" titleSize={22} width={560} onClose={() => nav.close()} onOpenPage={() => nav.openDetail()} meta={`${data.items.length} waiting`}>
      <div style={{ maxHeight: 520, overflow: 'auto' }}>
        <ReviewQueue data={data} host={host} compact />
      </div>
    </PopupShell>
  );
}

function Detail({ data, host, nav }: HubCardProps<ReviewQueueData>) {
  return (
    <div className="hc-detail">
      <div className="hc-crumb">
        <Btn variant="ghost" icon="back" onClick={() => nav.close()}>Hub</Btn>
        <span className="hc-muted">/ Review queue</span>
      </div>
      <div className="hc-detail-head">
        <div>
          <h1>Review queue</h1>
          <div className="hc-sub">Everything waiting for a look before it shows on {data.org.name}.</div>
        </div>
      </div>
      <ReviewQueue data={data} host={host} />
    </div>
  );
}

export const reviewCard = defineHubCard<ReviewQueueData, ReviewQueueData>({
  id: 'review',
  title: 'Review queue',
  icon: 'list',
  capability: null,
  gate: 'guide',
  actions: REVIEW_ACTIONS,
  retires: [{ screen: 'submissions', tab: null }],
  Face,
  Popup,
  Detail,
});
