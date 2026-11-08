import type { CSSProperties } from "react";
import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { AeonSigil } from "@/components/aeon/sigil";

// ============================================================================
// Opening (he-hero): the front door, in the ÆON draft's shape. An eyebrow, a
// title with one phrase lit in gold, a lede, up to three links, and beside
// them the figure as an ornament (or a picture, or nothing).
//
// Colours and type come from the site's tokens (--he-*), so Site style moves
// them; the parts are clickable in the studio for this block's own look.
//
// Round 3 (2026-11-07): "A glow (orb)" beside the words, Ario's original
// ornament (a white-core radial glow), and quieter defaults: no course
// link (the free course is de-emphasised; it lives on /enneagram only).
// ============================================================================

const props = [
  { name: "eyebrow", kind: "string", label: "Eyebrow", description: "A short line above the title.", default: "Readings in the Enneagram", inlineEditable: true },
  { name: "title", kind: "string", label: "Title", default: "The story you framed your life around", inlineEditable: true },
  {
    name: "accent",
    kind: "string",
    label: "Lit phrase",
    description: "Words inside the title drawn in the accent colour (they must appear in the title exactly). Empty = none.",
    default: "your life",
  },
  {
    name: "lede",
    kind: "text",
    label: "Lede",
    default:
      "The Enneagram is a map of how your core motivations became a recurring psychological fixation — and how that reaction shaped the way you relate, protect, desire, and disconnect.",
  },
  { name: "primaryLabel", kind: "string", label: "First link", default: "Readings and counselling" },
  { name: "primaryHref", kind: "url", label: "First link goes to", default: "/services" },
  { name: "secondLabel", kind: "string", label: "Second link", description: "Empty = no second link.", default: "The enneagram" },
  { name: "secondHref", kind: "url", label: "Second link goes to", default: "/enneagram" },
  { name: "thirdLabel", kind: "string", label: "Third link", description: "Empty = no third link.", default: "" },
  { name: "thirdHref", kind: "url", label: "Third link goes to", default: "" },
  {
    name: "figure",
    kind: "select",
    label: "Beside the words",
    default: "sigil",
    options: [
      { value: "sigil", label: "The figure (ornament)" },
      { value: "orb", label: "A glow (orb)" },
      { value: "image", label: "A picture" },
      { value: "none", label: "Nothing (words across)" },
    ],
  },
  { name: "image", kind: "image", label: "Picture", description: "Used when 'Beside the words' is a picture." },
  { name: "imageAlt", kind: "string", label: "Picture description", description: "For screen readers. Empty = decorative.", default: "" },
  { name: "titleSize", kind: "number", label: "Title size", default: 64, min: 32, max: 112, step: 2, unit: "px" },
] as const;

export type HeroProps = PropsOf<typeof props>;

/** The title with its lit phrase wrapped (first occurrence only). */
function litTitle(title: string, accent: string) {
  const at = accent ? title.indexOf(accent) : -1;
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className="he-accent">{accent}</span>
      {title.slice(at + accent.length)}
    </>
  );
}

export function HeHero({
  eyebrow,
  title,
  accent = "",
  lede,
  primaryLabel,
  primaryHref,
  secondLabel,
  secondHref,
  thirdLabel,
  thirdHref,
  figure = "sigil",
  image,
  imageAlt = "",
  titleSize = 64,
}: HeroProps) {
  const links = [
    { label: primaryLabel, href: primaryHref, primary: true },
    { label: secondLabel, href: secondHref, primary: false },
    { label: thirdLabel, href: thirdHref, primary: false },
  ].filter((l) => typeof l.label === "string" && l.label.trim() && typeof l.href === "string" && l.href.trim());
  const hasImage = figure === "image" && typeof image === "string" && image.trim() !== "";
  const side = figure === "sigil" || figure === "orb" || hasImage;
  const titleText = typeof title === "string" ? title : "";

  return (
    <section className="blk he-hero" data-side={side ? "yes" : "no"} style={{ "--he-hero-title-size": `${titleSize}px` } as CSSProperties}>
      <div className="he-hero-grid">
        <div className="he-hero-copy">
          {eyebrow ? <p className="he-eyebrow he-hero-eyebrow">{eyebrow}</p> : null}
          <h1 className="he-hero-title">{typeof title === "string" ? litTitle(titleText, typeof accent === "string" ? accent : "") : title}</h1>
          {typeof lede === "string" && lede.trim() ? <p className="he-lede he-hero-lede">{lede}</p> : null}
          {links.length ? (
            <div className="he-hero-actions">
              {links.map((l) => (
                <a key={`${l.label}-${l.href}`} className={`he-btn${l.primary ? " he-primary" : ""}`} href={l.href as string}>
                  {l.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        {figure === "sigil" ? (
          <div className="he-hero-figure" aria-hidden="true">
            <AeonSigil />
          </div>
        ) : figure === "orb" ? (
          <div className="he-hero-figure he-hero-orb" aria-hidden="true">
            <div className="he-orb" />
          </div>
        ) : hasImage ? (
          <figure className="he-hero-figure he-hero-picture">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image as string} alt={imageAlt} {...(imageAlt ? {} : { "aria-hidden": true })} />
          </figure>
        ) : null}
      </div>
    </section>
  );
}

export const heHero = defineBlock(
  {
    id: "he-hero",
    label: "Opening",
    category: "headers",
    description: "The front door: a title with a lit phrase, a lede, up to three links, and a glow, the figure or a picture beside them.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Opening", sel: "> .he-hero" },
      eyebrow: { label: "Eyebrow", sel: "> .he-hero .he-hero-eyebrow", prop: "eyebrow" },
      heading: { label: "Title", sel: "> .he-hero .he-hero-title", prop: "title" },
      lit: { label: "Lit phrase", sel: "> .he-hero .he-accent" },
      lede: { label: "Lede", sel: "> .he-hero .he-hero-lede", prop: "lede" },
      actions: { label: "Links", sel: "> .he-hero .he-hero-actions" },
      first: { label: "First link", sel: "> .he-hero .he-btn.he-primary", prop: "primaryLabel" },
      ornament: { label: "Figure / picture", sel: "> .he-hero .he-hero-figure" },
    },
    tokens: [
      { name: "--he-aurum", label: "Accent (lit phrase, first link)", type: "color" },
      { name: "--he-ink", label: "Ink", type: "color" },
      { name: "--he-ink-dim", label: "Quiet ink (lede)", type: "color" },
    ],
  },
  HeHero,
  () => ({
    eyebrow: "Readings in the Enneagram",
    title: "The story you framed your life around",
    accent: "your life",
    lede: "The Enneagram is a map of how your core motivations became a recurring psychological fixation — and how that reaction shaped the way you relate, protect, desire, and disconnect.",
    primaryLabel: "Readings and counselling",
    primaryHref: "/services",
    secondLabel: "The enneagram",
    secondHref: "/enneagram",
    thirdLabel: "",
    thirdHref: "",
    figure: "orb" as const,
    image: "",
    imageAlt: "",
    titleSize: 64,
  })
);
