'use client';

// The Site Builder detail page: header, tabs (Pages, Theme, Profile) and the New page dialog.

import * as React from 'react';
import type { HubCardProps } from '../contract';
import { Btn, BtnLink, Tabs } from '../ui/primitives';
import type { SiteBuilderHost } from './host';
import { useSiteLive } from './live';
import type { SiteBuilderDetailData } from './model';
import { NewPageDialog } from './NewPageDialog';
import { PagesTab, type Layout } from './PagesTab';
import { clearIntent, lookName, peekIntent, plural } from './parts';
import { ProfileTab } from './ProfileTab';
import { ThemeTab } from './ThemeTab';

const TAB_IDS = ['pages', 'theme', 'profile'] as const;
type TabId = (typeof TAB_IDS)[number];
const asTab = (t: string | null): TabId => ((TAB_IDS as readonly string[]).includes(t ?? '') ? (t as TabId) : 'pages');

export function Detail({ data, host, nav }: HubCardProps<SiteBuilderDetailData, SiteBuilderHost>) {
  const live = useSiteLive(data, host);
  const [tab, setTab] = React.useState<TabId>(asTab(nav.tab));
  React.useEffect(() => setTab(asTab(nav.tab)), [nav.tab]);

  const [layout, setLayout] = React.useState<Layout>(data.pages.length <= 4 ? 'list' : 'grid');
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState<boolean>(() => Boolean(peekIntent()?.newPage) && data.can.createPages);
  const [pick, setPick] = React.useState<string | null>(() => peekIntent()?.themePick ?? null);
  React.useEffect(() => clearIntent(), []);

  const n = live.pages.length;
  const sub = [data.org.domain, plural(n, 'page'), lookName(data.theme.look), data.theme.headingFont].join(' · ');

  const openTheme = (pageId: string) => {
    const has = live.pages.find((p) => p.id === pageId)?.exception;
    setPick(has ? null : pageId);
    setTab('theme');
  };

  return (
    <div className="hc-detail">
      <div className="hc-crumb">
        <Btn variant="ghost" icon="back" iconSize={14} onClick={() => nav.close()}>Hub</Btn>
        <span style={{ color: 'var(--hc-n-500)' }}>/</span>
        <span>Site builder</span>
      </div>
      <div className="hc-detail-head" style={{ marginBottom: 14 }}>
        <div>
          <h1>Site builder</h1>
          <div className="hc-sub">{sub}</div>
        </div>
        <div className="hc-actions">
          <BtnLink href={host.liveHref('')} target="_blank" rel="noopener noreferrer">View site ↗</BtnLink>
          {data.can.createPages ? <Btn variant="primary" icon="plus" onClick={() => setNewOpen(true)}>New page</Btn> : null}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Tabs
          active={tab}
          onChange={(id) => setTab(asTab(id))}
          tabs={[
            { id: 'pages', label: 'Pages', count: n },
            { id: 'theme', label: 'Theme' },
            { id: 'profile', label: 'Profile' },
          ]}
        />
      </div>

      {tab === 'pages' ? (
        <PagesTab
          data={data}
          host={host}
          live={live}
          layout={layout}
          setLayout={setLayout}
          expanded={expanded}
          setExpanded={setExpanded}
          onTheme={openTheme}
        />
      ) : null}
      {tab === 'theme' ? <ThemeTab data={data} host={host} live={live} pick={pick} setPick={setPick} /> : null}
      {tab === 'profile' ? <ProfileTab data={data} host={host} live={live} /> : null}

      {newOpen ? (
        <NewPageDialog
          data={data}
          host={host}
          live={live}
          onClose={() => setNewOpen(false)}
          onCreated={(path) => {
            setNewOpen(false);
            setTab('pages');
            setLayout('list');
            setExpanded(path);
          }}
        />
      ) : null}
      {live.toast}
    </div>
  );
}
