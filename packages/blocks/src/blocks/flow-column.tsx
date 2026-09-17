import { defineBlock, type PropsOf } from "../registry";
import { Region } from "../slot";

// ============================================================================
// A column whose contents are in NORMAL FLOW — so text wraps around images.
//
// Why this block has to exist at all.
//
// The way a page builder lets someone put an image in a column of text and
// have the text move aside is CSS `float`. There is no second way: a floated
// box is taken out of the line boxes of everything that follows it in the same
// flow, and the browser re-runs that as the image is resized, as the column
// narrows, as a paragraph is added. Nothing has to measure anything.
//
// Float has one hard requirement: the container has to be in normal flow. Our
// other region — the column of "Two columns" — is `display: flex`, and a flex
// container does not float its children at all. It makes each one a flex item
// and drops the float on the ground. So an image dropped into a flex column
// can only ever sit on its own line above the text.
//
// This block is therefore the flowing counterpart: one region, `display:
// flow-root`, into which an author drops an image with "Text flow: left" and
// then the paragraphs that should wrap around it. `flow-root` rather than
// plain `block` so the float is CONTAINED by the column — otherwise a tall
// image hangs out of the bottom and shoves whatever block comes next.
//
// The author's gesture is the ordinary one: drag the image above the text it
// should sit beside, drag it further down to move the wrap further down, and
// set its width. The page reflows because that is what flow does.
// ============================================================================

const props = [
  {
    name: "content",
    kind: "slot",
    label: "Column",
    description:
      "Blocks in a single flowing column. An image set to flow left or right will have the text below it wrap around.",
  },
  {
    name: "width",
    kind: "select",
    label: "Column width",
    default: "measure",
    options: [
      { value: "measure", label: "Reading width" },
      { value: "wide", label: "Wider" },
      { value: "full", label: "Full width" },
    ],
  },
] as const;

export type FlowColumnProps = PropsOf<typeof props>;

export function FlowColumn({ content, width = "measure" }: FlowColumnProps) {
  return (
    <div className="blk blk-flow" data-width={width}>
      {/* No minEmptyHeight: an editor's own default (128px in Puck 0.19.3) is
          taller than anything we would sensibly pick here. */}
      <Region of={content} className="blk-flow-body" />
    </div>
  );
}

export const flowColumn = defineBlock(
  {
    id: "flow-column",
    category: "layout",
    label: "Text column",
    description:
      "A single column where text wraps around any image you set to flow left or right.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  FlowColumn,
  () => ({ width: "measure" as const })
);
