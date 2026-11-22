import { createElement } from "react";
import type { PropDef } from "@elkdonis/blocks";
import { PersonPickerField } from "@/components/studio/person-picker";
import { PICK_KINDS } from "./reference-kinds";

/**
 * Puck's control for a string setting that holds a reference to a place, a cover picture, a guide, an experience or a
 * tour (2026-11-21): the "From what?" chooser instead of a box holding an id. Returns null for every other string, which
 * keeps Puck's own box. Client side only (it draws the picker); the editor configs pass it as `fields.string`.
 */
export function referenceString(prop: PropDef) {
  if (!prop.binds || !PICK_KINDS.includes(prop.binds)) return null;
  return function ReferenceProp(props: Record<string, unknown>) {
    return createElement(PersonPickerField, { ...(props as object), field: { label: prop.label }, binds: prop.binds } as never);
  };
}
