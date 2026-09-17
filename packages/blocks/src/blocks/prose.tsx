import { defineBlock, type PropsOf } from "../registry";
import { Paragraphs, toParagraphs } from "../text";

// ============================================================================
// Prose — words on a page.
//
// The most conspicuous thing missing from the catalogue: until this existed
// there was no way to put a paragraph anywhere. Every other block was a frame
// around content that had nowhere to come from.
//
// Text is split on blank lines into paragraphs and rendered as TEXT NODES,
// never as HTML — see ../text, which is where that rule now lives so that this
// block and the image-and-text block cannot drift apart on it.
// ============================================================================

const props = [
  {
    name: "body",
    kind: "text",
    label: "Text",
    description: "Leave a blank line between paragraphs.",
    required: true,
  },
  {
    name: "size",
    kind: "select",
    label: "Size",
    default: "regular",
    options: [
      { value: "regular", label: "Regular" },
      { value: "large", label: "Large — for an introduction" },
      { value: "small", label: "Small — for a note or caption" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Alignment",
    default: "start",
    options: [
      { value: "start", label: "Left" },
      { value: "center", label: "Centred" },
    ],
  },
  {
    name: "measure",
    kind: "boolean",
    label: "Limit line length",
    description: "Keeps lines near 65 characters, which is easier to read.",
    default: true,
  },
] as const;

export type ProseProps = PropsOf<typeof props>;

export function Prose({ body, size = "regular", align = "start", measure = true }: ProseProps) {
  // Nothing typed is nothing to draw, rather than an empty box with padding.
  if (toParagraphs(body).length === 0) return null;

  return (
    <div className="blk blk-prose" data-size={size} data-align={align} data-measure={measure ? "on" : "off"}>
      <Paragraphs body={body} />
    </div>
  );
}

export const prose = defineBlock(
  {
    id: "prose",
    label: "Text",
    category: "content",
    description: "One or more paragraphs. Blank lines separate them.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  Prose,
  () => ({
    body: "The hours before dawn have been kept apart in every tradition.\n\nWe gather at four, and sit until the light comes.",
    size: "regular" as const,
    align: "start" as const,
    measure: true,
  })
);
