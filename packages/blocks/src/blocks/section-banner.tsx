import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// Section banner.
//
// Lifted from feed-banner.tsx, which was byte-identical in amrit-canada and
// innergathering — and whose own comment records that it replaced three
// hand-written copies inside one app. So this markup has now been written five
// times. Its third life is here.
//
// Renamed from "feed banner": the component never knew anything about feeds.
// It takes an eyebrow, a title, a subtitle and a colour. Calling it after the
// one caller that happened to use it is what made it invisible to the next
// person who needed a section header.
//
// The accent arrives as a CSS colour rather than the app's HSL-triplet
// convention (`"45 79% 52%"`). A block cannot assume its host's colour
// plumbing — hexToHslTriplet is an app-local helper — so the boundary takes
// anything CSS understands and the caller converts if it wants to.
// ============================================================================

const props = [
  {
    name: "title",
    kind: "string",
    label: "Title",
    required: true,
    inlineEditable: true,
  },
  {
    name: "eyebrow",
    kind: "string",
    label: "Small label above the title",
    description: "Sits in a pill. Often the section or category name.",
  },
  {
    name: "subtitle",
    kind: "string",
    label: "Subtitle",
    inlineEditable: true,
  },
  {
    name: "accent",
    kind: "string",
    label: "Accent colour",
    description:
      "Any CSS colour — the rule beneath, the pill and the title all take it. Defaults to the site accent.",
  },
  {
    name: "height",
    kind: "number",
    label: "Height",
    description:
      "0 is as tall as its words. More sets its least height, with the words centred. Also set by dragging the handle under the selected banner.",
    default: 0,
    min: 0,
    max: 1200,
    step: 10,
    unit: "px",
  },
] as const;

export type SectionBannerProps = PropsOf<typeof props>;

export function SectionBanner({ title, eyebrow, subtitle, accent, height = 0 }: SectionBannerProps) {
  const style: Record<string, string> = {};
  // Set as a custom property rather than on each element: the CSS decides
  // where the colour lands, so a theme can move it without touching this.
  if (accent) style["--blk-banner-accent"] = accent;
  if (height > 0) style.minHeight = `${height}px`;
  return (
    <div
      className="blk blk-banner"
      {...(height > 0 ? { "data-tall": "" } : {})}
      style={Object.keys(style).length ? (style as React.CSSProperties) : undefined}
    >
      <div className="blk-shell">
        {eyebrow && <span className="blk-banner-eyebrow">{eyebrow}</span>}
        <h1 className="blk-banner-title">{title}</h1>
        {subtitle && <p className="blk-banner-sub">{subtitle}</p>}
      </div>
    </div>
  );
}

export const sectionBanner = defineBlock(
  {
    id: "section-banner",
    category: "headers",
    label: "Section banner",
    description:
      "A dark header for the top of a section page: a label, a title in the section's colour, and a subtitle.",
    props,
    memberSafe: true,
    styling: "tokens",
    resize: { height: "height" },
  },
  SectionBanner,
  () => ({
    eyebrow: "Daily practice",
    title: "Amrit Vela",
    subtitle: "The hours before dawn",
    accent: "#f4c430",
  })
);
