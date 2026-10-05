import { defineBlock, Region, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// Para Theater's layout and header blocks.
//
// These carry the SHAPE of the current landing page: a full-width band with a
// ground, a hairline and a measure; a photograph banner with a scrim; a serif
// heading with the bronze rule under it. They are site-local and
// Tailwind-styled: sunjay compiles Tailwind and the look is built from its own
// tokens (--card, --border, --primary, bg-header-footer). If a second org wants
// the same band, it moves to @elkdonis/blocks as a `tokens` block.
//
// Class names are written out in full in the lookup tables below. Tailwind
// finds classes by scanning source text, so a class assembled from a prop
// (`py-${n}`) is never generated.
// ============================================================================

// ── band ────────────────────────────────────────────────────────────────────

const bandProps = [
  {
    name: "content",
    kind: "slot",
    label: "Contents",
    description: "Blocks placed in the band. Use “Two columns” inside for a side-by-side row.",
  },
  {
    name: "ground",
    kind: "select",
    label: "Background",
    default: "plain",
    options: [
      { value: "plain", label: "Plain — the page's own ground" },
      { value: "raised", label: "Raised — a slightly lighter tint" },
      { value: "chrome", label: "Chrome — the header and footer colour" },
    ],
  },
  {
    name: "rule",
    kind: "boolean",
    label: "Line along the top edge",
    default: true,
  },
  {
    name: "padding",
    kind: "select",
    label: "Space above and below",
    default: "regular",
    options: [
      { value: "none", label: "None" },
      { value: "small", label: "Small" },
      { value: "regular", label: "Regular" },
      { value: "large", label: "Large" },
    ],
  },
  {
    name: "width",
    kind: "select",
    label: "Width of the contents",
    default: "wide",
    options: [
      { value: "narrow", label: "Narrow — reading width" },
      { value: "standard", label: "Standard" },
      { value: "wide", label: "Wide" },
      { value: "full", label: "Full width" },
    ],
  },
] as const;

export type BandProps = PropsOf<typeof bandProps>;

const GROUND: Record<string, string> = {
  plain: "",
  raised: "bg-card/40",
  chrome: "bg-header-footer",
};
const PADDING: Record<string, string> = {
  none: "py-0",
  small: "py-8",
  regular: "py-14",
  large: "py-20",
};
const WIDTH: Record<string, string> = {
  narrow: "max-w-3xl",
  standard: "max-w-5xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

export function Band({ content, ground = "plain", rule = true, padding = "regular", width = "wide" }: BandProps) {
  return (
    <section
      className={[
        GROUND[ground] ?? "",
        PADDING[padding] ?? PADDING.regular,
        rule ? "border-t border-border/70" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`mx-auto px-5 ${WIDTH[width] ?? WIDTH.wide}`}>
        <Region of={content} />
      </div>
    </section>
  );
}

export const band = defineBlock(
  {
    id: "pt-band",
    category: "layout",
    label: "Band (full-width section)",
    description:
      "A full-width section with its own background, top line, spacing and width. Holds other blocks.",
    memberSafe: true,
    styling: "tailwind",
    props: bandProps,
  },
  Band,
  () => ({ ground: "raised" as const, rule: true, padding: "regular" as const, width: "wide" as const })
);

// ── banner ──────────────────────────────────────────────────────────────────

const bannerProps = [
  { name: "title", kind: "string", label: "Title", default: "", inlineEditable: true },
  { name: "subtitle", kind: "string", label: "Subtitle", default: "", inlineEditable: true },
  { name: "body", kind: "text", label: "Paragraph underneath", default: "", inlineEditable: true },
  { name: "ctaLabel", kind: "string", label: "Button text", default: "" },
  { name: "ctaHref", kind: "url", label: "Button goes to", default: "" },
  {
    name: "imageUrl",
    kind: "image",
    label: "Background photograph",
    description: "Leave empty for a plain band in the header colour.",
  },
  { name: "imageAlt", kind: "string", label: "Photograph description", default: "" },
  {
    name: "scrim",
    kind: "number",
    label: "Darkness over the photograph",
    description:
      "The words are light, and a photograph can be anything, so a wash goes between them. Lower it only for a dark photograph.",
    default: 80,
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
  },
  {
    name: "scrimColor",
    kind: "string",
    format: "color",
    label: "Wash colour",
    description: "Empty is the site's slate.",
    default: "",
  },
  {
    name: "inkColor",
    kind: "string",
    format: "color",
    label: "Title colour",
    description: "Empty is the site's bone white.",
    default: "",
  },
  {
    name: "accentColor",
    kind: "string",
    format: "color",
    label: "Subtitle and button colour",
    description: "Empty is the site's bronze.",
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
  {
    name: "size",
    kind: "select",
    label: "Space around the words",
    default: "regular",
    options: [
      { value: "compact", label: "Compact" },
      { value: "regular", label: "Regular" },
      { value: "tall", label: "Tall" },
    ],
  },
  {
    name: "height",
    kind: "number",
    label: "Height",
    description: "0 sizes the banner to its words. More sets its least height. Also set by dragging the handle under it.",
    default: 0,
    min: 0,
    max: 1200,
    step: 10,
    unit: "px",
  },
] as const;

export type BannerProps = PropsOf<typeof bannerProps>;

const HEX = /^#[0-9a-fA-F]{6}$/;
const color = (value: unknown, fallback: string) =>
  typeof value === "string" && HEX.test(value) ? value : fallback;

const BANNER_SIZE: Record<string, string> = {
  compact: "py-12 sm:py-16",
  regular: "py-20 sm:py-28",
  tall: "py-28 sm:py-40",
};

export function Banner({
  title,
  subtitle,
  body,
  ctaLabel,
  ctaHref,
  imageUrl,
  imageAlt = "",
  scrim = 80,
  scrimColor,
  inkColor,
  accentColor,
  align = "center",
  size = "regular",
  height = 0,
}: BannerProps) {
  const ink = color(inkColor, "#f4f1ea");
  const accent = color(accentColor, "#d9c08a");
  const wash = color(scrimColor, "#2b3033");
  const left = align === "left";

  return (
    <section
      className="relative isolate flex items-center overflow-hidden border-b border-border"
      style={height > 0 ? { minHeight: `${height}px` } : undefined}
    >
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl as string}
            alt={imageAlt as string}
            {...(imageAlt ? {} : { "aria-hidden": true })}
            className="absolute inset-0 -z-10 h-full w-full object-cover"
            fetchPriority="high"
          />
          {/* A scrim, not a tint: the photograph is arbitrary, so the words
              cannot be guaranteed readable against it. The default wash is
              what the contrast ratio was measured on (#f4f1ea on #2b3033 at
              80% = 11.8:1). */}
          <div
            className="absolute inset-0 -z-10"
            style={{ backgroundColor: wash, opacity: Math.min(Math.max(scrim, 0), 100) / 100 }}
            aria-hidden
          />
        </>
      ) : (
        <div className="bg-header-footer absolute inset-0 -z-10" aria-hidden />
      )}

      <div
        className={`mx-auto w-full max-w-5xl px-5 ${BANNER_SIZE[size] ?? BANNER_SIZE.regular} ${left ? "text-left" : "text-center"}`}
      >
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl" style={{ color: ink }}>
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 text-lg italic" style={{ color: accent }}>
            {subtitle}
          </p>
        ) : null}
        {body ? (
          <p
            className={`mt-6 max-w-2xl leading-relaxed ${left ? "" : "mx-auto"}`}
            style={{ color: ink, opacity: 0.85 }}
          >
            {body}
          </p>
        ) : null}
        {ctaLabel && ctaHref ? (
          <a
            href={ctaHref as string}
            className="mt-8 inline-block border px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              color: accent,
              borderColor: `color-mix(in srgb, ${accent} 60%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
            }}
          >
            {ctaLabel}
          </a>
        ) : null}
      </div>
    </section>
  );
}

export const banner = defineBlock(
  {
    id: "pt-banner",
    category: "headers",
    label: "Banner (photograph and words)",
    description:
      "The opening of a page: a photograph under a dark wash, with a title, a subtitle, a paragraph and a button.",
    memberSafe: true,
    styling: "tailwind",
    resize: { height: "height" },
    props: bannerProps,
  },
  Banner,
  () => ({
    title: "Para Theater",
    subtitle: "Rock balancing, qi gong, and conscious creativity",
    body: "",
    scrim: 80,
    align: "center" as const,
    size: "regular" as const,
    height: 0,
  })
);

// ── heading ─────────────────────────────────────────────────────────────────

const headingProps = [
  { name: "text", kind: "string", label: "Heading", default: "", inlineEditable: true },
  {
    name: "level",
    kind: "select",
    label: "Size",
    default: "2",
    options: [
      { value: "1", label: "Page title" },
      { value: "2", label: "Section heading" },
      { value: "3", label: "Subheading" },
    ],
  },
  { name: "rule", kind: "boolean", label: "Bronze line underneath", default: true },
  {
    name: "align",
    kind: "select",
    label: "Position",
    default: "left",
    options: [
      { value: "left", label: "Left" },
      { value: "center", label: "Centred" },
    ],
  },
] as const;

export type HeadingProps = PropsOf<typeof headingProps>;

const HEADING_SIZE: Record<string, string> = {
  "1": "text-4xl",
  "2": "text-2xl",
  "3": "text-xl",
};

export function Heading({ text, level = "2", rule = true, align = "left" }: HeadingProps) {
  const Tag = (`h${level === "1" || level === "3" ? level : "2"}`) as "h1" | "h2" | "h3";
  const center = align === "center";
  return (
    <div className={center ? "text-center" : undefined}>
      <Tag className={`font-serif ${HEADING_SIZE[level] ?? HEADING_SIZE["2"]}`}>{text}</Tag>
      {rule ? <hr className={`saffron-divider max-w-[12rem] ${center ? "mx-auto" : ""}`} /> : null}
    </div>
  );
}

export const heading = defineBlock(
  {
    id: "pt-heading",
    category: "headers",
    label: "Heading",
    description: "A serif heading with the site's bronze line under it.",
    memberSafe: true,
    styling: "tailwind",
    props: headingProps,
  },
  Heading,
  () => ({ text: "A heading", level: "2" as const, rule: true, align: "left" as const })
);

// ── link ────────────────────────────────────────────────────────────────────

const linkProps = [
  { name: "label", kind: "string", label: "Text", default: "" },
  { name: "href", kind: "url", label: "Goes to", default: "" },
  {
    name: "look",
    kind: "select",
    label: "Look",
    default: "text",
    options: [
      { value: "text", label: "Underlined text" },
      { value: "button", label: "Button" },
    ],
  },
] as const;

export type LinkProps = PropsOf<typeof linkProps>;

export function PtLink({ label, href, look = "text" }: LinkProps) {
  if (!label || !href) return null;
  return (
    <a
      href={href as string}
      className={
        look === "button"
          ? "inline-block border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/15 px-5 py-2.5 text-sm font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))]/25"
          : "text-sm font-medium text-[hsl(var(--rust))] underline underline-offset-4"
      }
    >
      {label}
    </a>
  );
}

export const link = defineBlock(
  {
    id: "pt-link",
    category: "actions",
    label: "Link",
    description: "One link, as underlined text or a button.",
    memberSafe: true,
    styling: "tailwind",
    props: linkProps,
  },
  PtLink,
  () => ({ label: "Read more →", href: "/", look: "text" as const })
);
