// ============================================================================
// The catalogue.
//
// One list, read by everything. This is the intent `silex-render/components.ts`
// already stated — "three consumers, all reading the same table" — made real
// for React blocks, and with the props typed rather than all-strings.
// ============================================================================

import type { Block, BlockDef, PropDef, PropValue } from "./types";
import type { ComponentType, ReactNode } from "react";

/**
 * Derive a block's props type from its declaration.
 *
 * So an author writes the `PropDef[]` once and the component is typed from it,
 * instead of writing an interface and a parallel array that can disagree. A
 * prop without `required` is optional, because `coerceProps` fills it from
 * `default`.
 */
type Rendered<P extends PropDef> =
  // An inline-editable prop is a ReactNode inside the editor and a string
  // everywhere else, so the component has to accept both — and, being a
  // ReactNode, can only be rendered, never parsed. That is the whole contract.
  P extends { inlineEditable: true } ? string | ReactNode : PropValue<P["kind"]>;

export type PropsOf<D extends readonly PropDef[]> = {
  [P in D[number] as P extends { required: true } ? P["name"] : never]: Rendered<P>;
} & {
  [P in D[number] as P extends { required: true } ? never : P["name"]]?: Rendered<P>;
};

/**
 * Bind a declaration to its component.
 *
 * The `props` array is captured as a const generic so `PropsOf` can read the
 * literal names and kinds out of it — which is what makes the component's
 * props type follow the declaration automatically.
 */
export function defineBlock<const D extends readonly PropDef[], P>(
  def: Omit<BlockDef, "props"> & { props: D },
  Component: ComponentType<P>,
  sample?: () => P
): Block<P> {
  return { def: { ...def, props: [...def.props] }, Component, sample };
}

/**
 * A resolved catalogue.
 *
 * Built by the host rather than being a module-level mutable singleton: an app
 * declares which blocks it offers, the same way a hub declares which tiles are
 * real (`hubCards(caps)`). A shared array with everything baked in would tell
 * an org its unavailable blocks exist — the mistake the hub catalogue's
 * comment already warns about.
 *
 * It also leaves room for the thing that makes a supported-tier site feel
 * custom: `createCatalogue([...shared, ...orgBlocks])`. Bespoke blocks written
 * for one org compose in beside the shared set instead of needing a fork.
 */
export interface Catalogue {
  /** Every block, in declaration order. */
  all: Block<never>[];
  /** Just the declarations — safe to serialise and send to an editor. */
  defs: BlockDef[];
  get(id: string): Block<never> | null;
  /** Only what an untrusted author may place. */
  memberSafe(): Block<never>[];
}

/**
 * Prop names a drag-and-drop editor injects for itself.
 *
 * A block declaring any of these would have its value silently overwritten at
 * render time with no type error anywhere — an editor passes the node's own
 * `id`, an editor-context object, and `children` for a root component. Better
 * to refuse the declaration than to debug the overwrite.
 */
const RESERVED_PROP_NAMES = new Set(["id", "puck", "editMode", "children"]);

export function createCatalogue(blocks: Block<never>[]): Catalogue {
  const byId = new Map<string, Block<never>>();

  for (const block of blocks) {
    for (const prop of block.def.props) {
      if (RESERVED_PROP_NAMES.has(prop.name)) {
        throw new Error(
          `[blocks] ${block.def.id} declares a prop named "${prop.name}", which an editor overwrites with its own value.`
        );
      }
    }

    if (byId.has(block.def.id)) {
      // Two blocks answering to one id means stored page JSON is ambiguous:
      // whichever registered last would silently win, and a page saved today
      // could render as a different block tomorrow. Loud, immediately.
      throw new Error(`[blocks] duplicate block id: ${block.def.id}`);
    }
    if (block.def.dataDriven && !block.sample) {
      // A data-driven block with nothing to preview renders as an empty box
      // in an editor, which reads as "broken" rather than "not configured".
      throw new Error(
        `[blocks] ${block.def.id} is dataDriven and must supply sample()`
      );
    }
    byId.set(block.def.id, block);
  }

  return {
    all: blocks,
    defs: blocks.map((b) => b.def),
    get: (id) => byId.get(id) ?? null,
    memberSafe: () => blocks.filter((b) => b.def.memberSafe),
  };
}
