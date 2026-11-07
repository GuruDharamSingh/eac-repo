import { defineBlock, editItem, RichText, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// Small blocks, used on every template: a callout and numbered steps.
//
// Server-safe and data-free, so they render the same in the editor and on the
// page. `steps` is a `rows` prop: each row is a title and a few lines.
//
// Numbered steps declares its parts (2026-11-06), so a page can restyle them,
// and marks each step with `editItem("steps", <index in the stored rows>)`:
// the editor maps a click on a step's words to that row's `title` or `text`
// (a part's `prop` "steps.title"). The marks add one data attribute per step
// to the published markup; nothing else changes.
// ============================================================================

// ── steps ───────────────────────────────────────────────────────────────────

const stepsProps = [
  { name: "heading", kind: "string", label: "Heading", default: "How to join" },
  {
    name: "steps",
    kind: "rows",
    label: "Step",
    addLabel: "Add a step",
    summary: ["title"],
    fields: [
      { name: "title", kind: "string", label: "Step" },
      { name: "text", kind: "richtext", label: "Words under it" },
    ],
  },
  { name: "numbered", kind: "boolean", label: "Number the steps", default: true },
] as const;

export function Steps({ heading = "", steps = [], numbered = true }: PropsOf<typeof stepsProps>) {
  // The index in the stored rows, not the position drawn: empty rows are skipped.
  const rows = (steps ?? []).map((r, at) => ({ r, at })).filter(({ r }) => r && (r.title || r.text));
  if (rows.length === 0) return null;
  return (
    <section>
      {heading ? <h2 className="font-serif text-2xl">{heading}</h2> : null}
      {heading ? <hr className="saffron-divider max-w-[12rem]" /> : null}
      <ol className="space-y-5">
        {rows.map(({ r, at }, i) => (
          <li key={i} className="grid grid-cols-[2.25rem_1fr] gap-4" {...editItem("steps", at)}>
            <span
              aria-hidden
              className="flex size-9 items-center justify-center border border-[hsl(var(--primary))]/50 font-serif text-lg text-[hsl(var(--primary))]"
            >
              {numbered ? i + 1 : "•"}
            </span>
            <div>
              <h3 className="font-serif text-lg">{r.title as string}</h3>
              {r.text ? (
                <RichText body={r.text as string} className="mt-1 text-sm leading-relaxed text-muted-foreground [&_p]:mb-2" />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export const steps = defineBlock(
  {
    id: "pt-steps",
    category: "content",
    label: "Numbered steps",
    description: "A short list of steps, each with a title and a few lines: how to join, what to bring, what to read first.",
    memberSafe: true,
    styling: "tailwind",
    // Selectors over today's markup. `prop` "steps.title": the row is the step's editItem mark.
    parts: {
      root: { label: "Numbered steps", sel: "> section" },
      heading: { label: "Heading", sel: "> section > h2", prop: "heading" },
      divider: { label: "Rule", sel: "> section > hr" },
      list: { label: "Steps", sel: "> section > ol" },
      step: { label: "Step", sel: "> section > ol > li", repeat: true },
      number: { label: "Number", sel: "> section > ol > li > span", repeat: true },
      words: { label: "Step words", sel: "> section > ol > li > div", repeat: true },
      stepTitle: { label: "Step title", sel: "> section > ol > li > div > h3", repeat: true, prop: "steps.title" },
      stepText: { label: "Step text", sel: "> section > ol > li > div > div", repeat: true, prop: "steps.text" },
    },
    props: stepsProps,
  },
  Steps,
  () => ({
    heading: "How to join",
    numbered: true,
    steps: [
      { title: "Open the room", text: "<p>Use the button below. Allow your camera and microphone when asked.</p>" },
      { title: "Read before we meet", text: "<p>The reading for the week is listed under Materials.</p>" },
    ],
  })
);

// ── notice ──────────────────────────────────────────────────────────────────

const noticeProps = [
  { name: "title", kind: "string", label: "Title", default: "" },
  { name: "body", kind: "richtext", label: "Words", default: "" },
  {
    name: "tone",
    kind: "select",
    label: "Look",
    default: "note",
    options: [
      { value: "note", label: "Note — bronze edge" },
      { value: "quiet", label: "Quiet — plain card" },
      { value: "warning", label: "Warning — red edge" },
    ],
  },
] as const;

const TONE: Record<string, string> = {
  note: "border-l-[3px] border-l-[hsl(var(--primary))]",
  quiet: "",
  warning: "border-l-[3px] border-l-destructive",
};

export function Notice({ title = "", body = "", tone = "note" }: PropsOf<typeof noticeProps>) {
  if (!title && !body) return null;
  return (
    <aside className={`card-natural p-5 ${TONE[tone] ?? TONE.note}`}>
      {title ? <h3 className="font-serif text-lg">{title}</h3> : null}
      {body ? <RichText body={body as string} className="mt-1 text-sm leading-relaxed [&_p]:mb-2" /> : null}
    </aside>
  );
}

export const notice = defineBlock(
  {
    id: "pt-notice",
    category: "content",
    label: "Notice (callout)",
    description: "A boxed note with an edge colour: a recording notice, a reminder, a change of plan.",
    memberSafe: true,
    styling: "tailwind",
    props: noticeProps,
  },
  Notice,
  () => ({ title: "This session is recorded", body: "<p>Recordings are kept in the group's folder for members.</p>", tone: "note" as const })
);
