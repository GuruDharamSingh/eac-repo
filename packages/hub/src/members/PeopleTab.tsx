'use client';

// Detail > People (1j, 1k, 1o): filters, the table (owner and guide column sets), the expanded row.

import * as React from 'react';
import type { HubRole } from '../contract';
import { Btn, Chevron, Icon, RoleChip, Segmented, Spinner, Toggle } from '../ui/primitives';
import type { Live } from './live';
import type { Member, MembersDetailData } from './model';
import { ROLE_LABEL, ROLE_PLURAL, ROLE_STORAGE } from './model';
import {
  ACCESS_LABEL, Overline, PersonLine, ROLES, StorageCell, countRoles, lowerRole, pickable,
} from './parts';
import { joinedText, seenText } from './time';

type RoleFilter = 'all' | HubRole;
type ListedFilter = 'any' | 'listed' | 'unlisted';

export interface PeopleActions {
  pickRole(m: Member, to: HubRole): void;
  askRemove(m: Member): void;
}

export function PeopleTab({ data, live, actions }: { data: MembersDetailData; live: Live; actions: PeopleActions }) {
  const [query, setQuery] = React.useState('');
  const [roleF, setRoleF] = React.useState<RoleFilter>('all');
  const [listedF, setListedF] = React.useState<ListedFilter>('any');
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const showStorage = data.can.seeStorage && live.people.some((p) => p.storage !== null);
  const cols = showStorage
    ? 'minmax(0,1fr) 112px 80px 130px 96px 104px 28px'
    : 'minmax(0,1fr) 112px 80px 96px 104px 28px';
  const minWidth = showStorage ? 780 : 640;

  const counts = countRoles(live.people);
  const q = query.trim().toLowerCase();
  const filtered = live.people.filter(
    (p) =>
      (roleF === 'all' || p.role === roleF) &&
      (listedF === 'any' || (listedF === 'listed') === p.listed) &&
      (!q || p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)),
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ position: 'relative', width: 240 }}>
          <span style={{ position: 'absolute', left: 10, top: 10, display: 'flex', color: 'var(--hc-n-600)' }}>
            <Icon name="search" size={16} />
          </span>
          <input
            className="hc-input"
            type="search"
            aria-label="Search people"
            placeholder="Search people"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <Segmented<RoleFilter>
          label="Filter by role"
          value={roleF}
          onChange={setRoleF}
          options={[
            { value: 'all', label: 'All', count: live.people.length },
            ...ROLES.map((r) => ({ value: r, label: ROLE_PLURAL[r], count: counts[r] })),
          ]}
        />
        <Segmented<ListedFilter>
          label="Filter by directory listing"
          value={listedF}
          onChange={setListedF}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'listed', label: 'Listed' },
            { value: 'unlisted', label: 'Unlisted' },
          ]}
        />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--hc-n-700)' }}>
          Showing {filtered.length} of {live.people.length}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth }}>
          <div
            style={{
              display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '8px 12px',
              borderBottom: '1px solid var(--hc-divider)', fontSize: 11, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--hc-n-700)',
            }}
          >
            <span>Person</span>
            <span>Role</span>
            <span>Listed</span>
            {showStorage ? <span>Storage</span> : null}
            <span>Joined</span>
            <span>Last seen</span>
            <span />
          </div>
          {filtered.map((m) => (
            <Row
              key={m.id}
              m={m}
              cols={cols}
              showStorage={showStorage}
              orgName={data.org.name}
              open={expanded === m.id}
              onToggleOpen={() => setExpanded((cur) => (cur === m.id ? null : m.id))}
              live={live}
              actions={actions}
            />
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: '28px 12px', fontSize: 14, color: 'var(--hc-n-700)' }}>No one matches these filters.</div>
      ) : null}
    </div>
  );
}

function Row({ m, cols, showStorage, orgName, open, onToggleOpen, live, actions }: {
  m: Member;
  cols: string;
  showStorage: boolean;
  orgName: string;
  open: boolean;
  onToggleOpen(): void;
  live: Live;
  actions: PeopleActions;
}) {
  const seen = seenText(m.lastSeenAt);
  return (
    <div className="hc-row" data-open={open}>
      <div
        className="hc-row-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggleOpen}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleOpen();
          }
        }}
        style={{
          display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '8px 12px',
          minHeight: 50, cursor: 'pointer',
        }}
      >
        <PersonLine member={m} />
        <div><RoleChip role={m.role} reason={m.can.reason} /></div>
        <div>
          <Toggle
            checked={m.listed}
            disabled={!m.can.list}
            label="Listed publicly"
            title={m.listed ? 'Listed in the public directory' : 'Not shown publicly'}
            onChange={(v) => void live.setListed(m, v)}
          />
        </div>
        {showStorage ? <div><StorageCell status={m.storage} /></div> : null}
        <span style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>{joinedText(m.joinedAt)}</span>
        <span style={{ fontSize: 13, color: 'var(--hc-n-700)' }}>{seen ?? '—'}</span>
        <span style={{ display: 'flex', justifyContent: 'center' }}><Chevron open={open} /></span>
      </div>
      {open ? <Expanded m={m} showStorage={showStorage} orgName={orgName} live={live} actions={actions} /> : null}
    </div>
  );
}

function Expanded({ m, showStorage, orgName, live, actions }: {
  m: Member;
  showStorage: boolean;
  orgName: string;
  live: Live;
  actions: PeopleActions;
}) {
  const choosable = new Set<HubRole>([m.role, ...pickable(m)]);
  const reason = pickable(m).length > 0
    ? 'Demoting asks you to confirm. Every change queues a storage sync.'
    : m.can.reason;
  const access = ACCESS_LABEL[ROLE_STORAGE[m.role]];
  const storageNote =
    m.storage === 'pending'
      ? `Sync in flight: updating access to match the ${lowerRole(m.role)} role.`
      : m.storage === 'synced'
        ? `Synced with ${orgName} shared storage.`
        : 'Viewers don’t get shared storage.';
  return (
    <div
      className="hc-row-panel"
      style={{
        display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) auto', gap: 28,
        padding: '16px 16px 18px 52px', borderBottom: '1px solid var(--hc-divider)',
      }}
    >
      <div>
        <Overline style={{ marginBottom: 8 }}>Role</Overline>
        <Segmented<HubRole>
          label={`Role for ${m.name}`}
          value={m.role}
          onChange={(to) => actions.pickRole(m, to)}
          options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r], disabled: !choosable.has(r) }))}
        />
        {reason ? <div style={{ marginTop: 8, fontSize: 12, color: 'var(--hc-n-700)' }}>{reason}</div> : null}
      </div>
      <div>
        <Overline style={{ marginBottom: 8 }}>Directory</Overline>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Toggle
            checked={m.listed}
            disabled={!m.can.list}
            label="Listed publicly"
            onChange={(v) => void live.setListed(m, v)}
          />
          <span style={{ fontSize: 13 }}>{m.listed ? 'Listed in the public directory' : 'Not shown publicly'}</span>
        </div>
        {m.arrivedFrom ? (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--hc-n-700)' }}>Arrived from {m.arrivedFrom}</div>
        ) : null}
      </div>
      <div>
        {showStorage && m.storage !== null ? (
          <>
            <Overline style={{ marginBottom: 8 }}>Shared storage</Overline>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {m.storage === 'pending' ? <Spinner size={13} /> : null}
              {m.storage === 'synced' ? (
                <span style={{ display: 'flex', color: 'var(--hc-a-700)' }}><Icon name="check" size={14} /></span>
              ) : null}
              {access}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--hc-n-700)' }}>{storageNote}</div>
          </>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
        {m.can.remove ? (
          <Btn variant="secondary" icon="user-minus" iconSize={15} onClick={() => actions.askRemove(m)}>
            Remove from {orgName}
          </Btn>
        ) : null}
      </div>
    </div>
  );
}
