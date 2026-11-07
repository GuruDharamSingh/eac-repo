import type { CSSProperties } from "react";
import { defineBlock, Region, type PropsOf } from "@elkdonis/blocks";
import { lookOf, lookProp } from "./looks";

// ============================================================================
// ktp-piece-row: pieces arranged by hand. ONE slot laid out as a CSS grid (so
// Puck drags in two dimensions, as in the shared Grid), accepting only
// ktp-piece. A piece dropped here reads its placement as "in a row of pieces"
// and draws as a card; the columns follow the ROW's own width (auto-fill on a
// minimum card width), so a row in a narrow column steps down by itself.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "" },
  lookProp("Every piece in the row wears it, unless a piece picks its own."),
  { name: "pieces", kind: "slot", label: "Pieces", description: "Drag Piece blocks in; arrange them by dragging.", allow: ["ktp-piece"] },
  { name: "minWidth", kind: "number", label: "Narrowest card", default: 240, min: 160, max: 480, step: 10, unit: "px" },
  { name: "columns", kind: "number", label: "At most this many across", description: "0 = as many as fit.", default: 0, min: 0, max: 6, step: 1 },
  { name: "gap", kind: "number", label: "Space between", default: 24, min: 0, max: 64, step: 2, unit: "px" },
] as const;

export type PieceRowProps = PropsOf<typeof props>;

export function PieceRow({ heading, look, pieces, minWidth = 240, columns = 0, gap = 24 }: PieceRowProps) {
  const title = typeof heading === "string" ? heading.trim() : "";
  return (
    <section
      className="blk ktp-piece-row"
      data-look={lookOf(look) ?? undefined}
      style={{ "--ktp-row-min": `${minWidth}px`, "--ktp-row-gap": `${gap}px`, "--ktp-row-max": columns > 0 ? String(columns) : "99" } as CSSProperties}
    >
      {title ? <h2 className="ktp-works-title ktp-piece-row-title">{title}</h2> : null}
      <Region of={pieces} className="ktp-piece-row-cells" minEmptyHeight={180} />
    </section>
  );
}

export const pieceRow = defineBlock(
  {
    id: "ktp-piece-row",
    label: "Row of pieces",
    category: "layout",
    description: "Arrange Piece blocks by hand. Each piece draws as a card that fits the row.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Row", sel: "> .ktp-piece-row" },
      heading: { label: "Heading", sel: "> .ktp-piece-row > .ktp-piece-row-title", draws: { props: { heading: "Pieces" } } },
    },
  },
  PieceRow,
  () => ({ heading: "", look: "" as const, minWidth: 240, columns: 0, gap: 24 })
);
