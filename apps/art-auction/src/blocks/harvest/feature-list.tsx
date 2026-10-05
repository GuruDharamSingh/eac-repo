import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// A checklist of features: a tick, a bold line, a sentence underneath.
//
// Source:  HyperUI "Pricing" 1 — public/examples/marketing/pricing/1.html
//          (the `ul.space-y-2` check-mark rows), with the heading block and
//          spacing of "Feature Grids" 1 —
//          public/examples/marketing/feature-grids/1.html
//          https://github.com/markmead/hyperui (MIT, Copyright (c) Mark Mead;
//          see ./NOTICE.md)
//
// Changes: indigo-700 tick -> text-primary; gray-700 text -> text-foreground
// for the title and text-muted-foreground for the sentence; the rows sit on a
// bg-card panel with border-border. HyperUI's rows have one line each; a
// second line (`text`) is added, and the row spacing grows from space-y-2 to
// space-y-4 to suit it. The check <svg> is HyperUI's, unchanged (fixed
// markup, not author input). `m-0 list-none p-0` on <ul>; `list-none m-0` on
// <li>; `m-0` on <h2>, <p>.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  { name: "intro", kind: "text", label: "Underneath", default: "", inlineEditable: true },
  {
    name: "items",
    kind: "rows",
    label: "Item",
    addLabel: "Add an item",
    summary: ["title"],
    fields: [
      { name: "title", kind: "string", label: "Title", default: "" },
      { name: "text", kind: "text", label: "Text", default: "" },
    ],
  },
] as const;

export type FeatureListProps = PropsOf<typeof props>;

export function FeatureList({ heading, intro, items }: FeatureListProps) {
  const shown = (items ?? []).filter((it) => String(it.title ?? "").trim());
  if (!heading && !intro && shown.length === 0) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {heading || intro ? (
        <div className="mx-auto max-w-lg text-center">
          {heading ? (
            <h2 className="m-0 text-3xl/tight font-bold text-foreground sm:text-4xl">{heading}</h2>
          ) : null}
          {intro ? (
            <p className="mx-0 mb-0 mt-4 text-lg text-pretty text-muted-foreground">{intro}</p>
          ) : null}
        </div>
      ) : null}

      {shown.length > 0 ? (
        <ul
          className={`${heading || intro ? "mt-8" : "mt-0"} mb-0 mx-0 list-none space-y-4 rounded-2xl border border-border bg-card p-6 sm:px-8`}
        >
          {shown.map((it, i) => (
            <li className="m-0 flex list-none items-start gap-3" key={i}>
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="mt-0.5 size-5 shrink-0 text-primary"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>

              <div>
                <p className="m-0 font-semibold text-card-foreground">{String(it.title)}</p>
                {String(it.text ?? "").trim() ? (
                  <p className="mx-0 mb-0 mt-1 text-pretty text-muted-foreground">{String(it.text)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export const featureList = defineBlock(
  {
    id: "ha-feature-list",
    label: "Feature checklist",
    category: "content",
    description: "A heading and a ticked list; each row has a bold line and a sentence.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  FeatureList,
  () => ({
    heading: "What a listing includes",
    intro: "Every work offered through the house gets the same treatment.",
    items: [
      { title: "Condition report", text: "Written and photographed by a member of staff." },
      { title: "Framing advice", text: "Suggestions for display, with local framers we trust." },
      { title: "Shipping quote", text: "A fixed price before you bid, not after." },
    ],
  })
);
