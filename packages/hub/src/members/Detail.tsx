'use client';

// The Members detail page: header, summary, tabs with counts, and the tab bodies.
// 5 people or fewer draws SmallOrgDetail (no tabs) instead.

import * as React from 'react';
import type { HubCardProps } from '../contract';
import { Tabs } from '../ui/primitives';
import { ArrivalsTab } from './ArrivalsTab';
import type { MembersHost } from './host';
import { useMembersLive } from './live';
import type { MembersDetailData } from './model';
import { PeopleTab } from './PeopleTab';
import { PermissionsTab } from './PermissionsTab';
import { DetailHeader, countRoles, roleCount, ROLES, sizeKind, useMemberConfirm } from './parts';
import { SmallOrgDetail } from './SmallOrgDetail';
import { plural } from './time';
import { VisitorsTab } from './VisitorsTab';

const TAB_IDS = ['people', 'arrivals', 'visitors', 'permissions'] as const;
type TabId = (typeof TAB_IDS)[number];
const asTab = (t: string | null): TabId => (TAB_IDS as readonly string[]).includes(t ?? '') ? (t as TabId) : 'people';

export function Detail({ data, host, nav }: HubCardProps<MembersDetailData, MembersHost>) {
  const live = useMembersLive(data, host, data.people);
  const confirm = useMemberConfirm(live, data.org.name);
  const [tab, setTab] = React.useState<TabId>(asTab(nav.tab));
  React.useEffect(() => setTab(asTab(nav.tab)), [nav.tab]);

  const kind = sizeKind(data.total);
  const counts = countRoles(live.people);
  const summary =
    kind === 'large'
      ? `${plural(live.people.length, 'person', 'people')} · ${ROLES.map((r) => roleCount(r, counts[r])).join(' · ')}`
      : plural(live.people.length, 'person', 'people');

  // A locked tab can't be shown even if the URL asks for it.
  const active: TabId = tab === 'visitors' && !data.can.seeVisitors ? 'people' : tab;

  return (
    <div className="hc-detail">
      <DetailHeader data={data} live={live} nav={nav} summary={summary} />

      {kind !== 'large' ? (
        <SmallOrgDetail data={data} host={host} live={live} actions={confirm} />
      ) : (
        <>
          <div style={{ marginBottom: 18 }}>
            <Tabs
              size={17}
              active={active}
              onChange={(id) => setTab(asTab(id))}
              tabs={[
                { id: 'people', label: 'People', count: live.people.length },
                { id: 'arrivals', label: 'Arrivals', count: live.waiting },
                { id: 'visitors', label: 'Visitors', locked: data.can.seeVisitors ? undefined : 'Owners only' },
                { id: 'permissions', label: 'Permissions' },
              ]}
            />
          </div>
          {active === 'people' ? <PeopleTab data={data} live={live} actions={confirm} /> : null}
          {active === 'arrivals' ? <ArrivalsTab data={data} live={live} /> : null}
          {active === 'visitors' ? <VisitorsTab data={data} host={host} nav={nav} /> : null}
          {active === 'permissions' ? <PermissionsTab data={data} host={host} /> : null}
        </>
      )}

      {confirm.node}
      {live.toast}
    </div>
  );
}
