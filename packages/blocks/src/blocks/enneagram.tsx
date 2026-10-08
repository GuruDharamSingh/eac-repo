import { defineBlock, type PropsOf } from "../registry";
import { EnneagramView } from "./enneagram.client";
import { CENTRES } from "./enneagram.data";

// ============================================================================
// The enneagram, as an interactive figure.
//
// A remake of hiddenenneagram.com's diagram (apps/hidden-enneagram,
// EnneagramDiagram + CentersDiagram) as one block, so any Puck site can place
// it. The nine points sit on a circle with the head, heart and gut centres as
// coloured arcs around it. Hovering or tapping a point lights it, its centre
// and the two lines that join it, and explains the type beside the figure;
// hovering or tapping a centre lights its three points and explains the
// centre. On first view the figure draws itself: the ring, the triangle, the
// hexagram, then the points.
//
// Split like contact-form: this file is the declaration and stays server-safe,
// ./enneagram.client is the "use client" half. The words default to the
// hidden-enneagram text (./enneagram.data) and every one can be replaced from
// the editor without a deploy.
// ============================================================================

const TYPE_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((v) => ({
  value: v,
  label: `Type ${v}`,
}));

const centreText = (id: string) => CENTRES.find((c) => c.id === id)!.description;

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  {
    name: "intro",
    kind: "text",
    label: "Introduction",
    description: "Shown beside the figure until a point or centre is chosen.",
    default: "Hover over or tap a point to read about each type, or a centre to see how the types group.",
  },
  {
    name: "layout",
    kind: "select",
    label: "Layout",
    default: "side",
    options: [
      { value: "side", label: "Explanation beside the figure" },
      { value: "stacked", label: "Explanation below the figure" },
    ],
  },
  {
    name: "labels",
    kind: "select",
    label: "Point labels",
    default: "numbers",
    options: [
      { value: "numbers", label: "Numbers" },
      { value: "names", label: "Numbers and names" },
    ],
  },
  {
    name: "colourLines",
    kind: "select",
    label: "Coloured lines",
    default: "none",
    options: [
      { value: "none", label: "None — one colour" },
      { value: "369", label: "The 3–6–9 triangle" },
      { value: "hexagram", label: "The inner hexagram" },
      { value: "both", label: "Triangle and hexagram" },
    ],
  },
  {
    name: "showControls",
    kind: "boolean",
    label: "Line group buttons",
    description: "Lets visitors switch the 3-6-9, 1-4-7, 2-5-8 and hexagram lines on and off.",
    default: false,
  },
  {
    name: "startWith",
    kind: "select",
    label: "Open with",
    default: "none",
    options: [
      { value: "none", label: "Nothing chosen" },
      { value: "head", label: "The head centre" },
      { value: "heart", label: "The heart centre" },
      { value: "body", label: "The gut centre" },
      ...TYPE_OPTIONS,
    ],
  },
  {
    name: "animate",
    kind: "boolean",
    label: "Draw in on first view",
    description: "Skipped for visitors who have asked their device for less motion.",
    default: true,
  },
  {
    name: "speed",
    kind: "number",
    label: "Drawing time",
    default: 3,
    min: 1,
    max: 10,
    step: 0.5,
    unit: "s",
  },

  // ── Look ──────────────────────────────────────────────────────────────────
  {
    name: "palette",
    kind: "select",
    label: "Palette",
    default: "dark",
    options: [
      { value: "dark", label: "Dark — the Hidden Enneagram look" },
      { value: "light", label: "Light" },
      { value: "theme", label: "The site's own colours" },
    ],
  },
  {
    name: "font",
    kind: "select",
    label: "Font",
    default: "serif",
    options: [
      { value: "serif", label: "Cormorant Garamond (serif)" },
      { value: "theme", label: "The site's heading font" },
      { value: "sans", label: "Sans-serif" },
    ],
  },
  {
    name: "size",
    kind: "number",
    label: "Width",
    description: "The widest the block grows.",
    default: 960,
    min: 320,
    max: 1400,
    step: 20,
    unit: "px",
  },
  { name: "background", kind: "string", format: "color", label: "Background", default: "" },
  { name: "ink", kind: "string", format: "color", label: "Text and lines", default: "" },
  { name: "headColour", kind: "string", format: "color", label: "Head colour", default: "" },
  { name: "heartColour", kind: "string", format: "color", label: "Heart colour", default: "" },
  { name: "gutColour", kind: "string", format: "color", label: "Gut colour", default: "" },

  // ── Words ─────────────────────────────────────────────────────────────────
  {
    name: "headText",
    kind: "text",
    label: "Head centre",
    default: centreText("head"),
  },
  {
    name: "heartText",
    kind: "text",
    label: "Heart centre",
    default: centreText("heart"),
  },
  {
    name: "gutText",
    kind: "text",
    label: "Gut centre",
    default: centreText("body"),
  },
  {
    name: "types",
    kind: "rows",
    label: "Rewrite a type",
    description: "Blank fields keep the Hidden Enneagram text.",
    addLabel: "Rewrite a type",
    summary: ["type", "name"],
    fields: [
      { name: "type", kind: "select", label: "Type", default: "1", options: TYPE_OPTIONS },
      { name: "name", kind: "string", label: "Name", default: "" },
      { name: "tagline", kind: "string", label: "Tagline", default: "" },
      { name: "description", kind: "text", label: "Explanation", default: "" },
      {
        name: "keywords",
        kind: "string",
        label: "Keywords",
        description: "Comma-separated.",
        default: "",
      },
    ],
  },
] as const;

export type EnneagramProps = PropsOf<typeof props>;

/** The name every consumer uses. The client split is a Next boundary, not an API. */
export const Enneagram = EnneagramView;

export const enneagram = defineBlock(
  {
    id: "enneagram",
    label: "Enneagram",
    category: "content",
    description:
      "The nine points with the head, heart and gut centres. Hover or tap to explain each one; draws itself in.",
    memberSafe: true,
    interactive: true,
    styling: "tokens",
    props,
  },
  Enneagram,
  () => ({
    heading: "The Enneagram",
    layout: "side" as const,
    labels: "numbers" as const,
    palette: "dark" as const,
    animate: true,
    speed: 3,
  })
);
