import type { CSSProperties } from "react";
import { defineBlock, type PropsOf } from "../registry";
import { Region } from "../slot";

// ============================================================================
// A grid of whatever you put in it.
//
// The other half of the shape the retiring landing pages repeated: every one
// of those sections was a heading over `repeat(auto-fit, minmax(…, 1fr))`, and
// the only thing that differed between Features and Philosophy was what went
// in the cells. So this is a slot, not a list of hardcoded cards — drop
// feature cards in, or images, or quotes, or another grid.
//
// auto-fit rather than a fixed column count: the author picks how NARROW a
// column may get, and the browser decides how many fit. That is what makes one
// setting work from a phone to a wide screen without a breakpoint anywhere.
// ============================================================================

const props = [
  {
    name: "items",
    kind: "slot",
    label: "Cards",
    description: "Blocks placed in the grid.",
  },
  {
    name: "minWidth",
    kind: "select",
    label: "Narrowest a column may be",
    description: "The browser fits as many columns as this allows.",
    default: "medium",
    options: [
      { value: "small", label: "Small — many columns" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large — few columns" },
    ],
  },
  {
    name: "gap",
    kind: "select",
    label: "Space between",
    default: "regular",
    options: [
      { value: "tight", label: "Tight" },
      { value: "regular", label: "Regular" },
      { value: "loose", label: "Loose" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Card heights",
    default: "stretch",
    options: [
      { value: "stretch", label: "Equal height" },
      { value: "start", label: "Natural height" },
    ],
  },
] as const;

export type CardGridProps = PropsOf<typeof props>;

const MIN_WIDTH = { small: "180px", medium: "240px", large: "320px" } as const;
const GAP = { tight: "0.75rem", regular: "1.25rem", loose: "2.5rem" } as const;

export function CardGrid({ items, minWidth = "medium", gap = "regular", align = "stretch" }: CardGridProps) {
  // The settings ride in as custom properties rather than data attributes,
  // because in an editor this element is the drop zone itself — the editor
  // owns its attributes, and we are a guest on it. A custom property is the
  // one channel that cannot collide with what the editor puts there.
  return (
    <Region
      of={items}
      className="blk blk-grid"
      style={
        {
          "--grid-min": MIN_WIDTH[minWidth as keyof typeof MIN_WIDTH] ?? MIN_WIDTH.medium,
          "--grid-gap": GAP[gap as keyof typeof GAP] ?? GAP.regular,
          "--grid-align": align === "start" ? "start" : "stretch",
        } as CSSProperties
      }
    />
  );
}

export const cardGrid = defineBlock(
  {
    id: "card-grid",
    label: "Grid",
    category: "layout",
    description: "A responsive grid that holds other blocks. Columns fit themselves.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  CardGrid,
  () => ({ minWidth: "medium" as const, gap: "regular" as const, align: "stretch" as const })
);
