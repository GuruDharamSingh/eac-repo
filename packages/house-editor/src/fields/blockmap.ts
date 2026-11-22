// ============================================================================
// Fields lens, block content: the map (contract C4). Light and pure: type imports only, so the client lens can
// import it. The server doors that use it are in ./blocks.ts.
// ============================================================================

import type { FieldSpec } from "./registry";

/** What fieldMapOf reads of a block's declaration: `contractOf(blocks)` satisfies it. */
export interface BlockMapSource {
  label: string;
  props: readonly { name: string; kind: string; label: string; binds?: string; inlineEditable?: boolean }[];
  parts?: Readonly<Record<string, { label: string; sel: string; prop?: string; repeat?: true }>>;
}

export interface BlockPartField {
  /** The part's selector, as the block declared it (the `>` form means the block's root, then a path). */
  sel: string;
  label: string;
  /** The setting this part draws. */
  prop: string;
  kind: "string" | "text";
  /** The value is drawn verbatim, so it may be typed on the page. */
  inline: boolean;
  max: number;
}

export interface BlockFieldEntry {
  label: string;
  /** The root part's selector without a leading `>` (what the first element after the block's marker must match). */
  root: string;
  parts: Record<string, BlockPartField>;
}

/** Block type -> the parts of it a person may type into. Plain data: it crosses from a server page to the client lens. */
export type BlockFieldMap = Record<string, BlockFieldEntry>;

/** The same default `direct-edit/block/contract.ts` GENERIC_ROOT_SEL gives a block that declares no root. */
const GENERIC_ROOT = ":not(template)";
const LONGEST = { string: 400, text: 4000 } as const;

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Which parts of which blocks can be typed on the page. Plain `string` and `text` settings only, drawn by a part that
 * names them (no `rows.field` parts, no repeated parts), and never a setting filled from a record (`binds`).
 */
export function fieldMapOf(contracts: Readonly<Record<string, BlockMapSource>>): BlockFieldMap {
  const out: BlockFieldMap = {};
  for (const [type, c] of Object.entries(contracts)) {
    if (!c.parts) continue;
    const parts: Record<string, BlockPartField> = {};
    for (const [name, part] of Object.entries(c.parts)) {
      if (!part.prop || part.repeat || part.prop.includes(".")) continue;
      const def = c.props.find((p) => p.name === part.prop);
      if (!def || def.binds || (def.kind !== "string" && def.kind !== "text")) continue;
      parts[name] = { sel: part.sel, label: part.label, prop: def.name, kind: def.kind, inline: def.kind === "string" && def.inlineEditable === true, max: LONGEST[def.kind] };
    }
    if (!Object.keys(parts).length) continue;
    const rootSel = c.parts.root?.sel;
    const ok = rootSel && !/[,{};<]/.test(rootSel);
    out[type] = { label: c.label, root: (ok ? rootSel! : GENERIC_ROOT).replace(/^>\s*/, ""), parts };
  }
  return out;
}

/** The fields of one block as the Fields lens declares them: one per setting, in part order. */
export function blockSpecs(entry: BlockFieldEntry): Record<string, FieldSpec> {
  const out: Record<string, FieldSpec> = {};
  for (const part of Object.values(entry.parts)) {
    if (own(out, part.prop)) continue;
    out[part.prop] = { label: part.label, input: part.kind === "text" ? "textarea" : "text", inline: part.inline, max: part.max };
  }
  return out;
}

/** "<page slug>:<block id>". A slug has no colon; a block id may. */
export function splitBlockId(id: string): { slug: string; block: string } | null {
  const cut = id.indexOf(":");
  if (cut < 1 || cut === id.length - 1) return null;
  return { slug: id.slice(0, cut), block: id.slice(cut + 1) };
}

