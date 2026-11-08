// Harness: the real Members card (packages/hub/src/members) on the design's sample data
// (docs/open/hub-cards-handoff/source/MemberHub.dc.html seed()). No server, no database:
// host.act resolves { ok: true } after 600 ms and logs.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { HubRoot, lucideHubIcons } from '@elkdonis/hub/ui';
import { membersCard } from '@elkdonis/hub/members';
import type { HubNav, HubRole } from '@elkdonis/hub/contract';
import type {
  Arrival, Member, MembersDetailData, MembersFaceData, VisitorRange, VisitorsData,
} from '@elkdonis/hub/members/model';
import { CHIP_REASON, ROLE_LABEL } from '@elkdonis/hub/members/model';
import type { MembersHost } from '@elkdonis/hub/members';

type OrgKey = 'ifac' | 'sunjay' | 'solo';
type Viewer = 'owner' | 'guide';

const NOW = Date.now();
const ago = (min: number) => new Date(NOW - min * 60000).toISOString();
const initialsOf = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('');

interface P { id: string; name: string; handle: string; role: HubRole; listed: boolean; storage: 'synced' | 'pending' | 'none'; joined: string; seenMin: number; from?: string }
const p = (id: string, name: string, handle: string, role: HubRole, listed: boolean, storage: P['storage'], joined: string, seenMin: number, from?: string): P =>
  ({ id, name, handle, role, listed, storage, joined, seenMin, from });

const SEED: Record<OrgKey, { people: P[]; arrivals: Array<{ id: string; name: string; handle: string; from: string; ageMin: number }>; me: Record<Viewer, string>; org: { name: string; mark: string }; week: number[]; top: string }> = {
  ifac: {
    org: { name: 'IFAC', mark: 'IF' }, week: [142, 168, 201, 189, 236, 198, 150], top: '/artists', me: { owner: 'p1', guide: 'p3' },
    people: [
      p('p1', 'Mara Okafor', '@mara', 'owner', true, 'synced', '2021-03-10', 5),
      p('p2', 'Julien Ferrand', '@jferrand', 'owner', true, 'synced', '2021-06-10', 2900),
      p('p3', 'Theo Lindqvist', '@theo', 'guide', true, 'synced', '2022-01-10', 40),
      p('p4', 'Ana Ruiz', '@anaruiz', 'guide', false, 'synced', '2022-09-10', 7200),
      p('p5', 'Kofi Mensah', '@kofi', 'guide', true, 'pending', '2023-02-10', 60),
      p('p6', 'Hana Sato', '@hanasato', 'member', true, 'synced', '2023-04-10', 1500),
      p('p7', 'Dev Patel', '@devp', 'member', true, 'synced', '2023-07-10', 4300),
      p('p8', 'Lucía Benítez', '@lucia.b', 'member', false, 'synced', '2023-11-10', 20000),
      p('p9', 'Oskar Nyberg', '@oskar', 'member', true, 'pending', '2024-01-10', 120),
      p('p10', 'Priya Raman', '@priya', 'member', true, 'synced', '2024-05-10', 10000),
      p('p11', 'Sam Adeyemi', '@samade', 'member', false, 'synced', '2025-08-10', 5800, 'sunjay'),
      p('p12', 'Elif Kaya', '@elif', 'viewer', false, 'none', '2026-02-10', 30000),
      p('p13', 'Marco Bellini', '@mbellini', 'viewer', false, 'none', '2026-06-10', 1400),
      p('p14', 'Ines Duarte', '@ines', 'viewer', false, 'none', '2026-08-10', 8600),
      p('p15', 'Ren Watanabe', '@renw', 'viewer', false, 'none', '2026-10-10', 2800, 'studio-north'),
      p('p16', 'Zoe Hart', '@zoehart', 'viewer', false, 'none', '2026-10-20', 200, 'sunjay'),
    ],
    arrivals: [
      { id: 'a4', name: 'Yusuf Celik', handle: '@yusuf', from: 'sunjay', ageMin: 5 * 1440 },
      { id: 'a3', name: 'Amara Diallo', handle: '@amara', from: 'print-collective', ageMin: 3 * 1440 },
      { id: 'a2', name: 'Felix Brandt', handle: '@felixb', from: 'studio-north', ageMin: 1440 },
      { id: 'a1', name: 'Noor Haddad', handle: '@noor', from: 'sunjay', ageMin: 120 },
    ],
  },
  sunjay: {
    org: { name: 'sunjay', mark: 'SR' }, week: [9, 14, 11, 16, 12, 15, 9], top: '/work', me: { owner: 's1', guide: 's2' },
    people: [
      p('s1', 'Sunjay Rao', '@sunjay', 'owner', true, 'synced', '2025-01-10', 3),
      p('s2', 'Leila Moradi', '@leila', 'guide', true, 'synced', '2025-03-10', 1300),
      p('s3', 'Tom Archer', '@tomarcher', 'member', false, 'synced', '2026-09-10', 5800, 'print-collective'),
    ],
    arrivals: [],
  },
  solo: {
    org: { name: 'Vale Press', mark: 'VP' }, week: [0, 0, 0, 0, 0, 0, 0], top: '', me: { owner: 'v1', guide: 'v1' },
    people: [p('v1', 'Ada Moreau', '@ada', 'owner', false, 'synced', '2026-11-01', 1)],
    arrivals: [],
  },
};

function members(org: OrgKey, viewer: Viewer): Member[] {
  const s = SEED[org];
  const me = s.me[viewer];
  return s.people.map((x) => {
    const self = x.id === me;
    const owner = viewer === 'owner';
    const canChange = owner && !self && x.role !== 'owner';
    return {
      id: x.id, name: x.name, handle: x.handle, initials: initialsOf(x.name), role: x.role, listed: x.listed,
      storage: owner ? x.storage : null,
      joinedAt: new Date(x.joined).toISOString(), lastSeenAt: ago(x.seenMin), arrivedFrom: x.from ?? null, isYou: self,
      can: {
        roles: canChange ? (['guide', 'member', 'viewer'] as HubRole[]) : [],
        reason: canChange ? null : self ? CHIP_REASON.self : x.role === 'owner' ? CHIP_REASON.owner : CHIP_REASON.notOwner,
        list: owner,
        remove: canChange,
      },
    };
  });
}

function arrivalsOf(org: OrgKey, empty: boolean): Arrival[] {
  if (empty) return [];
  return SEED[org].arrivals.map((a) => ({
    id: a.id, userId: 'u-' + a.id, name: a.name, handle: a.handle, initials: initialsOf(a.name), fromSite: a.from, arrivedAt: ago(a.ageMin),
  }));
}

function face(org: OrgKey, viewer: Viewer, noArrivals: boolean): MembersFaceData {
  const s = SEED[org];
  const people = members(org, viewer);
  const owner = viewer === 'owner';
  const counts = { owner: 0, guide: 0, member: 0, viewer: 0 } as Record<HubRole, number>;
  people.forEach((x) => { counts[x.role] += 1; });
  const arrivals = arrivalsOf(org, noArrivals);
  const me = people.find((x) => x.isYou) ?? people[0];
  return {
    org: s.org,
    viewer: { name: me.name, initials: me.initials, role: viewer, roleLabel: ROLE_LABEL[viewer] },
    counts, total: people.length, people,
    recent: people.filter((x) => !x.isYou).sort((a, b) => new Date(b.lastSeenAt ?? 0).getTime() - new Date(a.lastSeenAt ?? 0).getTime()).slice(0, 5),
    arrivals, arrivalsWaiting: arrivals.length,
    visitorsWeek: owner ? s.week.reduce((a, b) => a + b, 0) : null,
    syncsInFlight: owner ? people.filter((x) => x.storage === 'pending').length : null,
    can: { welcomeAs: owner ? ['guide', 'member', 'viewer'] : ['viewer'], dismiss: true, seeVisitors: owner, seeStorage: owner, invite: false },
  };
}

const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function visitors(org: OrgKey, range: VisitorRange): VisitorsData {
  const sources: VisitorsData['sources'] = [
    { label: 'sunjay', group: 'network', n: 14 }, { label: 'studio-north', group: 'network', n: 11 },
    { label: 'print-collective', group: 'network', n: 8 }, { label: 'a-site', group: 'network', n: 2 },
    { label: 'b-site', group: 'network', n: 2 }, { label: 'c-site', group: 'network', n: 1 },
    { label: 'Search', group: 'search', n: 27 }, { label: 'Direct', group: 'direct', n: 21 },
    { label: 'Social', group: 'social', n: 9 }, { label: 'Other', group: 'other', n: 5 },
  ];
  const mult = { '7d': 1, '30d': 4.2, '90d': 12.4 }[range];
  const base: Array<[string, number]> = [['/artists', 412], ['/exhibitions/after-image', 288], ['/', 254], ['/artists/hana-sato', 131], ['/visit', 96], ['/dealers', 74]];
  const topPages = base.map(([path, n]) => ({ path, n: Math.round(n * mult) }));
  if (org !== 'ifac') {
    const wk = SEED[org].week;
    const lb = ['Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7', 'Sun 8'];
    const t = wk.reduce((a, b) => a + b, 0);
    return { range, total: t, changeLabel: t ? 'Nov 2 – 8' : null, bars: t ? wk.map((n, i) => ({ label: lb[i], n })) : [], topPages: SEED[org].top ? [{ path: SEED[org].top, n: Math.round(t / 3) }] : [], sources: t ? sources : [] };
  }
  if (range === '30d') {
    const bars = Array.from({ length: 30 }, (_, i) => ({
      label: shortDate(new Date(2026, 9, 10 + i)),
      n: Math.round(168 + 42 * Math.sin(i / 1.1) + ((i * 53) % 37) - 18),
    }));
    return { range, total: bars.reduce((a, b) => a + b.n, 0), changeLabel: 'Oct 10 – Nov 8 · +6% on the previous 30 days', bars, topPages, sources };
  }
  if (range === '90d') {
    const bars = Array.from({ length: 13 }, (_, i) => ({
      label: 'Week of ' + shortDate(new Date(2026, 10, 2 - 7 * (12 - i))),
      n: Math.round(1080 + 190 * Math.sin(i / 1.8) + ((i * 71) % 130)),
    }));
    return { range, total: bars.reduce((a, b) => a + b.n, 0), changeLabel: 'Aug 10 – Nov 8 · +18% on the previous 90 days', bars, topPages, sources };
  }
  const labels = ['Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7', 'Sun 8'];
  const bars = [142, 168, 201, 189, 236, 198, 150].map((n, i) => ({ label: labels[i], n }));
  return { range, total: bars.reduce((a, b) => a + b.n, 0), changeLabel: 'Nov 2 – 8 · +12% on the previous week', bars, topPages, sources };
}

function detail(org: OrgKey, viewer: Viewer, range: VisitorRange, noArrivals: boolean): MembersDetailData {
  const f = face(org, viewer, noArrivals);
  return { ...f, visitors: viewer === 'owner' ? visitors(org, range) : null };
}

// ── host stub ────────────────────────────────────────────────────────────

const host: MembersHost = {
  studioHref: () => '#',
  hubHref: (card, tab) => `#/hub/${card}${tab ? '?tab=' + tab : ''}`,
  liveHref: (path) => '#' + path,
  async act(actionId, input) {
    console.log('act', actionId, JSON.stringify(input));
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true };
  },
  refresh: () => console.log('refresh'),
  icons: lucideHubIcons,
  analyticsHref: '#analytics',
  storagePanel: (
    <div style={{ border: '1px solid var(--hc-divider)', padding: '16px 18px', fontSize: 14 }}>
      Host-provided shared storage panel (the old Cloud storage panel): Nextcloud group, folder, sync controls.
    </div>
  ),
};
const hostNoStorage: MembersHost = { ...host, storagePanel: undefined, analyticsHref: null };

// ── stage: top bar + hub grid + the card's three states ───────────────────

const card = membersCard;

function TopBar({ org, me, role }: { org: { name: string; mark: string }; me: string; role: string }) {
  const ini = initialsOf(me);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 52, padding: '0 28px', borderBottom: '1px solid var(--hc-divider)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
        <div style={{ width: 26, height: 26, border: '1px solid var(--hc-text)', display: 'grid', placeItems: 'center', fontFamily: 'var(--hc-font-heading)', fontWeight: 600, fontSize: 12 }}>{org.mark}</div>
        <span style={{ fontFamily: 'var(--hc-font-heading)', fontWeight: 600, fontSize: 18 }}>{org.name}</span>
        <span className="hc-overline">Hub</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="hc-avatar" style={{ width: 26, height: 26 }}>{ini}</div>
        <div style={{ lineHeight: 1.15 }}><div style={{ fontSize: 13 }}>{me}</div><div style={{ fontSize: 11, color: 'var(--hc-n-700)' }}>{role}</div></div>
      </div>
    </div>
  );
}

interface Cfg {
  org: OrgKey; viewer: Viewer; start: 'card' | 'hub' | 'popup' | 'detail'; tab?: string;
  noArrivals?: boolean; noStorage?: boolean; plain?: boolean;
  /** DOM steps after mount (the harness drives the real controls). */
  drive?: Array<() => void>;
}

function Stage({ cfg }: { cfg: Cfg }) {
  const [view, setView] = React.useState<'hub' | 'popup' | 'detail'>(cfg.start === 'card' ? 'hub' : cfg.start);
  const [tab, setTab] = React.useState<string | null>(cfg.tab ?? null);
  const [range, setRange] = React.useState<VisitorRange>('7d');
  const h = cfg.noStorage ? hostNoStorage : host;

  const faceData = React.useMemo(() => face(cfg.org, cfg.viewer, !!cfg.noArrivals), []);
  const detailData = React.useMemo(() => detail(cfg.org, cfg.viewer, range, !!cfg.noArrivals), [range]);

  const nav: HubNav = {
    view: view === 'hub' ? 'card' : view,
    tab,
    openPopup: () => setView('popup'),
    close: () => setView('hub'),
    openDetail: (t, row) => {
      setTab(t ?? null);
      if (t === 'visitors' && (row === '7d' || row === '30d' || row === '90d')) setRange(row);
      setView('detail');
    },
  };

  React.useEffect(() => {
    cfg.drive?.forEach((step, i) => window.setTimeout(step, 400 + i * 350));
  }, []);

  const bare = cfg.start === 'card';
  const org = faceData.org;
  return (
    <div style={{ position: 'relative', minHeight: bare ? 0 : 820, background: 'var(--hc-bg)', overflow: 'hidden' }}>
      {bare ? null : <TopBar org={org} me={faceData.viewer.name} role={faceData.viewer.roleLabel} />}
      {view === 'detail' ? (
        <card.Detail data={detailData} host={h} nav={nav} />
      ) : (
        <div style={{ padding: 28 }}>
          {bare ? null : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
              <h2 style={{ fontSize: 42 }}>Hub</h2>
              <span style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>Back office for {org.name}</span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 380px)', gap: 24, alignItems: 'start' }}>
            <card.Face data={faceData} host={h} nav={nav} />
            {bare ? null : [1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ height: 268, border: '1px dashed var(--hc-n-300)', display: 'flex', alignItems: 'flex-end', padding: 14, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--hc-n-500)' }}>Other hub card</div>
            ))}
          </div>
          {view === 'popup' ? <card.Popup data={faceData} host={h} nav={nav} /> : null}
        </div>
      )}
    </div>
  );
}

// ── driving the real controls ─────────────────────────────────────────────

function typeInto(selector: string, value: string) {
  const el = document.querySelector<HTMLInputElement>(selector);
  if (!el) return;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
function choose(label: string, value: string) {
  const el = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  if (!el) return;
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  set.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function clickText(text: string, tag = 'button') {
  const el = [...document.querySelectorAll<HTMLElement>(tag)].find((e) => e.textContent?.trim().startsWith(text));
  el?.click();
}
function clickRow(name: string) {
  const el = [...document.querySelectorAll<HTMLElement>('.hc-row-head')].find((e) => e.textContent?.includes(name));
  el?.click();
}

// ── pages ─────────────────────────────────────────────────────────────

const PLAIN_VARS: Record<string, string> = {
  '--sf-bg': '#faf6ef', '--sf-fg': '#2a2118', '--sf-accent': '#a4552a', '--sf-line': '#ddd2c0',
  '--sf-font-title': 'Georgia, "Times New Roman", serif', '--sf-font-body': 'system-ui, sans-serif',
  '--eac-hub-accent-100': '#f8ece3', '--eac-hub-accent-200': '#f0d8c6', '--eac-hub-accent-300': '#e5bd9f',
  '--eac-hub-accent-400': '#d29a72', '--eac-hub-accent-500': '#bf7a4d', '--eac-hub-accent-600': '#a4552a',
  '--eac-hub-accent-700': '#86431f', '--eac-hub-accent-800': '#63321a', '--eac-hub-accent-900': '#3f2111',
  '--eac-hub-on-accent': '#ffffff', '--eac-hub-radius': '3px',
  '--eac-hub-neutral-100': '#f6f2ea', '--eac-hub-neutral-200': '#ebe4d6', '--eac-hub-neutral-300': '#ddd2c0',
  '--eac-hub-neutral-400': '#c3b6a0', '--eac-hub-neutral-500': '#a39580', '--eac-hub-neutral-600': '#85786a',
  '--eac-hub-neutral-700': '#6a5f52', '--eac-hub-neutral-800': '#4d443a', '--eac-hub-neutral-900': '#2f2922',
};

const O = (o: Partial<Cfg>): Cfg => ({ org: 'ifac', viewer: 'owner', start: 'detail', ...o });

const PAGES: Record<string, Cfg> = {
  card: O({ start: 'card' }),
  'card-small': O({ start: 'card', org: 'sunjay' }),
  'card-solo': O({ start: 'card', org: 'solo' }),
  'card-guide': O({ start: 'card', viewer: 'guide' }),
  popup: O({ start: 'popup' }),
  'popup-guide': O({ start: 'popup', viewer: 'guide' }),
  'popup-demote': O({
    start: 'popup',
    drive: [() => typeInto('input[type=search]', 'ana'), () => choose('Role for Ana Ruiz', 'viewer')],
  }),
  'popup-nomatch': O({ start: 'popup', drive: [() => typeInto('input[type=search]', 'zzz')] }),
  people: O({ tab: 'people' }),
  'people-guide': O({ tab: 'people', viewer: 'guide' }),
  'people-expanded': O({ tab: 'people', drive: [() => clickRow('Oskar Nyberg')] }),
  'confirm-remove': O({ tab: 'people', drive: [() => clickRow('Lucía Benítez'), () => clickText('Remove from IFAC')] }),
  'confirm-demote': O({ tab: 'people', drive: [() => choose('Role for Theo Lindqvist', 'viewer')] }),
  arrivals: O({ tab: 'arrivals', drive: [() => choose('Role on welcome', 'member')] }),
  'arrivals-guide': O({ tab: 'arrivals', viewer: 'guide' }),
  'arrivals-empty': O({ tab: 'arrivals', noArrivals: true }),
  visitors: O({ tab: 'visitors' }),
  'visitors-30d': O({ tab: 'visitors', drive: [() => clickText('30 days')] }),
  'visitors-90d': O({ tab: 'visitors', drive: [() => clickText('90 days')] }),
  permissions: O({ tab: 'permissions' }),
  'permissions-guide': O({ tab: 'permissions', viewer: 'guide' }),
  'small-org': O({ org: 'sunjay' }),
  'small-org-guide': O({ org: 'sunjay', viewer: 'guide' }),
  solo: O({ org: 'solo' }),
  'card-plain': O({ start: 'card', plain: true }),
  'people-plain': O({ tab: 'people', plain: true, drive: [() => clickRow('Oskar Nyberg')] }),
};

const raw = String((window as unknown as { __PAGE__?: string }).__PAGE__ ?? 'card');
const name = raw.replace(/-phone$/, '');
const cfg = PAGES[name] ?? PAGES.card;

createRoot(document.getElementById('root')!).render(
  <HubRoot theme={cfg.plain ? null : 'industry'} vars={cfg.plain ? PLAIN_VARS : undefined} icons={lucideHubIcons}>
    <Stage cfg={cfg} />
  </HubRoot>,
);
