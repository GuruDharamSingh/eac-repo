import type { CSSProperties } from "react";
import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A wall of pictures.
//
// `card-grid` already tiles other blocks, and it is the wrong tool for twenty
// paintings: twenty dragged blocks, each configured separately. This takes a
// list of pictures as DATA — add a row, choose an image — which is how someone
// actually fills a gallery page.
//
// The column count is a MINIMUM WIDTH, not a number. Saying "three across"
// gives three across on a phone too; saying "each at least 240px" lets the
// browser fit as many as the space allows and reflow when it changes, which is
// the same reasoning card-grid already uses.
// ============================================================================

const props = [
  {
    name: "pictures",
    kind: "rows",
    label: "Picture",
    addLabel: "Add a picture",
    // The caption first, because that is what an author wrote and will
    // recognise; the description second, for a picture with no caption. Never
    // the image address, which is a long path with the useful part at the end.
    summary: ["caption", "alt"],
    fields: [
      { name: "src", kind: "image", label: "Image" },
      {
        name: "alt",
        kind: "string",
        label: "Description",
        description: "What the picture shows, for anyone who cannot see it.",
        default: "",
      },
      { name: "caption", kind: "string", label: "Caption", default: "" },
      { name: "href", kind: "url", label: "Links to", default: "" },
    ],
  },
  {
    name: "min",
    kind: "number",
    label: "Smallest picture width",
    description: "The browser fits as many across as this allows.",
    default: 260,
    min: 120,
    max: 640,
    step: 10,
    unit: "px",
  },
  {
    name: "shape",
    kind: "select",
    label: "Shape",
    description: "Original keeps each picture's own proportions, ragged edges and all.",
    default: "auto",
    options: [
      { value: "auto", label: "Original" },
      { value: "square", label: "Square" },
      { value: "photo", label: "Photo (4:3)" },
      { value: "portrait", label: "Portrait (3:4)" },
    ],
  },
  {
    name: "gap",
    kind: "select",
    label: "Space between",
    default: "regular",
    options: [
      { value: "tight", label: "Tight" },
      { value: "regular", label: "Regular" },
      { value: "loose", label: "Loose" },
    ],
  },
] as const;

export type PictureWallProps = PropsOf<typeof props>;

export function PictureWall({
  pictures,
  min = 260,
  shape = "auto",
  gap = "regular",
}: PictureWallProps) {
  // A row with no image is one someone has added and not yet filled. It draws
  // nothing rather than a grey box, for the same reason the image block draws
  // nothing without a source: an empty frame reads as broken.
  const shown = (pictures ?? []).filter((p) => String(p.src ?? "").trim());
  if (shown.length === 0) return null;

  return (
    <ul
      className="blk blk-wall"
      data-shape={shape}
      data-gap={gap}
      style={{ "--blk-wall-min": `${min}px` } as CSSProperties}
    >
      {shown.map((picture, i) => {
        const src = String(picture.src);
        const alt = String(picture.alt ?? "");
        const caption = String(picture.caption ?? "").trim();
        const href = String(picture.href ?? "").trim();
        const image = (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="blk-wall-img"
            src={src}
            alt={alt}
            loading="lazy"
            {...(alt ? {} : { "aria-hidden": true })}
          />
        );
        return (
          <li className="blk-wall-cell" key={i}>
            <figure className="blk-wall-figure">
              {href ? (
                <a className="blk-wall-link" href={href}>
                  {image}
                </a>
              ) : (
                image
              )}
              {caption ? <figcaption className="blk-wall-caption">{caption}</figcaption> : null}
            </figure>
          </li>
        );
      })}
    </ul>
  );
}

export const pictureWall = defineBlock(
  {
    id: "picture-wall",
    label: "Picture wall",
    category: "listings",
    description: "A grid of pictures with captions, fitting as many across as the space allows.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  PictureWall,
  () => ({
    pictures: [1, 2, 3].map((n) => ({
      src:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3">` +
            `<rect width="4" height="3" fill="#d8d3c4"/>` +
            `<circle cx="${n}" cy="1.2" r="0.6" fill="#b3ab93"/>` +
            `</svg>`
        ),
      alt: "",
      caption: `Picture ${n}`,
      href: "",
    })),
    min: 260,
    shape: "auto" as const,
    gap: "regular" as const,
  })
);
