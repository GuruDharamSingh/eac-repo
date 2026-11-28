'use client';

// ============================================================================
// @elkdonis/hub/mount: one mount for any defineHubCard card (Content cornerstone,
// 2026-11-26; CONTRACT §8 and §10.5). Generalised from sunjay's useHost +
// SiteBuilderCardMount/SiteBuilderDetailMount (apps/sunjay/src/components/hub/hub-card-host.tsx).
//
//   - The card face is drawn in place; its pop-up is ONE layer (no stack, no crumbs). A host that
//     needs stacked frames keeps cms-ui's SurfaceProvider for them; the two coexist on a page
//     (the pop-up is a fixed layer of its own and needs no provider).
//   - Needs no next/*. The app passes `act` (a 'use server' action), and optionally `navigate`
//     and `refresh` (router.push / router.refresh). Without them it falls back to
//     window.location, which is correct but loses client state.
//   - A card object holds components, so it cannot cross from a server component. The app writes
//     one small 'use client' file that imports the cards and renders this mount (see MOUNTING.md).
// ============================================================================

import * as React from 'react';
import type { StudioLinkRequest } from '@elkdonis/utils/host';
import type { HubCardDef, HubCardHost, HubCardView, HubIconMap, HubNav } from '../contract';
import { HubRoot } from '../ui/primitives';
import { lucideHubIcons } from '../ui/icons';

/** Plain-data link settings: safe to build in a server file and pass down. */
export interface HubMountLinks {
  /** Where cards live: /hub/<card>?tab=. Default "/hub". */
  hubBase?: string;
  /** "" or a Next basePath. Prefixed to live pages. */
  basePath?: string;
  /** The authoring Studio. Default "/studio"; null = the host has none. */
  studioPath?: string | null;
  /** Logical /manage screen -> path. A screen not listed answers null. */
  manage?: Record<string, string>;
  /** Default "/login". */
  loginPath?: string;
}

/** What a host's edit form is told (Content round 2, 2026-11-26). */
export interface HubRenderEditArgs {
  /** The piece's content key, e.g. "artwork:<id>". */
  key: string;
  /** Saved: the card pops back to the piece and refreshes. */
  onDone(): void;
  /** Cancelled: the card pops back to the piece. */
  onCancel(): void;
}

/**
 * Function-valued host extras a card may read beyond HubCardHost. Optional, so existing mounts are unchanged.
 * `renderEdit`: the host's own edit form for a piece, drawn INSIDE the card's popup as the third frame
 * (list > piece > edit). Absent: the card links out to the Studio instead.
 */
export interface HubCardHostExtras {
  renderEdit?(args: HubRenderEditArgs): React.ReactNode;
}

export interface HubCardMountBase<H extends HubCardHost> {
  /** The write door: a host server action bound to this site. */
  act: HubCardHost['act'];
  links?: HubMountLinks;
  /** Function-valued host members (puckEditHref, uploadImage, hubHref…). Only possible from a client module. */
  host?: Partial<H> & HubCardHostExtras;
  /** router.push. Default: window.location.assign. */
  navigate?: (href: string) => void;
  /** router.refresh. Default: window.location.reload. */
  refresh?: () => void;
  icons?: HubIconMap;
  /** A hub theme ("industry") or none to wear the site's palette. */
  theme?: string | null;
  vars?: Record<string, string>;
  className?: string;
}

/** Builds the HubCardHost. Exported so a harness, or an app that wants the host itself, can use it. */
export function useHubCardHost<H extends HubCardHost = HubCardHost>(o: HubCardMountBase<H>): H {
  const { act, links, host, navigate, refresh, icons } = o;
  const hubBase = links?.hubBase;
  const basePathIn = links?.basePath;
  const studioPathIn = links?.studioPath;
  const loginPathIn = links?.loginPath;
  const manage = links?.manage;
  return React.useMemo(() => {
    const hub = (hubBase ?? '/hub').replace(/\/+$/, '');
    const basePath = (basePathIn ?? '').replace(/\/+$/, '');
    const studioPath = studioPathIn === undefined ? '/studio' : studioPathIn;
    const loginPath = loginPathIn ?? '/login';
    const base: HubCardHost = {
      hubHref: (card, tab, row, query) => {
        const q = new URLSearchParams();
        if (tab) q.set('tab', tab);
        if (row) q.set('row', row);
        for (const [k, v] of Object.entries(query ?? {})) q.set(k, v);
        const s = q.toString();
        return `${basePath}${hub}/${card}${s ? `?${s}` : ''}`;
      },
      liveHref: (path) => `${basePath}/${path}`.replace(/\/+$/, '') || '/',
      studioHref: (r: StudioLinkRequest) => {
        if (studioPath === null) return '';
        const q = new URLSearchParams();
        if (r.kind) q.set('kind', r.studioKind ?? r.kind);
        if (r.id) q.set('id', r.id);
        if (r.org) q.set('org', r.org);
        if (r.back) q.set('back', r.back);
        if (r.backLabel) q.set('backLabel', r.backLabel);
        const s = q.toString();
        return `${basePath}${studioPath}${s ? `?${s}` : ''}`;
      },
      manageHref: (screen) => manage?.[screen] ?? null,
      loginHref: (next) => `${basePath}${loginPath}?next=${encodeURIComponent(next)}`,
      act,
      navigate: navigate ?? ((href) => window.location.assign(href)),
      refresh: refresh ?? (() => window.location.reload()),
      icons: icons ?? lucideHubIcons,
    };
    return { ...base, ...host } as H;
  }, [act, navigate, refresh, icons, hubBase, basePathIn, studioPathIn, loginPathIn, manage, host]);
}

export interface HubCardMountProps<F, D, H extends HubCardHost = HubCardHost> extends HubCardMountBase<H> {
  card: HubCardDef<F, D, H>;
  /** The server half's load(site, viewer). */
  data: F;
  /** Open on the pop-up (a deep link; the harness). */
  initialView?: Extract<HubCardView, 'card' | 'popup'>;
}

/** The collapsed card plus its pop-up, on the hub. One layer: opening the pop-up never stacks. */
export function HubCardMount<F, D, H extends HubCardHost = HubCardHost>(p: HubCardMountProps<F, D, H>) {
  const host = useHubCardHost<H>(p);
  const [view, setView] = React.useState<HubCardView>(p.initialView ?? 'card');
  const { card } = p;
  const nav: HubNav = {
    view,
    tab: null,
    openPopup: () => setView('popup'),
    close: () => setView('card'),
    openDetail: (tab, row, query) => host.navigate?.(host.hubHref(card.id, tab, row, query)),
  };
  const { Face, Popup } = card;
  return (
    <HubRoot theme={p.theme} vars={p.vars} className={p.className} icons={host.icons}>
      <Face data={p.data} host={host} nav={nav} />
      {view === 'popup' ? <Popup data={p.data} host={host} nav={nav} /> : null}
    </HubRoot>
  );
}

export interface HubCardDetailMountProps<F, D, H extends HubCardHost = HubCardHost> extends HubCardMountBase<H> {
  card: HubCardDef<F, D, H>;
  /** The server half's loadDetail(site, viewer, query). */
  data: D;
  tab: string | null;
  row?: string | null;
  /** Where "close" goes. Default the hub index. */
  closeHref?: string;
}

/** /hub/<card>: the detail page. */
export function HubCardDetailMount<F, D, H extends HubCardHost = HubCardHost>(p: HubCardDetailMountProps<F, D, H>) {
  const host = useHubCardHost<H>(p);
  const { card } = p;
  const closeTo = p.closeHref ?? `${(p.links?.basePath ?? '').replace(/\/+$/, '')}${(p.links?.hubBase ?? '/hub').replace(/\/+$/, '')}`;
  const nav: HubNav = {
    view: 'detail',
    tab: p.tab,
    openPopup: () => undefined,
    close: () => host.navigate?.(closeTo),
    openDetail: (t, row, query) => host.navigate?.(host.hubHref(card.id, t, row, query)),
  };
  const { Detail } = card;
  return (
    <HubRoot theme={p.theme} vars={p.vars} className={p.className} icons={host.icons}>
      <Detail data={p.data} host={host} nav={nav} />
    </HubRoot>
  );
}
