// ============================================================================
// Fields lens: the declaration (server-safe, pure data, no React, no DOM, no db).
//
// In the markup a field is  data-field="<kind>:<id>:<field>"  (e.g. section:hero:title).
// In code it is one entry of a registry made with defineFields(). The same module is read by
// the client lens (labels, input kinds, limits) and by the server (allow-list, validation,
// which atlas capability the save goes through).
//
// The input shape is live-editor's FieldDef (label, input, hint, options, compound), widened
// with the kinds the About editor and the plan ask for (rich, boolean, color) and the lens's own
// flags (inline, max, optional, readOnly). cms-bindings' fieldRegistry (trait -> table column)
// stays as it is: it is the workshop store's coercion table, not a declaration of what a page may edit.
// ============================================================================

import type { FieldDef, FieldInputType } from "@elkdonis/live-editor";

/** live-editor's kinds, plus: rich (cms-ui RichTextEditor), boolean, color. */
export type FieldKind = FieldInputType | "rich" | "boolean" | "color" | "list" | "record";

export interface FieldSpec extends Omit<FieldDef, "trait" | "initialValue" | "input" | "label"> {
  /** Shown in the panel; defaults to the field name. */
  label?: string;
  input: FieldKind;
  /**
   * Short plain text typed straight on the page (B). Only honoured for input "text".
   * Everything else, and "More..." on an inline field, goes to the side panel (C).
   */
  inline?: boolean;
  /** Longest value, in characters (for a "list": the longest single line). Enforced on the page and again on the server. */
  max?: number;
  /** A "list" only: most lines it may hold (default 30). */
  maxItems?: number;
  /** May be cleared (an empty value removes the field, so the page's own default shows). Default true. */
  optional?: boolean;
  /** A reason string makes the field read-only: the panel shows it, nothing can be saved. */
  readOnly?: string;
  /** What the block uses when nothing is set, as text ("true" / "false" for a switch). Set: "" means "use the default" and saves as `unset`. */
  default?: string;
  /** A "number": its declared range, step and unit. */
  range?: { min?: number; max?: number; step?: number; unit?: string };
  /** A "record": the kind of record this value is filled from (a setting declared `binds`). */
  binds?: string;
}

export interface RecordSpec {
  /** Shown in the panel header; defaults to "kind id". */
  label?: string;
  /** Replaces the kind's fields for this one record id (a section's fields differ by section). */
  fields: Record<string, FieldSpec>;
}

export interface KindSpec {
  /** The atlas capability id the save runs through (performAction). Omit when the host supplies `save`. */
  capability?: string;
  label?: string;
  /** The fields every record of this kind has. */
  fields?: Record<string, FieldSpec>;
  /** Per record id: its own fields. A record listed here uses these instead of `fields`. */
  records?: Record<string, RecordSpec>;
  /**
   * For a kind that is a record many places draw (a post a card shows): the line the lens says beside its fields,
   * because a change reaches every place the record appears ("This changes the post itself, everywhere it appears.").
   */
  shared?: string;
  /** The panel's heading as it is, when the id is not worth showing (a tour's id): "This tour". */
  heading?: string;
}

export type FieldsRegistry = Record<string, KindSpec>;

/** Identity function that types the registry. It stays plain, serialisable data. */
export function defineFields<R extends FieldsRegistry>(registry: R): R {
  return registry;
}

export interface FieldRef {
  kind: string;
  id: string;
  field: string;
}

/** "section:about-hero:title" -> parts. The id may itself contain colons: kind is the first part, field the last. */
export function parseFieldRef(ref: string | null | undefined): FieldRef | null {
  if (!ref) return null;
  const parts = ref.split(":");
  if (parts.length < 3) return null;
  const kind = parts[0]!;
  const field = parts[parts.length - 1]!;
  const id = parts.slice(1, -1).join(":");
  if (!kind || !id || !field) return null;
  return { kind, id, field };
}

export function formatFieldRef(r: FieldRef): string {
  return `${r.kind}:${r.id}:${r.field}`;
}

/** The declared fields of one record, or null when this kind/id declares none. */
export function resolveFields(registry: FieldsRegistry, kind: string, id: string): Record<string, FieldSpec> | null {
  const k = registry[kind];
  if (!k) return null;
  const fields = k.records?.[id]?.fields ?? k.fields;
  return fields && Object.keys(fields).length > 0 ? fields : null;
}

export function recordLabel(registry: FieldsRegistry, kind: string, id: string): string {
  const k = registry[kind];
  return k?.records?.[id]?.label ?? k?.heading ?? (k?.label ? `${k.label}: ${id}` : `${kind} ${id}`);
}

/** Pure value check shared by the page (before it sends) and the server (before it routes). "" is a clear. */
/** Both fields are always present (the apps compile non-strict, where a union on a boolean does not narrow). */
export interface CheckResult { ok: boolean; value: string; error: string }

export function checkValue(spec: FieldSpec, value: unknown): CheckResult {
  const bad = (error: string): CheckResult => ({ ok: false, value: "", error });
  const good = (v: string): CheckResult => ({ ok: true, value: v, error: "" });
  if (spec.readOnly) return bad(spec.readOnly);
  if (typeof value === "boolean") value = value ? "true" : "";
  if (typeof value !== "string") return bad("That value is not text.");
  if (spec.input === "list") {
    // One line per bullet; blank lines drop out. The value travels as the lines joined by "\n".
    const items = value.split(/\r?\n/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    const most = spec.maxItems ?? 30;
    if (items.length === 0) return spec.optional === false ? bad(`${spec.label ?? "This list"} cannot be empty.`) : good("");
    if (items.length > most) return bad(`Too many lines: ${items.length} of ${most}.`);
    const long = items.find((s) => spec.max !== undefined && s.length > spec.max);
    if (long) return bad(`A line is too long: ${long.length} of ${spec.max} characters.`);
    return good(items.join("\n"));
  }
  let v = value;
  if (spec.input !== "textarea" && spec.input !== "rich") v = v.replace(/\s*[\r\n]+\s*/g, " ");
  v = v.trim();
  if (v === "") {
    return spec.optional === false ? bad(`${spec.label ?? "This field"} cannot be empty.`) : good("");
  }
  if (spec.max !== undefined && v.length > spec.max) return bad(`Too long: ${v.length} of ${spec.max} characters.`);
  if (spec.input === "url" && !linkOk(v)) return bad("Use a web address (https://...), a path starting with /, or mailto:.");
  if (spec.input === "number") {
    if (!Number.isFinite(Number(v))) return bad("That is not a number.");
    const { min, max } = spec.range ?? {};
    if (min !== undefined && max !== undefined && (Number(v) < min || Number(v) > max)) return bad(`Use a number from ${min} to ${max}.`);
    if (min !== undefined && Number(v) < min) return bad(`Use a number of ${min} or more.`);
    if (max !== undefined && Number(v) > max) return bad(`Use a number of ${max} or less.`);
  }
  if (spec.input === "boolean" && spec.default !== undefined && v !== "true" && v !== "false") return bad("Choose on or off.");
  if (spec.input === "record" && /\s/.test(v)) return bad("A record is chosen from the list, not typed.");
  if (spec.input === "color" && !/^#[0-9a-fA-F]{6}$/.test(v)) return bad("Use a colour like #c9a961.");
  if (spec.input === "select" && spec.options && !spec.options.some((o) => o.value === v)) return bad("Pick one of the choices.");
  return good(v);
}

/** http(s), mailto, or a same-site path (not protocol-relative). Never javascript: or data:. */
export function linkOk(v: string): boolean {
  if (v.startsWith("/")) return !v.startsWith("//");
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(v)) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Can this field be typed on the page. */
export function isInline(spec: FieldSpec): boolean {
  return spec.inline === true && spec.input === "text" && !spec.readOnly;
}
