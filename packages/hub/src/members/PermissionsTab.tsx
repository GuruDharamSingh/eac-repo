'use client';

// Detail > Permissions (1n): the read-only matrix, then the Shared storage block (owners).
// The matrix is the README roles table, drawn as documentation; it gates nothing.

import * as React from 'react';
import type { HubRole } from '../contract';
import { Frame, Icon, RoleChip, Tag } from '../ui/primitives';
import type { MembersHost } from './host';
import type { MembersDetailData } from './model';
import { ROLES, hairline } from './parts';

const MATRIX: Array<[string, string, string, string, string]> = [
  ['See people and arrivals', 'y', 'y', 'n', 'n'],
  ['Welcome arrivals', 'y', 'As viewer', 'n', 'n'],
  ['Give or change roles', 'Below owner', 'n', 'n', 'n'],
  ['List or unlist in the directory', 'y', 'n', 'n', 'n'],
  ['Remove people', 'y', 'n', 'n', 'n'],
  ['Shared storage', 'Full', 'Edit', 'View', 'n'],
  ['Storage controls', 'y', 'n', 'n', 'n'],
  ['Visitor analytics', 'y', 'n', 'n', 'n'],
];

const tint = 'color-mix(in srgb, var(--hc-accent) 9%, transparent)';
const GRID = 'minmax(0,1fr) repeat(4, 120px)';

export function Matrix({ mine, style }: { mine: HubRole; style?: React.CSSProperties }) {
  const myCol = ROLES.indexOf(mine);
  return (
    <div style={{ maxWidth: 900, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h4 style={{ margin: 0, fontSize: 22 }}>Who can do what</h4>
        <Tag tone="neutral">Read-only</Tag>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--hc-n-700)' }}>
        Your column is highlighted. Nobody can change their own role, and no one can change an owner’s.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <Frame style={{ minWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, borderBottom: '1px solid var(--hc-divider)' }}>
            <span style={{ padding: '10px 14px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--hc-n-700)' }}>
              Capability
            </span>
            {ROLES.map((r, i) => (
              <div key={r} style={{ padding: '10px 14px', background: i === myCol ? tint : 'transparent', display: 'flex', alignItems: 'center', gap: 6 }}>
                <RoleChip role={r} />
                {i === myCol ? <span style={{ fontSize: 11, color: 'var(--hc-n-700)' }}>you</span> : null}
              </div>
            ))}
          </div>
          {MATRIX.map(([cap, ...cells]) => (
            <div key={cap} style={{ display: 'grid', gridTemplateColumns: GRID, borderBottom: hairline }}>
              <span style={{ padding: '10px 14px', fontSize: 14 }}>{cap}</span>
              {cells.map((v, i) => (
                <div key={ROLES[i]} style={{ padding: '10px 14px', background: i === myCol ? tint : 'transparent', display: 'flex', alignItems: 'center', fontSize: 13 }}>
                  {v === 'y' ? (
                    <span style={{ display: 'flex', color: 'var(--hc-a-700)' }}><Icon name="check" size={16} /></span>
                  ) : v === 'n' ? (
                    <span style={{ color: 'var(--hc-n-400)' }}>—</span>
                  ) : (
                    <span style={{ color: 'var(--hc-a-800)' }}>{v}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </Frame>
      </div>
    </div>
  );
}

/** The old Cloud storage panel, handed in by the host. Owners only; hidden when absent. */
export function StorageBlock({ data, host, style }: { data: MembersDetailData; host: MembersHost; style?: React.CSSProperties }) {
  if (!data.can.seeStorage || !host.storagePanel) return null;
  return (
    <section aria-label="Shared storage" style={{ maxWidth: 900, ...style }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 22 }}>Shared storage</h4>
      {host.storagePanel}
    </section>
  );
}

export function PermissionsTab({ data, host }: { data: MembersDetailData; host: MembersHost }) {
  return (
    <div>
      <Matrix mine={data.viewer.role} />
      <StorageBlock data={data} host={host} style={{ marginTop: 36 }} />
    </div>
  );
}
