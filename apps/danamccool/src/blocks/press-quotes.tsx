import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// What people have said — HyperUI's testimonial grid (MIT).
//
// Structure taken verbatim: a <ul> of cards, each a <blockquote> with the
// attribution beneath it. Two changes, both deliberate.
//
//   The portrait is gone. HyperUI's card hotlinks a stock photo from Unsplash,
//   which is a person who did not say this about Dana's work, on a domain that
//   can change or disappear. A press quote does not need a face.
//
//   The colours are her tokens. HyperUI ships `text-gray-700` and
//   `border-gray-200`, which on a violet ground is grey text on purple.
// ============================================================================

const props = [
  {
    name: "quotes",
    kind: "rows",
    label: "Quote",
    addLabel: "Add a quote",
    summary: ["name", "quote"],
    fields: [
      { name: "quote", kind: "text", label: "Quote", default: "" },
      { name: "name", kind: "string", label: "Who said it", default: "" },
      { name: "source", kind: "string", label: "Where", description: "Publication, exhibition, date.", default: "" },
    ],
  },
  {
    name: "columns",
    kind: "number",
    label: "Narrowest card",
    description: "The browser fits as many across as this allows.",
    default: 280,
    min: 200,
    max: 520,
    step: 10,
    unit: "px",
  },
] as const;

export type PressQuotesProps = PropsOf<typeof props>;

export function PressQuotes({ quotes, columns = 280 }: PressQuotesProps) {
  const shown = (quotes ?? []).filter((q) => String(q.quote ?? "").trim());
  if (shown.length === 0) return null;

  return (
    <ul
      className="grid gap-6"
      // Arbitrary values cannot take a runtime number, so the track lives in a
      // custom property. Tailwind compiles what it can SEE in this file.
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${columns}px, 100%), 1fr))`,
      }}
    >
      {shown.map((q, i) => (
        <li
          key={i}
          className="flex flex-col border border-[color-mix(in_srgb,var(--ink)_28%,var(--violet))] p-6"
        >
          {/* `m-0` is not decoration. HyperUI's markup assumes Tailwind's
              preflight, which zeroes the browser's default
              `blockquote { margin: 1em 40px }`. This site deliberately skips
              preflight to protect Dana's own CSS, so every UA default survives
              and harvested markup inherits them — measured here as a 40px
              inset on both sides that read, at a glance, as bad alignment.
              Expect this with any copied section: lists keep their bullets,
              headings keep their sizes, fieldsets keep their borders. */}
          <blockquote className="m-0 flex-1 text-[var(--ink)]">
            &ldquo;{String(q.quote)}&rdquo;
          </blockquote>
          {String(q.name ?? "").trim() || String(q.source ?? "").trim() ? (
            <footer className="mt-6">
              {String(q.name ?? "").trim() ? (
                <p className="text-sm font-medium text-[var(--ink)]">{String(q.name)}</p>
              ) : null}
              {String(q.source ?? "").trim() ? (
                <p className="text-xs text-[var(--ink)] opacity-75">{String(q.source)}</p>
              ) : null}
            </footer>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export const pressQuotes = defineBlock(
  {
    id: "press-quotes",
    label: "Press quotes",
    category: "listings",
    description: "A grid of things people have written about the work.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  PressQuotes,
  () => ({
    quotes: [
      { quote: "Ornament that turns out, on looking, to be a crowd of faces.", name: "", source: "Exhibition note, 2024" },
      { quote: "The underdrawing stays visible the whole way through.", name: "", source: "Studio visit" },
    ],
    columns: 280,
  })
);
