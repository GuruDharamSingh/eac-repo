import type { CSSProperties } from "react";
import { defineBlock, hasText, RichText, type PropsOf } from "@elkdonis/blocks";
import { sized, srcSet } from "./media";
import { hex } from "./artwork-data";
import "./about.css";

// ============================================================================
// ktp-about-hero — the opening of an About page (2026-11-17).
//
// A kicker, a large title, the potter's story as rich text and a signature
// line, beside a portrait. The portrait has a shape (arch like a kiln mouth,
// oval, rounded or square), sits left or right, and may carry a smaller second
// picture overlapping its corner (hands at the wheel, a bowl, the studio door).
// A thin offset outline sits behind the portrait so it reads as a framed print.
//
// Words are fields and nothing is stored as defaults beyond a neutral title:
// the About template (lib/puck/templates.ts) supplies the starting text, which
// is meant to be replaced. With no portrait the words take the full width.
// Padding, width, background and border of the whole block are the generic
// Style layer's (blkStyle), so they are not repeated here.
//
// The story is `richtext`, drawn only through <RichText> (sanitised).
// ============================================================================

const colour = <N extends string>(name: N, label: string, description: string) =>
  ({ name, kind: "string", format: "color", label, description, default: "" }) as const;

const props = [
  { name: "kicker", kind: "string", label: "Kicker", description: "A short line above the title.", default: "About", inlineEditable: true },
  { name: "title", kind: "string", label: "Title", default: "About the studio", inlineEditable: true },
  { name: "story", kind: "richtext", label: "Story", description: "Type on the page. Select words for bold, italic, a link or a list." },
  { name: "signature", kind: "string", label: "Signature line", description: "A closing line under the story, set in italics. Leave empty for none.", default: "", inlineEditable: true },
  { name: "portrait", kind: "image", label: "Portrait", description: "You at the wheel, or the studio. Taller than wide suits the arch." },
  { name: "portraitAlt", kind: "string", label: "Portrait description", description: "What the picture shows, for screen readers.", default: "" },
  { name: "inset", kind: "image", label: "Small second picture", description: "Optional. A round picture overlapping the portrait's corner: hands, a bowl, a glaze test." },
  { name: "insetAlt", kind: "string", label: "Second picture description", default: "" },
  {
    name: "side",
    kind: "select",
    label: "Portrait side",
    default: "right",
    options: [
      { value: "right", label: "Right" },
      { value: "left", label: "Left" },
    ],
  },
  {
    name: "shape",
    kind: "select",
    label: "Portrait shape",
    default: "arch",
    options: [
      { value: "arch", label: "Arch (rounded top)" },
      { value: "oval", label: "Oval" },
      { value: "rounded", label: "Rounded corners" },
      { value: "square", label: "Square corners" },
    ],
  },
  { name: "frame", kind: "boolean", label: "Offset outline behind the portrait", default: true },
  { name: "titleSize", kind: "number", label: "Title size", default: 60, min: 32, max: 110, step: 2, unit: "px" },
  {
    name: "titleStyle",
    kind: "select",
    label: "Title style",
    default: "italic",
    options: [
      { value: "italic", label: "Italic" },
      { value: "upright", label: "Upright" },
    ],
  },
  colour("accent", "Accent", "Kicker, outline and signature rule. Empty = the site's accent."),
  colour("ink", "Text colour", "Empty = the site's ink."),
  colour("ground", "Ground", "The block's own ground. Empty = the page's."),
] as const;

export type AboutHeroProps = PropsOf<typeof props>;

const filled = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

export function AboutHero({
  kicker,
  title,
  story,
  signature,
  portrait,
  portraitAlt = "",
  inset,
  insetAlt = "",
  side = "right",
  shape = "arch",
  frame = true,
  titleSize = 60,
  titleStyle = "italic",
  accent,
  ink,
  ground,
}: AboutHeroProps) {
  const vars: Record<string, string> = { "--ktp-ah-title-size": `${titleSize}px` };
  const a = hex(accent);
  if (a) {
    vars["--blk-accent"] = a;
    vars["--blk-accent-ink"] = `color-mix(in srgb, ${a} 60%, black)`;
  }
  const i = hex(ink);
  if (i) vars["--ktp-ah-ink"] = i;
  const g = hex(ground);
  if (g) vars["--ktp-ah-ground"] = g;

  const hasPortrait = filled(portrait);
  const hasInset = hasPortrait && filled(inset);

  return (
    <section
      className="blk ktp-ah"
      data-place={hasPortrait ? side : "none"}
      data-shape={shape}
      data-frame={frame ? "on" : "off"}
      data-title={titleStyle}
      style={vars as CSSProperties}
    >
      <div className="ktp-ah-inner">
        <div className="ktp-ah-copy">
          {kicker ? <p className="ktp-ah-kicker">{kicker}</p> : null}
          <h1 className="ktp-ah-title">{title}</h1>
          {hasText(story) ? <RichText className="ktp-ah-story" body={story} /> : null}
          {signature ? <p className="ktp-ah-signature">{signature}</p> : null}
        </div>
        {hasPortrait ? (
          <figure className="ktp-ah-art">
            <div className="ktp-ah-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="ktp-ah-portrait"
                src={sized(portrait, 1024)}
                srcSet={srcSet(portrait)}
                sizes="(max-width: 760px) 100vw, 42vw"
                alt={portraitAlt}
                {...(portraitAlt ? {} : { "aria-hidden": true })}
              />
            </div>
            {hasInset ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="ktp-ah-inset"
                src={sized(inset, 512)}
                srcSet={srcSet(inset)}
                sizes="(max-width: 760px) 40vw, 16vw"
                alt={insetAlt}
                {...(insetAlt ? {} : { "aria-hidden": true })}
              />
            ) : null}
          </figure>
        ) : null}
      </div>
    </section>
  );
}

export const aboutHero = defineBlock(
  {
    id: "ktp-about-hero",
    label: "About: portrait and story",
    category: "headers",
    description: "The opening of an About page: title and story beside a shaped portrait, with an optional small second picture and a signature line.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "About opening", sel: "> .ktp-ah" },
      kicker: { label: "Kicker", sel: "> .ktp-ah .ktp-ah-kicker", prop: "kicker" },
      title: { label: "Title", sel: "> .ktp-ah .ktp-ah-title", prop: "title" },
      signature: { label: "Signature", sel: "> .ktp-ah .ktp-ah-signature", prop: "signature", draws: { props: { signature: "A line" } } },
      portrait: { label: "Portrait", sel: "> .ktp-ah .ktp-ah-art", prop: "portrait", draws: { props: { portrait: "/x.jpg" } } },
    },
  },
  AboutHero,
  () => ({
    kicker: "About",
    title: "About the studio",
    story: "",
    signature: "",
    portrait: "",
    portraitAlt: "",
    inset: "",
    insetAlt: "",
    side: "right" as const,
    shape: "arch" as const,
    frame: true,
    titleSize: 60,
    titleStyle: "italic" as const,
    accent: "",
    ink: "",
    ground: "",
  })
);
