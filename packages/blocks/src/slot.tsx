import { createElement, type ComponentType, type CSSProperties, type ReactNode } from "react";

// ============================================================================
// Rendering a slot, whoever supplied it.
//
// A slot is a region that holds other blocks, and it arrives in one of two
// shapes depending on who is drawing the page:
//
//   a hand-written page passes JSX          → a ReactNode
//   a drag-and-drop editor passes a ZONE    → a function to be rendered
//
// The second is not optional or exotic: an editor's drop region has to be a
// real component so it can register itself, measure itself and accept a drag.
// React cannot render a function as a child — it throws — so something has to
// bridge the two.
//
// Doing that bridging in the EDITOR ADAPTER (call the function, hand the block
// the resulting element) works and was the first thing built. It has a real
// cost though: a drop zone accepts props — `className`, `style`,
// `minEmptyHeight` — and an adapter that calls it with none of them throws all
// of that away. The block is the only thing that knows a column should fill its
// track, or that an empty region still needs somewhere to aim a drag, and under
// that design it had no way to say so.
//
// So the bridge lives here instead, and blocks render their regions through it.
// The adapter then does nothing at all with slots, and a block gains control of
// its own drop zones without importing an editor or knowing one exists.
// ============================================================================

/**
 * What a drop region accepts.
 *
 * Structurally a subset of Puck's `Omit<DropZoneProps, "zone">`, declared here
 * rather than imported: this package has no editor dependency and should not
 * gain one for three optional fields. If they diverge, the editor ignores what
 * it does not recognise, which is the failure we can live with.
 *
 * `allow` and `disallow` USED to be here and are deliberately gone. Puck 0.23
 * moved slot permissions out of the region and into the FIELD, because passing
 * them as props only constrained the canvas and left the outline able to drop
 * anything. The declaration was always the better home anyway — a block says
 * what its region accepts in its own `PropDef.allow`, which `toPuckFields`
 * emits onto the slot field, and one statement then governs every surface.
 */
export interface RegionProps {
  className?: string;
  style?: CSSProperties;
  /**
   * How tall an EMPTY region should be, in pixels.
   *
   * Only set this to make a region TALLER. An earlier version of this comment
   * claimed an empty region collapses to nothing and is impossible to drop
   * into; that is not true of Puck 0.19.3, which defaults the value to 128 and
   * gives an empty zone a dashed outline and a tinted ground. Passing a
   * smaller number therefore shrinks the drop target rather than rescuing it.
   */
  minEmptyHeight?: number;
}

/** An editor-supplied region: a component that draws the drop zone. */
export type SlotRenderer = (props?: RegionProps) => ReactNode;

/** What a slot prop may hold. A bare function is not a valid ReactNode, which
 *  is precisely what makes these two safely distinguishable at runtime. */
export type SlotValue = ReactNode | SlotRenderer;

/**
 * Draw a slot's contents.
 *
 * Both paths produce ONE element carrying the given class, so a block's CSS
 * targets the same thing whether the page is hand-written or edited.
 */
export function Region({
  of,
  className,
  style,
  minEmptyHeight,
}: { of?: SlotValue } & RegionProps) {
  if (typeof of === "function") {
    // createElement, not `of(props)`: calling a component as a plain function
    // would run its hooks against whatever component is currently rendering,
    // which is a subtle way to corrupt hook order. Keep the boundary.
    // A SlotRenderer is declared as returning ReactNode, which React's own
    // component types are narrower than; the cast says "this really is a
    // component", which it is — the editor built it as one.
    const Zone = of as unknown as ComponentType<RegionProps>;

    // Send ONLY what the caller actually specified.
    //
    // An editor merges the props it is given over its own defaults with a
    // plain object spread, and a key whose value is `undefined` is still an
    // own property — so handing over `minEmptyHeight: undefined` REPLACES the
    // editor's own default with nothing, rather than leaving it alone. Same
    // for anything else the editor defaults for itself.
    const zoneProps: RegionProps = {};
    if (className !== undefined) zoneProps.className = className;
    if (style !== undefined) zoneProps.style = style;
    if (minEmptyHeight !== undefined) zoneProps.minEmptyHeight = minEmptyHeight;

    return createElement(Zone, zoneProps);
  }

  return createElement("div", { className, style }, of ?? null);
}
