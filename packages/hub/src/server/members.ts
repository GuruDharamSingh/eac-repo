import 'server-only';

// Member Management's server half: load(site, viewer) → MembersFaceData,
// loadDetail(...) → MembersDetailData. Every permission is decided here and
// sent as `can`; the UI never re-derives a gate. Writes are registry entries
// (packages/actions/src/hub.ts), not here. PLAN.md §2.

import { db } from '@elkdonis/db';
import {
  getNextcloudAccessOverview,
  hasOrgGrant,
  listNextcloudSyncRequests,
  listOrgArrivalQueue,
  listOrgPeople,
} from '@elkdonis/services';
import { getDashboardData } from '@elkdonis/analytics/server';
import type { DashboardData } from '@elkdonis/analytics';
import { defineHubCardServer, type HubRole, type HubSite, type HubViewer } from '../contract';
import {
  CHIP_REASON,
  ROLE_LABEL,
  type Arrival,
  type Member,
  type MembersCan,
  type MembersDetailData,
  type MembersFaceData,
  type VisitorRange,
  type VisitorsData,
} from '../members/model';
import { capabilityOn, GRANTED_CAPABILITIES } from './index';

const ROLES: HubRole[] = ['owner', 'guide', 'member', 'viewer'];
/** Never owner from the hub (Justin, 2026-11-08). */
const SETTABLE: HubRole[] = ['guide', 'member', 'viewer'];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const handleOf = (email: string | null | undefined) => {
  const local = (email ?? '').split('@')[0];
  return local ? `@${local}` : '';
};

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

async function lastSeen(orgId: string): Promise<Map<string, string>> {
  try {
    const rows = await db<Array<{ user_id: string; last_seen_at: Date }>>`
      SELECT user_id::text AS user_id, last_seen_at FROM user_site_visits WHERE org_id = ${orgId}
    `;
    return new Map(rows.map((r) => [r.user_id, new Date(r.last_seen_at).toISOString()]));
  } catch {
    return new Map();
  }
}

async function syncsInFlight(orgId: string): Promise<number> {
  const recent = await listNextcloudSyncRequests(orgId, 10).catch(() => []);
  return recent.filter((r) => r.status === 'pending' || r.status === 'running').length;
}

interface Built {
  face: MembersFaceData;
  storageOn: boolean;
}

async function build(site: HubSite, viewer: HubViewer): Promise<Built> {
  const role: HubRole = viewer.role ?? 'viewer';
  // The services guard requires an org owner; a network admin who isn't one sees it read-only.
  const isOwner = role === 'owner';
  const storageCap = await capabilityOn(site, 'nextcloud_access', {
    granted: GRANTED_CAPABILITIES,
    hasGrant: (orgId, key) => hasOrgGrant(orgId, key as 'nextcloud_access'),
  });
  const storageOn = isOwner && storageCap;

  const [people, queue, seen, inFlight] = await Promise.all([
    listOrgPeople(site.orgId),
    listOrgArrivalQueue(site.orgId),
    lastSeen(site.orgId),
    storageOn ? syncsInFlight(site.orgId) : Promise.resolve(0),
  ]);

  const members: Member[] = people.map((p) => {
    const r = p.role as HubRole;
    const isYou = p.userId === viewer.userId;
    let reason: string | null = null;
    if (isYou) reason = CHIP_REASON.self;
    else if (r === 'owner') reason = CHIP_REASON.owner;
    else if (!isOwner) reason = CHIP_REASON.notOwner;
    const editable = reason === null;
    const name = p.displayName || p.email || 'Someone';
    return {
      id: p.userId,
      name,
      handle: handleOf(p.email),
      initials: initialsOf(name),
      role: r,
      listed: Boolean(p.listing?.isPublic),
      // Org-wide: a person shows Syncing while a sync is in flight and their role carries access.
      // Per-person subjects arrive with migration 259.
      storage: storageOn ? (r === 'viewer' ? 'none' : inFlight > 0 ? 'pending' : 'synced') : null,
      joinedAt: iso(p.joinedAt),
      lastSeenAt: seen.get(p.userId) ?? null,
      arrivedFrom: p.arrivedFrom ?? null,
      isYou,
      can: {
        roles: editable ? SETTABLE : [],
        reason,
        list: editable,
        remove: editable,
      },
    };
  });

  const arrivals: Arrival[] = queue.map((a) => {
    const name = a.displayName || a.email || 'Someone';
    return {
      id: a.arrivalId,
      userId: a.userId,
      name,
      handle: a.handle ? `@${a.handle}` : '',
      initials: initialsOf(name),
      fromSite: a.fromOrgName || a.fromHost || 'another site',
      arrivedAt: a.arrivedAt,
    };
  });

  const counts = Object.fromEntries(ROLES.map((x) => [x, 0])) as Record<HubRole, number>;
  for (const m of members) counts[m.role] += 1;

  const can: MembersCan = {
    welcomeAs: isOwner ? SETTABLE : role === 'guide' ? ['viewer'] : [],
    dismiss: isOwner || role === 'guide',
    seeVisitors: isOwner,
    seeStorage: storageOn,
    invite: false,
  };

  const recent = members
    .filter((m) => !m.isYou)
    .sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''))
    .slice(0, 5);

  const viewerName = viewer.name || 'You';
  return {
    storageOn,
    face: {
      org: { name: site.name, mark: site.mark },
      viewer: { name: viewerName, initials: initialsOf(viewerName), role, roleLabel: ROLE_LABEL[role] },
      counts,
      total: members.length,
      people: members,
      recent,
      arrivals,
      arrivalsWaiting: arrivals.length,
      visitorsWeek: isOwner ? await visitorsTotal(site, '7d') : null,
      syncsInFlight: storageOn ? inFlight : null,
      can,
    },
  };
}

async function dashboard(site: HubSite, range: VisitorRange): Promise<DashboardData | null> {
  try {
    return await getDashboardData({ scope: { orgId: site.orgId }, range, timeZone: site.timeZone });
  } catch (err) {
    console.error('[hub/members] analytics:', err);
    return null;
  }
}

async function visitorsTotal(site: HubSite, range: VisitorRange): Promise<number | null> {
  const d = await dashboard(site, range);
  return d ? d.totals.visits : null;
}

const PERIOD: Record<VisitorRange, string> = { '7d': 'week', '30d': '30 days', '90d': '90 days' };

function visitorsFrom(d: DashboardData, range: VisitorRange): VisitorsData {
  const days = d.daily.map((p) => ({ label: p.day, n: p.visitors }));
  let bars = days;
  if (range === '90d') {
    bars = [];
    for (let i = 0; i < days.length; i += 7) {
      const wk = days.slice(i, i + 7);
      bars.push({ label: wk[0].label, n: wk.reduce((s, x) => s + x.n, 0) });
    }
  }
  const cur = d.totals.visits;
  const prev = d.previous.visits;
  const changeLabel = prev > 0
    ? `${cur >= prev ? '+' : '−'}${Math.round((Math.abs(cur - prev) / prev) * 100)}% on the previous ${PERIOD[range]}`
    : null;
  const group = (k: string): VisitorsData['sources'][number]['group'] =>
    k === 'network' ? 'network' : k === 'search' ? 'search' : k === 'direct' ? 'direct' : k === 'social' ? 'social' : 'other';
  const net = new Map<string, number>();
  const rest = new Map<VisitorsData['sources'][number]['group'], number>();
  for (const s of d.sources) {
    const g = group(s.kind);
    if (g === 'network') net.set(s.referrerHost ?? 'Network', (net.get(s.referrerHost ?? 'Network') ?? 0) + s.visits);
    else rest.set(g, (rest.get(g) ?? 0) + s.visits);
  }
  const LABEL = { search: 'Search', direct: 'Direct', social: 'Social', other: 'Other' } as const;
  const sources: VisitorsData['sources'] = [
    ...[...net.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, group: 'network' as const, n })),
    ...(['search', 'direct', 'social', 'other'] as const).filter((g) => rest.has(g)).map((g) => ({ label: LABEL[g], group: g, n: rest.get(g) ?? 0 })),
  ];
  return {
    range,
    total: cur,
    changeLabel,
    bars,
    topPages: d.pages.slice(0, 8).map((p) => ({ path: p.path, n: p.views })),
    sources,
  };
}

export const membersServer = defineHubCardServer<MembersFaceData, MembersDetailData>({
  id: 'members',
  async load(site, viewer) {
    return (await build(site, viewer)).face;
  },
  async loadDetail(site, viewer, query) {
    const { face } = await build(site, viewer);
    let visitors: VisitorsData | null = null;
    // Visitors are owners-only, enforced here: a guide's request never reaches analytics.
    if (face.can.seeVisitors) {
      const range: VisitorRange = query.range === '30d' || query.range === '90d' ? query.range : '7d';
      const d = await dashboard(site, range);
      visitors = d ? visitorsFrom(d, range) : null;
    }
    return { ...face, visitors };
  },
});

/** Whether the org has shared storage the Permissions tab should show (owners + nextcloud_access grant). */
export async function membersStorageOn(site: HubSite, viewer: HubViewer): Promise<boolean> {
  if (viewer.role !== 'owner') return false;
  return Boolean(await getNextcloudAccessOverview(site.orgId).catch(() => null)) && (await hasOrgGrant(site.orgId, 'nextcloud_access'));
}
