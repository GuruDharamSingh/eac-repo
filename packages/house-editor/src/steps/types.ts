// ============================================================================
// The one door: the shapes (contract C2). Pure: no React, no DOM, no database.
// ============================================================================

export interface PageNode {
  type: string;
  props: Record<string, unknown>;
}

/** A Puck document. `zones` is Puck's old zone map; a page that still uses one cannot take structure steps. */
export interface PageDoc {
  root: { props: Record<string, unknown> };
  content: PageNode[];
  zones?: Record<string, PageNode[]>;
}

export type LookState = "hover" | "focus" | "active";
export type LookSize = "sm" | "md";

export type Step =
  | { op: "set_prop"; block: string; prop: string; value: unknown }
  | { op: "set_look"; block: string; part: string; look: Record<string, unknown> | null; state?: LookState; at?: LookSize }
  | { op: "set_token"; block: string; name: string; value: string | null }
  | { op: "insert"; type: string; zone?: string; index?: number; props?: Record<string, unknown> }
  | { op: "move"; block: string; zone?: string; index: number }
  | { op: "duplicate"; block: string }
  | { op: "remove"; block: string };

/** What a step reads of a block's declaration: `contractOf(blocks)` from @elkdonis/blocks/contract satisfies it. */
export interface BlockContractLike {
  label: string;
  props: readonly {
    name: string;
    kind: string;
    label: string;
    binds?: string;
    /** A string setting that holds a hex colour (or nothing). */
    format?: string;
    min?: number;
    max?: number;
    options?: readonly { value: string; label: string }[];
  }[];
  parts?: Readonly<Record<string, { label: string; sel: string; prop?: string }>>;
  tokens: readonly { name: string; label: string; type: string }[];
}

export interface StepContext {
  contracts: Readonly<Record<string, BlockContractLike>>;
  /** The published Puck config (buildPuckConfig's answer). Required for insert, move, duplicate and remove. */
  config?: unknown;
  /**
   * A block type missing from `contracts` is kept untouched and steps ON it are refused. Default false: a page
   * with a block type the door cannot vouch for is refused whole, because the door could not say what its step did to it.
   */
  allowUnknownTypes?: boolean;
}

export type StepSide = "words" | "look" | "structure" | null;

export interface StepResult {
  ok: boolean;
  /** Unchanged (the same object) when !ok. */
  doc: PageDoc;
  side: StepSide;
  /** A stable machine code: "ok", "same", or the reason for a refusal ("unknown_part", "bound_prop", "not_yet", ...). */
  code: string;
  /** Plain words for a person. */
  say: string;
  /** Block ids written or created. */
  touched?: string[];
}

/** The keys that carry a block's look. Content steps never write them; look steps write nothing else (contract C1). */
export const LOOK_PROPS: readonly string[] = ["morph", "look", "blkStyle"];
/** The keys Puck owns on a block. */
export const EDITOR_PROPS: readonly string[] = ["id", "puck", "editMode", "children"];
