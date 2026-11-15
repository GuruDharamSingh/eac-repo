'use client';

import * as React from 'react';
import { Icon } from '../theme/context';
import type { FieldTone } from './Field';

// ============================================================================
// Chip inputs: TagInput (free words) and PeopleInput (people from a list,
// optionally a typed name too). Chips are the accent tag (design: `.tag-accent`
// "printmaking ×"); each has its own remove button with a spoken name.
//
// PeopleInput is an ARIA 1.2 combobox: the text box owns a listbox of
// matches (aria-expanded, aria-controls, aria-activedescendant); ↑/↓ move,
// Enter picks, Escape closes, Backspace on an empty box removes the last chip.
// ============================================================================

function useOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  React.useEffect(() => {
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [ref, onOutside]);
}

export interface TagInputProps {
  id: string;
  value: unknown;
  onChange: (tags: string[]) => void;
  placeholder?: string;
  describedBy?: string;
  tone?: FieldTone | null;
  disabled?: boolean;
  /** Lower-case what is typed (default true: tags are matched case-blind). */
  lowercase?: boolean;
}

export function TagInput({ id, value, onChange, placeholder = 'Add a tag', describedBy, tone, disabled, lowercase = true }: TagInputProps) {
  const tags = Array.isArray(value) ? value.map(String) : [];
  const [draft, setDraft] = React.useState('');
  const input = React.useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const words = raw
      .split(',')
      .map((w) => (lowercase ? w.trim().toLowerCase() : w.trim()))
      .filter(Boolean)
      .filter((w) => !tags.includes(w));
    if (words.length) onChange([...tags, ...words]);
    setDraft('');
  };

  return (
    <div
      className="frm-input frm-chips"
      data-state={tone ?? undefined}
      data-disabled={disabled ? '' : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) input.current?.focus();
      }}
    >
      {tags.map((t) => (
        <span key={t} className="frm-chip">
          <span>{t}</span>
          <button type="button" className="frm-chip-x" aria-label={`Remove ${t}`} disabled={disabled} onClick={() => onChange(tags.filter((x) => x !== t))}>
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      <input
        ref={input}
        id={id}
        className="frm-chips-input"
        value={draft}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-invalid={tone === 'error' || undefined}
        disabled={disabled}
        enterKeyHint="done"
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
    </div>
  );
}

export interface PersonOption {
  value: string;
  label: string;
  /** A second line in the list ("Elkdonis Lab · member"). */
  note?: string;
}

export interface PeopleInputProps {
  id: string;
  value: unknown;
  onChange: (ids: string[]) => void;
  options: PersonOption[];
  /** The signed-in person: their chip reads "(you)". */
  selfId?: string | null;
  /** Ids that cannot be removed here (the author). */
  fixed?: string[];
  max?: number;
  /** Accept a typed name that is not on the list (credits: "Elkdonis Lab"). */
  allowFree?: boolean;
  placeholder?: string;
  describedBy?: string;
  tone?: FieldTone | null;
  disabled?: boolean;
}

export function PeopleInput({
  id,
  value,
  onChange,
  options,
  selfId,
  fixed = [],
  max,
  allowFree,
  placeholder = 'Add someone',
  describedBy,
  tone,
  disabled,
}: PeopleInputProps) {
  const ids = Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === 'string' && value ? [value] : [];
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useOutside(box, close);

  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const needle = q.trim().toLowerCase();
  const matches = options.filter((o) => !ids.includes(o.value) && (!needle || o.label.toLowerCase().includes(needle))).slice(0, 8);
  const full = max !== undefined && ids.length >= max;
  const listId = `${id}-list`;
  const optId = (i: number) => `${id}-opt-${i}`;

  const pick = (v: string) => {
    if (!ids.includes(v)) onChange([...ids, v]);
    setQ('');
    setActive(0);
    setOpen(false);
    input.current?.focus();
  };

  return (
    <div
      ref={box}
      className="frm-input frm-chips"
      data-state={tone ?? undefined}
      data-disabled={disabled ? '' : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) input.current?.focus();
      }}
    >
      {ids.map((v) => {
        const isFixed = fixed.includes(v);
        const name = `${labelOf(v)}${selfId && v === selfId ? ' (you)' : ''}`;
        return (
          <span key={v} className="frm-chip" data-fixed={isFixed ? '' : undefined}>
            <span>{name}</span>
            {!isFixed && (
              <button type="button" className="frm-chip-x" aria-label={`Remove ${name}`} disabled={disabled} onClick={() => onChange(ids.filter((x) => x !== v))}>
                <Icon name="close" size={12} />
              </button>
            )}
          </span>
        );
      })}
      {!full && (
        <input
          ref={input}
          id={id}
          className="frm-chips-input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && matches[active] ? optId(active) : undefined}
          aria-describedby={describedBy}
          aria-invalid={tone === 'error' || undefined}
          value={q}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, Math.max(matches.length - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              if (open && matches[active]) {
                e.preventDefault();
                pick(matches[active].value);
              } else if (allowFree && q.trim()) {
                e.preventDefault();
                pick(q.trim());
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
            } else if (e.key === 'Backspace' && !q && ids.length) {
              const last = ids[ids.length - 1];
              if (last && !fixed.includes(last)) onChange(ids.slice(0, -1));
            }
          }}
        />
      )}
      <ul className="frm-suggest" id={listId} role="listbox" hidden={!open || matches.length === 0}>
        {matches.map((o, i) => (
          <li
            key={o.value}
            id={optId(i)}
            role="option"
            aria-selected={i === active}
            className="frm-suggest-opt"
            onPointerDown={(e) => {
              e.preventDefault();
              pick(o.value);
            }}
            onPointerEnter={() => setActive(i)}
          >
            <span>{o.label}</span>
            {o.note && <span className="frm-suggest-note">{o.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
