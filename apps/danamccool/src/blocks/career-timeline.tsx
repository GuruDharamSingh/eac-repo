import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// A timeline — daisyUI (MIT).
//
// The third kind of intake, and the most different. HyperUI and Preline are
// markup you copy; daisyUI is a Tailwind PLUGIN that adds semantic classes —
// `timeline`, `timeline-box` — whose colours come from CSS variables. That is
// much closer to how everything else on this network is themed than raw
// utilities are, which is why it is worth a dependency at all: the theme in
// globals.css maps her palette onto daisyUI's variables once, and every
// daisyUI class then arrives already wearing her colours.
//
// Only the components this site actually places are compiled (`include:` in
// the plugin config), so the dependency costs what it uses and no more.
//
// Not a replacement for the shared "Dated list" block. That one is a
// description list — the right thing for a CV of forty entries, where a
// timeline would be four screens of zig-zag. This is for a handful of moments
// that deserve the room.
// ============================================================================

const props = [
  {
    name: "moments",
    kind: "rows",
    label: "Moment",
    addLabel: "Add a moment",
    summary: ["year", "title"],
    fields: [
      { name: "year", kind: "string", label: "When", default: "" },
      { name: "title", kind: "string", label: "What", default: "" },
      { name: "detail", kind: "text", label: "More", default: "" },
    ],
  },
  {
    name: "compact",
    kind: "boolean",
    label: "All on one side",
    description: "Rather than alternating left and right. Better on a narrow screen.",
    default: false,
  },
] as const;

export type CareerTimelineProps = PropsOf<typeof props>;

export function CareerTimeline({ moments, compact = false }: CareerTimelineProps) {
  const shown = (moments ?? []).filter(
    (m) => String(m.year ?? "").trim() || String(m.title ?? "").trim()
  );
  if (shown.length === 0) return null;

  return (
    <ul className={`timeline timeline-vertical ${compact ? "timeline-compact" : ""}`}>
      {shown.map((moment, i) => {
        const year = String(moment.year ?? "");
        const title = String(moment.title ?? "");
        const detail = String(moment.detail ?? "").trim();
        // Alternating sides, which is what a vertical timeline is for. The
        // `hr` before and after is how daisyUI draws the connecting line; the
        // first and last are omitted so the line does not overshoot the ends.
        const side = !compact && i % 2 === 1 ? "timeline-start" : "timeline-end";
        const opposite = !compact && i % 2 === 1 ? "timeline-end" : "timeline-start";
        return (
          <li key={i}>
            {i > 0 ? <hr /> : null}
            <div className={`${opposite} font-mono text-sm opacity-80`}>{year}</div>
            <div className="timeline-middle">
              <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <circle cx="10" cy="10" r="5" />
              </svg>
            </div>
            <div className={`${side} timeline-box`}>
              <p className="font-medium">{title}</p>
              {detail ? <p className="mt-1 text-sm opacity-80">{detail}</p> : null}
            </div>
            {i < shown.length - 1 ? <hr /> : null}
          </li>
        );
      })}
    </ul>
  );
}

export const careerTimeline = defineBlock(
  {
    id: "career-timeline",
    label: "Timeline",
    category: "listings",
    description: "A handful of moments down a line. For a few turning points, not a whole CV.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  CareerTimeline,
  () => ({
    moments: [
      { year: "2024", title: "Radical Renaissance", detail: "Solo exhibition, Toronto" },
      { year: "2022", title: "The Universal Pharmacy", detail: "A cosmology of remedies that do not exist" },
      { year: "2019", title: "Botanical resin sculptures", detail: "The first of the cast pieces" },
    ],
    compact: false,
  })
);
