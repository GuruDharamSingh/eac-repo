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
//
// A caption can sit UNDER its picture (the default, and what every page saved
// before this option existed keeps) or ON it, as the title of the page the
// picture opens. On the picture it goes inside the link, so the words are as
// clickable as the image. Its colour, weight, font and size are set once for
// the wall; each picture may move its own caption and change its colour,
// because where the words read well depends on what is under them.
// ============================================================================

const POSITIONS = [
  { value: "top-left", label: "Top left" },
  { value: "top", label: "Top" },
  { value: "top-right", label: "Top right" },
  { value: "left", label: "Middle left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Middle right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom", label: "Bottom" },
  { value: "bottom-right", label: "Bottom right" },
] as const;

type Position = (typeof POSITIONS)[number]["value"];
const isPosition = (v: unknown): v is Position => POSITIONS.some((p) => p.value === v);

/** Only a hex colour reaches the page; anything else means "the theme's". */
function hex(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) ? s : undefined;
}

/**
 * Everything about how a wall LOOKS — shared with any block that renders one.
 *
 * Lifted out of `props` so a data-driven wall (profile-gallery, which fills
 * the pictures from a person's gallery rather than from typed rows) declares
 * the SAME presentation controls rather than a second copy that drifts. Two
 * blocks disagreeing about what "caption position" means is precisely the
 * duplication this package exists to end.
 */
export const WALL_PROPS = [
  {
    name: "captionPlace",
    kind: "select",
    label: "Captions",
    default: "below",
    options: [
      { value: "below", label: "Under the picture" },
      { value: "on", label: "On the picture" },
    ],
  },
  {
    name: "captionAt",
    kind: "select",
    label: "Caption position",
    description: "Where captions sit on the pictures. Each picture can override it.",
    default: "bottom-left",
    options: POSITIONS,
  },
  {
    name: "captionWeight",
    kind: "select",
    label: "Caption weight",
    default: "regular",
    options: [
      { value: "regular", label: "Regular" },
      { value: "bold", label: "Bold" },
    ],
  },
  {
    name: "captionFont",
    kind: "select",
    label: "Caption font",
    default: "caption",
    options: [
      { value: "caption", label: "The site's caption font" },
      { value: "title", label: "Heading font" },
      { value: "body", label: "Body font" },
    ],
  },
  {
    name: "captionSize",
    kind: "select",
    label: "Caption size",
    default: "theme",
    options: [
      { value: "theme", label: "The site's caption size" },
      { value: "s", label: "Small" },
      { value: "m", label: "Medium" },
      { value: "l", label: "Large" },
      { value: "xl", label: "Extra large" },
    ],
  },
  {
    name: "captionColor",
    kind: "string",
    format: "color",
    label: "Caption colour",
    description: "Empty: the site's caption colour under a picture, white on one.",
    default: "",
  },
  {
    name: "captionScrim",
    kind: "select",
    label: "Shade behind the caption",
    description:
      "A picture is light in some places and dark in others; a shade keeps the words readable over all of it.",
    default: "soft",
    options: [
      { value: "none", label: "None" },
      { value: "soft", label: "Soft" },
      { value: "strong", label: "Strong" },
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
      {
        name: "at",
        kind: "select",
        label: "Caption position (this picture)",
        description: "Only when captions sit on the pictures.",
        default: "",
        options: [{ value: "", label: "Same as the wall" }, ...POSITIONS],
      },
      {
        name: "color",
        kind: "string",
        format: "color",
        label: "Caption colour (this picture)",
        default: "",
      },
    ],
  },
  ...WALL_PROPS,
] as const;

export type PictureWallProps = PropsOf<typeof props>;

export function PictureWall({
  pictures,
  min = 260,
  shape = "auto",
  gap = "regular",
  captionPlace = "below",
  captionAt = "bottom-left",
  captionWeight = "regular",
  captionFont = "caption",
  captionSize = "theme",
  captionColor = "",
  captionScrim = "soft",
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
      data-caption={captionPlace}
      data-caption-weight={captionWeight}
      data-caption-font={captionFont}
      data-caption-size={captionSize}
      data-scrim={captionScrim}
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
        // Inline, so a colour someone chose beats any site's caption theming;
        // unchosen, the stylesheet (and so the site's theme) decides.
        const ink = hex(picture.color) ?? hex(captionColor);
        const tint = ink ? { color: ink } : undefined;

        if (captionPlace === "on") {
          const at = isPosition(picture.at) ? picture.at : isPosition(captionAt) ? captionAt : "bottom-left";
          const inner = (
            <>
              {image}
              {caption ? (
                <figcaption className="blk-wall-caption" data-at={at} style={tint}>
                  <span className="blk-wall-caption-text">{caption}</span>
                </figcaption>
              ) : null}
            </>
          );
          // The whole figure is the link, so a caption on the picture is as
          // clickable as the picture. A figcaption inside an <a> is valid:
          // <a> takes flow content wherever its parent does.
          return (
            <li className="blk-wall-cell" key={i}>
              {href ? (
                <a className="blk-wall-link" href={href}>
                  <figure className="blk-wall-figure blk-wall-figure--on">{inner}</figure>
                </a>
              ) : (
                <figure className="blk-wall-figure blk-wall-figure--on">{inner}</figure>
              )}
            </li>
          );
        }

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
              {caption ? (
                <figcaption className="blk-wall-caption" style={tint}>
                  {caption}
                </figcaption>
              ) : null}
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
      at: "",
      color: "",
    })),
    min: 260,
    shape: "auto" as const,
    gap: "regular" as const,
    captionPlace: "below" as const,
    captionAt: "bottom-left" as const,
    captionWeight: "regular" as const,
    captionFont: "caption" as const,
    captionSize: "theme" as const,
    captionColor: "",
    captionScrim: "soft" as const,
  })
);
