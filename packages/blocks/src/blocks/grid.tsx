import type { CSSProperties } from "react";
import { defineBlock, type PropsOf } from "../registry";
import { Region } from "../slot";

// ============================================================================
// A grid that holds other blocks.
//
// "Two columns" is a row of two regions; this is ONE region laid out as a
// grid, so anything dropped into it takes the next cell and can be dragged to
// any other — across a row or down a column. Puck reads the axis from the
// region's computed layout, so a CSS grid here is what makes dragging inside
// it two-dimensional; no editor code knows this block exists.
//
// Columns step down by the grid's OWN width (a container query), not the
// screen's: a grid can sit inside a column of "Two columns", where the screen
// is wide and the grid is not.
// ============================================================================

const props = [
  {
    name: "items",
    kind: "slot",
    label: "Cells",
    description: "Blocks placed in the grid, one per cell, filling left to right.",
  },
  {
    name: "columns",
    kind: "select",
    label: "Columns",
    description: "Fewer columns are used automatically when the grid gets narrow.",
    default: "3",
    options: [
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "5", label: "5" },
      { value: "6", label: "6" },
      { value: "auto", label: "Automatic — as many as fit" },
    ],
  },
  {
    name: "minWidth",
    kind: "number",
    label: "Narrowest cell (automatic columns)",
    description: "Only used with Automatic: a cell never gets narrower than this.",
    default: 220,
    min: 120,
    max: 480,
    step: 10,
    unit: "px",
  },
  {
    name: "gap",
    kind: "select",
    label: "Space between cells",
    default: "regular",
    options: [
      { value: "none", label: "None" },
      { value: "tight", label: "Tight" },
      { value: "regular", label: "Regular" },
      { value: "loose", label: "Loose" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Cells in a row",
    default: "stretch",
    options: [
      { value: "stretch", label: "Equal height" },
      { value: "start", label: "Top" },
      { value: "center", label: "Centred" },
    ],
  },
] as const;

export type GridProps = PropsOf<typeof props>;

export function Grid({ items, columns = "3", minWidth = 220, gap = "regular", align = "stretch" }: GridProps) {
  return (
    <div
      className="blk blk-grid"
      data-cols={columns}
      data-gap={gap}
      data-align={align}
      style={{ "--grid-min": `${minWidth}px` } as CSSProperties}
    >
      <Region of={items} className="blk-grid-cells" />
    </div>
  );
}

export const grid = defineBlock(
  {
    id: "grid",
    category: "layout",
    label: "Grid",
    description: "Rows and columns that hold other blocks. Drag blocks in, then drag them between cells.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  Grid,
  () => ({
    columns: "3" as const,
    minWidth: 220,
    gap: "regular" as const,
    align: "stretch" as const,
  })
);
