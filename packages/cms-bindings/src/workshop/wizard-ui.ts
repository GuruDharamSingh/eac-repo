/**
 * Adapt manifest-derived wizard steps to the shape `@elkdonis/cms-ui`'s
 * `<TemplateWizard>` renders.
 *
 * `buildWorkshopWizardSteps` produces `WizardStep[]` keyed on the field
 * registry; `<TemplateWizard>` wants `{ id, label, fields: WizardFieldSpec[] }`.
 * The shape is structural on both sides, so this is a near-identity map with two
 * jobs:
 *
 *   1. Collapse the registry's rich input union onto the primitives cms-ui
 *      renders directly. `image` / `gallery` / `media` / `compound` become
 *      `custom` fields, carrying a `slot` the app switches on to supply a
 *      Nextcloud picker or a sub-field group.
 *   2. Carry the `table` / `col` / `dataKey` through as `binding`, so the save
 *      handler can turn answers (keyed by trait) back into column values.
 *
 * cms-bindings does not import cms-ui — the returned objects satisfy cms-ui's
 * interfaces by structure, and the app passes them straight through.
 */

import type { WizardStep, WizardField } from "./wizard-config";

/** The subset of cms-ui's `WizardFieldInput` this adapter emits. */
export type WizardUiInput =
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

/** What a `custom` field needs — the app renders a control per `slot`. */
export type WizardUiSlot = "image" | "gallery" | "media" | "compound";

export interface WizardUiField {
  name: string;
  label: string;
  input: WizardUiInput;
  hint?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Set when `input === "custom"`. */
  slot?: WizardUiSlot;
  /** Constituent fields for a `compound` slot. */
  compound?: { name: string; label: string; input: "text" | "number" | "url" }[];
  /** Where this answer is persisted. */
  binding: { table: string; col: string; dataKey?: string };
  visibleWhen?: { col: string; equals?: string | number | boolean };
}

export interface WizardUiStep {
  id: string;
  label: string;
  description?: string;
  optional?: boolean;
  source: "template" | "platform";
  fields: WizardUiField[];
}

const DIRECT: Record<string, WizardUiInput> = {
  text: "text",
  textarea: "textarea",
  url: "url",
  number: "number",
  date: "date",
  datetime: "datetime",
  select: "select",
  boolean: "boolean",
  color: "color",
};

const SLOT: Record<string, WizardUiSlot> = {
  image: "image",
  gallery: "gallery",
  media: "media",
  compound: "compound",
};

/**
 * The long workshop description reads better in a taller control. It is the
 * only `textarea` field that is really long-form prose.
 */
const RICHTEXT_TRAITS = new Set(["descriptionLong"]);

function toUiField(field: WizardField): WizardUiField {
  const slot = SLOT[field.input];
  const input: WizardUiInput = slot
    ? "custom"
    : RICHTEXT_TRAITS.has(field.trait)
      ? "richtext"
      : (DIRECT[field.input] ?? "text");

  return {
    name: field.trait,
    label: field.label,
    input,
    hint: field.hint,
    required: field.required,
    options: field.options,
    slot,
    compound: field.compound?.map((c) => ({
      name: c.col,
      label: c.label,
      input: c.input,
    })),
    binding: { table: field.table, col: field.col, dataKey: field.dataKey },
    visibleWhen: field.visibleWhen,
  };
}

export function toWizardUiSteps(steps: WizardStep[]): WizardUiStep[] {
  return steps.map((step) => ({
    id: step.id,
    label: step.label,
    description: step.description,
    optional: step.optional,
    source: step.source,
    fields: step.fields.map(toUiField),
  }));
}

/**
 * Fold wizard answers (keyed by trait) back into a flat column map for the save
 * handler. `dataKey` wins over `col` — it is the key the DB-facing types use
 * when a SQL alias renamed the column (`display_name` → `facilitator_name`).
 * Compound answers are expected to already be objects keyed by sub-field name.
 */
export function wizardAnswersToColumns(
  steps: WizardUiStep[],
  answers: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const step of steps) {
    for (const field of step.fields) {
      const value = answers[field.name];
      if (value === undefined) continue;
      if (field.slot === "compound" && value && typeof value === "object") {
        Object.assign(out, value as Record<string, unknown>);
        continue;
      }
      out[field.binding.dataKey ?? field.binding.col] = value;
    }
  }
  return out;
}
