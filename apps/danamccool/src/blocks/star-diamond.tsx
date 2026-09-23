import type { CSSProperties } from "react";
import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// The front door of her old site: a star chart blown up across the whole
// screen, a white square turned 45° in the middle, and four plain text links
// sitting close to the centre of the diamond — one on each point — around her
// name.
//
// Her scraped home page is the text of exactly that:
//   "DANA McCOOL / ARTIST / COLLECTIONS ~ EVENTS ~ ABOUT / ELKDONIS ARTS"
// with ELKDONIS ARTS on the bottom point.
//
// "Hide the site around it" is what makes it a SPLASH rather than a banner:
// the sidebar and footer step aside while this block is on the page, so the
// first thing a visitor sees is the chart and the diamond, and every link
// then settles into the ordinary sidebar layout. Done in CSS with `:has()`
// (site.css), so the block needs no script and no knowledge of the layout —
// take the block off the page and the sidebar comes back.
//
// Plain CSS classes (`dm-diamond*` in site.css), not Tailwind: this block is
// her site's own, and its look is hers, not a kit's.
// ============================================================================

const link = (name: string, label: string, dLabel: string, dHref: string) =>
  [
    { name: `${name}Label`, kind: "string", label: `${label} — words`, default: dLabel },
    { name: `${name}Href`, kind: "url", label: `${label} — goes to`, default: dHref },
  ] as const;

const props = [
  {
    name: "image",
    kind: "image",
    label: "Background picture",
    description: "Blown up to fill the screen behind the diamond.",
  },
  { name: "title", kind: "string", label: "In the middle", default: "Dana McCool", inlineEditable: true },
  { name: "subtitle", kind: "string", label: "Underneath the name", default: "Artist", inlineEditable: true },
  ...link("top", "Top point", "Events", "/current"),
  ...link("left", "Left point", "Collections", "/collections"),
  ...link("right", "Right point", "About", "/biography"),
  ...link("bottom", "Bottom point", "Elkdonis Arts", "https://elkdonis-arts.org"),
  {
    name: "size",
    kind: "number",
    label: "Diamond size",
    description: "How much of the screen the diamond takes, measured on its shorter side.",
    default: 58,
    min: 30,
    max: 80,
    step: 1,
    unit: "%",
  },
  {
    name: "dim",
    kind: "number",
    label: "Darken the picture",
    default: 0,
    min: 0,
    max: 70,
    step: 5,
    unit: "%",
  },
  {
    name: "splash",
    kind: "boolean",
    label: "Hide the site around it",
    description: "No sidebar or footer while this is on the page — a front door rather than a banner.",
    default: true,
  },
] as const;

export type StarDiamondProps = PropsOf<typeof props>;

function Point({
  where,
  label,
  href,
}: {
  where: "top" | "left" | "right" | "bottom";
  label?: unknown;
  href?: unknown;
}) {
  const text = typeof label === "string" ? label.trim() : label;
  const to = String(href ?? "").trim();
  if (!text) return null;
  // An off-site link says so, and opens where the visitor expects a new site
  // to open; her own pages stay in the same tab.
  const external = /^https?:\/\//.test(to);
  return (
    <a
      className={`dm-diamond-link dm-diamond-link--${where}`}
      href={to || "#"}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {text as string}
      {external ? <span className="dm-sr">(opens in a new tab)</span> : null}
    </a>
  );
}

export function StarDiamond({
  image,
  title,
  subtitle,
  topLabel,
  topHref,
  leftLabel,
  leftHref,
  rightLabel,
  rightHref,
  bottomLabel,
  bottomHref,
  size = 58,
  dim = 0,
  splash = true,
}: StarDiamondProps) {
  const src = String(image ?? "").trim();
  const style = {
    "--dm-diamond-size": `${size}vmin`,
    "--dm-diamond-dim": `${dim / 100}`,
    ...(src ? { "--dm-diamond-image": `url("${src.replace(/"/g, "%22")}")` } : {}),
  } as CSSProperties;

  return (
    <section className="dm-diamond" data-splash={splash ? "true" : "false"} style={style}>
      <div className="dm-diamond-stage">
        <div className="dm-diamond-shape" aria-hidden="true" />
        <nav className="dm-diamond-content" aria-label="Enter the site">
          <Point where="top" label={topLabel} href={topHref} />
          <Point where="left" label={leftLabel} href={leftHref} />
          <div className="dm-diamond-name">
            {title ? <h1 className="dm-diamond-title">{title}</h1> : null}
            {subtitle ? <p className="dm-diamond-sub">{subtitle}</p> : null}
          </div>
          <Point where="right" label={rightLabel} href={rightHref} />
          <Point where="bottom" label={bottomLabel} href={bottomHref} />
        </nav>
      </div>
    </section>
  );
}

export const starDiamond = defineBlock(
  {
    id: "dm-star-diamond",
    label: "Diamond landing",
    category: "headers",
    description:
      "Her front door: a picture across the whole screen, a white diamond in the middle, a link on each point.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  StarDiamond,
  () => ({
    image: "",
    title: "Dana McCool",
    subtitle: "Artist",
    topLabel: "Events",
    topHref: "/current",
    leftLabel: "Collections",
    leftHref: "/collections",
    rightLabel: "About",
    rightHref: "/biography",
    bottomLabel: "Elkdonis Arts",
    bottomHref: "https://elkdonis-arts.org",
    size: 58,
    dim: 0,
    splash: true,
  })
);
