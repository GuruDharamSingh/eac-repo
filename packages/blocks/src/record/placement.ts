// ============================================================================
// Where a record block sits, and the layout "auto" draws there.
//
// Two inputs, two mechanisms (see docs/reference/record-blocks.md):
//   PROXIMITY  where it sits: a resolver reads page-builder's
//              `metadata.placement` ({ parentType, slot }, from Puck's
//              resolveData `parent`) and maps it to a starting layout with the
//              rules below. Pure and client-safe, so the editor and the
//              published page apply the same rule.
//   WIDTH      how much room it actually has: CSS container queries on the
//              block's frame (RecordFrame -> .blk-rec-frame) refine it in the
//              browser, identically in the canvas and on the page. Those
//              breakpoints belong to the app's own CSS.
// ============================================================================

/** The editing flags Puck (and direct-edit's popup) hand a server block as its `puck` prop. */
export interface PuckEditing {
  isEditing?: boolean;
  boxEditing?: boolean;
}

export type RecordLayout = "card" | "compact" | "row" | "feature";
export type RecordLayoutChoice = RecordLayout | "auto";

/** Where a record sits, as a word CSS can key on (`data-in`): spacing differs by place. */
export type RecordWhere = "page" | "hero" | "column" | "row" | "other";

/** The part of page-builder's `metadata.placement` the rules read. */
export interface PlacementLike {
  parentType: string | null;
  slot: string | null;
}

/** What a resolver stores for the block (under a key that is NOT a prop name, e.g. `placement`). */
export interface ResolvedPlacement {
  layout: RecordLayout;
  /** Why, in words, for the editor-only line ("in a hero's slot"). */
  reason: string;
  /** On the page itself: the block takes the page measure (`data-top`). */
  top?: boolean;
  where: RecordWhere;
}

/**
 * Parent block ids per starting layout. An entry is a block id
 * (`"split-row"`) or a block id and one of its slots (`"split-row:left"`);
 * a slot entry is checked before the plain id, so one slot of a parent can
 * differ from the rest.
 */
export interface PlacementRuleSets {
  /** Parents that hold one featured thing (a hero's slot) -> feature. */
  feature?: readonly string[];
  /** Narrow columns (a record beside words) -> compact. */
  compact?: readonly string[];
  /** Grids of equals -> card. */
  card?: readonly string[];
}

/**
 * The shared layout blocks that hold other blocks: split-row and flow-column
 * (columns), grid and card-grid (equals). No shared block has a feature slot
 * (hero-banner has none), so `feature` is the app's.
 */
export const BASE_RULES = {
  feature: [],
  compact: ["split-row", "flow-column"],
  card: ["grid", "card-grid"],
} as const satisfies Required<PlacementRuleSets>;

const LAYOUTS: ReadonlySet<string> = new Set<RecordLayout>(["card", "compact", "row", "feature"]);

/** A stored layout choice, or "auto" for anything else (missing, empty, unknown). */
export function layoutChoice(v: unknown): RecordLayoutChoice {
  return typeof v === "string" && LAYOUTS.has(v) ? (v as RecordLayout) : "auto";
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Reads `metadata.placement` as handed to a resolver: anything else counts as the page itself. */
function readPlacement(p: unknown): { parent: string | null; slot: string | null } {
  if (!p || typeof p !== "object") return { parent: null, slot: null };
  const { parentType, slot } = p as Record<string, unknown>;
  // "root" too: the page itself (page-builder normalises it; kept for older builds).
  const parent = str(parentType);
  return { parent: parent && parent !== "root" ? parent : null, slot: str(slot) };
}

/**
 * The placement function for one app's record block. The app's own parent
 * ids are ADDED to BASE_RULES. For each parent, a `"type:slot"` entry wins
 * over a plain `"type"` entry; between sets, feature, then compact, then card.
 * `rowLabel` words the reason for a card parent ("in a row of pieces");
 * default "in a row".
 *
 *   const placementOf = placementRules({ feature: ["ktp-quick-landing"], card: ["ktp-piece-row"], rowLabel: "in a row of pieces" });
 *   // resolver:  placement: placementOf(metadata.placement)    (no cast needed)
 */
export function placementRules(rules: PlacementRuleSets & { rowLabel?: string } = {}) {
  const sets = [
    { layout: "feature", where: "hero", reason: "in a hero's slot", ids: new Set<string>([...BASE_RULES.feature, ...(rules.feature ?? [])]) },
    { layout: "compact", where: "column", reason: "in a column", ids: new Set<string>([...BASE_RULES.compact, ...(rules.compact ?? [])]) },
    { layout: "card", where: "row", reason: rules.rowLabel ?? "in a row", ids: new Set<string>([...BASE_RULES.card, ...(rules.card ?? [])]) },
  ] as const;

  return function placementOf(p: PlacementLike | null | undefined | unknown): ResolvedPlacement {
    const { parent, slot } = readPlacement(p);
    if (!parent) return { layout: "card", reason: "on the page itself", top: true, where: "page" };
    const hit = (slot ? sets.find((s) => s.ids.has(`${parent}:${slot}`)) : undefined) ?? sets.find((s) => s.ids.has(parent));
    if (hit) return { layout: hit.layout, reason: hit.reason, where: hit.where };
    return { layout: "card", reason: `inside ${parent}`, where: "other" };
  };
}

/** The layout to draw: a chosen one wins; "auto" (or anything unknown) follows the placement, else card. */
export function effectiveLayout(choice: unknown, placement?: { layout?: RecordLayout } | null): RecordLayout {
  const c = layoutChoice(choice);
  return c !== "auto" ? c : placement?.layout ?? "card";
}

/** The editor-only line: "Auto: feature, in a hero's slot" or "Layout: row". Agrees with effectiveLayout. */
export function describeLayout(choice: unknown, layout: RecordLayout, placement?: { reason?: string } | null): string {
  if (layoutChoice(choice) !== "auto") return `Layout: ${layout}`;
  return `Auto: ${layout}${placement?.reason ? `, ${placement.reason}` : ""}`;
}

/**
 * The `layout` prop a record block declares. Never rename its values: they
 * are stored in page JSON. Returned `as const` so PropsOf sees the name; the
 * value still types as `string` (PropsOf maps every select to string), so
 * read it through layoutChoice / effectiveLayout.
 */
export const layoutProp = (description = "Auto follows where the block sits and how wide it is.") =>
  ({
    name: "layout",
    kind: "select",
    label: "Layout",
    description,
    default: "auto",
    options: [
      { value: "auto", label: "Auto (by placement and width)" },
      { value: "card", label: "Card" },
      { value: "compact", label: "Compact" },
      { value: "row", label: "Row (picture beside words)" },
      { value: "feature", label: "Feature (large)" },
    ],
  }) as const;

/**
 * Which editing surface the block is on, from Puck's `puck` prop.
 *   editing  Puck's canvas (`isEditing`): draw the "why" line.
 *   drawn    any editing surface, the direct-edit "Edit look" popup
 *            (`boxEditing`) included: draw the block, keep it inert, and show
 *            the empty placeholder instead of nothing.
 */
export function editingOf(puck?: PuckEditing | null): { editing: boolean; drawn: boolean } {
  const editing = Boolean(puck?.isEditing);
  return { editing, drawn: editing || Boolean(puck?.boxEditing) };
}
