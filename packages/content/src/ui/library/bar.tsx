"use client";

import * as React from "react";
import { LayoutGrid, List, Search } from "lucide-react";

// The bar's parts, shared by the published view, the files view and the remote view:
// search, the two-way view toggle, the scope toggle and the count line.

export function SearchBox({
  placeholder,
  value,
  onChange,
  disabled,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="chn-search">
      <Search size={15} aria-hidden />
      <span className="chn-sr">Search</span>
      <input type="search" placeholder={placeholder} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export interface ViewToggleOption<V extends string> {
  value: V;
  label: string;
}

/** Bricks | List (the library) or Grid | List (files): a two-button group. */
export function ViewToggle<V extends string>({ value, options, onChange }: { value: V; options: [ViewToggleOption<V>, ViewToggleOption<V>]; onChange: (v: V) => void }) {
  const [a, b] = options;
  return (
    <div className="chn-seg is-small eac-c-viewseg" role="group" aria-label="View">
      <button type="button" aria-pressed={value === a.value} aria-label={a.label} title={a.label} onClick={() => onChange(a.value)}>
        <LayoutGrid size={14} aria-hidden />
      </button>
      <button type="button" aria-pressed={value === b.value} aria-label={b.label} title={b.label} onClick={() => onChange(b.value)}>
        <List size={14} aria-hidden />
      </button>
    </div>
  );
}

/** A labelled run of pressed-state buttons ("Where to look", "Scope", "Show"). */
export function SegGroup<V extends string>({
  label,
  value,
  options,
  onChange,
  small,
}: {
  label: string;
  value: V;
  options: Array<{ value: V; label: string }>;
  onChange: (v: V) => void;
  small?: boolean;
}) {
  return (
    <div className={`chn-seg${small ? " is-small" : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The count line. role="status" is a polite live region: a screen reader hears the count change. */
export function CountLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="eac-c-lib-count" role="status">
      {children}
    </p>
  );
}
