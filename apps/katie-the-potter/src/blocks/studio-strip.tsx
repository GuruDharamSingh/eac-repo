import type { CSSProperties } from "react";
import { defineBlock, editItem, type PropsOf } from "@elkdonis/blocks";
import { sized, srcSet } from "./media";
import { hex } from "./artwork-data";
import "./about.css";

// ============================================================================
// ktp-studio-strip — pictures of the studio and a band of short facts
// (2026-11-17).
//
// A heading, then pictures as DATA (add a row, choose an image) laid out as a
// mosaic (the first picture large, the rest beside it) or as an even row, each
// with an optional caption; then a facts band: short label and value pairs
// ("Clay — stoneware and porcelain") divided by hairlines. Either half may be
// left empty: no pictures draws the heading and the facts, no facts draws the
// pictures. A row with no image is skipped on the page.
//
// Padding, width, background and border of the whole block are the generic
// Style layer's (blkStyle). Tokens only (about.css), so it draws the same on
// the page and in the editor's iframe.
// ============================================================================

const colour = <N extends string>(name: N, label: string, description: string) =>
  ({ name, kind: "string", format: "color", label, description, default: "" }) as const;

const props = [
  { name: "eyebrow", kind: "string", label: "Small label above", default: "In the studio", inlineEditable: true },
  { name: "title", kind: "string", label: "Heading", default: "", inlineEditable: true },
  { name: "intro", kind: "text", label: "Line underneath", description: "One or two sentences. Leave empty for none.", default: "" },
  {
    name: "pictures",
    kind: "rows",
    label: "Picture",
    addLabel: "Add a picture",
    summary: ["caption", "alt"],
    fields: [
      { name: "src", kind: "image", label: "Image" },
      { name: "alt", kind: "string", label: "Description", description: "What the picture shows, for anyone who cannot see it.", default: "" },
      { name: "caption", kind: "string", label: "Caption", default: "" },
    ],
  },
  {
    name: "layout",
    kind: "select",
    label: "Pictures",
    default: "mosaic",
    options: [
      { value: "mosaic", label: "Mosaic (first one large)" },
      { value: "row", label: "Even row" },
    ],
  },
  {
    name: "ratio",
    kind: "select",
    label: "Picture shape",
    description: "Crops every picture to the same shape in an even row. A mosaic keeps its own proportions.",
    default: "photo",
    options: [
      { value: "photo", label: "Photo (4:3)" },
      { value: "square", label: "Square" },
      { value: "tall", label: "Tall (3:4)" },
    ],
  },
  { name: "radius", kind: "number", label: "Corner radius", default: 12, min: 0, max: 40, step: 1, unit: "px" },
  {
    name: "facts",
    kind: "rows",
    label: "Fact",
    addLabel: "Add a fact",
    summary: ["label", "value"],
    fields: [
      { name: "label", kind: "string", label: "Label", description: "A word or two: Clay, Firing, Made in.", default: "" },
      { name: "value", kind: "string", label: "Value", default: "" },
    ],
  },
  colour("accent", "Accent", "Labels and rules. Empty = the site's accent."),
  colour("ground", "Facts band ground", "Empty = the site's soft tint."),
] as const;

export type StudioStripProps = PropsOf<typeof props>;

type PictureRow = { src?: string; alt?: string; caption?: string };
type FactRow = { label?: string; value?: string };

const filled = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

export function StudioStrip({
  eyebrow,
  title,
  intro,
  pictures,
  layout = "mosaic",
  ratio = "photo",
  radius = 12,
  facts,
  accent,
  ground,
}: StudioStripProps) {
  const vars: Record<string, string> = { "--ktp-ss-radius": `${radius}px` };
  const a = hex(accent);
  if (a) {
    vars["--blk-accent"] = a;
    vars["--blk-accent-ink"] = `color-mix(in srgb, ${a} 60%, black)`;
  }
  const g = hex(ground);
  if (g) vars["--ktp-ss-band"] = g;

  // Keep each row's index in the stored array: the editor opens that row when its picture is clicked.
  const all = (pictures ?? []) as PictureRow[];
  const shown = all.map((row, index) => ({ row, index })).filter(({ row }) => filled(row.src));
  const rows = ((facts ?? []) as FactRow[]).map((row, index) => ({ row, index })).filter(({ row }) => filled(row.label) || filled(row.value));
  const hasHead = filled(eyebrow) || filled(title) || filled(intro);
  if (!hasHead && shown.length === 0 && rows.length === 0) return null;

  return (
    <section className="blk ktp-ss" data-layout={layout} data-ratio={ratio} data-count={Math.min(shown.length, 5)} style={vars as CSSProperties}>
      {hasHead ? (
        <header className="ktp-ss-head">
          {filled(eyebrow) ? <p className="ktp-ss-eyebrow">{eyebrow}</p> : null}
          {filled(title) ? <h2 className="ktp-ss-title">{title}</h2> : null}
          {filled(intro) ? <p className="ktp-ss-intro">{intro}</p> : null}
        </header>
      ) : null}
      {shown.length > 0 ? (
        <div className="ktp-ss-pictures">
          {shown.map(({ row, index }) => (
            <figure key={index} className="ktp-ss-pic" {...editItem("pictures", index)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="ktp-ss-img"
                src={sized(row.src as string, 1024)}
                srcSet={srcSet(row.src as string)}
                sizes="(max-width: 760px) 100vw, 40vw"
                alt={row.alt ?? ""}
                {...(row.alt ? {} : { "aria-hidden": true })}
              />
              {filled(row.caption) ? <figcaption className="ktp-ss-cap">{row.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <dl className="ktp-ss-facts">
          {rows.map(({ row, index }) => (
            <div key={index} className="ktp-ss-fact" {...editItem("facts", index)}>
              {filled(row.label) ? <dt className="ktp-ss-fact-label">{row.label}</dt> : null}
              {filled(row.value) ? <dd className="ktp-ss-fact-value">{row.value}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

export const studioStrip = defineBlock(
  {
    id: "ktp-studio-strip",
    label: "About: studio pictures and facts",
    category: "content",
    description: "A heading, a mosaic or row of studio pictures with captions, and a band of short facts (clay, firing, where it is made).",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Studio strip", sel: "> .ktp-ss" },
      title: { label: "Heading", sel: "> .ktp-ss .ktp-ss-title", prop: "title", draws: { props: { title: "A line" } } },
      pictures: { label: "Pictures", sel: "> .ktp-ss .ktp-ss-pictures", draws: { props: { pictures: [{ src: "/x.jpg" }] } } },
      facts: { label: "Facts band", sel: "> .ktp-ss .ktp-ss-facts", draws: { props: { facts: [{ label: "Clay", value: "Stoneware" }] } } },
    },
  },
  StudioStrip,
  () => ({
    eyebrow: "In the studio",
    title: "",
    intro: "",
    pictures: [],
    layout: "mosaic" as const,
    ratio: "photo" as const,
    radius: 12,
    facts: [],
    accent: "",
    ground: "",
  })
);
