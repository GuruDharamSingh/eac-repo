import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// A row of big numbers with labels.
//
// Source:  HyperUI "Stats" 1 — public/examples/marketing/stats/1.html
//          https://github.com/markmead/hyperui (MIT, Copyright (c) Mark Mead;
//          see ./NOTICE.md)
//
// Changes: gray-100 border -> border-border on a bg-card tile; gray-500 label
// -> text-muted-foreground; blue-600 figure -> text-primary; heading and text
// -> text-foreground / text-muted-foreground. Copy is props; the heading and
// intro are optional. At most four stats are drawn (HyperUI's lg:grid-cols-4).
// `m-0` is added to <dl>, <dd>, <h2> and <p>: this app does not rely on
// preflight, and <dd> carries a browser margin-left.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  { name: "intro", kind: "text", label: "Underneath", default: "", inlineEditable: true },
  {
    name: "stats",
    kind: "rows",
    label: "Number",
    addLabel: "Add a number",
    summary: ["value", "label"],
    fields: [
      { name: "value", kind: "string", label: "Number", default: "" },
      { name: "label", kind: "string", label: "Label", default: "" },
    ],
  },
] as const;

export type StatBandProps = PropsOf<typeof props>;

// Static class names, so Tailwind can see them.
const COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function StatBand({ heading, intro, stats }: StatBandProps) {
  const shown = (stats ?? []).filter((s) => String(s.value ?? "").trim()).slice(0, 4);
  if (!heading && !intro && shown.length === 0) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {heading || intro ? (
        <div className="mx-auto max-w-3xl text-center">
          {heading ? (
            <h2 className="m-0 text-3xl font-bold text-foreground sm:text-4xl">{heading}</h2>
          ) : null}
          {intro ? (
            <p className="mx-0 mb-0 mt-4 text-muted-foreground sm:text-xl">{intro}</p>
          ) : null}
        </div>
      ) : null}

      {shown.length > 0 ? (
        <dl
          className={`mx-0 mb-0 grid grid-cols-1 gap-4 ${heading || intro ? "mt-6 sm:mt-8" : "mt-0"} ${COLUMNS[shown.length] ?? COLUMNS[4]}`}
        >
          {shown.map((s, i) => (
            <div
              className="flex flex-col rounded-lg border border-border bg-card px-4 py-8 text-center"
              key={i}
            >
              <dt className="order-last text-lg font-medium text-muted-foreground">
                {String(s.label ?? "")}
              </dt>
              <dd className="m-0 text-4xl font-extrabold text-primary md:text-5xl">
                {String(s.value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export const statBand = defineBlock(
  {
    id: "ha-stat-band",
    label: "Stat band",
    category: "content",
    description: "Two to four big numbers, each with a label underneath.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  StatBand,
  () => ({
    heading: "The year in numbers",
    intro: "A short count of what the studio made and sold.",
    stats: [
      { value: "42", label: "Works sold" },
      { value: "9", label: "Exhibitions" },
      { value: "$18k", label: "Raised for artists" },
      { value: "310", label: "Collectors" },
    ],
  })
);
