// ============================================================================
// Which look the panel is editing (lane LIVE, 2026-11-20): "When" (always, on hover, on focus, on press) and
// "Screen" (every size, phones, tablets). One of the two at a time: a state together with a size is not offered, and
// the stored look cannot hold it (`setPartLookAt` refuses). Both panels (the canvas's `tree-editor` and the Puck
// sheet's `look-panel`) read and write through this file, so they behave alike.
//
// Plain words for a site owner: nothing here says "hover" or "media query" to a person except as "On hover".
// Pure except `Forcer`, which writes two attributes on elements in the EDITOR's own document.
// ============================================================================

import { LOOK_SIZES, LOOK_STATES, partLookAt, setPartLookAt, type LookSize, type LookState, type LookWhere } from "../block/morph";
import type { PartStyle } from "../block/style";

export type { LookWhere };

/** What the panel draws: where it is now, and which places already hold a look (they get a small dot). */
export interface PanelWhere {
  now: LookWhere;
  marks: { base: boolean; state: Partial<Record<LookState, boolean>>; at: Partial<Record<LookSize, boolean>> };
}

export const WHEN_LABEL: Record<"" | LookState, string> = { "": "Always", hover: "On hover", focus: "On focus", active: "On press" };
export const SCREEN_LABEL: Record<"" | LookSize, string> = { "": "Every size", sm: "Phones", md: "Tablets" };

type Props = Record<string, unknown>;

/** Which of a part's looks hold something. */
export function whereMarks(props: Props, part: string): PanelWhere["marks"] {
  const has = (w: LookWhere) => Object.keys(partLookAt(props, part, w)).length > 0;
  const state: Partial<Record<LookState, boolean>> = {};
  for (const s of LOOK_STATES) if (has({ state: s })) state[s] = true;
  const at: Partial<Record<LookSize, boolean>> = {};
  for (const a of LOOK_SIZES) if (has({ at: a })) at[a] = true;
  return { base: has({}), state, at };
}

export const panelWhere = (props: Props, part: string, now: LookWhere): PanelWhere => ({ now, marks: whereMarks(props, part) });

/**
 * Where a click on one switch option leads. A state or a size is chosen on its own: picking one drops the other.
 * "Always" and "Every size" drop only their own row, so Phones then "Always" stays on Phones.
 */
export function nextWhere(now: LookWhere, pick: string): LookWhere {
  const [row, value] = pick.split(":") as ["state" | "at", string];
  if (row === "state") {
    if (value && (LOOK_STATES as readonly string[]).includes(value)) return { state: value as LookState };
    return now.at ? { at: now.at } : {};
  }
  if (value && (LOOK_SIZES as readonly string[]).includes(value)) return { at: value as LookSize };
  return now.state ? { state: now.state } : {};
}

/** A where that can be stored: at most one of the two, and a known one. Anything else is the base look. */
export function cleanWhere(w: LookWhere | undefined): LookWhere {
  if (w?.state && !w.at && (LOOK_STATES as readonly string[]).includes(w.state)) return { state: w.state };
  if (w?.at && !w.state && (LOOK_SIZES as readonly string[]).includes(w.at)) return { at: w.at };
  return {};
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? {}));

/** The look the panel shows: a copy of what is stored at `where`. */
export const lookAtWhere = (props: Props, part: string, where: LookWhere): PartStyle => clone(partLookAt(props, part, cleanWhere(where))) as PartStyle;

/** Edit a copy of the look at `where` and store it. With no `where` this is exactly what `setPartLook(partLookOf(...))` did. */
export function editLookAt(props: Props, part: string, where: LookWhere, fn: (s: PartStyle) => void): boolean {
  const w = cleanWhere(where);
  const s = lookAtWhere(props, part, w);
  fn(s);
  return setPartLookAt(props, part, w, s);
}

/** Markup of the two switches. `esc` is the panel's escaper. */
export function whereHtml(w: PanelWhere, esc: (s: unknown) => string): string {
  const dot = (on: boolean | undefined) => (on ? `<i class="de-dot" aria-label="has a look"></i>` : "");
  const btn = (pick: string, label: string, pressed: boolean, marked: boolean | undefined) =>
    `<button type="button" data-where="${esc(pick)}" aria-pressed="${pressed}" data-f="where-${esc(pick.replace(":", "-") || "base")}">${esc(label)}${dot(marked)}</button>`;
  const whenRows: Array<[string, "" | LookState]> = [["state:", ""], ...LOOK_STATES.map((s) => [`state:${s}`, s] as [string, LookState])];
  const screenRows: Array<[string, "" | LookSize]> = [["at:", ""], ...LOOK_SIZES.map((s) => [`at:${s}`, s] as [string, LookSize])];
  const when = whenRows.map(([pick, s]) => btn(pick, WHEN_LABEL[s], (w.now.state ?? "") === s, s ? w.marks.state[s] : w.marks.base)).join("");
  const screen = screenRows.map(([pick, s]) => btn(pick, SCREEN_LABEL[s], (w.now.at ?? "") === s, s ? w.marks.at[s] : w.marks.base)).join("");
  return `<div class="de-where" data-sync="where" role="group" aria-label="Which look">` +
    `<div class="de-where-row"><span class="de-where-label">When</span><div class="de-seg" role="group" aria-label="When">${when}</div></div>` +
    `<div class="de-where-row"><span class="de-where-label">Screen</span><div class="de-seg" role="group" aria-label="Screen">${screen}</div></div>` +
    `</div>`;
}

/**
 * Shows the look being edited, in the editor's own drawing only. A state cannot be seen unless it is happening, so the
 * part's elements carry `data-de-force="hover"`; a size is shown with `data-de-at="sm md"` (phones are also tablets).
 * `morphCss(..., { editor: true })` writes the matching selectors; a public page (`editor: false`) never has them,
 * and neither does a page that is not being edited, because these attributes live only on elements this class marks.
 */
export class Forcer {
  private held = new Set<HTMLElement>();
  apply(els: Array<HTMLElement | null | undefined>, where: LookWhere): void {
    const w = cleanWhere(where);
    const next = new Set(els.filter((e): e is HTMLElement => !!e));
    for (const el of this.held) if (!next.has(el) || (!w.state && !w.at)) this.strip(el);
    if (!w.state && !w.at) { this.held.clear(); return; }
    for (const el of next) {
      if (w.state) el.setAttribute("data-de-force", w.state); else el.removeAttribute("data-de-force");
      if (w.at) el.setAttribute("data-de-at", w.at === "sm" ? "sm md" : "md"); else el.removeAttribute("data-de-at");
    }
    this.held = next;
  }
  clear(): void { for (const el of this.held) this.strip(el); this.held.clear(); }
  private strip(el: HTMLElement) { el.removeAttribute("data-de-force"); el.removeAttribute("data-de-at"); }
}

/**
 * Plain words for the CSS properties two sources can both set at a block's root, and what really happens when both do.
 * Style (`blkStyle`) is inline on a wrapper `div.blk-st` around the block (page-builder style/wrap.tsx); the look is an
 * `!important` rule on the block's own root inside it. Two elements, so only what is INHERITED is decided by the look;
 * the rest stacks (reviewed 2026-11-21): space adds, borders and shadows nest, opacity multiplies, sizes compound, and a
 * background shows from the wrapper wherever the root's is clear.
 */
const PROP_WORDS: Array<[RegExp, string, string]> = [
  [/^(background|background-color|background-image)$/, "the background", "Both draw: the look's background covers the Style's, which shows only where the look's is clear."],
  [/^(color|--blk-fg|--blk-muted|--blk-line)$/, "the text colour", "The look's text colour is the one you see."],
  [/^margin/, "the space outside", "Both add space, so the block gets both."],
  [/^padding/, "the space inside", "Both add space, so the block gets both."],
  [/^border/, "the border", "Both borders draw, one inside the other."],
  [/^(box-shadow)$/, "the shadow", "Both shadows draw, one inside the other."],
  [/^opacity$/, "how see-through it is", "Both fade the block, so they multiply."],
  [/^(width|max-width|min-height|height)$/, "the size", "Both limit the size, one inside the other."],
  [/^gap$|^row-gap$|^column-gap$/, "the gaps", "The look's gaps are the ones you see."],
];
const kindOf = (prop: string) => PROP_WORDS.find(([re]) => re.test(prop));

/**
 * One short note when the block's Style (Puck's panel) and its look set the same thing at the root: names what, then says
 * what happens, by kind of property (see PROP_WORDS: most things stack, only what is inherited is the look's alone).
 * Read-only: it says so, it changes nothing.
 */
export function clashLine(conflicts: ReadonlyArray<{ prop: string; sources: ReadonlyArray<{ source: string }> }> | undefined): string | undefined {
  const both = (conflicts ?? []).filter((c) => c.sources.some((s) => s.source === "morph") && c.sources.some((s) => s.source === "blkStyle"));
  if (!both.length) return undefined;
  const kinds = [...new Map(both.map((c) => kindOf(c.prop) ?? [/./, "a setting", "Both apply, one inside the other."] as [RegExp, string, string]).map((k) => [k[1], k] as const)).values()];
  const what = kinds.map((k) => k[1]);
  const list = what.length === 1 ? what[0]! : `${what.slice(0, -1).join(", ")} and ${what[what.length - 1]}`;
  const says = [...new Set(kinds.map((k) => k[2]))];
  return `Style and this look both change ${list}. ${says.join(" ")}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// The choice survives a remount (review 2026-11-21): Puck remounts the panel when a block's props change, so the choice is
// kept here, per block and part like the open tab (`id~p:part`), and cleared when the selection moves to another part.
const chosen = new Map<string, LookWhere>();
let current: string | null = null;
/** The choice for this selection. A different key than last time means the selection moved: the old choice is dropped. */
export function selectionWhere(key: string): LookWhere {
  if (current !== key) { if (current) chosen.delete(current); current = key; }
  return chosen.get(key) ?? {};
}
export function rememberWhere(key: string, w: LookWhere): void {
  const c = cleanWhere(w);
  if (c.state || c.at) chosen.set(key, c); else chosen.delete(key);
  current = key;
}
