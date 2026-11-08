'use client';

// The Members pop-up: find a person, recent people, the arrivals queue (3 oldest),
// inline demote confirm (1h), and the footer. Owner (1g) and guide (1i) differ only by `data.can`.

import * as React from 'react';
import type { HubCardProps, HubRole } from '../contract';
import { Btn, Icon, Popup as PopupShell, Spinner } from '../ui/primitives';
import type { MembersHost } from './host';
import type { Arrival, Member, MembersFaceData } from './model';
import { useMembersLive } from './live';
import {
  InviteStub, Overline, RoleCell, SyncStatus, WelcomeSelect, defaultWelcomeRole, hairline, isDemotion, lowerRole,
} from './parts';
import { plural, seenText, whenText } from './time';

type Inline = { id: string; to: HubRole };

export function Popup({ data, host, nav }: HubCardProps<MembersFaceData, MembersHost>) {
  const base = React.useMemo(() => {
    const seen = new Set(data.people.map((p) => p.id));
    return [...data.people, ...data.recent.filter((r) => !seen.has(r.id))];
  }, [data.people, data.recent]);
  const live = useMembersLive(data, host, base);

  const [q, setQ] = React.useState('');
  const [inline, setInline] = React.useState<Inline | null>(null);
  const [arrRole, setArrRole] = React.useState<Record<string, HubRole>>({});

  const byId = React.useMemo(() => new Map(live.people.map((p) => [p.id, p])), [live.people]);
  const query = q.trim().toLowerCase();
  const rows: Member[] = query
    ? live.people
        .filter((p) => p.name.toLowerCase().includes(query) || p.handle.toLowerCase().includes(query))
        .slice(0, 6)
    : data.recent.map((r) => byId.get(r.id)).filter((p): p is Member => Boolean(p));

  const welcomeAs = data.can.welcomeAs;
  const choose = welcomeAs.length > 1;
  const welcomeLabel = choose ? 'Welcome' : `Welcome as ${welcomeAs[0] ? lowerRole(welcomeAs[0]) : 'viewer'}`;
  const shown = live.arrivals.slice(0, 3);
  const more = live.waiting - shown.length;

  const pick = (m: Member, to: HubRole) => {
    if (to === m.role || to === 'owner') return;
    if (isDemotion(m.role, to)) setInline({ id: m.id, to });
    else void live.setRole(m, to);
  };

  return (
    <>
      <PopupShell
        icon="users"
        title="Members"
        titleSize={22}
        meta={plural(live.total, 'person', 'people')}
        width={540}
        top={112}
        onClose={() => nav.close()}
        onOpenPage={() => nav.openDetail()}
        footer={
          <>
            <InviteStub />
            <span style={{ fontSize: 12, color: 'var(--hc-n-600)' }}>Coming with the roster service</span>
            {data.can.seeStorage && live.syncs !== null ? (
              <span style={{ marginLeft: 'auto' }}><SyncStatus syncs={live.syncs} /></span>
            ) : null}
          </>
        }
      >
        <div style={{ padding: '0 18px 10px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 29, top: 10, display: 'flex', color: 'var(--hc-n-600)' }}>
            <Icon name="search" size={16} />
          </span>
          <input
            className="hc-input"
            type="search"
            aria-label="Find a person"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setInline(null);
            }}
            placeholder="Find a person by name or @handle"
            style={{ paddingLeft: 34 }}
          />
        </div>
        <Overline style={{ padding: '4px 18px 6px', display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
          <span>{query ? plural(rows.length, 'match', 'matches') : 'Recently active'}</span>
        </Overline>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((p) => {
            const confirming = inline && inline.id === p.id ? inline : null;
            const seen = seenText(p.lastSeenAt);
            let sub: React.ReactNode = seen ? `${p.handle} · seen ${seen.toLowerCase()}` : p.handle;
            if (p.storage === 'pending') {
              sub = (<><Spinner size={13} />Syncing shared storage</>);
            }
            if (confirming) {
              sub = `Demote to ${lowerRole(confirming.to)}? ${confirming.to === 'viewer' ? 'Loses shared storage access.' : 'Storage access drops to view.'}`;
            }
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', minHeight: 52,
                  background: confirming ? 'var(--hc-a-100)' : 'transparent', borderTop: hairline,
                }}
              >
                <span className="hc-avatar" aria-hidden="true">{p.initials}</span>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: confirming ? 'var(--hc-a-800)' : 'var(--hc-n-700)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {sub}
                  </div>
                </div>
                {confirming ? (
                  <>
                    <Btn variant="secondary" style={{ padding: '4px 10px' }} onClick={() => setInline(null)}>Cancel</Btn>
                    <Btn
                      variant="primary"
                      style={{ padding: '4px 10px' }}
                      onClick={() => {
                        setInline(null);
                        void live.setRole(p, confirming.to);
                      }}
                    >
                      Demote
                    </Btn>
                  </>
                ) : (
                  <RoleCell member={p} width={112} onPick={(to) => pick(p, to)} />
                )}
              </div>
            );
          })}
          {rows.length === 0 && query ? (
            <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--hc-n-700)', borderTop: hairline }}>
              No one in {data.org.name} matches “{q.trim()}”.
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 10, borderTop: '1px solid var(--hc-divider)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '12px 18px 6px' }}>
            <Overline>Arrivals · {live.waiting} waiting</Overline>
            {live.waiting > 0 ? <span style={{ fontSize: 12, color: 'var(--hc-n-600)' }}>Oldest first</span> : null}
          </div>
          {shown.map((a) => (
            <ArrivalRow
              key={a.id}
              arrival={a}
              role={arrRole[a.id] ?? defaultWelcomeRole(welcomeAs)}
              roles={welcomeAs}
              choose={choose}
              label={welcomeLabel}
              canDismiss={data.can.dismiss}
              onRole={(r) => setArrRole((m) => ({ ...m, [a.id]: r }))}
              onWelcome={(r) => void live.welcome(a, r)}
              onDismiss={() => void live.dismiss(a)}
            />
          ))}
          {more > 0 ? (
            <div style={{ padding: '4px 12px 0' }}>
              <Btn variant="ghost" onClick={() => nav.openDetail('arrivals')}>{more} more waiting · open the queue</Btn>
            </div>
          ) : null}
          {live.waiting === 0 ? (
            <div style={{ padding: '2px 18px 6px', fontSize: 13, color: 'var(--hc-n-700)' }}>No one waiting.</div>
          ) : null}
        </div>
        <div style={{ height: 10 }} />
      </PopupShell>
      {live.toast}
    </>
  );
}

function ArrivalRow({ arrival: a, role, roles, choose, label, canDismiss, onRole, onWelcome, onDismiss }: {
  arrival: Arrival;
  role: HubRole;
  roles: HubRole[];
  choose: boolean;
  label: string;
  canDismiss: boolean;
  onRole(r: HubRole): void;
  onWelcome(r: HubRole): void;
  onDismiss(): void;
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '8px 14px 8px 18px', borderTop: hairline,
      }}
    >
      <span className="hc-avatar" data-arrival="true" aria-hidden="true" style={{ color: 'var(--hc-a-800)' }}>{a.initials}</span>
      <div style={{ flex: '1 1 120px', minWidth: 0, lineHeight: 1.25 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
        <div style={{ fontSize: 12, color: 'var(--hc-n-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          From {a.fromSite} · {whenText(a.arrivedAt)}
        </div>
      </div>
      {choose ? <WelcomeSelect roles={roles} value={role} onChange={onRole} width={96} /> : null}
      <Btn variant="primary" style={{ padding: '5px 12px' }} onClick={() => onWelcome(role)}>{label}</Btn>
      {canDismiss ? (
        <Btn variant="ghost" square aria-label={`Dismiss ${a.name}`} title="Dismiss" style={{ width: 30, height: 30, color: 'var(--hc-n-700)' }} icon="close" iconSize={15} onClick={onDismiss} />
      ) : null}
    </div>
  );
}

