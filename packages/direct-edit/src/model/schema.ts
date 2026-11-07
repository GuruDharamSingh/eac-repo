// ============================================================================
// Slot schema: what each part of a block lets a member change, per freedom
// level. Data, not code paths: a host (classifieds today, Puck blocks later)
// declares `PartSchema`s, and the panel shows only the slots a part declares,
// with the values the current level offers.
//
// Freedom is a dial, not a wall (DIRECT_EDITING_PANEL_PLAN Direction 3):
//   0 Family  only what the block's style family allows
//   1 Borrow  values from any family, a few more controls
//   2 Free    anything the server's validator accepts, raw CSS included
// A stored value outside the current level is flagged ("outside"), never
// changed behind the member's back; "Snap to family" removes it on request.
// ============================================================================

export type Freedom = 0 | 1 | 2;
export const FREEDOM_LABEL = ["Family", "Borrow", "Free"] as const;
export const FREEDOM_HINT = [
  "Only what the block's style family allows",
  "Borrow fonts, sizes and colours from other families",
  "Anything, including raw CSS",
] as const;

export type Scalar = string | number | boolean;

/** What a slot offers at one level. */
export interface Allowed {
  /** Discrete choices. */
  list?: readonly Scalar[];
  /** Inclusive numeric range. */
  range?: readonly [number, number];
  step?: number;
}

/** One level's offer: fixed, computed from the host's environment, or hidden (null). */
export type Level<E> = Allowed | null | ((env: E) => Allowed | null);

export type SectionId = "layers" | "content" | "align" | "size" | "layout" | "link" | "text" | "appearance" | "behaviour" | "effects" | "advanced";
export const SECTION_ORDER: readonly SectionId[] = ["layers", "content", "align", "size", "layout", "link", "text", "appearance", "behaviour", "effects", "advanced"];
export const SECTION_TITLE: Record<SectionId, string> = {
  layers: "Layers", content: "Content", align: "Align", size: "Size", layout: "Layout", link: "Link", text: "Text",
  appearance: "Appearance", behaviour: "Behaviour", effects: "Effects", advanced: "Advanced",
};

export type Control =
  | "chips"        // a row of labelled buttons
  | "icons"        // a segmented row of icon buttons (align, direction)
  | "select"       // native select
  | "number"       // numeric field with unit, arrows step, Shift = x10
  | "color"        // swatch + hex, Theme / Custom picker
  | "font"         // searchable font picker
  | "textstyle"    // type-scale presets, "Custom" after edits
  | "sides"        // one value or four (padding)
  | "corners"      // one value or four (radius)
  | "toggle"       // two-state chips (italic)
  | "dim"          // width / height: a number plus a mode menu (Hug / Fixed / Fill)
  | "css-prop"     // one property inside the part's raw `css` override
  | "text"         // one line of text, stored as typed
  | "textarea"     // several lines of text, stored as typed
  | "readout";     // a fact about the value, not a field (`readout` holds the words)

export interface SlotSpec<E = unknown> {
  /** The style key it edits (a key of the host's part style). */
  key: string;
  /** Distinct id when two controls edit one key (e.g. width mode and align). Default: key. */
  id?: string;
  section: SectionId;
  label: string;
  control: Control;
  /** Offers at Family, Borrow, Free. Missing borrow = family's; missing free = borrow's. */
  family?: Level<E>;
  borrow?: Level<E>;
  free?: Level<E>;
  /** Display labels for list values. */
  labels?: Record<string, string>;
  /** Icon glyphs for `icons` controls. */
  icons?: Record<string, string>;
  unit?: string;
  placeholder?: string;
  /** Hard numeric bounds: what the host's server validator accepts. Typed values clamp to these, never to a level's range. */
  bounds?: [number, number];
  /** For css-prop: the CSS property inside the `css` override. */
  prop?: string;
  /** Values of `key` this control maps onto (e.g. width mode: Hug → "start"). */
  map?: Record<string, Scalar>;
  /** Shown only after the section's "+" (or when it holds a value): the default panel stays short. */
  optional?: boolean;
  /** For a `dim` control: the key of its number (the mode menu edits `key`). Its bounds are `bounds`. */
  numKey?: string;
  /**
   * Stored keys this control also writes (a `dim` control writes align-self, w, h, grow):
   * key → the mode a stored value stands for (null = always fine). Lets outside-level
   * checks treat them as covered by the mode menu instead of as unexplained.
   */
  covers?: Record<string, (v: unknown) => string | null>;
  /** A tooltip on the label: what the setting does. */
  hint?: string;
  /** For a `readout` control: the words it shows. */
  readout?: string;
}

export interface PartSchema<E = unknown> {
  label: string;
  slots: SlotSpec<E>[];
  /** The part's words take the small rich-text markup (richtext.ts); `list` allows bullets. */
  rich?: { list?: boolean };
  /** The part may be added with the Text tool (when its words are empty). */
  insertable?: boolean;
}

export interface ResolvedSlot<E = unknown> extends SlotSpec<E> {
  id: string;
  /** null when the slot is hidden at this level. */
  allowed: Allowed | null;
}

function levelValue<E>(spec: SlotSpec<E>, freedom: Freedom): Level<E> | undefined {
  const fam = "family" in spec ? spec.family : {};
  const bor = "borrow" in spec ? spec.borrow : fam;
  const free = "free" in spec ? spec.free : bor;
  return [fam, bor, free][freedom];
}

/** Every slot of a schema with what it offers at `freedom` (hidden ones have allowed = null). */
export function resolveSlots<E>(schema: PartSchema<E>, freedom: Freedom, env: E): ResolvedSlot<E>[] {
  return schema.slots.map((s) => {
    const lv = levelValue(s, freedom);
    const allowed = typeof lv === "function" ? lv(env) : lv === undefined ? {} : lv;
    return { ...s, id: s.id ?? s.key, allowed };
  });
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Does `value` fit what a level allows? Arrays (per-side values) must fit element-wise. */
export function fits(allowed: Allowed | null, value: unknown): boolean {
  if (!allowed) return false;
  if (Array.isArray(value)) return value.every((v) => fits(allowed, v));
  if (allowed.list) {
    return allowed.list.some((x) => x === value || (typeof x === "string" && typeof value === "string" && x.toLowerCase() === value.toLowerCase()) || (typeof x === "number" && typeof value === "number" && near(x, value)));
  }
  if (allowed.range && typeof value === "number") return value >= allowed.range[0] - 1e-9 && value <= allowed.range[1] + 1e-9;
  return true;
}

/**
 * Override keys that the current level does not allow: hidden at this level,
 * or holding a value outside its offer. `value(key)` reads the effective value.
 * Keys no slot declares are reported too (nothing unexplained is kept quietly).
 */
export function outsideKeys<E>(slots: ResolvedSlot<E>[], overrideKeys: string[], value: (key: string) => unknown): string[] {
  const out: string[] = [];
  for (const k of overrideKeys) {
    const visible = slots.filter((s) => s.allowed && (s.key === k || (s.covers && k in s.covers)));
    const v = value(k);
    const ok = (s: ResolvedSlot<E>) => {
      if (s.covers && k in s.covers && s.key !== k) { const m = s.covers[k]!(v); return m === null || fits(s.allowed, m); }
      return s.control === "css-prop" || slotFits(s, v);
    };
    if (!visible.length || !visible.some(ok)) out.push(k);
  }
  return out;
}

/** fits() through a control's value map (e.g. width mode Hug / Fill over align-self). */
export function slotFits(s: ResolvedSlot<any>, v: unknown): boolean {
  if (s.map) return Object.entries(s.map).some(([cv, kv]) => kv === v && fits(s.allowed, cv));
  return fits(s.allowed, v);
}
