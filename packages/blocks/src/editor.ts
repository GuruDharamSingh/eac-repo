// ============================================================================
// Editor adapters.
//
// These turn a `BlockDef` into whatever shape a given editing surface wants.
// They are pure functions over data and import NOTHING — no editor library, no
// React. That is deliberate: it lets the catalogue prove it can drive an
// editor without the repo taking on a dependency on one.
//
// If a drag-and-drop editor is ever adopted, the work here is a thin mapping
// layer that already exists, rather than a second hand-written description of
// every block's props.
// ============================================================================

import type { BlockDef, PropDef } from "./types";

// ── Silex ───────────────────────────────────────────────────────────────────

/**
 * A GrapesJS/Silex trait, as the connector's template manifests already
 * declare them (see any `manifest.json` `traits` array).
 */
export interface SilexTrait {
  name: string;
  label: string;
  type: "text" | "number" | "checkbox" | "select";
  options?: { id: string; name: string }[];
}

const SILEX_TYPE: Record<PropDef["kind"], SilexTrait["type"]> = {
  string: "text",
  text: "text",
  url: "text",
  image: "text",
  number: "number",
  boolean: "checkbox",
  select: "select",
  // A Silex trait IS an HTML attribute, so a list stays comma-separated text
  // here; `propsFromAttributes` splits it back into an array on the way in.
  // The Puck map below makes a different choice, because a form control can
  // hold a real array and an attribute cannot.
  list: "text",
  // Never reached — slot and rows props are filtered out below. Present so the
  // map stays exhaustive and a new kind cannot be added without deciding this.
  slot: "text",
  rows: "text",
};

/**
 * The trait panel for a block's Silex twin.
 *
 * Attribute names match what `propsFromAttributes` reads back, so what an
 * author sets in Silex is exactly what the React component receives. Those two
 * halves drifting is the failure this whole registry exists to prevent.
 */
export function toSilexTraits(def: BlockDef): SilexTrait[] {
  // A slot has no trait: in Silex the equivalent of "blocks go here" is the
  // element's own inner HTML, which the author edits on the canvas rather than
  // in the settings panel. Offering it as a text trait would invite someone to
  // type markup into a box that cannot hold it.
  return def.props
    .filter((prop) => prop.kind !== "slot" && prop.kind !== "rows")
    .map((prop) => ({
    name: `data-${prop.name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
    label: prop.label,
    type: SILEX_TYPE[prop.kind],
    ...(prop.kind === "select" && prop.options
      ? { options: prop.options.map((o) => ({ id: o.value, name: o.label })) }
      : {}),
    }));
}

// ── Puck ────────────────────────────────────────────────────────────────────

/**
 * A field in the shape `@puckeditor/core` expects in a component's `fields` map.
 *
 * A DISCRIMINATED UNION, because Puck's own `Field` is one. This was originally
 * written as a single interface with a union `type` and optional `options` —
 * which looked equivalent and is not: `Record<string, ThatInterface>` will not
 * assign to Puck's `Fields`, because a field typed as possibly-"array" has to
 * carry `arrayFields`. The file used to carry a note saying these shapes were
 * unverified against the real package. They have now been checked against
 * @puckeditor/core 0.19.3, and the note was right to be there.
 *
 * Only the kinds we actually emit are modelled. Puck has more (array, object,
 * external, custom); adding one is a job for whenever a PropKind needs it.
 */
export type PuckField =
  | {
      type: "text" | "textarea";
      label?: string;
      placeholder?: string;
      /** Typed on the page rather than in the panel. See PropDef.inlineEditable. */
      contentEditable?: boolean;
    }
  | {
      type: "number";
      label?: string;
      placeholder?: string;
      min?: number;
      max?: number;
      step?: number;
    }
  | { type: "select" | "radio"; label?: string; options: { label: string; value: string | number | boolean }[] }
  | {
      type: "array";
      label?: string;
      arrayFields: Record<string, PuckField>;
      defaultItemProps?: Record<string, unknown>;
      /** What an editor calls one row when the list is collapsed. */
      getItemSummary?: (item: Record<string, unknown>, index?: number) => string;
    }
  | { type: "slot"; label?: string; allow?: string[]; disallow?: string[] };

const PUCK_TYPE: Record<PropDef["kind"], PuckField["type"]> = {
  string: "text",
  // No dedicated URL or image control without a custom field; plain text is
  // the honest default rather than pretending there is a picker.
  url: "text",
  image: "text",
  text: "textarea",
  number: "number",
  boolean: "radio",
  select: "select",
  // NOT "text". A list's value is a string[], and a text control writes back a
  // plain string — so the first edit in an editor would silently turn the
  // array into a string and the component would render one long item. An array
  // field of single-value rows round-trips correctly.
  list: "array",
  // Puck's own field type for a nested drag-and-drop region.
  slot: "slot",
  // Structured repeating items — the same array field a `list` uses, but with
  // the block's declared columns instead of one anonymous value.
  rows: "array",
};

export function toPuckFields(def: BlockDef): Record<string, PuckField> {
  const fields: Record<string, PuckField> = {};

  for (const prop of def.props) {
    const kind = PUCK_TYPE[prop.kind];

    if (kind === "slot") {
      // `allow` restricts what may be dropped in, so an author is stopped at
      // the drag rather than after saving a page that renders wrong.
      fields[prop.name] = {
        type: "slot",
        label: prop.label,
        ...(prop.allow ? { allow: [...prop.allow] } : {}),
      };
      continue;
    }

    if (kind === "select") {
      fields[prop.name] = {
        type: "select",
        label: prop.label,
        options: (prop.options ?? []).map((o) => ({ label: o.label, value: o.value })),
      };
      continue;
    }

    if (kind === "array") {
      // A `list` is rows of ONE anonymous string; `rows` declares its columns.
      // Same Puck field either way — the difference is entirely in what the
      // block said it wanted.
      if (prop.kind === "rows") {
        const arrayFields: Record<string, PuckField> = {};
        const defaultItemProps: Record<string, unknown> = {};
        for (const column of prop.fields ?? []) {
          arrayFields[column.name] = toPuckFields({ props: [column] } as BlockDef)[column.name]!;
          if (column.default !== undefined) defaultItemProps[column.name] = column.default;
        }
        // Name each row by its own content rather than its position. A
        // function, not a string — the editor calls it per row — but still no
        // import: this file describes a field, it does not build one.
        const summaryColumns = prop.summary ?? [];
        fields[prop.name] = {
          type: "array",
          label: prop.label,
          arrayFields,
          defaultItemProps,
          ...(summaryColumns.length
            ? {
                getItemSummary: (item: Record<string, unknown>, index?: number) => {
                  const parts = summaryColumns
                    .map((name) => String(item?.[name] ?? "").trim())
                    .filter(Boolean);
                  // Falls back to the position, which is what an editor would
                  // have shown anyway — an unfilled row still needs a handle.
                  return parts.join(" — ") || `${prop.label} ${(index ?? 0) + 1}`;
                },
              }
            : {}),
        };
        continue;
      }

      fields[prop.name] = {
        type: "array",
        label: prop.label,
        arrayFields: { value: { type: "text" } },
        defaultItemProps: { value: "" },
      };
      continue;
    }

    if (kind === "radio") {
      // A boolean is offered as a pair rather than a checkbox, matching how
      // Puck renders booleans everywhere else.
      fields[prop.name] = {
        type: "radio",
        label: prop.label,
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      };
      continue;
    }

    if (kind === "number") {
      // A declared range reaches the control, so a size prop is offered as a
      // bounded input rather than a box that happily accepts 4000. The same
      // three numbers are what lets a custom field draw a SLIDER instead — a
      // width is a thing you drag, not a thing you type.
      fields[prop.name] = {
        type: "number",
        label: prop.label,
        ...(prop.description ? { placeholder: prop.description } : {}),
        ...(prop.min !== undefined ? { min: prop.min } : {}),
        ...(prop.max !== undefined ? { max: prop.max } : {}),
        ...(prop.step !== undefined ? { step: prop.step } : {}),
      };
      continue;
    }

    // A description has no home of its own in an editor's field panel, so it
    // becomes the control's placeholder rather than being dropped — which is
    // what used to happen, leaving a prop like "Time zone" with no hint that
    // it wants an IANA name.
    fields[prop.name] = {
      type: kind,
      label: prop.label,
      ...(prop.description ? { placeholder: prop.description } : {}),
      // Only where the block said its value is rendered verbatim. Switching
      // this on for a prop the component parses replaces the string with a
      // ReactNode and the block draws nothing.
      ...(prop.inlineEditable ? { contentEditable: true } : {}),
    };
  }

  return fields;
}

/** The `defaultProps` for a block, taken from its declared defaults. */
export function toDefaultProps(def: BlockDef): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const prop of def.props) {
    if (prop.kind === "slot") continue; // a region has no default value
    if (prop.default !== undefined) out[prop.name] = prop.default;
  }
  return out;
}

/**
 * The names of a block's slot props.
 *
 * An editor adapter needs this because slots arrive differently from every
 * other prop. Puck hands a slot to the component as a RENDER FUNCTION, while
 * our components take a `ReactNode` — so the adapter has to call it and pass
 * the result, rather than forwarding it untouched:
 *
 *     render: (props) => {
 *       const next = { ...props };
 *       for (const name of slotNames(def)) {
 *         const Region = props[name];
 *         next[name] = <Region />;
 *       }
 *       return <Component {...next} />;
 *     }
 *
 * Keeping that translation in the adapter is what lets the block itself stay
 * ordinary React — a hand-written page passes JSX children straight in and
 * never learns that an editor exists.
 */
export function slotNames(def: BlockDef): string[] {
  return def.props.filter((p) => p.kind === "slot").map((p) => p.name);
}
