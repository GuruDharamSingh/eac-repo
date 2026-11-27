// ============================================================================
// Fields lens, block content: the map (contract C4). Light and pure: type imports only, so the client lens can
// import it. The server doors that use it are in ./blocks.ts.
//
// Two ways a setting reaches the lens (2026-11-22):
//   a part   the block declares which element draws it (a part with a `prop`): clicking that element opens it.
//   other    a setting no part draws (a choice, a switch, a size): reached by clicking the block's own box, or from
//            "Another setting of this block" in the panel. The panel still shows ONE value at a time.
// ============================================================================

import type { FieldSpec } from "./registry";

/** The kinds of setting the lens offers. Rows, lists, regions (slots) and colours stay with the canvas and the settings sheet. */
export type SettingKind = "string" | "text" | "richtext" | "url" | "image" | "select" | "boolean" | "number";

const OFFERED: ReadonlySet<string> = new Set(["string", "text", "richtext", "url", "image", "select", "boolean", "number"]);

/** What fieldMapOf reads of a block's declaration: `contractOf(blocks)` satisfies it. */
export interface BlockMapSource {
  label: string;
  props: readonly {
    name: string;
    kind: string;
    label: string;
    description?: string;
    default?: unknown;
    binds?: string;
    inlineEditable?: boolean;
    format?: string;
    options?: readonly { value: string; label: string }[];
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
  }[];
  parts?: Readonly<Record<string, { label: string; sel: string; prop?: string; repeat?: true }>>;
}

/** One setting a person may change from the page. */
export interface BlockSetting {
  prop: string;
  label: string;
  kind: SettingKind;
  /** The block's own help text for it. */
  hint?: string;
  /** The value is drawn verbatim, so it may be typed on the page. */
  inline: boolean;
  /** Longest text, in characters (text kinds). */
  max: number;
  /** A choice's options. */
  options?: { value: string; label: string }[];
  /** What the block uses when nothing is set, as text ("true" / "false" for a switch). */
  default?: string;
  /** A number's declared range, step and unit. */
  range?: { min?: number; max?: number; step?: number; unit?: string };
  /** Filled from a record of this kind (declared `binds`). */
  binds?: string;
}

export interface BlockPartField extends BlockSetting {
  /** The part's selector, as the block declared it (the `>` form means the block's root, then a path). */
  sel: string;
}

export interface BlockFieldEntry {
  label: string;
  /** The root part's selector without a leading `>` (what the first element after the block's marker must match). */
  root: string;
  /** Settings an element of the block draws, by part name. */
  parts: Record<string, BlockPartField>;
  /** Settings no part draws, by setting name, in the block's own order. */
  others: Record<string, BlockSetting>;
}

/** Block type -> the settings of it a person may change. Plain data: it crosses from a server page to the client lens. */
export type BlockFieldMap = Record<string, BlockFieldEntry>;

/** The same default `direct-edit/block/contract.ts` GENERIC_ROOT_SEL gives a block that declares no root. */
const GENERIC_ROOT = ":not(template)";
const LONGEST = { string: 400, text: 4000, url: 2000, image: 2000, richtext: 20000 } as const;

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export interface FieldMapOptions {
  /** The host has a sanitiser for formatted text. Without one a rich-text setting is not offered (the door would refuse it). */
  richtext?: boolean;
}

type Prop = BlockMapSource["props"][number];

/** The keys the door never writes as content (steps/types.ts LOOK_PROPS and EDITOR_PROPS): a block's own `look` choice is among them. */
const RESERVED: ReadonlySet<string> = new Set(["morph", "look", "blkStyle", "id", "puck", "editMode", "children"]);

function settingOf(def: Prop, label: string, opts: FieldMapOptions): BlockSetting | null {
  if (RESERVED.has(def.name)) return null;
  const binds = typeof def.binds === "string" && def.binds ? def.binds : undefined;
  if (binds) {
    // A record is chosen, never typed: only a plain string can hold one.
    if (def.kind !== "string") return null;
    return { prop: def.name, label, kind: "string", hint: def.description, inline: false, max: LONGEST.string, binds };
  }
  if (!OFFERED.has(def.kind)) return null;
  // A colour is the look's: the canvas's panel owns it.
  if (def.kind === "string" && def.format === "color") return null;
  if (def.kind === "richtext" && !opts.richtext) return null;
  const kind = def.kind as SettingKind;
  const s: BlockSetting = { prop: def.name, label, kind, hint: def.description, inline: kind === "string" && def.inlineEditable === true, max: own(LONGEST, kind) ? LONGEST[kind as keyof typeof LONGEST] : 0 };
  if (kind === "select") {
    if (!def.options?.length) return null;
    s.options = def.options.map((o) => ({ value: o.value, label: o.label }));
  }
  if (kind === "boolean") s.default = String(def.default === true);
  else if (def.default !== undefined && (kind === "select" || kind === "number") && (typeof def.default === "string" || typeof def.default === "number")) s.default = String(def.default);
  if (kind === "number") {
    const range: NonNullable<BlockSetting["range"]> = {};
    if (typeof def.min === "number") range.min = def.min;
    if (typeof def.max === "number") range.max = def.max;
    if (typeof def.step === "number") range.step = def.step;
    if (typeof def.unit === "string" && def.unit) range.unit = def.unit;
    if (Object.keys(range).length) s.range = range;
  }
  return s;
}

/**
 * Which settings of which blocks can be changed from the page: every plain content setting a block declares (words,
 * links, pictures, choices, switches, numbers, formatted text where the host can clean it, and the records a setting is
 * filled from). A part that names a setting is where the person clicks; the rest are reached from the block's own box.
 * Never offered: colours, lists, rows, regions that hold other blocks, and the look.
 */
export function fieldMapOf(contracts: Readonly<Record<string, BlockMapSource>>, opts: FieldMapOptions = {}): BlockFieldMap {
  const out: BlockFieldMap = {};
  for (const [type, c] of Object.entries(contracts)) {
    const offered: Record<string, BlockSetting> = {};
    for (const def of c.props) {
      const s = settingOf(def, def.label, opts);
      if (s) offered[def.name] = s;
    }
    const parts: Record<string, BlockPartField> = {};
    const drawn = new Set<string>();
    for (const [name, part] of Object.entries(c.parts ?? {})) {
      if (!part.prop || part.repeat || part.prop.includes(".")) continue;
      const s = own(offered, part.prop) ? offered[part.prop]! : undefined;
      if (!s) continue;
      parts[name] = { ...s, label: part.label, sel: part.sel };
      drawn.add(part.prop);
    }
    const others: Record<string, BlockSetting> = {};
    for (const [name, s] of Object.entries(offered)) if (!drawn.has(name)) others[name] = s;
    if (!Object.keys(parts).length && !Object.keys(others).length) continue;
    const rootSel = c.parts?.root?.sel;
    const ok = rootSel && !/[,{};<]/.test(rootSel);
    out[type] = { label: c.label, root: (ok ? rootSel! : GENERIC_ROOT).replace(/^>\s*/, ""), parts, others };
  }
  return out;
}

/** The lens's field for one setting. */
export function settingSpec(s: BlockSetting, label: string = s.label): FieldSpec {
  const spec: FieldSpec = {
    label,
    input: s.binds ? "record" : s.kind === "text" ? "textarea" : s.kind === "richtext" ? "rich" : s.kind === "string" ? "text" : s.kind,
    inline: s.inline,
  };
  if (s.max) spec.max = s.max;
  if (s.hint) spec.hint = s.hint;
  if (s.options) spec.options = s.options;
  if (s.default !== undefined) spec.default = s.default;
  if (s.range) spec.range = s.range;
  if (s.binds) spec.binds = s.binds;
  return spec;
}

/** The fields of one block as the Fields lens declares them: one per setting, drawn ones first, in part order. */
export function blockSpecs(entry: BlockFieldEntry): Record<string, FieldSpec> {
  const out: Record<string, FieldSpec> = {};
  for (const part of Object.values(entry.parts)) {
    if (own(out, part.prop)) continue;
    out[part.prop] = settingSpec(part);
  }
  for (const s of Object.values(entry.others)) if (!own(out, s.prop)) out[s.prop] = settingSpec(s);
  return out;
}

/** Every setting of a block by name (parts and others). */
export function settingsOf(entry: BlockFieldEntry): Record<string, BlockSetting> {
  const out: Record<string, BlockSetting> = {};
  for (const p of Object.values(entry.parts)) if (!own(out, p.prop)) out[p.prop] = p;
  for (const s of Object.values(entry.others)) if (!own(out, s.prop)) out[s.prop] = s;
  return out;
}

/** "<page slug>:<block id>". A slug has no colon; a block id may. */
export function splitBlockId(id: string): { slug: string; block: string } | null {
  const cut = id.indexOf(":");
  if (cut < 1 || cut === id.length - 1) return null;
  return { slug: id.slice(0, cut), block: id.slice(cut + 1) };
}
