'use client';

import * as React from 'react';
import type { FormIconName } from '../contract';
import { Icon } from '../theme/context';
import type { FieldTone } from './Field';

// ============================================================================
// Seg: one choice from a few, drawn as a segmented bar (design `.seg`).
//
// It IS a radiogroup of native radios sharing a name, so arrow keys move the
// choice, Tab enters and leaves the group once, and a screen reader hears
// "radio, 2 of 3" without any of that being re-implemented. The radios are
// visually hidden inside their labels; the label paints the state.
// ============================================================================

export interface SegOption {
  value: string;
  label: React.ReactNode;
  icon?: FormIconName;
  disabled?: boolean;
  /** Read after the label ("Members-only posts show a locked card…"). */
  title?: string;
}

export interface SegProps {
  /** The radios' shared name: one per field (hydration-safe; from the field name). */
  name: string;
  /** Put on the first radio, so a <label htmlFor> or an alert link can reach the group. */
  id?: string;
  value: string | null | undefined;
  options: SegOption[];
  onChange: (value: string) => void;
  labelledBy?: string;
  ariaLabel?: string;
  describedBy?: string;
  size?: 'md' | 'sm';
  /** Full width, options sharing it (the phone's Form | Preview). */
  full?: boolean;
  /** On a surface-coloured column, the bar takes the page ground (the preview's Card | Page). */
  ground?: 'bg';
  tone?: FieldTone | null;
  disabled?: boolean;
  className?: string;
}

export function Seg({
  name,
  id,
  value,
  options,
  onChange,
  labelledBy,
  ariaLabel,
  describedBy,
  size = 'md',
  full,
  ground,
  tone,
  disabled,
  className,
}: SegProps) {
  return (
    <div
      role="radiogroup"
      className={className ? `frm-seg ${className}` : 'frm-seg'}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : ariaLabel}
      aria-describedby={describedBy}
      aria-invalid={tone === 'error' || undefined}
      data-size={size}
      data-full={full ? '' : undefined}
      data-ground={ground}
      data-state={tone ?? undefined}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        const off = disabled || o.disabled;
        return (
          <label key={o.value} className="frm-seg-opt" data-checked={checked ? '' : undefined} data-disabled={off ? '' : undefined} title={o.title}>
            <input
              type="radio"
              id={i === 0 ? id : undefined}
              name={name}
              value={o.value}
              checked={checked}
              disabled={off}
              onChange={() => onChange(o.value)}
            />
            {o.icon && <Icon name={o.icon} size={15} />}
            <span>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}
