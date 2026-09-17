import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// Hero banner.
//
// Lifted from apps/amrit-canada/src/components/hero-banner.tsx, where the
// image URL, the title and the subtitle were module-level constants — the
// owner of that site could not change a word of their own hero without a
// developer and a redeploy. That is the whole argument for a block library in
// one file: the markup was already fine, the CONTENT was welded to it.
//
// The original also hotlinked its image from a news site outside our control,
// with a comment noting it would break if that site changed it. As a prop, the
// fix is now an edit rather than a deploy.
// ============================================================================

const props = [
  {
    name: "title",
    kind: "string",
    label: "Title",
    required: true,
  },
  {
    name: "subtitle",
    kind: "string",
    label: "Subtitle",
    description: "One line under the title. Set in italics.",
  },
  {
    name: "imageUrl",
    kind: "image",
    label: "Background image",
    description: "Fills the banner. Leave empty for a plain coloured band.",
  },
  {
    name: "imageAlt",
    kind: "string",
    label: "Image description",
    description:
      "What the image shows, for screen readers. Leave empty if the image is purely decorative.",
    default: "",
  },
  {
    name: "align",
    kind: "select",
    label: "Text position",
    default: "center",
    options: [
      { value: "center", label: "Centred" },
      { value: "left", label: "Left" },
    ],
  },
] as const;

export type HeroBannerProps = PropsOf<typeof props>;

export function HeroBanner({
  title,
  subtitle,
  imageUrl,
  imageAlt = "",
  align = "center",
}: HeroBannerProps) {
  return (
    <section className="blk blk-hero">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="blk-hero-img"
          src={imageUrl}
          // A decorative image gets an empty alt so a screen reader skips it
          // rather than reading a filename.
          alt={imageAlt}
          {...(imageAlt ? {} : { "aria-hidden": true })}
        />
      )}
      {/* The wash is what keeps the title legible over an arbitrary photo. It
          is drawn even without an image so the band reads the same either
          way. */}
      <div className="blk-hero-wash" />
      <div className="blk-hero-copy" style={{ textAlign: align as "center" | "left" }}>
        <h1 className="blk-hero-title">{title}</h1>
        {subtitle && <p className="blk-hero-sub">{subtitle}</p>}
      </div>
    </section>
  );
}

export const heroBanner = defineBlock(
  {
    id: "hero-banner",
    category: "headers",
    label: "Hero banner",
    description:
      "A full-width image with a title and one line under it. The first thing on a page.",
    props,
    memberSafe: true,
    styling: "tokens",
  },
  HeroBanner,
  () => ({
    title: "The Ambrosial Hours",
    subtitle: "Rise with the sun and crown yourself in sacred time",
  })
);
