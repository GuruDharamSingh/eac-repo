// ============================================================================
// A contract for EVERY block, built from the block manifest (lane DEV, wave 2).
//
// The one door checks a step against a block's declaration (`BlockContractLike`). Until now the app could
// only build one for the shared blocks it can import on the server (`contractOf`); a block of one site (its
// own file, its own imports) was "not in the catalogue" and its page could not be changed or published from
// here. The manifest (packages/mcp, generated from the shared catalogue and the scan of every app's blocks)
// names all 184 blocks with their settings, kinds, limits, parts and tokens, so every block has a contract.
//
// What the manifest does not carry, and what is done about it:
//   - a token's type and label: read off its name (a font, a length, otherwise a colour; "--blk-font-title" is a
//     font, "--blk-radius" a length). A wrong guess can only make the door stricter or looser about the value's
//     shape; it still refuses anything that is not a hex colour or a short length, and fonts always.
//   - a part's selector: a step does not use it (only the live editor's marks do, and those are built in the
//     browser from the blocks it can load), so it is left empty here.
//   - a select setting's option labels: the door checks values only.
// Pure data, no React, no database. Relative import for the same reason as ./sites-door.ts.
// ============================================================================
import { manifest } from "../../../../packages/mcp/src/manifest/index";
import type { ManifestBlock } from "../../../../packages/mcp/src/manifest/index";
import type { BlockContractLike } from "./sites-door";

export type { ManifestBlock };

export interface SiteContract extends BlockContractLike {
  id: string;
  parts?: Record<string, { label: string; sel: string; prop?: string; repeat?: true }>;
  /** Names of the slots (places that hold other blocks). */
  slots: string[];
}

const LENGTHY = /-(radius|gap|pad|padding|spacing|size|width|height|rounding)$/;

/** "--he-ink-dim" -> "Ink dim". */
const labelOfToken = (name: string): string => {
  const words = name.replace(/^--[a-z0-9]+-/, "").replace(/-/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : name;
};

const typeOfToken = (name: string): "color" | "length" | "font" => (/font/.test(name) ? "font" : LENGTHY.test(name) ? "length" : "color");

export function contractFromManifest(b: ManifestBlock): SiteContract {
  const parts: NonNullable<SiteContract["parts"]> = {};
  for (const p of b.parts) parts[p.name] = { label: p.label ?? p.name, sel: "", ...(p.setting ? { prop: p.setting } : {}), ...(p.repeat ? { repeat: true as const } : {}) };
  return {
    id: b.id,
    label: b.label,
    slots: [...b.slots],
    props: b.settings.map((s) => ({
      name: s.name,
      kind: s.kind,
      label: s.label,
      ...(s.binds ? { binds: s.binds } : {}),
      ...(s.min !== undefined ? { min: s.min } : {}),
      ...(s.max !== undefined ? { max: s.max } : {}),
      ...(s.options ? { options: s.options.map((v) => ({ value: v, label: v })) } : {}),
    })),
    parts,
    tokens: b.tokens.map((name) => ({ name, label: labelOfToken(name), type: typeOfToken(name) })),
  };
}

let cached: Record<string, SiteContract> | null = null;

/** Block id -> contract, for every block in the manifest. */
export function manifestContracts(): Record<string, SiteContract> {
  if (!cached) {
    const out: Record<string, SiteContract> = {};
    for (const b of manifest().file.blocks) out[b.id] = contractFromManifest(b);
    cached = out;
  }
  return cached;
}

/** The manifest's blocks, in id order. */
export function manifestBlocks(): readonly ManifestBlock[] {
  return manifest().file.blocks;
}

/** What a block's own declaration (`contractOf`) says, as far as the door reads it. */
export interface DeclaredLike {
  id: string;
  label: string;
  props: ReadonlyArray<{ name: string; kind: string; label: string; binds?: string; min?: number; max?: number; options?: ReadonlyArray<{ value: string; label: string }> }>;
  parts?: Readonly<Record<string, { label: string; sel: string; prop?: string; repeat?: true }>>;
  tokens: ReadonlyArray<{ name: string; label: string; type: string }>;
}

/**
 * A contract from a block's REAL declaration, trimmed to plain data (no sample rows). Used where this app can import the
 * block (the shared and box blocks): it knows what the manifest's static scan cannot, such as a select's options
 * and a token's real type. The manifest covers every other block.
 */
export function contractFromDeclaration(c: DeclaredLike): SiteContract {
  return {
    id: c.id,
    label: c.label,
    slots: c.props.filter((p) => p.kind === "slot").map((p) => p.name),
    props: c.props.map((p) => ({
      name: p.name,
      kind: p.kind,
      label: p.label,
      ...(p.binds ? { binds: p.binds } : {}),
      ...(p.min !== undefined ? { min: p.min } : {}),
      ...(p.max !== undefined ? { max: p.max } : {}),
      ...(p.options ? { options: p.options.map((o) => ({ value: o.value, label: o.label })) } : {}),
    })),
    parts: Object.fromEntries(Object.entries(c.parts ?? {}).map(([name, p]) => [name, { label: p.label, sel: p.sel, ...(p.prop ? { prop: p.prop } : {}), ...(p.repeat ? { repeat: true as const } : {}) }])),
    tokens: c.tokens.map((t) => ({ name: t.name, label: t.label, type: t.type })),
  };
}
