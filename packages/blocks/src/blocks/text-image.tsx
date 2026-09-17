import type { CSSProperties } from "react";
import { defineBlock, type PropsOf } from "../registry";
import { Paragraphs, toParagraphs } from "../text";

// ============================================================================
// Text with an image in it — one block, wrapping guaranteed.
//
// The composable route to the same picture is a "Text column" with an image
// block and a text block dropped into it, and that route is the more powerful
// one: any number of paragraphs, any number of images, moved by dragging.
//
// This block exists because that route has a precondition an author cannot
// see. Float only reaches the text that follows it IN THE SAME FLOW, so
// whether the wrap happens depends on which region the two blocks happen to be
// sitting in — flowing, and it works; flex, and the image silently lands on
// its own line. "Why is it not wrapping" then has an answer about block
// formatting contexts, which is not an answer anyone should need.
//
// Here the image and the words are one block, so the flow is this component's
// own and nothing outside can take the wrap away. It is the thing to reach for
// first; the column is there when one block stops being enough.
//
// Placement is a setting rather than a drag, and the four values are the four
// real answers: beside the text on the left, beside it on the right, above it,
// or below it. Width is a number of percent, which is the honest unit — the
// column it lands in is not a fixed number of pixels wide.
// ============================================================================

const props = [
  { name: "src", kind: "image", label: "Image", required: true },
  {
    name: "alt",
    kind: "string",
    label: "Image description",
    description: "What the image shows. Leave empty if it is purely decorative.",
    default: "",
  },
  {
    name: "body",
    kind: "text",
    label: "Text",
    description: "Leave a blank line between paragraphs.",
    required: true,
  },
  {
    name: "place",
    kind: "select",
    label: "Image position",
    description: "Where the image sits. Beside the text, the text wraps around it.",
    default: "left",
    options: [
      { value: "left", label: "Left — text wraps to the right" },
      { value: "right", label: "Right — text wraps to the left" },
      { value: "above", label: "Above the text" },
      { value: "below", label: "Below the text" },
    ],
  },
  {
    name: "size",
    kind: "number",
    label: "Image width",
    description: "Share of the block's width the image takes.",
    default: 40,
    min: 15,
    max: 100,
    step: 1,
    unit: "%",
  },
  {
    name: "offsetY",
    kind: "number",
    label: "Start lower",
    description:
      "Slides the image down through the text, so the first lines run full width above it. Applies to the square wrap.",
    default: 0,
    min: 0,
    max: 600,
    step: 4,
    unit: "px",
  },
  {
    name: "wrap",
    kind: "select",
    label: "How the text follows it",
    description: "Tight only differs for a cut-out image — one with a transparent background.",
    default: "square",
    options: [
      { value: "square", label: "Square — around the picture's edges" },
      { value: "tight", label: "Tight — around the shape in the picture" },
      { value: "round", label: "Round — around a circle" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Image alignment",
    description: "Only applies when the image is above or below the text.",
    default: "start",
    options: [
      { value: "start", label: "Left" },
      { value: "center", label: "Centred" },
      { value: "end", label: "Right" },
    ],
  },
  {
    name: "ratio",
    kind: "select",
    label: "Shape",
    description: "Crops the image to a shape. Original keeps its own.",
    default: "auto",
    options: [
      { value: "auto", label: "Original" },
      { value: "wide", label: "Wide (16:9)" },
      { value: "photo", label: "Photo (4:3)" },
      { value: "square", label: "Square" },
      { value: "round", label: "Circle" },
    ],
  },
  { name: "caption", kind: "string", label: "Caption", inlineEditable: true },
  {
    name: "gap",
    kind: "select",
    label: "Space around the image",
    default: "regular",
    options: [
      { value: "tight", label: "Tight" },
      { value: "regular", label: "Regular" },
      { value: "loose", label: "Loose" },
    ],
  },
] as const;

export type TextImageProps = PropsOf<typeof props>;

export function TextImage({
  src,
  alt = "",
  body,
  place = "left",
  size = 40,
  offsetY = 0,
  wrap = "square",
  align = "start",
  ratio = "auto",
  caption,
  gap = "regular",
}: TextImageProps) {
  const hasText = toParagraphs(body).length > 0;

  // Half a block is still a block: an image with no words yet is a legitimate
  // half-finished state and should draw. Neither is nothing to draw.
  if (!src && !hasText) return null;

  // Only what was actually set. A custom property written as `0px` still
  // overrides the stylesheet's own default, so an untouched block would lose
  // the small optical offset that lines the image up with the first line.
  const frame: Record<string, string> = { "--blk-textimg-size": `${size}%` };
  if (offsetY > 0) frame["--blk-textimg-offset"] = `${offsetY}px`;
  // The silhouette comes from the image's own alpha channel. A photograph with
  // no transparency yields its full rectangle, which is exactly the square
  // wrap — so this degrades to the default rather than breaking.
  if (wrap === "tight" && src) frame["--blk-textimg-shape"] = `url("${encodeURI(src)}")`;

  const figure = src ? (
    <figure
      className="blk-textimg-figure"
      // The hook a visual editor grabs to move this. Just an attribute: the
      // block does not know what an editor is, and nothing here depends on one
      // existing. See BlockDef.manipulate.
      data-drag-target="image"
      style={frame as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="blk-textimg-img"
        src={src}
        alt={alt}
        loading="lazy"
        {...(alt ? {} : { "aria-hidden": true })}
      />
      {caption && <figcaption className="blk-textimg-caption">{caption}</figcaption>}
    </figure>
  ) : null;

  const text = hasText ? (
    <div className="blk-textimg-body">
      <Paragraphs body={body} />
    </div>
  ) : null;

  // DOM order follows VISUAL order, rather than being fixed with the image
  // first and moved by `column-reverse`. Two reasons, and they point the same
  // way: a float can only push aside what comes AFTER it, so a left or right
  // image has to be first; and someone hearing the page read aloud should meet
  // the caption where they see it, not always before the words.
  return (
    <div
      className="blk blk-textimg"
      data-place={place}
      data-align={align}
      data-ratio={ratio}
      data-gap={gap}
      data-wrap={wrap}
    >
      {place === "below" ? (
        <>
          {text}
          {figure}
        </>
      ) : (
        <>
          {figure}
          {text}
        </>
      )}
    </div>
  );
}

export const textImage = defineBlock(
  {
    id: "text-image",
    label: "Text with an image",
    category: "content",
    description:
      "A paragraph or several with an image beside, above or below them. Text wraps around the image.",
    memberSafe: true,
    styling: "tokens",
    // Position and size are a GESTURE where an editor can offer one. The same
    // three props remain ordinary fields everywhere else.
    manipulate: { target: "image", place: "place", size: "size", offset: "offsetY" },
    props,
  },
  TextImage,
  () => ({
    // The same self-contained placeholder the image block uses: a sample is
    // rendered in an editor's palette and in tests, neither of which should
    // depend on a network or on a URL that may rot.
    src:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5">' +
          '<rect width="4" height="5" fill="#d8d3c4"/>' +
          '<path d="M0 5l1.4-1.8 1 .8 1-1.4L4 5z" fill="#b3ab93"/>' +
          '<circle cx="2.9" cy="1.2" r="0.5" fill="#c9c0a6"/>' +
          "</svg>"
      ),
    alt: "",
    body: "Choose an image and type here. The words move aside to make room for it, and keep moving as you change its width or which side it sits on.\n\nA second paragraph carries on around the image, and closes up underneath once there is no more image to flow past.",
    place: "left" as const,
    size: 40,
    offsetY: 0,
    wrap: "square" as const,
    align: "start" as const,
    ratio: "auto" as const,
    caption: "",
    gap: "regular" as const,
  })
);
