"use client";

import * as React from "react";

// ============================================================================
// Field controls for the manifest-driven wizard.
//
// The wizard's *steps* are derived from a template manifest
// (`@elkdonis/cms-bindings` `buildWorkshopWizardSteps`); this file renders the
// *fields* of a step as plain controls. It stays free of any component library
// and of `@elkdonis/cms-bindings` itself — the consuming app maps the manifest
// field shape onto `WizardFieldSpec` below (a near-identity map) so this package
// keeps zero heavy dependencies, the same posture as the rest of cms-ui.
//
// Styling is `hsl(var(--token))` utilities only, so each site's palette drives
// it. Anything richer than these primitives — a Nextcloud image picker, a
// session list, a rich-text body — is a `custom` field the app supplies.
// ============================================================================

export type WizardFieldInput =
  | "text"
  | "textarea"
  | "richtext"
  | "url"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "boolean"
  | "color"
  | "custom";

export interface WizardFieldOption {
  value: string;
  label: string;
}

export interface WizardFieldSpec {
  /** Key in the wizard's answer object. Usually the registry trait. */
  name: string;
  label: string;
  input: WizardFieldInput;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  options?: WizardFieldOption[];
  /**
   * For `input: "custom"` — a render function the app supplies (image picker,
   * session editor, …). Receives the current value and a setter.
   */
  render?: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    id: string;
    field: WizardFieldSpec;
  }) => React.ReactNode;
}

const FIELD =
  "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] " +
  "px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm " +
  "placeholder:text-[hsl(var(--muted-foreground))] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

function toInputValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** One labelled control. */
export function WizardFieldControl({
  field,
  value,
  onChange,
}: {
  field: WizardFieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `wf-${field.name}`;
  const describedBy = field.hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="flex items-center gap-1 text-sm font-medium text-[hsl(var(--foreground))]"
      >
        {field.label}
        {field.required && (
          <span aria-hidden className="text-[hsl(var(--destructive))]">
            *
          </span>
        )}
      </label>

      <Control field={field} value={value} onChange={onChange} id={id} describedBy={describedBy} />

      {field.hint && (
        <p id={describedBy} className="text-xs text-[hsl(var(--muted-foreground))]">
          {field.hint}
        </p>
      )}
    </div>
  );
}

function Control({
  field,
  value,
  onChange,
  id,
  describedBy,
}: {
  field: WizardFieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  id: string;
  describedBy?: string;
}) {
  switch (field.input) {
    case "custom":
      return <>{field.render?.({ value, onChange, id, field }) ?? null}</>;

    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--foreground))]">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          />
          <span className="text-[hsl(var(--muted-foreground))]">
            {field.placeholder ?? "Yes"}
          </span>
        </label>
      );

    case "select":
      return (
        <select
          id={id}
          className={FIELD}
          value={toInputValue(value)}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{field.placeholder ?? "Select…"}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "textarea":
    case "richtext":
      return (
        <textarea
          id={id}
          rows={field.input === "richtext" ? 8 : 4}
          className={FIELD}
          value={toInputValue(value)}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "color":
      return (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="color"
            value={toInputValue(value) || "#000000"}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
          />
          <input
            type="text"
            className={FIELD}
            value={toInputValue(value)}
            placeholder="#000000"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case "number":
      return (
        <input
          id={id}
          type="number"
          className={FIELD}
          value={toInputValue(value)}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );

    case "date":
    case "datetime":
      return (
        <input
          id={id}
          type={field.input === "datetime" ? "datetime-local" : "date"}
          className={FIELD}
          value={toInputValue(value)}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );

    case "url":
      return (
        <input
          id={id}
          type="url"
          inputMode="url"
          className={FIELD}
          value={toInputValue(value)}
          placeholder={field.placeholder ?? "https://"}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "text":
    default:
      return (
        <input
          id={id}
          type="text"
          className={FIELD}
          value={toInputValue(value)}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
