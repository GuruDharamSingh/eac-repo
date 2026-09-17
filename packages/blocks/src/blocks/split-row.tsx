import { defineBlock, type PropsOf } from "../registry";
import { Region } from "../slot";

// ============================================================================
// Split row — the first block that CONTAINS other blocks.
//
// Two things are being proved here at once.
//
// 1. NESTING. `start` and `end` are slot props: regions an author drops other
//    blocks into. Until this existed, a page built from blocks could only ever
//    be a vertical stack, because no block could hold another.
//
// 2. A COLUMN CAN FLOW. Its columns are a flex stack by default, which is the
//    right thing for cards under a heading and the wrong thing for words
//    around an image: a flex container ignores `float` entirely. Set "Inside
//    each column" to flowing and the column becomes a `flow-root`, at which
//    point an image dropped above a paragraph and set to flow left has the
//    paragraph wrap around it. Same mechanism as the "Text column" block,
//    offered here so a two-column layout does not have to nest one.
//
// 3. SIZING IS A PROP. Puck has no drag-handle resize and no grid — its
//    `viewports` control switches the whole canvas width, and component size
//    is left entirely to the host's CSS. So a block is resizable exactly when
//    we DECLARE a prop for it. `ratio` is that prop: a select, which becomes a
//    dropdown in any editor, and which this block's CSS honours.
//
// Written as ordinary React. It has no idea an editor exists: a hand-written
// page passes JSX into `start` and `end`, and an editor adapter passes
// whatever it rendered for those regions. That is the whole point of typing a
// slot as ReactNode rather than as something editor-shaped.
// ============================================================================

const props = [
  {
    name: "start",
    kind: "slot",
    label: "Left column",
    description: "Blocks placed in the first column.",
  },
  {
    name: "end",
    kind: "slot",
    label: "Right column",
    description: "Blocks placed in the second column.",
  },
  {
    name: "ratio",
    kind: "select",
    label: "Column widths",
    description: "How the row divides. Both columns stack on a narrow screen.",
    default: "even",
    options: [
      { value: "even", label: "Even — 50 / 50" },
      { value: "wide-start", label: "Wider left — 2 / 1" },
      { value: "wide-end", label: "Wider right — 1 / 2" },
      { value: "sidebar-start", label: "Left sidebar — 1 / 3" },
      { value: "sidebar-end", label: "Right sidebar — 3 / 1" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Vertical alignment",
    default: "start",
    options: [
      { value: "start", label: "Top" },
      { value: "center", label: "Centred" },
      { value: "stretch", label: "Equal height" },
    ],
  },
  {
    name: "columns",
    kind: "select",
    label: "Inside each column",
    description:
      "Flowing lets an image set to flow left or right have the text below it wrap around.",
    default: "stacked",
    options: [
      { value: "stacked", label: "Stacked — one block under the next" },
      { value: "flowing", label: "Flowing — text wraps around images" },
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
] as const;

export type SplitRowProps = PropsOf<typeof props>;

export function SplitRow({
  start,
  end,
  ratio = "even",
  align = "start",
  gap = "regular",
  columns = "stacked",
}: SplitRowProps) {
  return (
    <div
      className="blk blk-split"
      data-ratio={ratio}
      data-align={align}
      data-gap={gap}
      data-columns={columns}
    >
      {/* No minEmptyHeight: an editor's own default (128px in Puck 0.19.3) is
          taller than anything we would sensibly pick, and overriding it
          downward only makes an empty column harder to drop into. */}
      <Region of={start} className="blk-split-col" />
      <Region of={end} className="blk-split-col" />
    </div>
  );
}

export const splitRow = defineBlock(
  {
    id: "split-row",
    category: "layout",
    label: "Two columns",
    description:
      "A row of two columns that stacks on a narrow screen. Holds other blocks.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  SplitRow,
  () => ({
    ratio: "even" as const,
    align: "start" as const,
    gap: "regular" as const,
    columns: "stacked" as const,
  })
);
