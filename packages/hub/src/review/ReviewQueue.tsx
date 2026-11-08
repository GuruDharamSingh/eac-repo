'use client';

// The review queue as a SECTION: no page chrome, so a host card (the Content
// card's pop-up later, the Review card's detail page now) can draw it inside
// its own frame. Decisions are optimistic: the row leaves at once and comes
// back with the error if the server refuses.

import * as React from 'react';
import type { HubCardHost } from '../contract';
import { Btn, Frame, Icon, Segmented, Tag, Toggle, useToast } from '../ui/primitives';
import { SOURCE_LABEL, type ReviewItem, type ReviewQueueData, type ReviewSource } from './model';

const when = (iso: string) => {
  const d = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (d < 60 * 60 * 1000) return 'just now';
  if (d < day) return 'today';
  if (d < 2 * day) return 'yesterday';
  if (d < 14 * day) return `${Math.round(d / day)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

type Filter = 'all' | ReviewSource;

async function decide(host: HubCardHost, item: ReviewItem, approve: boolean) {
  if (item.source === 'listing') {
    return host.act(approve ? 'listing-approve' : 'listing-decline', item.ref as { threadId: string });
  }
  return host.act('submission-review', { source: item.source, ...item.ref, decision: approve ? 'approve' : 'decline' });
}

export function ReviewQueue({ data, host, compact = false }: { data: ReviewQueueData; host: HubCardHost; compact?: boolean }) {
  const [items, setItems] = React.useState(data.items);
  const [switches, setSwitches] = React.useState(data.switches);
  const [filter, setFilter] = React.useState<Filter>('all');
  const toast = useToast(3200);
  React.useEffect(() => setItems(data.items), [data.items]);

  const counts = React.useMemo(() => {
    const c: Record<Filter, number> = { all: items.length, post: 0, panel: 0, listing: 0 };
    for (const i of items) c[i.source] += 1;
    return c;
  }, [items]);
  const shown = filter === 'all' ? items : items.filter((i) => i.source === filter);
  const sources = (['listing', 'post', 'panel'] as const).filter((s) => counts[s] > 0 || (s === 'post' ? switches.posts : s === 'panel' ? switches.storePanels : true));

  async function onDecide(item: ReviewItem, approve: boolean) {
    const before = items;
    setItems((xs) => xs.filter((x) => x.key !== item.key));
    toast.show(approve ? `“${item.title}” is on the site.` : `Turned down “${item.title}”.`);
    try {
      const res = await decide(host, item, approve);
      if (res.ok) {
        host.refresh?.();
        return;
      }
      setItems(before);
      toast.show('error' in res && res.error ? res.error : 'That could not be decided.');
    } catch {
      setItems(before);
      toast.show('That could not be decided.');
    }
  }

  async function onSwitch(which: 'posts' | 'storePanels', on: boolean) {
    const before = switches;
    setSwitches((s) => ({ ...s, [which]: on }));
    const res = await host.act('review-switch', { which, on }).catch(() => ({ ok: false as const, error: '' }));
    if (!res.ok) {
      setSwitches(before);
      toast.show('error' in res && res.error ? res.error : 'That could not be changed.');
    } else host.refresh?.();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!compact && sources.length > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Segmented<Filter>
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              ...sources.map((s) => ({ value: s as Filter, label: SOURCE_LABEL[s], count: counts[s] })),
            ]}
          />
        </div>
      ) : null}

      {shown.length === 0 ? (
        <Frame style={{ padding: 18 }}>
          <div className="hc-heading" style={{ fontSize: 19 }}>Nothing waiting</div>
          <div className="hc-muted" style={{ fontSize: 14, marginTop: 4 }}>
            Posts from other network sites that ask to show on {data.org.name}, and anything members send in for a look, land here.
          </div>
        </Frame>
      ) : (
        <div style={{ borderTop: '1px solid var(--hc-divider)' }}>
          {shown.map((item) => (
            <div key={item.key} className="hc-row" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: compact ? '10px 16px' : '14px 12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{item.title}</span>
                  <Tag tone={item.source === 'listing' ? 'editor' : 'template'}>{item.kindLabel}</Tag>
                </div>
                <div className="hc-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                  {[item.source === 'listing' && item.from ? `From ${item.from}` : SOURCE_LABEL[item.source], item.by, when(item.at)].filter(Boolean).join(' · ')}
                </div>
                {!compact && item.excerpt ? (
                  <div style={{ fontSize: 14, marginTop: 6, color: 'var(--hc-n-800)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.excerpt}</div>
                ) : null}
              </div>
              {data.can.decide ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="ghost" onClick={() => void onDecide(item, false)}>Decline</Btn>
                  <Btn variant="primary" onClick={() => void onDecide(item, true)}>{item.source === 'listing' ? 'Show here' : 'Approve'}</Btn>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {!compact && data.can.switch && (switches.posts !== null || switches.storePanels !== null) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: '1px solid var(--hc-divider)' }}>
          <div className="hc-overline">What waits for a look</div>
          {switches.posts !== null ? (
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
              <Toggle checked={switches.posts} label="Hold members’ posts for a look first" onChange={(on) => void onSwitch('posts', on)} />
              Hold members’ posts for a look first
            </label>
          ) : null}
          {switches.storePanels !== null ? (
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
              <Toggle checked={switches.storePanels} label="Host members’ store panels" onChange={(on) => void onSwitch('storePanels', on)} />
              Host members’ store panels
            </label>
          ) : null}
          <div className="hc-hint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Icon name="info" size={14} />
            Owners and guides are never held. Posts from other sites always ask first.
          </div>
        </div>
      ) : null}
      {toast.node}
    </div>
  );
}
