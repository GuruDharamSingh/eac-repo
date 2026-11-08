'use client';

import * as React from 'react';

// ============================================================================
// CheckRow: a native checkbox (16px, accent-color) with its label and an
// optional second line. `after` sits beside the label outside it ("Edit
// wording"), so the link is not part of the checkbox's name.
// ============================================================================

export interface CheckRowProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  sub?: React.ReactNode;
  /** The label in the label weight ("Present it as a series"). */
  strong?: boolean;
  disabled?: boolean;
  describedBy?: string;
  after?: React.ReactNode;
}

export function CheckRow({ id, checked, onChange, label, sub, strong, disabled, describedBy, after }: CheckRowProps) {
  const box = (
    <label className="frm-check" data-plain={sub ? undefined : ''} data-disabled={disabled ? '' : undefined}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="frm-check-text">
        <span className="frm-check-label" data-strong={strong ? '' : undefined}>
          {label}
        </span>
        {sub && <span className="frm-check-sub">{sub}</span>}
      </span>
    </label>
  );
  if (!after) return box;
  return (
    <div className="frm-check-row">
      {box}
      {after}
    </div>
  );
}

/** Several checkboxes answering one question (cms-ui `multichoice`): the answer is always an array. */
export function CheckList({
  id,
  value,
  options,
  onChange,
  labelledBy,
  describedBy,
  inline,
  disabled,
}: {
  id: string;
  value: unknown;
  options: Array<{ value: string; label: string; hint?: string }>;
  onChange: (v: string[]) => void;
  labelledBy?: string;
  describedBy?: string;
  inline?: boolean;
  disabled?: boolean;
}) {
  const selected = Array.isArray(value) ? value.map(String) : [];
  return (
    <div role="group" className="frm-checks" data-inline={inline ? '' : undefined} aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {options.map((o, i) => (
        <CheckRow
          key={o.value}
          id={i === 0 ? id : `${id}-${i}`}
          checked={selected.includes(o.value)}
          label={o.label}
          sub={o.hint}
          disabled={disabled}
          onChange={(on) => onChange(on ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
        />
      ))}
    </div>
  );
}
