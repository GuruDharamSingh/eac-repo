import { defineBlock, type PropsOf } from "../registry";
import { hasText, RichText } from "../text";

// ============================================================================
// Prose — words on a page.
//
// The most conspicuous thing missing from the catalogue: until this existed
// there was no way to put a paragraph anywhere. Every other block was a frame
// around content that had nowhere to come from.
//
// Rich text since 2026-09-25: typed on the page with bold, italic, links,
// lists, subheadings and quotes, stored as HTML and rendered only after
// sanitising — see <RichText> in ../text, shared with the image-and-text
// block so the two cannot drift apart. Bodies typed before then are plain
// text and still render as paragraphs split on blank lines.
// ============================================================================

const props = [
  {
    name: "body",
    kind: "richtext",
    label: "Text",
    description: "Type on the page. Select words for bold, italic, a link or a list.",
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
  if (!hasText(body)) return null;

  return (
    <RichText
      className="blk blk-prose"
      data-size={size}
      data-align={align}
      data-measure={measure ? "on" : "off"}
      body={body}
    />
  );
}

export const prose = defineBlock(
  {
    id: "prose",
    label: "Text",
    category: "content",
    description: "Paragraphs typed on the page, with bold, italic, links, lists and subheadings.",
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
