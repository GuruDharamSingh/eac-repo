// Types of the parts plugin (2026-11-06). Structural, so that page-builder does
// not depend on @elkdonis/direct-edit or on @elkdonis/blocks' contract module:
// `contractOf(catalogue)` (blocks) and `EditorContract` (direct-edit) satisfy
// PartsContract, and direct-edit's morph helpers satisfy PartLookHelpers.

/** One inner element a page may restyle: `PartDef` in packages/blocks/src/types.ts. */
export interface PartDecl {
  label: string;
  sel: string;
  repeat?: true;
}

/** A custom property a page may set on one block (`TokenDef` in packages/blocks/src/types.ts). */
export interface TokenDecl {
  name: string;
  label: string;
  type: "color" | "font" | "length";
}

/** What one block type declares for the look layer. */
export interface PartsEntry {
  label?: string;
  parts?: Readonly<Record<string, PartDecl>>;
  tokens?: readonly TokenDecl[];
}

/** Per block type, the parts it declares. */
export type PartsContract = Readonly<Record<string, PartsEntry | undefined>>;

type Quad = [number, number, number, number];

/** The keys of direct-edit's `PartStyle` (block/style.ts) that the built-in panel writes. Other stored keys are kept. */
export interface PartLook {
  fill?: string;
  color?: string;
  size?: number;
  weight?: number;
  case?: string;
  tracking?: number;
  padding?: number | Quad;
  radius?: number | Quad;
  bstyle?: string;
  bcolor?: string;
  bwidth?: number;
  opacity?: number;
  hide?: boolean;
  css?: string;
}

/**
 * The morph helpers of `@elkdonis/direct-edit/puck/morph` (block/morph.ts). Passed by
 * the host so the stored shape is the one direct-edit writes and MorphMark draws.
 */
export interface PartLookHelpers {
  partLookOf(props: Record<string, unknown>, part: string): PartLook;
  setPartLook(props: Record<string, unknown>, part: string, look: PartLook): void;
  /** The declarations of a part's CSS box that the stylesheet keeps. */
  partSafeDecls(css: string | undefined): Array<[string, string]>;
}

/** The selected part: a block id and one of its part names. */
export type PartSelection = { id: string; part: string } | null;

/**
 * What an injected look panel is given for the selected part, on every change
 * (direct-edit's `mountLookPanel`, packages/direct-edit/src/puck/look-panel.ts).
 * Writes go through `live` and `commit`, so the panel never touches Puck itself.
 */
export interface PartPanelContext {
  id: string;
  type: string;
  part: string;
  /** The block type's entry in the contract. */
  block: PartsEntry;
  blockLabel: string;
  /** The block's props as stored now. */
  props: Record<string, unknown>;
  /** The block's drawn parts, root first; elements are in the canvas document. */
  parts: Array<{ part: string; label: string; els: HTMLElement[] }>;
  developer: boolean;
  /** A change while typing or dragging: drawn now, recorded when the spell ends. */
  live(edit: (props: Record<string, unknown>) => void): void;
  /** A finished change: recorded as one undo step, together with the spell it ends. */
  commit(edit: (props: Record<string, unknown>) => void): void;
  endSpell(): void;
  /** Ctrl+Z inside a field while typing: puts the spell back unrecorded. False when no spell is open. */
  revert(): boolean;
  /** Another part of this block; null goes back to the block's own settings. */
  select(part: string | null): void;
  /** Outline a part on the canvas while the pointer is over its row; null clears it. */
  hover(part: string | null): void;
}

export interface PartPanelHandle {
  render(ctx: PartPanelContext): void;
  destroy(): void;
}

/** Mounts a look panel into an element of Puck's right column. */
export type PartPanelMount = (el: HTMLElement) => PartPanelHandle;

/**
 * One block handed to a focused editor over Studio (2026-11-06): direct-edit's
 * `openStudioPopup` (packages/direct-edit/src/puck/studio-popup.ts) takes this
 * shape. Plain data and callbacks, so neither package imports the other.
 */
export interface BlockPopupContext {
  id: string;
  type: string;
  /** The block's name. */
  label: string;
  /** The node as stored: the props its resolvers fill are taken out, into `resolved`. */
  node: { type: string; props: Record<string, unknown> & { id: string } };
  /** What Puck's resolvers filled, by node id: this node and every node in its slots. Drawn, never handed back. */
  resolved: Record<string, Record<string, unknown>>;
  /** The page's root props. */
  root: Record<string, unknown>;
  /** The element around the page in the canvas iframe: its classes carry over to the popup's stage. */
  scope: HTMLElement;
  /** The block's width in the canvas, in the page's own pixels. */
  width: number;
  developer: boolean;
  /** The save path's rich-text sanitiser (`sanitizeRichValues`). */
  cleanRich(html: string): string;
  /** "Use on this page": Puck gets the node back as one `replace`, one undo step. */
  use(node: { type: string; props: Record<string, unknown> }): void;
  /** The popup is gone, whichever way it closed. */
  closed(): void;
}

export interface BlockPopupHandle {
  close(): void;
}

/** Opens the focused editor for one block. Mounted outside Puck's React tree, over Studio's window. */
export type BlockPopupOpen = (ctx: BlockPopupContext) => BlockPopupHandle;

export interface PartsPluginOptions {
  contract: PartsContract;
  look: PartLookHelpers;
  /** The label of a block's root part when it declares none. Default "Whole block". */
  rootLabel?: string;
  /** A fuller panel than the built-in one (direct-edit's `mountLookPanel`). */
  panel?: PartPanelMount;
  /**
   * Developer tools: the Code tab of an injected panel and the built-in panel's
   * CSS box. A host sets this only for platform admins. Default false.
   */
  developer?: boolean;
  /**
   * The block popup: "Edit look" in the action bar of a block the contract
   * lists, and a double-click on it (one on a Puck inline field stays Puck's
   * typing). Absent: neither is offered.
   */
  popup?: BlockPopupOpen;
}
