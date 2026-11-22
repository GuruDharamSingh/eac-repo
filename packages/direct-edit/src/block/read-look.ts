// ============================================================================
// One look reader (lane LOOK, 2026-11-20). A block can hold three looks at once: `morph` (a look per part, plus
// tokens), `blkStyle` (Puck's per-block Style panel: a wrapper's spacing, colour, border...), and, on a canvas box,
// `look`. This reads them as one answer and says where two of them set the same CSS property on the block's root.
//
// Read-only and pure: it changes no prop and draws nothing, so it cannot change what any page emits. direct-edit does
// not depend on page-builder, so the function that turns a `blkStyle` value into declarations is passed in.
// ============================================================================

import { hasOwn, ROOT_PART } from "./contract";
import { cleanMorph, type LookSize, type LookState, type MorphParts } from "./morph";
import { lookDecls } from "./patch";
import { cleanStyle, type Decl, type PartStyle } from "./style";

/** Turns a stored `blkStyle` value into the declarations its wrapper carries (CSS property, value). Page-builder's `cleanStyle` + `styleToCss` do; `declsFromStyleObject` adapts their camelCase output. */
export type BlkStyleDecls = (blkStyle: unknown) => Decl[];

export type LookSource = "morph" | "blkStyle" | "look";

export interface PartLookRead {
  /** The block's own declaration lists this part. A stored look on a part the block no longer declares draws nothing. */
  declared: boolean;
  base: PartStyle;
  states: Partial<Record<LookState, PartStyle>>;
  at: Partial<Record<LookSize, PartStyle>>;
}

export interface LookConflict {
  /** The general name when one source writes a shorthand and the other a longhand (`margin` and `margin-left`). */
  prop: string;
  sources: Array<{ source: LookSource; prop: string; value: string }>;
}

export interface LookRead {
  /** Every part with a stored look, as the cleaner would keep it. */
  parts: Record<string, PartLookRead>;
  tokens: Record<string, string>;
  /** Stored part names the block does not declare. */
  undeclared: string[];
  /** What each source writes on the root element. `morph` is the root part's base look plus the tokens. */
  root: Record<LookSource, Decl[]>;
  /** Properties two sources set on the root with different values. Equal values are not listed. */
  conflicts: LookConflict[];
}

/** The longhands a shorthand also sets. */
const SIDES = ["top", "right", "bottom", "left", "inline", "block"];
const COVERS: Record<string, readonly string[]> = {
  margin: SIDES.map((s) => `margin-${s}`),
  padding: SIDES.map((s) => `padding-${s}`),
  border: ["border-top", "border-right", "border-bottom", "border-left", "border-width", "border-style", "border-color"],
  "border-width": SIDES.map((s) => `border-${s}-width`),
  background: ["background-color", "background-image", "background-size", "background-position", "background-repeat"],
  gap: ["row-gap", "column-gap"],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
};
const overlaps = (a: string, b: string): string | null =>
  a === b ? a : COVERS[a]?.includes(b) ? a : COVERS[b]?.includes(a) ? b : null;

/** Adapts a camelCase style object (page-builder's `styleToCss(...).style`) to declarations. A number is a plain number, as React writes it. */
export function declsFromStyleObject(style: Record<string, string | number> | undefined): Decl[] {
  const out: Decl[] = [];
  for (const [k, v] of Object.entries(style ?? {})) {
    out.push([k.startsWith("--") ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), String(v)]);
  }
  return out;
}

const norm = (v: string) => v.replace(/\s+/g, " ").replace(/\s*!important$/i, "").trim().toLowerCase();

export function readLook(
  node: { props?: Record<string, unknown> } | null | undefined,
  def: { parts?: MorphParts } | null | undefined,
  blkStyleDecls?: BlkStyleDecls,
): LookRead {
  const props = node?.props ?? {};
  const declared = def?.parts;
  const morph = props.morph ? cleanMorph(props.morph) : null;

  const parts: Record<string, PartLookRead> = {};
  const undeclared: string[] = [];
  for (const name of Object.keys(morph?.parts ?? {}).sort()) {
    const { states, at, ...base } = morph!.parts![name]!;
    // The root always has a look: a block with no declared root has a generic one.
    const isDeclared = name === ROOT_PART || (!!declared && hasOwn(declared, name));
    if (!isDeclared) undeclared.push(name);
    parts[name] = { declared: isDeclared, base: base as PartStyle, states: states ?? {}, at: at ?? {} };
  }

  const tokens = { ...(morph?.tokens ?? {}) };
  const rootBase = parts[ROOT_PART]?.base;
  const root: Record<LookSource, Decl[]> = {
    morph: [...(rootBase ? lookDecls(rootBase) : []), ...Object.entries(tokens).sort(([a], [b]) => (a < b ? -1 : 1))],
    blkStyle: [],
    look: [],
  };
  if (props.blkStyle && blkStyleDecls) {
    try { root.blkStyle = blkStyleDecls(props.blkStyle); } catch { root.blkStyle = []; }
  }
  const box = props.look ? cleanStyle(props.look) : undefined;
  if (box) root.look = lookDecls(box);

  const byProp = new Map<string, LookConflict>();
  const note = (prop: string, source: LookSource, p: string, value: string) => {
    let c = byProp.get(prop);
    if (!c) byProp.set(prop, (c = { prop, sources: [] }));
    if (!c.sources.some((s) => s.source === source && s.prop === p)) c.sources.push({ source, prop: p, value });
  };
  const live = (["morph", "blkStyle", "look"] as const).filter((s) => root[s].length);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      for (const [pa, va] of root[live[i]!]) {
        for (const [pb, vb] of root[live[j]!]) {
          const prop = overlaps(pa, pb);
          if (!prop || norm(va) === norm(vb)) continue;
          note(prop, live[i]!, pa, va);
          note(prop, live[j]!, pb, vb);
        }
      }
    }
  }
  const conflicts = [...byProp.values()].sort((a, b) => (a.prop < b.prop ? -1 : 1));
  return { parts, tokens, undeclared, root, conflicts };
}
