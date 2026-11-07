// What the editor reads about a sealed block (2026-11-02). Structural:
// @elkdonis/blocks' contractOf() satisfies it, and direct-edit does not depend on
// blocks. Pure and server-safe. Not re-exported from block/index.ts yet.

export type ContractKind = "string" | "text" | "richtext" | "number" | "boolean" | "select" | "list" | "url" | "image" | "slot" | "rows";
export type OptionGroup = "content" | "layout" | "look" | "behaviour";

export interface ContractProp {
  name: string;
  kind: ContractKind;
  label: string;
  description?: string;
  default?: string | number | boolean | readonly string[];
  options?: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  format?: "color";
  binds?: string;
  /** A `rows` prop's fields, one row's worth (2026-11-06): a part's `prop` "steps.title" names one of them. */
  fields?: readonly { name: string; kind: string; label?: string }[];
  group: OptionGroup | null;
}

/** One inner element a page may restyle (stone 2). `sel` grammar: PartDef in `packages/blocks/src/types.ts`. */
export interface ContractPart {
  label: string;
  sel: string;
  repeat?: true;
  draws?: { props?: Record<string, unknown> };
  /** The prop whose words this part draws; "<rows prop>.<field>" for one field of a row, the row being the part's nearest `data-edit-item="<rows prop>:<index>"` mark (2026-11-06). */
  prop?: string;
}

export interface ContractToken {
  name: string;
  label: string;
  type: "color" | "font" | "length";
}

export interface BlockContract {
  id: string;
  label: string;
  description: string;
  dataDriven: boolean;
  interactive: boolean;
  props: readonly ContractProp[];
  sample: Readonly<Record<string, unknown>>;
  /** Absent: the block has only its generic root (GENERIC_ROOT_SEL). */
  parts?: Readonly<Record<string, ContractPart>>;
  tokens?: readonly ContractToken[];
}

export type EditorContract = Readonly<Record<string, BlockContract>>;

/** Lookups by a stored name go through this: a stored type or part called `constructor` must find nothing. Not Object.hasOwn: this package's lib is ES2020. */
export const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
export const contractFor = (c: EditorContract | undefined, type: string): BlockContract | undefined => (c && hasOwn(c, type) ? c[type] : undefined);

/** Panel key of a block's prop: routes the change to node.props, not to the look. */
export const propKey = (name: string) => `p:${name}`;
/** Panel slot id. `panel/panel.ts:590` splits data-pop at its first colon, so a colon in the name is safe. */
export const propSlotId = (name: string) => `p-${name}`;
export const propNameOf = (key: string): string | null => (key.startsWith("p:") ? key.slice(2) : null);
/** Rows the canvas draws for this type that are not in the document. */
export const sampleKeysOf = (c: EditorContract | undefined, type: string): string[] => Object.keys(contractFor(c, type)?.sample ?? {});
/** Whether the sample holds a row. A block may sample an empty list (gallery-grid) and draw its own empty message, so "sample rows" would be false of it. */
export const sampleHasRows = (c: EditorContract | undefined, type: string): boolean => Object.values(contractFor(c, type)?.sample ?? {}).some((v) => Array.isArray(v) && v.length > 0);

// ---------------------------------------------------------------------------
// Stone 2: parts and tokens.
// ---------------------------------------------------------------------------

/** The stored name of a block's outermost part. */
export const ROOT_PART = "root";
/** A block that declares no root: the element right after the marker. */
export const GENERIC_ROOT_SEL = "> :not(template)";
export const PART_NAME = /^[a-z][a-zA-Z0-9]{0,31}$/;

/**
 * A selection on a part: `<nodeId>~p:<part>`, or `<nodeId>~p:<part>:<i>` for the clicked instance of a
 * repeated part. It extends the `~` grammar of inline runs (`<nodeId>~<i>`), which a node id never holds.
 */
export const partRef = (id: string, part: string, i?: number) => `${id}~p:${part}${i === undefined ? "" : `:${i}`}`;
export function parsePartRef(ref: string | null | undefined): { id: string; part: string; i?: number } | null {
  const m = ref ? /^(.*)~p:([a-z][a-zA-Z0-9]*)(?::(\d+))?$/.exec(ref) : null;
  if (!m) return null;
  return m[3] === undefined ? { id: m[1]!, part: m[2]! } : { id: m[1]!, part: m[2]!, i: Number(m[3]) };
}

/** Panel key of a style token on this block: routes the change to morph.tokens. */
export const tokenKey = (name: string) => `t:${name}`;
export const tokenNameOf = (key: string): string | null => (key.startsWith("t:") ? key.slice(2) : null);
/** Panel slot id. `t-blk-accent`, not `t:--blk-accent`, because slot ids also become element ids. */
export const tokenSlotId = (name: string) => `t-${name.replace(/^-+/, "")}`;
