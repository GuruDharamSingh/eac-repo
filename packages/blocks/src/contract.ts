// ============================================================================
// What a block says about itself, as an editor reads it (2026-11-02). Data
// only: no component, no Puck, no database. Not exported from ./index until a
// host needs it; the direct-edit harness imports this file by path.
// ============================================================================

import type { Block, BlockDef, PartMap, PropDef, TokenDef } from "./types";

export type OptionGroup = "content" | "layout" | "look" | "behaviour";

const CONTENT_KINDS: ReadonlySet<string> = new Set(["string", "text", "richtext", "url", "image", "rows", "list"]);

/** The section an option sits in. A slot is in the tree, not the panel. */
export function groupOf(p: PropDef): OptionGroup | null {
  if (p.kind === "slot") return null;
  if (p.kind === "string" && p.format === "color") return "look";
  return CONTENT_KINDS.has(p.kind) ? "content" : "layout";
}

/** What sample() adds that the block does not declare: rows a resolver would fetch. Drawn in an editor, never stored. */
export function dataOf(def: Pick<BlockDef, "props">, sample: unknown): Record<string, unknown> {
  if (!sample || typeof sample !== "object") return {};
  const declared = new Set(def.props.map((p) => p.name));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(sample as Record<string, unknown>)) if (!declared.has(k)) out[k] = v;
  return out;
}

/** Style tokens every "tokens" block reads (`blocks.css:41-106`). A page sets them on one block's root; the rule that writes them also rewrites what is derived from them (`direct-edit/block/morph.ts`). */
export const BLOCK_TOKENS: readonly TokenDef[] = [
  { name: "--blk-accent", label: "Accent", type: "color" },
  { name: "--blk-fg", label: "Ink", type: "color" },
  { name: "--blk-bg", label: "Ground", type: "color" },
  { name: "--blk-band", label: "Band", type: "color" },
  { name: "--blk-band-fg", label: "Ink on a band", type: "color" },
  { name: "--blk-font-title", label: "Title font", type: "font" },
  { name: "--blk-font-body", label: "Body font", type: "font" },
  { name: "--blk-radius", label: "Corners", type: "length" },
];

export type ContractProp = PropDef & { group: OptionGroup | null };

export interface BlockContract {
  id: string;
  label: string;
  description: string;
  dataDriven: boolean;
  interactive: boolean;
  props: readonly ContractProp[];
  /** From dataOf. Empty for a block with no data of its own. */
  sample: Readonly<Record<string, unknown>>;
  /** What the block declares. Absent: it can be restyled only as a whole, through a generic root. */
  parts?: PartMap;
  /** BLOCK_TOKENS for a "tokens" block, then its own. A Tailwind block has only its own. */
  tokens: readonly TokenDef[];
}

export type BlocksContract = Readonly<Record<string, BlockContract>>;

export function contractOf(blocks: readonly Block<never>[]): BlocksContract {
  const out: Record<string, BlockContract> = {};
  for (const { def, sample } of blocks) {
    let rows: Record<string, unknown> = {};
    // A sample that throws must not take the catalogue with it.
    if (sample) { try { rows = dataOf(def, sample()); } catch { rows = {}; } }
    out[def.id] = {
      id: def.id, label: def.label, description: def.description,
      dataDriven: !!def.dataDriven, interactive: !!def.interactive,
      props: def.props.map((p) => ({ ...p, group: groupOf(p) })),
      sample: rows,
      ...(def.parts ? { parts: def.parts } : {}),
      tokens: [...(def.styling === "tokens" ? BLOCK_TOKENS : []), ...(def.tokens ?? [])],
    };
  }
  return out;
}
