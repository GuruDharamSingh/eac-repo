import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { editingOf, placementRules, type PuckEditing, type ResolvedPlacement } from "@elkdonis/blocks/record";
import { AeonFigure, type FigureReader } from "@/components/aeon/figure";
import { isTypeNum } from "@/components/aeon/geometry";
import type { ModeKey } from "@/components/aeon/content";

// ============================================================================
// The Figure (he-enneagram): Ario's instrument as a smart block.
//
// A SERVER component (not `interactive`), so it receives Puck's `puck` prop
// and can stay inert on every editing surface; the instrument itself is one
// client island (components/aeon/figure.tsx).
//
// Layout by placement (the record kit's proximity rules, katie's pattern):
// with Reader on "auto", the block decides from where it sits:
//   on the page itself          -> full   (wheel beside the five-step dossier)
//   in a column (split-row ...) -> summary (wheel, one paragraph, "read it")
//   (a parent listed as "feature" would draw the wheel alone; none is yet)
// then container queries stack the wheel over the dossier when it is narrow.
// A chosen Reader skips placement. The editor shows a line saying why.
// ============================================================================

export const figurePlacement = placementRules({ rowLabel: "in a row" });

const READER_BY_LAYOUT: Record<string, FigureReader> = { feature: "none", compact: "summary", card: "full", row: "full" };

const props = [
  { name: "eyebrow", kind: "string", label: "Eyebrow", default: "The instrument", inlineEditable: true },
  { name: "heading", kind: "string", label: "Heading", default: "Nine points, one circle", inlineEditable: true },
  {
    name: "intro",
    kind: "text",
    label: "Introduction",
    default:
      "Nine ways the psyche contracts around a core wound. Select a point and read its fixation a step at a time — essence, then the pattern, qualities, triads, wings. Change the lens to see how the hidden triads group the nine.",
  },
  {
    name: "mode",
    kind: "select",
    label: "Lens at first",
    default: "centers",
    options: [
      { value: "centers", label: "Centers (gut, heart, head)" },
      { value: "object", label: "Object relation" },
      { value: "energy", label: "Energy style" },
      { value: "attitude", label: "Attitude style" },
    ],
  },
  {
    name: "start",
    kind: "select",
    label: "Point selected at first",
    default: "9",
    options: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: String(n), label: `Type ${n}` })),
  },
  {
    name: "reader",
    kind: "select",
    label: "Reader",
    description: "Auto follows where the block sits: the full dossier on the page, a summary in a column.",
    default: "auto",
    options: [
      { value: "auto", label: "Auto" },
      { value: "full", label: "Full dossier, step by step" },
      { value: "summary", label: "Summary and a link" },
      { value: "none", label: "The figure alone" },
    ],
  },
  {
    name: "size",
    kind: "select",
    label: "Figure size",
    default: "large",
    options: [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large (as wide as it may)" },
    ],
  },
  { name: "controls", kind: "boolean", label: "Show the lens chips and legend", default: true },
  { name: "typeLinks", kind: "boolean", label: "Link each type to its own page (/type-N)", default: true },
  { name: "readHref", kind: "url", label: "Summary link goes to", description: "{n} = the type.", default: "/enneagram#type-{n}" },
] as const;

type Props = PropsOf<typeof props> & { placement?: ResolvedPlacement | null; puck?: PuckEditing };

function readerFor(choice: unknown, placement?: ResolvedPlacement | null): { reader: FigureReader; why: string } {
  if (choice === "full" || choice === "summary" || choice === "none") return { reader: choice, why: "chosen" };
  const reader = READER_BY_LAYOUT[placement?.layout ?? "card"] ?? "full";
  return { reader, why: placement?.reason ?? "on the page" };
}

const LABEL: Record<FigureReader, string> = { full: "full dossier", summary: "summary", none: "figure alone" };

export function HeEnneagram(p: Props) {
  const { editing, drawn } = editingOf(p.puck);
  const { reader, why } = readerFor(p.reader, p.placement);
  const start = Number(p.start);
  const figure = (
    <AeonFigure
      mode={(p.mode as ModeKey) ?? "centers"}
      start={isTypeNum(start) ? start : 9}
      size={p.size === "small" || p.size === "medium" ? p.size : "large"}
      controls={p.controls !== false}
      reader={reader}
      readHref={typeof p.readHref === "string" && p.readHref ? p.readHref : "/enneagram#type-{n}"}
      typeHref={p.typeLinks === false ? "" : "/type-{n}"}
      followHash={!drawn && reader === "full"}
      idBase={typeof (p as { id?: unknown }).id === "string" ? (p as { id: string }).id : "he-fig"}
    />
  );
  return (
    <section className="blk he-fig-block" data-reader={reader} data-in={p.placement?.where ?? "page"}>
      {p.eyebrow || p.heading || p.intro ? (
        <header className="he-section-head">
          {p.eyebrow ? <p className="he-eyebrow">{p.eyebrow}</p> : null}
          {p.heading ? <h2>{p.heading}</h2> : null}
          {typeof p.intro === "string" && p.intro.trim() ? <p className="he-lede">{p.intro}</p> : null}
        </header>
      ) : null}
      {/* On an editing surface nothing in the figure acts: a click selects the block. */}
      {drawn ? <div inert>{figure}</div> : figure}
      {editing ? (
        <p className="he-why" data-de-ui="">
          Reader: {LABEL[reader]}
          {p.reader === "auto" || !p.reader ? `, auto (${why})` : ""}
        </p>
      ) : null}
    </section>
  );
}

export const heEnneagram = defineBlock(
  {
    id: "he-enneagram",
    label: "The Figure",
    category: "content",
    description: "Ario's interactive enneagram: lenses, stress and growth lines, and each type's dossier read step by step.",
    memberSafe: true,
    dataDriven: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Figure block", sel: "> .he-fig-block" },
      eyebrow: { label: "Eyebrow", sel: "> .he-fig-block .he-section-head .he-eyebrow", prop: "eyebrow" },
      heading: { label: "Heading", sel: "> .he-fig-block .he-section-head h2", prop: "heading" },
      intro: { label: "Introduction", sel: "> .he-fig-block .he-section-head .he-lede", prop: "intro" },
      chips: { label: "Lens chips", sel: ".he-mode-chips" },
      wheel: { label: "Wheel", sel: ".he-wheel-box" },
      legend: { label: "Legend", sel: ".he-figure-legend" },
      dossier: { label: "Dossier", sel: ".he-dossier" },
      name: { label: "Type name", sel: ".he-dossier-id h3" },
      steps: { label: "Reading steps", sel: ".he-seg-rail" },
      reading: { label: "Reading", sel: ".he-seg-body" },
      pager: { label: "Back / Next", sel: ".he-seg-pager" },
    },
    tokens: [
      { name: "--he-gut", label: "Gut hue", type: "color" },
      { name: "--he-heart", label: "Heart hue", type: "color" },
      { name: "--he-head", label: "Head hue", type: "color" },
      { name: "--he-aurum", label: "Gold (lines, focus)", type: "color" },
      { name: "--he-card", label: "Dossier ground", type: "color" },
    ],
  },
  HeEnneagram,
);
