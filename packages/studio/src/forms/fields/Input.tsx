'use client';

import * as React from 'react';
import type { FormIconName } from '../contract';
import { Icon } from '../theme/context';
import type { FieldTone } from './Field';

// ============================================================================
// The boxed controls (design §2 `.input`): surface fill, 1px edge, 36px high,
// an optional leading icon in the accent. The box is a wrapper so the icon,
// a "$" prefix or a "CAD" suffix sit inside the same edge; focus is drawn on
// the wrapper (:focus-within), states on data-state.
// ============================================================================

interface BoxProps {
  icon?: FormIconName;
  tone?: FieldTone | null;
  locked?: boolean;
  /** Fixed width ("96px" for a time, 150 for a price); unset fills the row. */
  width?: number | string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
}

function boxProps({ tone, locked, width, className }: BoxProps, disabled?: boolean) {
  return {
    className: className ? `frm-input ${className}` : 'frm-input',
    'data-state': tone ?? undefined,
    'data-locked': locked ? '' : undefined,
    'data-disabled': disabled ? '' : undefined,
    'data-width': width !== undefined ? '' : undefined,
    style: width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width, flex: 'none' } : undefined,
  };
}

export type InputProps = BoxProps & Omit<React.ComponentProps<'input'>, 'prefix' | 'width'>;

export function Input({ icon, tone, locked, width, prefix, suffix, className, disabled, ...input }: InputProps) {
  return (
    <span {...boxProps({ tone, locked, width, className }, disabled)}>
      {locked ? <Icon name="members" size={15} /> : icon ? <Icon name={icon} size={16} /> : null}
      {prefix && <span className="frm-input-affix">{prefix}</span>}
      <input className="frm-input-el" disabled={disabled || locked} {...input} />
      {suffix && <span className="frm-input-affix">{suffix}</span>}
    </span>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export type SelectProps = BoxProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'prefix' | 'width'> & {
    options: SelectOption[];
    /** The empty choice's label; omitted, there is no empty choice. */
    placeholder?: string;
    groups?: Array<{ label: string; options: SelectOption[] }>;
  };

export function Select({ icon, tone, locked, width, prefix, className, disabled, options, groups, placeholder, ...select }: SelectProps) {
  return (
    <span {...boxProps({ tone, locked, width, className: className ? `frm-select ${className}` : 'frm-select' }, disabled)}>
      {locked ? <Icon name="members" size={15} /> : icon ? <Icon name={icon} size={16} /> : null}
      {prefix && <span className="frm-input-affix">{prefix}</span>}
      <select className="frm-input-el" disabled={disabled || locked} {...select}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {groups?.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <Icon name="caret" size={12} className="frm-select-caret" />
    </span>
  );
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { tone?: FieldTone | null };

export function Textarea({ tone, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={className ? `frm-textarea ${className}` : 'frm-textarea'}
      data-state={tone ?? undefined}
      {...rest}
    />
  );
}

/**
 * A wall-clock "YYYY-MM-DDTHH:mm" as two native controls (date, then time), the
 * shape cms-ui's datetime answers already have. Native pickers on purpose:
 * they bring the phone's own picker and keyboard entry for free.
 */
export function DateTimeInput({
  id,
  value,
  onChange,
  tone,
  locked,
  disabled,
  describedBy,
  invalid,
  defaultTime = '10:00',
  label,
}: {
  id: string;
  value: unknown;
  onChange: (v: string | null) => void;
  tone?: FieldTone | null;
  locked?: boolean;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
  defaultTime?: string;
  /** For the time control's own name ("Starts" → "Starts, time"). */
  label?: string;
}) {
  const raw = typeof value === 'string' ? value : '';
  const [date, time] = raw.includes('T') ? raw.split('T') : [raw, ''];
  const set = (d: string, t: string) => onChange(d ? `${d}T${(t || defaultTime).slice(0, 5)}` : null);
  return (
    <div className="frm-when">
      <Input
        id={id}
        type="date"
        icon="date"
        tone={tone}
        locked={locked}
        disabled={disabled}
        value={date ?? ''}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(e) => set(e.target.value, time ?? '')}
      />
      <Input
        id={`${id}-time`}
        type="time"
        icon="clock"
        locked={locked}
        disabled={disabled}
        step={300}
        value={(time ?? '').slice(0, 5)}
        aria-label={label ? `${label}, time` : 'Time'}
        aria-describedby={describedBy}
        onChange={(e) => set(date ?? '', e.target.value)}
      />
    </div>
  );
}
