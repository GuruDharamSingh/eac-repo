'use client';

// Small pieces the Members face, pop-up and detail pages share.

import * as React from 'react';
import type { HubNav, HubRole } from '../contract';
import { Btn, ConfirmDialog, Icon, RoleChip, Spinner, Tag } from '../ui/primitives';
import type { Live } from './live';
import type { Member, MembersFaceData, StorageAccess, StorageStatus } from './model';
import { ROLE_LABEL, ROLE_PLURAL, ROLE_STORAGE } from './model';
import { plural } from './time';

export const ROLES: HubRole[] = ['owner', 'guide', 'member', 'viewer'];

export const ACCESS_LABEL: Record<StorageAccess, string> = {
  full: 'Full access',
  edit: 'Can edit',
  view: 'Can view',
  none: 'No access',
};

const RANK: Record<HubRole, number> = { owner: 4, guide: 3, member: 2, viewer: 1 };
export const isDemotion = (from: HubRole, to: HubRole) => RANK[to] < RANK[from];

export const firstName = (name: string) => name.split(' ')[0] ?? name;
export const lowerRole = (r: HubRole) => ROLE_LABEL[r].toLowerCase();

/** 1 → "1 owner", 3 → "3 owners". */
export function roleCount(r: HubRole, n: number) {
  return `${n} ${(n === 1 ? ROLE_LABEL[r] : ROLE_PLURAL[r]).toLowerCase()}`;
}

export function countRoles(people: Member[]): Record<HubRole, number> {
  const c: Record<HubRole, number> = { owner: 0, guide: 0, member: 0, viewer: 0 };
  for (const p of people) c[p.role] += 1;
  return c;
}

export type SizeKind = 'solo' | 'small' | 'large';
export const sizeKind = (total: number): SizeKind => (total <= 1 ? 'solo' : total <= 5 ? 'small' : 'large');

export const hairline = '1px solid color-mix(in srgb, var(--hc-text) 8%, transparent)';

/** Roles a person may be set to by this viewer, from data. Owner only ever appears as the current role. */
export function pickable(m: Member): HubRole[] {
  return m.can.roles.filter((r) => r !== 'owner' && r !== m.role);
}

// ── role select / chip ────────────────────────────────────────────────────

/** A native select when the viewer may change this person's role, else the chip with the reason. */
export function RoleCell({ member, onPick, width, minHeight = 30, fontSize = 13 }: {
  member: Member;
  onPick(role: HubRole): void;
  width?: number;
  minHeight?: number;
  fontSize?: number;
}) {
  const choices = pickable(member);
  if (choices.length === 0) return <RoleChip role={member.role} reason={member.can.reason} />;
  const options: HubRole[] = [member.role, ...choices];
  return (
    <select
      className="hc-input"
      aria-label={`Role for ${member.name}`}
      value={member.role}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onPick(e.target.value as HubRole)}
      style={{ width, minHeight, padding: '3px 8px', fontSize, background: 'transparent' }}
    >
      {options.map((r) => (
        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
      ))}
    </select>
  );
}

/** The welcome role select: the roles `can.welcomeAs` allows. */
export function WelcomeSelect({ roles, value, onChange, width, minHeight = 30 }: {
  roles: HubRole[];
  value: HubRole;
  onChange(r: HubRole): void;
  width: number;
  minHeight?: number;
}) {
  return (
    <select
      className="hc-input"
      aria-label="Role on welcome"
      value={value}
      onChange={(e) => onChange(e.target.value as HubRole)}
      style={{ width, minHeight, padding: '3px 8px', fontSize: 13, background: 'transparent' }}
    >
      {roles.map((r) => (
        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
      ))}
    </select>
  );
}

export function defaultWelcomeRole(roles: HubRole[]): HubRole {
  return roles.includes('viewer') ? 'viewer' : (roles[0] ?? 'viewer');
}

// ── storage ────────────────────────────────────────────────────────────

export function StorageCell({ status }: { status: StorageStatus | null }) {
  if (status === 'synced') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--hc-a-700)' }}>
        <Icon name="check" size={14} />
        Synced
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--hc-a-700)',
          padding: '1px 8px 1px 6px', border: '1px solid var(--hc-a-400)',
        }}
      >
        <Spinner size={13} />
        Syncing
      </span>
    );
  }
  if (status === 'none') {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--hc-n-600)' }}>— No access</span>;
  }
  return <span style={{ fontSize: 13, color: 'var(--hc-n-600)' }}>—</span>;
}

export const storageAccessOf = (role: HubRole): string => ACCESS_LABEL[ROLE_STORAGE[role]];

/** Pop-up footer / detail header sync status. */
export function SyncStatus({ syncs, long, size = 12 }: { syncs: number; long?: boolean; size?: number }) {
  const text = syncs > 0
    ? long
      ? `${plural(syncs, 'change')} syncing to shared storage`
      : `${plural(syncs, 'sync')} in flight`
    : long
      ? 'Shared storage in sync'
      : 'Storage in sync';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: size, color: 'var(--hc-a-700)' }}>
      {syncs > 0 ? <Spinner size={13} /> : <Icon name="check" size={14} />}
      {text}
    </span>
  );
}

// ── small atoms ──────────────────────────────────────────────────────────

export function Overline({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--hc-n-700)', ...style }}>
      {children}
    </div>
  );
}

export function PersonLine({ member, avatar = 30, nameSize = 14 }: { member: Member; avatar?: number; nameSize?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span className="hc-avatar" style={{ width: avatar, height: avatar, fontSize: avatar > 30 ? 14 : 12 }} aria-hidden="true">
        {member.initials}
      </span>
      <div style={{ minWidth: 0, lineHeight: 1.25 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: nameSize, fontWeight: 500 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</span>
          {member.isYou ? <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--hc-n-600)' }}>you</span> : null}
        </div>
        <div style={{ fontSize: 12, color: 'var(--hc-n-700)' }}>{member.handle}</div>
      </div>
    </div>
  );
}

export function InviteStub() {
  return (
    <Btn variant="secondary" icon="user-plus" iconSize={15} disabled title="Invites arrive with the roster service">
      Invite
    </Btn>
  );
}

// ── detail header (shared by the tabbed and small-org pages) ────────────────

export function DetailHeader({ data, live, nav, summary }: {
  data: MembersFaceData;
  live: Live;
  nav: HubNav;
  summary: string;
}) {
  return (
    <>
      <div className="hc-crumb">
        <Btn variant="ghost" icon="back" iconSize={14} onClick={() => nav.close()}>Hub</Btn>
        <span style={{ color: 'var(--hc-n-500)' }}>/</span>
        <span>Members</span>
      </div>
      <div className="hc-detail-head" style={{ justifyContent: 'space-between', gap: 24, marginBottom: 0, paddingBottom: 18, alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1>Members</h1>
            {data.viewer.role === 'guide' ? <Tag tone="outline">Viewing as guide</Tag> : null}
          </div>
          <div style={{ fontSize: 14, color: 'var(--hc-n-700)', marginTop: 2 }}>{summary}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {data.can.seeStorage && live.syncs !== null ? <SyncStatus syncs={live.syncs} long size={13} /> : null}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <InviteStub />
            <span style={{ fontSize: 11, color: 'var(--hc-n-600)' }}>Coming with the roster service</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── confirm dialogs (remove, demote). No make-owner: owners aren't made here. ──

type Pending = { kind: 'remove'; id: string } | { kind: 'demote'; id: string; to: HubRole };

export function useMemberConfirm(live: Live, orgName: string) {
  const [pending, setPending] = React.useState<Pending | null>(null);

  const pickRole = (m: Member, to: HubRole) => {
    if (to === m.role || to === 'owner') return;
    if (isDemotion(m.role, to)) setPending({ kind: 'demote', id: m.id, to });
    else void live.setRole(m, to);
  };

  const askRemove = React.useCallback((m: Member) => setPending({ kind: 'remove', id: m.id }), []);
  const cancel = React.useCallback(() => setPending(null), []);

  let node: React.ReactNode = null;
  const m = pending ? live.people.find((p) => p.id === pending.id) : undefined;
  if (pending && m) {
    const fn = firstName(m.name);
    const hasStorage = m.storage !== null;
    if (pending.kind === 'remove') {
      node = (
        <ConfirmDialog
          title={`Remove ${m.name} from ${orgName}?`}
          body={`${fn} loses the ${lowerRole(m.role)} role${m.listed ? ' and comes off the public directory' : ''}. Their account stays, and they can come back later as an arrival.`}
          note={hasStorage ? 'Storage access is revoked in the next sync.' : undefined}
          action="Remove"
          onCancel={cancel}
          onConfirm={() => {
            setPending(null);
            void live.remove(m);
          }}
        />
      );
    } else {
      const to = pending.to;
      node = (
        <ConfirmDialog
          title={`Demote ${m.name} to ${lowerRole(to)}?`}
          body={`${fn} goes from ${lowerRole(m.role)} to ${lowerRole(to)}.`}
          note={
            hasStorage
              ? to === 'viewer'
                ? `Queues a sync: ${fn} loses access to ${orgName} shared storage.`
                : `Queues a sync: storage access drops to “${storageAccessOf(to).toLowerCase()}”.`
              : undefined
          }
          action="Demote"
          onCancel={cancel}
          onConfirm={() => {
            setPending(null);
            void live.setRole(m, to);
          }}
        />
      );
    }
  }
  return { pickRole, askRemove, node };
}
