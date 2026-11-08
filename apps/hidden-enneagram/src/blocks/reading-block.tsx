import { defineBlock, RichText, type PropsOf } from "@elkdonis/blocks";
import { editingOf, type PuckEditing } from "@elkdonis/blocks/record";
import { Reading, type ReadingStep } from "@/components/reading/reading";
import { CUES, cueOf, specOf, type StepRow } from "@/components/reading/parse";

// ============================================================================
// A reading (he-reading): the figure as Ario's instrument for ONE person's
// take. A list of steps; each says what the figure shows (core, wings,
// arrows, lit points, which lines, his own marks, pinned notes, a lens) and
// carries his words. The visitor steps through it, or reads it written out,
// or prints it.
//
// Why a block of its own, not a "take" mode of The Figure: a reading is a
// different document (a sequence written for one person, not the nine-type
// reference), its props are a list the Figure does not need, and a page that
// holds one is private by default (noindex; see lib/reading-privacy.ts). The
// Figure's stored props stay untouched.
//
// SERVER component: the step texts go through <RichText> (sanitised) here;
// the stepper is one client island (components/reading/reading.tsx).
// ============================================================================

const point = [{ value: "", label: "None" }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: String(n), label: `Type ${n}` }))];

const props = [
  { name: "eyebrow", kind: "string", label: "Eyebrow", default: "A reading", inlineEditable: true },
  { name: "title", kind: "string", label: "Title", default: "A reading for …", inlineEditable: true },
  { name: "intro", kind: "richtext", label: "Opening words", default: "" },
  {
    name: "steps",
    kind: "rows",
    label: "Steps",
    addLabel: "Add a step",
    summary: ["title"],
    fields: [
      { name: "title", kind: "string", label: "Step title", default: "" },
      { name: "text", kind: "richtext", label: "Words", default: "<p>Write here.</p>" },
      {
        name: "lens",
        kind: "select",
        label: "Lens (colours the points)",
        default: "centers",
        options: [
          { value: "centers", label: "Centers" },
          { value: "object", label: "Object relation" },
          { value: "energy", label: "Energy style" },
          { value: "attitude", label: "Attitude style" },
        ],
      },
      { name: "core", kind: "select", label: "Core type", default: "", options: point },
      {
        name: "wings",
        kind: "select",
        label: "Wings",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "lower", label: "The lower wing (core − 1)" },
          { value: "higher", label: "The higher wing (core + 1)" },
          { value: "both", label: "Both wings" },
        ],
      },
      {
        name: "arrows",
        kind: "select",
        label: "Arrows from the core",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "stress", label: "Stress line" },
          { value: "growth", label: "Growth line" },
          { value: "both", label: "Both" },
        ],
      },
      { name: "lit", kind: "string", label: "Other points lit", description: "e.g. 2 7", default: "" },
      {
        name: "lines",
        kind: "select",
        label: "The figure's lines",
        default: "all",
        options: [
          { value: "all", label: "All" },
          { value: "triangle", label: "The triangle 3-6-9 only" },
          { value: "hexad", label: "The hexad 1-4-2-8-5-7 only" },
          { value: "core", label: "Only the core's lines" },
          { value: "none", label: "None" },
        ],
      },
      { name: "marks", kind: "string", label: "Your own lines", description: "1-5 draws a line, 4>8 an arrow; separate with commas.", default: "" },
      { name: "pins", kind: "text", label: "Notes pinned to points", description: "One a line: 4: the mask", default: "" },
      { name: "cue", kind: "select", label: "Sound", default: "none", options: CUES.map((c) => ({ value: c.value, label: c.label })) },
    ],
    default: [],
  },
  { name: "editorStep", kind: "number", label: "Step shown in the editor", description: "Which step the canvas previews.", default: 1, min: 1, max: 40, step: 1 },
  {
    name: "view",
    kind: "select",
    label: "Opens as",
    default: "stepper",
    options: [
      { value: "stepper", label: "Step by step" },
      { value: "written", label: "Written out" },
    ],
  },
  { name: "sound", kind: "boolean", label: "Offer the steps' sounds", default: true },
] as const;

type Props = PropsOf<typeof props> & { puck?: PuckEditing };

export function HeReading(p: Props) {
  const { editing, drawn } = editingOf(p.puck);
  const rows = (Array.isArray(p.steps) ? p.steps : []) as StepRow[];
  const steps: ReadingStep[] = rows.map((r) => ({
    title: typeof r.title === "string" ? r.title : "",
    body: <RichText className="he-r-words" body={typeof r.text === "string" ? r.text : ""} />,
    spec: specOf(r),
    cue: cueOf(r),
  }));
  const idBase = typeof (p as { id?: unknown }).id === "string" ? (p as { id: string }).id : "he-reading";
  const editorStep = typeof p.editorStep === "number" ? p.editorStep : 1;
  const reading = (
    <Reading steps={steps} editorStep={editorStep} drawn={drawn} idBase={idBase} startView={p.view === "written" ? "written" : "stepper"} sound={p.sound !== false} />
  );
  return (
    <section className="blk he-reading-block">
      <header className="he-section-head">
        {p.eyebrow ? <p className="he-eyebrow">{p.eyebrow}</p> : null}
        {p.title ? <h2>{p.title}</h2> : null}
        {typeof p.intro === "string" && p.intro.trim() ? <RichText className="he-lede he-r-intro" body={p.intro} /> : null}
      </header>
      {drawn ? <div inert>{reading}</div> : reading}
      {editing ? (
        <p className="he-why" data-de-ui="">
          Showing step {Math.min(Math.max(1, editorStep), Math.max(1, steps.length))} of {steps.length}. A page with a reading is
          kept out of search engines; share its address only with the person it is for.
        </p>
      ) : null}
    </section>
  );
}

export const heReading = defineBlock(
  {
    id: "he-reading",
    label: "A reading",
    category: "content",
    description: "Write out a reading for one person on the figure, step by step: core, wings, lines, notes and sound. The page stays out of search engines.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Reading block", sel: "> .he-reading-block" },
      eyebrow: { label: "Eyebrow", sel: "> .he-reading-block .he-section-head .he-eyebrow", prop: "eyebrow" },
      title: { label: "Title", sel: "> .he-reading-block .he-section-head h2", prop: "title" },
      intro: { label: "Opening words", sel: ".he-r-intro" },
      tools: { label: "View buttons", sel: ".he-r-tools" },
      figure: { label: "Figure", sel: ".he-r-figure" },
      text: { label: "Step text", sel: ".he-r-stage .he-r-body" },
      pager: { label: "Back / Next", sel: ".he-r-pager" },
      written: { label: "Written-out list", sel: ".he-r-written" },
    },
    tokens: [
      { name: "--he-gut", label: "Gut hue", type: "color" },
      { name: "--he-heart", label: "Heart hue", type: "color" },
      { name: "--he-head", label: "Head hue", type: "color" },
      { name: "--he-aurum", label: "Gold (lines, marks)", type: "color" },
      { name: "--he-card", label: "Ground", type: "color" },
    ],
  },
  HeReading,
);
