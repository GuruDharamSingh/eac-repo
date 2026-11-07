import { defineBlock, type PropsOf } from "../registry";
import { Region } from "../slot";

// ============================================================================
// Sticky side (2026-11-07): two columns where one stays in view while the
// other scrolls past it. A title or a picture beside a long text, a booking
// box beside a description. Pure CSS (`position: sticky`), so it renders on the
// server and ships nothing. On a narrow screen the columns stack and nothing
// sticks: a pinned column there would cover the text.
// ============================================================================

const props = [
  { name: "side", kind: "slot", label: "The side that stays", description: "Blocks that stay in view while the other column scrolls." },
  { name: "main", kind: "slot", label: "The side that scrolls", description: "The longer column." },
  {
    name: "sideAt",
    kind: "select",
    label: "Staying side",
    default: "start",
    options: [
      { value: "start", label: "Left" },
      { value: "end", label: "Right" },
    ],
  },
  {
    name: "ratio",
    kind: "select",
    label: "Staying side's width",
    default: "third",
    options: [
      { value: "third", label: "A third" },
      { value: "half", label: "Half" },
      { value: "quarter", label: "A quarter" },
    ],
  },
  {
    name: "offset",
    kind: "number",
    label: "Distance from the top",
    description: "Where the staying side stops while scrolling, so it clears a fixed site header.",
    default: 96,
    min: 0,
    max: 400,
    step: 8,
    unit: "px",
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
] as const;

export type StickySplitProps = PropsOf<typeof props>;

export function StickySplit({ side, main, sideAt = "start", ratio = "third", offset = 96, gap = "regular" }: StickySplitProps) {
  const top = Math.max(0, Math.min(400, Number(offset) || 0));
  return (
    // The outer element is the size container; the grid is inside it, because a container query cannot restyle the container itself.
    <div className="blk blk-sticky" data-side={sideAt} data-ratio={ratio} data-gap={gap} style={{ "--sticky-top": `${top}px` } as React.CSSProperties}>
      <div className="blk-sticky-grid">
        <Region of={side} className="blk-sticky-side" />
        <Region of={main} className="blk-sticky-main" />
      </div>
    </div>
  );
}

export const stickySplit = defineBlock(
  {
    id: "sticky-split",
    category: "layout",
    label: "Sticky side",
    description: "Two columns; one stays in view while the other scrolls past. Stacks on a phone. Holds other blocks.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Sticky side", sel: "> .blk-sticky" },
    },
  },
  StickySplit,
  () => ({ sideAt: "start" as const, ratio: "third" as const, offset: 96, gap: "regular" as const }),
);
