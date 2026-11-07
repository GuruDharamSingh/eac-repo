import type { CSSProperties } from "react";
import { defineBlock, Region, type PropsOf } from "@elkdonis/blocks";
import { sized, srcSet } from "./media";
import { hex, tint } from "./artwork-data";
import "./quick-landing.css";

// ============================================================================
// Quick landing — the hero that leads into the pieces.
//
// One picture, a kicker, a title, a short lede and a button that scrolls to
// the grid (`#pieces` by default — the Artwork grid's Style → anchor). Every
// colour and size a visitor sees is a field here or a site token: nothing is
// hard-coded, so the look can be tuned in the studio without a developer.
//
// The generic Style layer (blkStyle) already covers padding, margin, max
// width, background, border, radius and shadow of the whole block, so those
// are deliberately NOT repeated here. What is here is the hero's own design:
// where the picture sits, its shape, the wash over it, the type sizes.
// ============================================================================

// Generic on the name so PropsOf keeps the literal key (a plain `string`
// name turns the whole props type into a string index signature).
const colour = <N extends string>(name: N, label: string, description: string) =>
  ({ name, kind: "string", format: "color", label, description, default: "" }) as const;

const props = [
  { name: "kicker", kind: "string", label: "Kicker", description: "A short line above the title.", default: "Handmade in small batches", inlineEditable: true },
  { name: "title", kind: "string", label: "Title", default: "Pots for everyday ritual", inlineEditable: true },
  {
    name: "lede",
    kind: "text",
    label: "Lede",
    description: "One or two sentences under the title.",
    default: "Wheel-thrown stoneware and porcelain, fired in a small studio kiln. Each piece is made to be used, and no two come out the same.",
  },
  { name: "image", kind: "image", label: "Picture", description: "A piece, the studio, your hands at the wheel." },
  {
    name: "featureSource",
    kind: "select",
    label: "Beside the words",
    description: "A picture, or a Piece block dropped into the slot (it then draws as a feature card).",
    default: "image",
    options: [
      { value: "image", label: "The picture above" },
      { value: "piece", label: "A piece (drop a Piece block in)" },
    ],
  },
  { name: "feature", kind: "slot", label: "Featured piece", description: "Used when 'Beside the words' is a piece.", allow: ["ktp-piece"] },
  { name: "imageAlt", kind: "string", label: "Picture description", description: "What the picture shows, for screen readers.", default: "" },
  {
    name: "imagePlacement",
    kind: "select",
    label: "Picture placement",
    default: "right",
    options: [
      { value: "right", label: "Beside the words, right" },
      { value: "left", label: "Beside the words, left" },
      { value: "background", label: "Behind the words (full bleed)" },
    ],
  },
  {
    name: "imageShape",
    kind: "select",
    label: "Picture shape",
    description: "Arch rounds the top like a kiln mouth. Ignored when the picture is behind the words.",
    default: "arch",
    options: [
      { value: "square", label: "Square corners" },
      { value: "rounded", label: "Rounded corners" },
      { value: "arch", label: "Arch (rounded top)" },
    ],
  },
  { name: "imageRadius", kind: "number", label: "Picture corner radius", default: 16, min: 0, max: 48, step: 1, unit: "px" },
  {
    name: "align",
    kind: "select",
    label: "Words",
    default: "left",
    options: [
      { value: "left", label: "Left" },
      { value: "center", label: "Centred" },
    ],
  },
  colour("overlayColor", "Wash colour", "The tint over a picture behind the words. Empty = the site's ink."),
  { name: "overlayOpacity", kind: "number", label: "Wash strength", description: "Only when the picture is behind the words.", default: 45, min: 0, max: 90, step: 5, unit: "%" },
  { name: "titleSize", kind: "number", label: "Title size", default: 64, min: 32, max: 120, step: 2, unit: "px" },
  {
    name: "titleStyle",
    kind: "select",
    label: "Title style",
    default: "italic",
    options: [
      { value: "italic", label: "Italic" },
      { value: "upright", label: "Upright" },
    ],
  },
  { name: "ledeSize", kind: "number", label: "Lede size", default: 19, min: 14, max: 28, step: 1, unit: "px" },
  { name: "minHeight", kind: "number", label: "Least height", description: "0 = as tall as its words. Also set by dragging the handle under the block.", default: 560, min: 0, max: 1000, step: 10, unit: "px" },
  { name: "primaryLabel", kind: "string", label: "Button", default: "See the pieces" },
  { name: "primaryHref", kind: "url", label: "Button goes to", description: "#pieces scrolls to the Artwork grid (its Style → anchor).", default: "#pieces" },
  { name: "secondaryLabel", kind: "string", label: "Second link", description: "Leave empty for no second link.", default: "" },
  { name: "secondaryHref", kind: "url", label: "Second link goes to", default: "" },
  {
    name: "ctaStyle",
    kind: "select",
    label: "Button style",
    default: "filled",
    options: [
      { value: "filled", label: "Filled" },
      { value: "outline", label: "Outline" },
    ],
  },
  colour("accent", "Accent", "Button and kicker colour. Empty = the site's accent."),
  colour("ink", "Text colour", "Empty = the site's ink (or its light band ink over a background picture)."),
  colour("ground", "Ground", "The block's own ground. Empty = the page's."),
] as const;

export type QuickLandingProps = PropsOf<typeof props>;

export function QuickLanding({
  kicker,
  title,
  lede,
  image,
  imageAlt = "",
  featureSource = "image",
  feature,
  imagePlacement = "right",
  imageShape = "arch",
  imageRadius = 16,
  align = "left",
  overlayColor,
  overlayOpacity = 45,
  titleSize = 64,
  titleStyle = "italic",
  ledeSize = 19,
  minHeight = 560,
  primaryLabel = "See the pieces",
  primaryHref = "#pieces",
  secondaryLabel = "",
  secondaryHref = "",
  ctaStyle = "filled",
  accent,
  ink,
  ground,
}: QuickLandingProps) {
  const background = imagePlacement === "background";
  const vars: Record<string, string> = {
    "--ktp-hero-title-size": `${titleSize}px`,
    "--ktp-hero-lede-size": `${ledeSize}px`,
    "--ktp-hero-radius": `${imageRadius}px`,
    "--ktp-hero-minh": minHeight > 0 ? `${minHeight}px` : "auto",
    // The wash: the chosen colour at the chosen strength, else the site's ink.
    "--ktp-hero-wash": tint(overlayColor, overlayOpacity) ?? `color-mix(in srgb, var(--blk-fg) ${Math.round(overlayOpacity)}%, transparent)`,
  };
  const a = hex(accent);
  if (a) {
    vars["--blk-accent"] = a;
    // A typed accent is used as ink for the kicker and the outline button, so
    // it is darkened the way blocks.css darkens every accent (60 % with black).
    vars["--blk-accent-ink"] = `color-mix(in srgb, ${a} 60%, black)`;
  }
  const i = hex(ink);
  if (i) vars["--ktp-hero-ink"] = i;
  const g = hex(ground);
  if (g) vars["--ktp-hero-ground"] = g;

  // A Piece in the slot takes the picture's place (beside the words); it is
  // the proximity showcase: the piece reads "in a hero's slot" and features.
  const usePiece = featureSource === "piece";
  const hasImage = !usePiece && typeof image === "string" && image.trim() !== "";
  const picture = hasImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="ktp-hero-img"
      src={sized(image, 1024)}
      srcSet={srcSet(image)}
      sizes={background ? "100vw" : "(max-width: 760px) 100vw, 50vw"}
      alt={imageAlt}
      {...(imageAlt ? {} : { "aria-hidden": true })}
    />
  ) : null;

  return (
    <section
      className="blk ktp-hero"
      data-place={usePiece ? (imagePlacement === "left" ? "left" : "right") : hasImage ? imagePlacement : "none"}
      data-shape={imageShape}
      data-align={align}
      data-title={titleStyle}
      data-cta={ctaStyle}
      data-resize-target="hero"
      style={vars as CSSProperties}
    >
      {background && hasImage ? (
        <>
          {picture}
          <div className="ktp-hero-wash" aria-hidden="true" />
        </>
      ) : null}
      <div className="ktp-hero-inner">
        <div className="ktp-hero-copy">
          {kicker ? <p className="ktp-hero-kicker">{kicker}</p> : null}
          <h1 className="ktp-hero-title">{title}</h1>
          {typeof lede === "string" && lede.trim() ? <p className="ktp-hero-lede">{lede}</p> : null}
          {(primaryLabel && primaryHref) || (secondaryLabel && secondaryHref) ? (
            <p className="ktp-hero-actions">
              {primaryLabel && primaryHref ? (
                <a className="ktp-hero-cta" href={primaryHref}>
                  {primaryLabel}
                </a>
              ) : null}
              {secondaryLabel && secondaryHref ? (
                <a className="ktp-hero-link" href={secondaryHref}>
                  {secondaryLabel}
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
        {!background && hasImage ? <figure className="ktp-hero-figure">{picture}</figure> : null}
        {usePiece ? <Region of={feature} className="ktp-hero-feature" minEmptyHeight={240} /> : null}
      </div>
    </section>
  );
}

export const quickLanding = defineBlock(
  {
    id: "ktp-quick-landing",
    label: "Quick landing",
    category: "headers",
    description: "The front door: a picture, a title, a line or two and a button that leads to the pieces.",
    memberSafe: true,
    styling: "tokens",
    props,
    resize: { height: "minHeight", target: "hero" },
    parts: {
      root: { label: "Hero", sel: "> .ktp-hero" },
      figure: { label: "Picture", sel: "> .ktp-hero .ktp-hero-figure", prop: "image", draws: { props: { image: "/x.jpg", imagePlacement: "right" } } },
      kicker: { label: "Kicker", sel: "> .ktp-hero .ktp-hero-kicker", prop: "kicker", draws: { props: { kicker: "A line" } } },
      title: { label: "Title", sel: "> .ktp-hero .ktp-hero-title", prop: "title" },
      lede: { label: "Lede", sel: "> .ktp-hero .ktp-hero-lede", prop: "lede", draws: { props: { lede: "A line" } } },
      button: { label: "Button", sel: "> .ktp-hero .ktp-hero-cta", prop: "primaryLabel" },
    },
  },
  QuickLanding,
  () => ({
    kicker: "Handmade in small batches",
    title: "Pots for everyday ritual",
    lede: "Wheel-thrown stoneware and porcelain, fired in a small studio kiln. Each piece is made to be used, and no two come out the same.",
    image: "/samples/hero.svg",
    imageAlt: "",
    featureSource: "image" as const,
    imagePlacement: "right" as const,
    imageShape: "arch" as const,
    imageRadius: 16,
    align: "left" as const,
    overlayColor: "",
    overlayOpacity: 45,
    titleSize: 64,
    titleStyle: "italic" as const,
    ledeSize: 19,
    minHeight: 560,
    primaryLabel: "See the pieces",
    primaryHref: "#pieces",
    secondaryLabel: "",
    secondaryHref: "",
    ctaStyle: "filled" as const,
    accent: "",
    ink: "",
    ground: "",
  })
);
