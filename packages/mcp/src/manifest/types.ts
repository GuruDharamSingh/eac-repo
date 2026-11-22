/**
 * The block manifest: what an assistant may know about every block (BUILD_SPEC lane MACHINES task 1;
 * shape: docs/open/MANJUSHRI_2026-11-20/manifest.json > block_manifest_example).
 *
 * Plain data, no React, no database. It is built by `buildManifest` (./build.ts) from a catalogue's
 * contracts (`contractOf(blocks)`) and from `docs/open/DEVELOPMENT_APP_2026-11-20/blocks.json`
 * (what a static scan knows about app-local blocks), and checked in as ./blocks.generated.ts by
 * `scripts/build-manifest.mts`. packages/mcp does not depend on @elkdonis/blocks, so the shapes it
 * reads are written out here structurally.
 */

/** Mirrors `BlockRead` in packages/blocks/src/types.ts (contract C5). */
export type BlockRead =
  | { from: 'route'; what: 'record'; kinds?: readonly string[] }
  | { from: 'site'; what: 'org' | 'theme' | 'menu' }
  | { from: 'viewer'; what: 'signed-in' | 'role' | 'membership' }
  | { from: 'record'; via: string; kinds: readonly string[] }
  | { from: 'place'; what: 'placement' }
  | { from: 'flow'; what: string };

/** What a block's setting can be (packages/blocks/src/types.ts, PropKind). */
export type SettingKind = 'string' | 'text' | 'richtext' | 'number' | 'boolean' | 'select' | 'list' | 'url' | 'image' | 'slot' | 'rows';

export interface ManifestSetting {
  name: string;
  kind: SettingKind | string;
  label: string;
  description?: string;
  /** For a `select`: the values it accepts. */
  options?: string[];
  default?: unknown;
  required?: boolean;
  /** For a `number`: the range it is clamped to. */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** For `rows`: the columns of one row. */
  columns?: string[];
  /** The block's own setting that is a record or person reference: the kind of record it names. */
  binds?: string;
  /** True when a page's field can be edited as one plain value: a `string` or `text` setting, not a binding, not a colour. */
  fieldable: boolean;
  /** When this setting is left empty the block shows this field of the record named by `via` (typed text wins). */
  boundFrom?: { via: string; field: string; editable: boolean };
}

export interface ManifestPart {
  name: string;
  label?: string;
  /** The setting this part draws ("<rows setting>.<column>" for one column of a row). */
  setting?: string;
  repeat?: boolean;
}

export interface ManifestBlock {
  id: string;
  label: string;
  /** Plain words: what it is. */
  what: string;
  category: string | null;
  /** `package:blocks`, `package:direct-edit` or `app:<name>`. */
  owner: string;
  source: string | null;
  /** The apps whose catalogues offer it. */
  offeredBy: string[];
  styling: 'tokens' | 'tailwind' | null;
  memberSafe: boolean;
  interactive: boolean;
  dataDriven: boolean;
  settings: ManifestSetting[];
  slots: string[];
  parts: ManifestPart[];
  tokens: string[];
  binds: Array<{ setting: string; kind: string }>;
  opens: { setting: string; grammar: string } | null;
  /** C5: what the block works out for itself. Empty for a block that has not declared any. */
  reads: BlockRead[];
  /** `reads` in plain words, one sentence each. */
  readsPlain: string[];
  /** Whether an assistant may see and change this block, and why: readable unless ./deny.ts names it (policy of 2026-11-20). */
  agent: { read: boolean; why: string };
}

export interface ManifestFile {
  v: 1;
  /** Field ids an editor can name, as `find_fields` returns them (contract C4). */
  fieldPattern: string;
  recordPattern: string;
  blocks: ManifestBlock[];
}

/** What `buildManifest` takes: the structural shape of `contractOf` output and of one blocks.json record. */
export interface ContractProp {
  name: string;
  kind: string;
  label: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  options?: ReadonlyArray<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  fields?: ReadonlyArray<{ name: string }>;
  binds?: string;
  format?: string;
}

export interface ContractLike {
  id: string;
  label: string;
  description: string;
  dataDriven: boolean;
  interactive: boolean;
  props: ReadonlyArray<ContractProp>;
  parts?: Record<string, { label: string; sel?: string; repeat?: true; prop?: string }>;
  tokens: ReadonlyArray<{ name: string }>;
}

export interface DefLike {
  id: string;
  memberSafe: boolean;
  category?: string;
  styling: 'tokens' | 'tailwind';
  reads?: readonly BlockRead[];
}

/** One record of docs/open/DEVELOPMENT_APP_2026-11-20/blocks.json (only the keys the manifest uses). */
export interface CatalogueRecord {
  id: string;
  label?: string;
  description?: string;
  owner: string;
  file?: string;
  category?: string | null;
  styling?: 'tokens' | 'tailwind' | null;
  memberSafe?: boolean;
  interactive?: boolean;
  dataDriven?: boolean;
  props?: Array<{ name: string; kind?: string; label?: string; default?: unknown; required?: boolean; options?: string[]; min?: number; max?: number; step?: number; unit?: string; binds?: string; format?: string; fields?: Array<{ name: string }> }>;
  slots?: string[];
  parts?: string[];
  tokens?: Array<{ name: string }>;
  offeredBy?: string[];
}
