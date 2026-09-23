import type { CSSProperties } from "react";
import { defineBlock, toParagraphs, type PropsOf } from "@elkdonis/blocks";
import { sized, srcSet } from "./media";
import { artworkProp, isForSale, lookup, pick, priceOf, type Bound } from "./artwork-data";

// ============================================================================
// A plate — one picture, centred, with its words underneath.
//
// Her Medicine Buddha page is a column of these: the painting, then two lines
// of title in her orange ("COMPASSIONATE TRANSMISSION / TAKING REFUGE…"),
// then a small centred credit and paragraph; the next plate is a detail, then
// its paragraph. It reads like pages of a catalogue, which is why it is ONE
// block rather than figure + heading + prose placed three times over — an
// author moving a plate moves its words with it.
//
// Text is text nodes, never HTML, like every other block here.
//
// BOUND OR TYPED (see artwork-data.ts): choose an artwork and the picture,
// its description and a title line come from the record, plus a price and an
// enquire link while it is for sale. Every one of those can still be typed by
// hand, and a typed value wins. With nothing chosen it is an ordinary
// picture-and-words block.
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
    name: "width",
    kind: "number",
    label: "Picture width",
    default: 60,
    min: 20,
    max: 100,
    step: 1,
    unit: "%",
  },
  {
    name: "headings",
    kind: "text",
    label: "Title lines",
    description: "One per line, capitals. Empty: the chosen artwork's title, or none.",
    default: "",
  },
  {
    name: "body",
    kind: "text",
    label: "Words underneath",
    description: "A blank line starts a new paragraph.",
    default: "",
  },
  {
    name: "showSale",
    kind: "boolean",
    label: "Price and enquire link",
    description: "Shown only while the chosen artwork is for sale.",
    default: true,
  },
  { name: "linkLabel", kind: "string", label: "Link — words", default: "" },
  { name: "linkHref", kind: "url", label: "Link — goes to", default: "" },
  {
    name: "textSize",
    kind: "select",
    label: "Text size",
    default: "small",
    options: [
      { value: "small", label: "Small (as her old site)" },
      { value: "regular", label: "Regular" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Words",
    default: "center",
    options: [
      { value: "center", label: "Centred" },
      { value: "start", label: "Left" },
    ],
  },
] as const;

export type PlateProps = PropsOf<typeof props> & { bound?: Bound };

export function Plate({
  artwork,
  bound,
  showSale = true,
  src,
  alt,
  width = 60,
  headings,
  body,
  linkLabel,
  linkHref,
  textSize = "small",
  align = "center",
}: PlateProps) {
  const item = lookup(bound, artwork);
  const image = pick(src, item?.image);
  const altText = pick(alt, item?.title);
  const typedLines = String(headings ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const lines = typedLines.length
    ? typedLines
    : item
      ? [[item.title, item.year].filter(Boolean).join(", ")]
      : [];
  const sale = showSale && item && isForSale(item) && item.href ? item : null;
  const paragraphs = toParagraphs(String(body ?? ""));
  const href = String(linkHref ?? "").trim();
  const label = String(linkLabel ?? "").trim();
  if (!image && lines.length === 0 && paragraphs.length === 0) return null;

  const external = /^https?:\/\//.test(href);

  return (
    <section
      className="dm-plate"
      data-size={textSize}
      data-align={align}
      style={{ "--dm-plate-width": `${width}%` } as CSSProperties}
    >
      {image ? (
        <a className="dm-plate-picture" href={image} aria-label={altText ? `${altText} — full size` : "Full size"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sized(image, 1024)}
            srcSet={srcSet(image)}
            sizes="(max-width: 720px) 100vw, 60vw"
            alt={altText}
            loading="lazy"
          />
        </a>
      ) : null}
      {lines.length ? (
        <h2 className="dm-plate-heads">
          {lines.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </h2>
      ) : null}
      {paragraphs.length ? (
        <div className="dm-plate-body">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}
      {sale ? (
        <p className="dm-plate-sale">
          <span>{priceOf(sale)}</span>
          <a className="dm-work-buy" href={sale.href!} target="_blank" rel="noopener noreferrer">
            Enquire / buy<span className="dm-sr"> — {sale.title} (opens in a new tab)</span>
          </a>
        </p>
      ) : null}
      {label && href ? (
        <p className="dm-plate-link">
          <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {label}
          </a>
        </p>
      ) : null}
    </section>
  );
}

export const plate = defineBlock(
  {
    id: "dm-plate",
    label: "Plate (picture + words)",
    category: "content",
    description: "One picture, centred, with title lines and words under it — like a page of a catalogue.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  Plate,
  () => ({
    artwork: "",
    showSale: true,
    src: "",
    alt: "",
    width: 60,
    headings: "A title line",
    body: "A few words about the picture.",
    linkLabel: "",
    linkHref: "",
    textSize: "small" as const,
    align: "center" as const,
  })
);
