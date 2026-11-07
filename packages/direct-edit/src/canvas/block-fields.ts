// ============================================================================
// What the right column shows for a sealed block (2026-11-04): each prop the
// block declares, as a panel slot in the rows a box uses, read from the editor
// contract (block/contract.ts). Rows and lists are shown by count until they can
// be edited; slots are in the tree, so they have no row. Plain functions: the
// panel draws the slots and tree-editor stores what they change.
// ============================================================================

import { safeLink, safeSrc } from "../block/bind";
import { propKey, propSlotId, type BlockContract, type ContractProp, type OptionGroup } from "../block/contract";
import type { Allowed, Control, ResolvedSlot, SectionId } from "../model/schema";
import { isPrivatePicture } from "./edit-shell";

const SECTION: Record<OptionGroup, SectionId> = { content: "content", layout: "layout", look: "appearance", behaviour: "behaviour" };
const isCounted = (p: ContractProp) => p.kind === "rows" || p.kind === "list";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Props the adapter or this editor own. A field on one would write the node's identity or its looks. */
const NOT_A_FIELD = new Set(["id", "puck", "editMode", "children", "morph"]);

function controlOf(p: ContractProp): Control {
  if (isCounted(p)) return "readout";
  switch (p.kind) {
    case "text":
    case "richtext": return "textarea";
    case "number": return "number";
    case "boolean": return "chips";
    case "select": return "select";
    case "string": return p.format === "color" ? "color" : "text";
    default: return "text";
  }
}

/** Typed letter by letter, so one spell of typing is one undo step. */
export const isTypedProp = (p: ContractProp) => { const c = controlOf(p); return c === "text" || c === "textarea"; };

function countOf(v: unknown): string {
  const n = Array.isArray(v) ? v.length : typeof v === "string" ? v.split(",").filter((s) => s.trim()).length : 0;
  return n === 0 ? "None yet" : n === 1 ? "1 row" : `${n} rows`;
}

function allowedOf(p: ContractProp): Allowed {
  if (p.kind === "boolean") return { list: [false, true] };
  if (p.kind === "select") return { list: (p.options ?? []).map((x) => x.value) };
  if (p.kind !== "number") return {};
  return { ...(p.min !== undefined && p.max !== undefined ? { range: [p.min, p.max] as const } : {}), ...(p.step !== undefined ? { step: p.step } : {}) };
}

/** The panel's slots for this block, in the order it declares them. */
export function blockSlots(def: BlockContract, props: Record<string, unknown>): ResolvedSlot[] {
  const out: ResolvedSlot[] = [];
  for (const p of def.props) {
    if (!p.group || NOT_A_FIELD.has(p.name)) continue;
    const slot: ResolvedSlot = { key: propKey(p.name), id: propSlotId(p.name), section: SECTION[p.group], label: p.label, control: controlOf(p), allowed: allowedOf(p), hint: p.description };
    if (isCounted(p)) slot.readout = countOf(props[p.name]);
    if (p.kind === "boolean") slot.labels = { false: "Off", true: "On" };
    if (p.kind === "select") slot.labels = Object.fromEntries((p.options ?? []).map((x) => [x.value, x.label]));
    if (p.kind === "url") slot.placeholder = "https://… or #anchor";
    if (p.kind === "image") slot.placeholder = "Paste a picture address";
    if (p.kind === "number") {
      if (p.unit) slot.unit = p.unit;
      if (p.min !== undefined || p.max !== undefined) slot.bounds = [p.min ?? -Infinity, p.max ?? Infinity];
    }
    out.push(slot);
  }
  return out;
}

/** Values by panel key: what is stored, else the default. Rows have no value here, and nothing to reset. */
export function blockValues(def: BlockContract, props: Record<string, unknown>): { values: Record<string, unknown>; overridden: Record<string, boolean> } {
  const values: Record<string, unknown> = {}, overridden: Record<string, boolean> = {};
  for (const p of def.props) {
    if (!p.group || isCounted(p) || NOT_A_FIELD.has(p.name)) continue;
    const key = propKey(p.name), stored = props[p.name];
    values[key] = stored !== undefined ? stored : p.default;
    const unset = stored === undefined || (p.default === undefined && (stored === "" || stored === null));
    overridden[key] = !unset && !same(stored, p.default);
  }
  return { values, overridden };
}

/** What may be stored for this prop. Empty is allowed: the block draws without it. A picture must also be one visitors can see. */
export function cleanPropValue(p: ContractProp, v: unknown): { ok: true; value: unknown } | { ok: false; message: string } {
  if (p.kind !== "url" && p.kind !== "image") return { ok: true, value: v };
  const s = String(v ?? "").trim();
  if (!s) return { ok: true, value: "" };
  if (p.kind === "url") {
    const link = safeLink(s);
    return link ? { ok: true, value: link } : { ok: false, message: "That link was not kept. Use https://…, mailto:, a path on this site or #anchor." };
  }
  if (isPrivatePicture(s)) return { ok: false, message: "That picture is private, so visitors could not see it. Choose a public one." };
  const src = safeSrc(s);
  return src ? { ok: true, value: src } : { ok: false, message: "That picture address was not kept. Use https://… or a path on this site." };
}

/** Back to what the block declares: its default, or nothing stored. */
export function resetProp(p: ContractProp, props: Record<string, unknown>): void {
  if (p.default !== undefined) props[p.name] = Array.isArray(p.default) ? [...p.default] : p.default;
  else delete props[p.name];
}
