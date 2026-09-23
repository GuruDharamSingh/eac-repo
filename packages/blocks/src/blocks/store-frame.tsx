import type { CSSProperties } from "react";
import { defineBlock, type PropsOf } from "../registry";
import { Region } from "../slot";

// ============================================================================
// The box a store section sits in — its ground, and the colours of
// everything inside it.
//
// A store panel is a section of SOMEONE ELSE'S page: IFAC's black artist
// page, Dana's violet, an org's cream. Its blocks default to the host's ink,
// which on a host with a dark page and light tokens (IFAC) drew black on
// black. A box with its own ground has to bring its own ink too, so a palette
// here is a MEASURED set — ground, ink, soft ink, accent as a fill and as
// text, the text on that fill — never a free colour picker, which is how
// white-on-light-accent keeps happening. Every pair clears 4.5:1 (see the
// numbers in blocks.css).
//
// The palette redeclares the resolved tokens (--blk-*, --pc-*) directly on
// the box rather than the --eac-block-* inputs: those resolve once, at :root,
// and changing them lower down changes nothing.
//
// A picture ground always carries an overlay, and the overlay decides the
// ink: dark overlay, light words; light overlay, dark words.
// ============================================================================

const props = [
  { name: "content", kind: "slot", label: "Inside the box", description: "Headers, shelves, words — whatever the section holds." },
  {
    name: "palette",
    kind: "select",
    label: "Colours",
    default: "paper",
    options: [
      { value: "inherit", label: "The page's own" },
      { value: "paper", label: "Paper — warm cream, brown ink" },
      { value: "gallery", label: "Gallery — white, black ink" },
      { value: "ink", label: "Ink — near-black, gold accent" },
      { value: "night", label: "Night — indigo gradient, amber accent" },
      { value: "terracotta", label: "Terracotta — fired clay, cream ink" },
      { value: "sage", label: "Sage — pale green, forest ink" },
      { value: "blush", label: "Blush — pale rose, wine ink" },
    ],
  },
  {
    name: "pattern",
    kind: "select",
    label: "Texture",
    default: "none",
    options: [
      { value: "none", label: "None" },
      { value: "dots", label: "Dots" },
      { value: "lines", label: "Fine lines" },
      { value: "grid", label: "Graph paper" },
      { value: "grain", label: "Grain" },
    ],
  },
  { name: "image", kind: "image", label: "Picture behind (optional)", default: "" },
  {
    name: "overlay",
    kind: "select",
    label: "Over the picture",
    description: "Keeps words readable on a picture. Dark gives light words; light gives dark words.",
    default: "dark",
    options: [
      { value: "dark", label: "Dark veil" },
      { value: "light", label: "Light veil" },
    ],
  },
  {
    name: "padding",
    kind: "select",
    label: "Space inside",
    default: "regular",
    options: [
      { value: "tight", label: "Tight" },
      { value: "regular", label: "Regular" },
      { value: "roomy", label: "Roomy" },
    ],
  },
  {
    name: "edge",
    kind: "select",
    label: "Edge",
    default: "soft",
    options: [
      { value: "none", label: "Square, no border" },
      { value: "soft", label: "Rounded" },
      { value: "hairline", label: "Rounded, hairline border" },
      { value: "double", label: "Square, double rule" },
      { value: "gilt", label: "Gilt frame" },
    ],
  },
] as const;

/**
 * The picture's address, made safe to put inside CSS `url("…")`: only an
 * http(s) or site-relative address, with every character that could end the
 * url() or the declaration percent-encoded. Encoded, not refused — the
 * network's media paths have spaces in them ("DANAS FORMAT WEBSITE").
 */
function cssUrl(value: unknown): string {
  if (typeof value !== "string" || !/^(https?:\/\/|\/)/.test(value)) return "";
  return value.replace(/[\s"'()\\<>;{}]/g, (ch) => encodeURIComponent(ch) === ch ? `%${ch.charCodeAt(0).toString(16).padStart(2, "0")}` : encodeURIComponent(ch));
}

export type StoreFrameProps = PropsOf<typeof props>;

export function StoreFrame({
  content,
  palette = "paper",
  pattern = "none",
  image,
  overlay = "dark",
  padding = "regular",
  edge = "soft",
}: StoreFrameProps) {
  const src = cssUrl(image);
  const style = src ? ({ "--frame-image": `url("${src}")` } as CSSProperties) : undefined;
  return (
    <section
      className="blk blk-frame"
      data-palette={src ? `veil-${overlay}` : palette}
      data-pattern={pattern}
      data-padding={padding}
      data-edge={edge}
      data-image={src ? "" : undefined}
      style={style}
    >
      <Region of={content} className="blk-frame-inner" />
    </section>
  );
}

export const storeFrame = defineBlock(
  {
    id: "store-frame",
    category: "layout",
    label: "Store box",
    description: "A box with its own ground — a colour palette, a texture or a picture — that holds a store section's other blocks.",
    props,
    memberSafe: true,
    styling: "tokens",
  },
  StoreFrame,
  () => ({
    palette: "paper" as const,
    pattern: "none" as const,
    overlay: "dark" as const,
    padding: "regular" as const,
    edge: "soft" as const,
  })
);
