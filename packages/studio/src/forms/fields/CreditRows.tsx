'use client';

import * as React from 'react';
import { Icon } from '../theme/context';
import { PeopleInput, type PersonOption } from './Chips';
import type { FieldTone } from './Field';
import { Select, type SelectOption } from './Input';

// ============================================================================
// CreditRows: who made it (design §5 "Maker and credits", 1f, 1p).
//
//   [Artist     ▾] [ Mara Okafor × ]                       ×
//   [Printed by ▾] [ Elkdonis Lab  ]                       ×
//   + Another credit
//
// Value: Array<{ role; userId?; name? }> (PLAN §12 `credits`). The person box
// is a PeopleInput of one: a member picked from the list keeps their userId
// (the first artist with one becomes the work's credited artist), a typed
// name is kept as a name ("Elkdonis Lab"). Rows wrap at 390: the role keeps
// 120px, the person takes the rest of the line.
// ============================================================================

export interface CreditValue {
  role: string;
  userId?: string;
  name?: string;
}

/** The roles offered by default; a kind can pass its own. 'artist' is the one commerce credits. */
export const CREDIT_ROLES: SelectOption[] = [
  { value: 'artist', label: 'Artist' },
  { value: 'printer', label: 'Printed by' },
  { value: 'publisher', label: 'Published by' },
  { value: 'framer', label: 'Framed by' },
  { value: 'photographer', label: 'Photographed by' },
  { value: 'collaborator', label: 'With' },
];

/** "Printed by", for a role value; an unknown role reads as itself. */
export function creditRoleLabel(role: string, roles: SelectOption[] = CREDIT_ROLES): string {
  return roles.find((r) => r.value === role)?.label ?? role;
}

/** The credits in an answer: rows with a role; a row with neither person nor name is kept (it is being typed). */
export function readCredits(value: unknown): CreditValue[] {
  if (!Array.isArray(value)) return [];
  const out: CreditValue[] = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const o = v as { role?: unknown; userId?: unknown; name?: unknown };
    const c: CreditValue = { role: typeof o.role === 'string' && o.role ? o.role : 'artist' };
    if (typeof o.userId === 'string' && o.userId) c.userId = o.userId;
    if (typeof o.name === 'string') c.name = o.name;
    out.push(c);
  }
  return out;
}

/** The name a credit prints: the person's name from the list, else the typed one. */
export function creditName(c: CreditValue, people: PersonOption[] = []): string {
  if (c.userId) return people.find((p) => p.value === c.userId)?.label ?? c.name ?? '';
  return c.name ?? '';
}

export interface CreditRowsProps {
  id: string;
  value: unknown;
  onChange: (credits: CreditValue[]) => void;
  /** People who can be credited by account (members, the signed-in person). */
  people?: PersonOption[];
  roles?: SelectOption[];
  selfId?: string | null;
  /** Default "Another credit". */
  addLabel?: string;
  /** No "+ Another credit" at this many rows. */
  max?: number;
  /** Accept a typed name (default true). False: people from the list only. */
  allowFree?: boolean;
  describedBy?: string;
  tone?: FieldTone | null;
  disabled?: boolean;
}

export function CreditRows({
  id,
  value,
  onChange,
  people = [],
  roles = CREDIT_ROLES,
  selfId,
  addLabel = 'Another credit',
  max,
  allowFree = true,
  describedBy,
  tone,
  disabled,
}: CreditRowsProps) {
  const stored = readCredits(value);
  // An empty answer still shows one row to fill in: the artist.
  const rows = stored.length ? stored : [{ role: roles[0]?.value ?? 'artist' } as CreditValue];
  const addBtn = React.useRef<HTMLButtonElement>(null);
  const focusRow = React.useRef<number | null>(null);
  const box = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const i = focusRow.current;
    if (i === null) return;
    focusRow.current = null;
    const el = box.current?.querySelector<HTMLElement>(`[data-credit-row="${i}"] input`);
    (el ?? addBtn.current)?.focus();
  });

  const set = (i: number, patch: Partial<CreditValue>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange(next);
  };

  const pickWho = (i: number, ids: string[]) => {
    const v = ids[ids.length - 1];
    if (!v) return set(i, { userId: undefined, name: '' });
    const person = people.find((p) => p.value === v);
    set(i, person ? { userId: person.value, name: person.label } : { userId: undefined, name: v });
  };

  const add = () => {
    const used = new Set(rows.map((r) => r.role));
    const role = roles.find((r) => !used.has(r.value))?.value ?? roles[roles.length - 1]?.value ?? 'collaborator';
    focusRow.current = rows.length;
    onChange([...rows, { role, name: '' }]);
  };

  const remove = (i: number) => {
    focusRow.current = i > 0 ? i - 1 : 0;
    onChange(rows.filter((_, j) => j !== i));
  };

  return (
    <div className="frm-credits" ref={box}>
      {rows.map((r, i) => {
        const who = r.userId ?? r.name ?? '';
        const roleOptions = roles.some((o) => o.value === r.role) ? roles : [...roles, { value: r.role, label: r.role }];
        const roleName = creditRoleLabel(r.role, roles);
        return (
          <div key={i} className="frm-credit" data-credit-row={i} role="group" aria-label={`Credit ${i + 1}: ${roleName}`}>
            <Select
              id={`${id}-role-${i}`}
              className="frm-credit-role"
              width={120}
              value={r.role}
              options={roleOptions}
              aria-label={`Credit ${i + 1}, role`}
              disabled={disabled}
              onChange={(e) => set(i, { role: e.target.value || 'artist' })}
            />
            <div className="frm-credit-who">
              <PeopleInput
                id={i === 0 ? id : `${id}-who-${i}`}
                value={who ? [who] : []}
                onChange={(ids) => pickWho(i, ids)}
                options={people}
                selfId={selfId}
                max={1}
                allowFree={allowFree === true}
                placeholder={allowFree === false ? 'Pick a member' : r.role === 'artist' ? 'A member, or a name' : 'A person or a studio'}
                describedBy={describedBy}
                tone={i === 0 ? tone : null}
                disabled={disabled}
              />
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                className="frm-btn frm-btn--icon frm-credit-x"
                aria-label={`Remove the credit ${roleName}${creditName(r, people) ? `, ${creditName(r, people)}` : ''}`}
                title="Remove this credit"
                disabled={disabled}
                onClick={() => remove(i)}
              >
                <Icon name="close" size={15} />
              </button>
            )}
          </div>
        );
      })}
      {(max === undefined || rows.length < max) && (
        <button ref={addBtn} type="button" className="frm-btn frm-btn--ghost frm-credits-add" disabled={disabled} onClick={add}>
          <Icon name="plus" size={14} />
          {addLabel}
        </button>
      )}
    </div>
  );
}
