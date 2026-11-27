'use client';

// ============================================================================
// The Channel hub card as a defineHubCard card (Content cornerstone Step 4, 2026-11-26).
// Lifted from sunjay's apps/sunjay/src/components/hub/{ChannelFace,ChannelSurface}.tsx. The data is the same
// ChannelHubData the reducer (./server) builds; the pop-up reads it from the card's own data (the host refreshes
// after a write that went) instead of fetching /api/hub/channel. Writes go through `host.act`, the host's door.
//
// Separate subpath on purpose: "@elkdonis/channel/hub" (index.ts) stays free of @elkdonis/hub so the sites that
// import the bare face and panel keep resolving. This file needs @elkdonis/hub (dependency edge, see LEDGER).
// ============================================================================

import * as React from 'react';
import type { ActionResult } from '@elkdonis/actions';
import type { HubCardProps } from '@elkdonis/hub/contract';
import { defineHubCard } from '@elkdonis/hub/contract';
import { Frame, Icon, Popup as PopupShell } from '@elkdonis/hub/ui';
import { SITE_DOOR_ALLOW } from '../site/view';
import { ChannelHubFace } from './Face';
import { ChannelHubPanel } from './Panel';
import type { ChannelHubData } from './data';

/** The .chp-* styles read --sf-* surface tokens; on a hub card they come from the card's --hc-* tokens. */
const TOKENS = {
  '--sf-line': 'var(--hc-divider)',
  '--sf-fg': 'var(--hc-text)',
  '--sf-muted': 'var(--hc-n-700)',
  '--sf-bg': 'transparent',
  '--sf-bg-soft': 'color-mix(in srgb, var(--hc-text) 6%, transparent)',
  '--sf-kind': 'var(--hc-accent)',
} as React.CSSProperties;

function useRun(host: HubCardProps<ChannelHubData>['host']) {
  return React.useCallback(
    async (id: string, input: unknown): Promise<ActionResult> => {
      const r = await host.act(id, (input ?? {}) as Record<string, unknown>);
      if (r.ok) {
        host.refresh?.();
        return { ok: true, data: (r.value ?? undefined) as Record<string, unknown> | undefined };
      }
      return { ok: false, error: r.error };
    },
    [host],
  );
}

/** Stop an Escape that belongs to the chart's quick-form <dialog> from reaching the pop-up's window listener. */
const keepEscapeInsideDialog = (e: React.KeyboardEvent) => {
  if (e.key === 'Escape' && (e.target as HTMLElement).closest?.('dialog')) e.stopPropagation();
};

function Face({ data, nav }: HubCardProps<ChannelHubData>) {
  const open = () => nav.openPopup();
  return (
    <Frame
      className="hc-card"
      role="button"
      tabIndex={0}
      aria-label="Channel"
      onClick={open}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className="hc-card-head">
        <span className="hc-icon-accent"><Icon name="layout-grid" size={20} /></span>
        <span className="hc-card-title">Channel</span>
        <span className="hc-go"><Icon name="external" size={18} /></span>
      </div>
      <p className="hc-muted" style={{ margin: 0, fontSize: 13 }}>Out, planned and waiting</p>
      <div style={TOKENS}>
        <ChannelHubFace data={data} />
      </div>
    </Frame>
  );
}

function Popup({ data, host, nav }: HubCardProps<ChannelHubData>) {
  const run = useRun(host);
  return (
    <PopupShell icon="layout-grid" title="Channel" width={1080} top={72} onClose={() => nav.close()} onOpenPage={() => nav.openDetail()}>
      <div style={TOKENS} onKeyDown={keepEscapeInsideDialog}>
        <ChannelHubPanel data={data} run={run} channelHref={host.liveHref('channel') ?? '/channel'} />
      </div>
    </PopupShell>
  );
}

/** The detail page (/hub/channel): the same panel, full width. */
function Detail({ data, host }: HubCardProps<ChannelHubData>) {
  const run = useRun(host);
  return (
    <div style={{ ...TOKENS, maxWidth: 1180, margin: '0 auto', padding: '16px' }}>
      <ChannelHubPanel data={data} run={run} channelHref={host.liveHref('channel') ?? '/channel'} />
    </div>
  );
}

export const channelCard = defineHubCard<ChannelHubData, ChannelHubData>({
  id: 'channel',
  title: 'Channel',
  icon: 'layout-grid',
  capability: null,
  // Owners and guides, as /channel and /api/hub/channel gate it.
  gate: 'guide',
  // The site door's allow-list; the host's `act` must run these through its Channel door.
  actions: SITE_DOOR_ALLOW,
  retires: [],
  Face,
  Popup,
  Detail,
});
