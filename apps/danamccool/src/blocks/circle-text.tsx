import type { CSSProperties } from "react";
import { defineBlock, toParagraphs, type PropsOf } from "@elkdonis/blocks";
import { sized, srcSet } from "./media";
import { artworkProp, isForSale, lookup, pick, priceOf, type Bound } from "./artwork-data";

// ============================================================================
// A picture beside words — her Manifestos page, and the shape her old site
// kept returning to: a circle-cropped painting in one column, a small bold
// heading and its text in the other, sides alternating down the page.
//
// Two COLUMNS, not a wrap. The shared "Text with an image" block floats the
// picture and lets the words run round it; hers keeps the text in its own
// column however long it gets (the 2018 manifesto is three paragraphs beside
// one tall painting). Under 720px the columns stack, picture first.
//
// BOUND OR TYPED (see artwork-data.ts): choose an artwork and its picture and
// description fill in, plus a price and enquire link while it is for sale if
// asked for. Typed values win.
// ============================================================================

const props = [
  artworkProp("Artwork (optional)"),
  {
    name: "src",
    kind: "image",
    label: "Picture",
    description: "Leave empty to use the chosen artwork's picture.",
  },
  {
    name: "alt",
    kind: "string",
    label: "Description",
    description: "What the picture shows, for anyone who cannot see it.",
    default: "",
  },
  {
    name: "side",
    kind: "select",
    label: "Picture on the",
    default: "left",
    options: [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ],
  },
  {
    name: "shape",
    kind: "select",
    label: "Picture shape",
    default: "circle",
    options: [
      { value: "circle", label: "Circle" },
      { value: "original", label: "As it is" },
    ],
  },
  {
    name: "width",
    kind: "number",
    label: "Picture size",
    default: 220,
    min: 100,
    max: 440,
    step: 10,
    unit: "px",
  },
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  {
    name: "body",
    kind: "text",
    label: "Words",
    description: "A blank line starts a new paragraph.",
    default: "",
  },
  {
    name: "showSale",
    kind: "boolean",
    label: "Price and enquire link",
    description: "Shown only while the chosen artwork is for sale.",
    default: false,
  },
] as const;

export type CircleTextProps = PropsOf<typeof props> & { bound?: Bound };

export function CircleText({
  artwork,
  bound,
  src,
  alt,
  side = "left",
  shape = "circle",
  width = 220,
  heading,
  body,
  showSale = false,
}: CircleTextProps) {
  const item = lookup(bound, artwork);
  const image = pick(src, item?.image);
  const altText = pick(alt, item?.title);
  const paragraphs = toParagraphs(String(body ?? ""));
  const title = typeof heading === "string" ? heading.trim() : heading;
  const sale = showSale && item && isForSale(item) && item.href ? item : null;
  if (!image && !title && paragraphs.length === 0) return null;

  return (
    <section
      className="dm-ct"
      data-side={side}
      data-shape={shape}
      style={{ "--dm-ct-w": `${width}px` } as CSSProperties}
    >
      {image ? (
        <div className="dm-ct-picture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sized(image, 512)}
            srcSet={srcSet(image)}
            sizes={`${width}px`}
            alt={altText}
            loading="lazy"
          />
        </div>
      ) : null}
      <div className="dm-ct-words">
        {title ? <h2 className="dm-ct-heading">{title as string}</h2> : null}
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {sale ? (
          <p className="dm-plate-sale" style={{ justifyContent: "flex-start" }}>
            <span>{priceOf(sale)}</span>
            <a className="dm-work-buy" href={sale.href!} target="_blank" rel="noopener noreferrer">
              Enquire / buy<span className="dm-sr"> — {sale.title} (opens in a new tab)</span>
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}

export const circleText = defineBlock(
  {
    id: "dm-circle-text",
    label: "Picture beside words",
    category: "content",
    description:
      "A picture (circle-cropped or as it is) in one column, a heading and words in the other — her Manifestos page.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  CircleText,
  () => ({
    artwork: "",
    src: "",
    alt: "",
    side: "left" as const,
    shape: "circle" as const,
    width: 220,
    heading: "A heading",
    body: "Words beside the picture.",
    showSale: false,
  })
);
