import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// A feature grid — HyperUI's "Grid with content" (MIT), taken verbatim.
//
// Their classes, their spacing, their `rounded-lg border border-gray-200`
// cards. See ./banner for why nothing is swapped for a site token.
//
// The icon is the one deviation, and it is forced: HyperUI inlines a different
// <svg> path per card, which is markup an author cannot type into a field.
// The block offers a small fixed set instead, by name — a paint mark, a frame,
// a letter, a clock — chosen for what an artist's page actually says. A free
// SVG field would be a hole: it is author-supplied markup rendered into a
// public page.
// ============================================================================

const ICONS = {
  spark: "m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z",
  frame: "M3.75 3.75h16.5v16.5H3.75zM3.75 8.25h16.5M8.25 3.75v16.5",
  letter: "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  eye: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z",
} as const;

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  { name: "intro", kind: "text", label: "Underneath", default: "", inlineEditable: true },
  {
    name: "features",
    kind: "rows",
    label: "Feature",
    addLabel: "Add a feature",
    summary: ["title"],
    fields: [
      { name: "title", kind: "string", label: "Title", default: "" },
      { name: "text", kind: "text", label: "Text", default: "" },
      {
        name: "icon",
        kind: "select",
        label: "Mark",
        default: "spark",
        options: [
          { value: "spark", label: "Spark" },
          { value: "frame", label: "Frame" },
          { value: "letter", label: "Letter" },
          { value: "clock", label: "Clock" },
          { value: "eye", label: "Eye" },
        ],
      },
    ],
  },
] as const;

export type FeatureGridProps = PropsOf<typeof props>;

export function FeatureGrid({ heading, intro, features }: FeatureGridProps) {
  const shown = (features ?? []).filter((f) => String(f.title ?? "").trim());
  if (!heading && shown.length === 0) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {heading || intro ? (
        <div className="mx-auto max-w-lg text-center">
          {heading ? (
            <h2 className="text-3xl/tight font-bold text-gray-900 sm:text-4xl">{heading}</h2>
          ) : null}
          {intro ? <p className="mt-4 text-lg text-pretty text-gray-700">{intro}</p> : null}
        </div>
      ) : null}

      {shown.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
          {shown.map((feature, i) => {
            const path = ICONS[String(feature.icon ?? "spark") as keyof typeof ICONS] ?? ICONS.spark;
            return (
              <div className="rounded-lg border border-gray-200 p-6" key={i}>
                <div className="inline-flex rounded-lg bg-gray-100 p-3 text-gray-700">
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-6"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{String(feature.title)}</h3>
                {String(feature.text ?? "").trim() ? (
                  <p className="mt-2 text-pretty text-gray-700">{String(feature.text)}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export const featureGrid = defineBlock(
  {
    id: "feature-grid",
    label: "Feature grid",
    category: "content",
    description: "A heading and a row of three things, each with a mark, a title and a line.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  FeatureGrid,
  () => ({
    heading: "How the work is made",
    intro: "Three things that are true of everything in the studio.",
    features: [
      { title: "Thin glazes", text: "Built in layers, so the underdrawing stays visible the whole way through.", icon: "eye" },
      { title: "Nothing painted out", text: "What was wrong the first time is still there, holding up what came after.", icon: "frame" },
      { title: "Months, not days", text: "Between two months and a year, depending on scale.", icon: "clock" },
    ],
  })
);
