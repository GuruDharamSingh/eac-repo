import type { CSSProperties } from "react";
import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// An image, with a caption.
//
// A <figure>, not a bare <img>, because a caption that is merely a paragraph
// underneath is not associated with its image for anyone navigating by screen
// reader — <figcaption> is what makes that link.
//
// It also knows how to step out of the way: set "Text flow" to left or right
// and the figure floats, so every block that follows it in the same flowing
// region wraps its lines around the image. That is CSS float doing what it was
// invented for — text reflows as the image is resized or moved, with no
// measuring and no JavaScript. It only works where the surrounding region is
// in NORMAL FLOW, which is what the "Text column" block and the flowing mode
// of "Two columns" exist to provide (a flex container ignores float outright).
//
// `alt` and the caption are separate on purpose, and they are not the same
// sentence: the caption is read by everyone, the alt text describes the image
// to someone who cannot see it. An image whose caption already says everything
// takes an empty alt so it is not announced twice.
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
  { name: "caption", kind: "string", label: "Caption", inlineEditable: true },
  {
    name: "width",
    kind: "select",
    label: "Width",
    default: "measure",
    options: [
      { value: "measure", label: "Text width" },
      { value: "wide", label: "Wider than the text" },
      { value: "full", label: "Full width" },
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
    ],
  },
  {
    name: "float",
    kind: "select",
    label: "Text flow",
    description:
      "Sit the image to one side and let the text that follows wrap around it.",
    default: "none",
    options: [
      { value: "none", label: "On its own line" },
      { value: "left", label: "Left — text wraps to the right" },
      { value: "right", label: "Right — text wraps to the left" },
    ],
  },
  {
    name: "size",
    kind: "number",
    label: "Width",
    description: "Share of the column the image takes when text wraps around it.",
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
      "Slides the image down through the text that follows it, so the first lines run full width. Applies to the square wrap.",
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
] as const;

export type FigureProps = PropsOf<typeof props>;

export function Figure({
  src,
  alt = "",
  caption,
  width = "measure",
  ratio = "auto",
  float = "none",
  size = 40,
  offsetY = 0,
  wrap = "square",
}: FigureProps) {
  // Nothing to show is nothing to draw — an empty frame with a caption under
  // it reads as a broken image rather than an unfinished block.
  if (!src) return null;

  const floated = float === "left" || float === "right";

  // Only what was set: a custom property written as `0px` still overrides the
  // stylesheet's own default, so an untouched figure would lose the small
  // optical offset that lines its top edge up with the first line of text.
  const frame: Record<string, string> = {};
  if (floated) {
    frame["--blk-figure-size"] = `${size}%`;
    if (offsetY > 0) frame["--blk-figure-offset"] = `${offsetY}px`;
    // The silhouette comes from the image's own alpha channel, so a
    // photograph with no transparency yields its full rectangle — which is
    // the square wrap. It degrades rather than breaking.
    if (wrap === "tight") frame["--blk-figure-shape"] = `url("${encodeURI(src)}")`;
  }

  return (
    <figure
      className="blk blk-figure"
      data-width={width}
      data-ratio={ratio}
      // Always present, even as "none", so the stylesheet can say "every child
      // that is NOT floated" — which is how a flowing column spaces its blocks
      // without stamping on a float's own side margin.
      data-float={float}
      data-wrap={wrap}
      // The hook a visual editor grabs to move this. Just an attribute — see
      // BlockDef.manipulate; the block does not know an editor exists.
      {...(floated ? { "data-drag-target": "image" } : {})}
      // The width is a NUMBER a person chose, so it cannot be a class. Sent as
      // a custom property rather than `width:` directly so the stylesheet keeps
      // the final say — on a phone the float is dropped and this is ignored.
      style={floated ? (frame as CSSProperties) : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="blk-figure-img"
        src={src}
        alt={alt}
        loading="lazy"
        {...(alt ? {} : { "aria-hidden": true })}
      />
      {caption && <figcaption className="blk-figure-caption">{caption}</figcaption>}
    </figure>
  );
}

export const figure = defineBlock(
  {
    id: "figure",
    label: "Image",
    category: "content",
    description: "An image with an optional caption.",
    memberSafe: true,
    styling: "tokens",
    // Only meaningful once it is floated; the editor checks that for itself.
    manipulate: { target: "image", place: "float", size: "size", offset: "offsetY" },
    props,
  },
  Figure,
  // A self-contained placeholder rather than a hotlink: a sample is rendered
  // in an editor's palette and in tests, neither of which should depend on a
  // network or on a URL that may rot. The original hero block this library was
  // harvested from hotlinked an image from a news site, with a comment saying
  // it would break when that site changed it — it since did.
  () => ({
    src:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9">' +
          '<rect width="16" height="9" fill="#d8d3c4"/>' +
          '<path d="M0 9l5-4 3 2 3-3 5 5z" fill="#b3ab93"/>' +
          '<circle cx="12" cy="2.5" r="1.2" fill="#c9c0a6"/>' +
          "</svg>"
      ),
    alt: "",
    caption: "A placeholder — choose an image.",
    width: "measure" as const,
    ratio: "auto" as const,
    float: "none" as const,
    size: 40,
    offsetY: 0,
    wrap: "square" as const,
  })
);
