import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// A vertical timeline.
//
// Source:  HyperUI "Timelines" 1 — public/examples/application/timelines/1.html
//          https://github.com/markmead/hyperui (MIT, Copyright (c) Mark Mead;
//          see ./NOTICE.md)
//
// Changes: bg-gray-200 rule -> bg-border; bg-blue-600 dots -> bg-primary;
// gray-700 / gray-900 text -> text-muted-foreground / text-foreground.
// `highlightFirst` (new): the first dot gets a ring and the others turn
// bg-muted-foreground, so the newest event reads as current. The <ol> gets
// `m-0 p-0 list-none`, <li> `list-none`, <h3> and <p> `m-0`. The heading
// (<time>, <h3>, <p>) keeps HyperUI's sizes and spacing.
// ============================================================================

const props = [
  {
    name: "events",
    kind: "rows",
    label: "Event",
    addLabel: "Add an event",
    summary: ["when", "title"],
    fields: [
      { name: "when", kind: "string", label: "When", default: "" },
      { name: "title", kind: "string", label: "Title", default: "" },
      { name: "text", kind: "text", label: "Text", default: "" },
    ],
  },
  {
    name: "highlightFirst",
    kind: "boolean",
    label: "Highlight the first event",
    description: "Rings the first dot and quiets the rest.",
    default: false,
  },
] as const;

export type TimelineProps = PropsOf<typeof props>;

export function Timeline({ events, highlightFirst = false }: TimelineProps) {
  const shown = (events ?? []).filter((e) => String(e.title ?? "").trim() || String(e.when ?? "").trim());
  if (shown.length === 0) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <ol className="relative m-0 list-none space-y-8 p-0 before:absolute before:-ms-px before:h-full before:w-0.5 before:rounded-full before:bg-border">
        {shown.map((e, i) => {
          const dot = highlightFirst
            ? i === 0
              ? "bg-primary ring-4 ring-primary/25"
              : "bg-muted-foreground"
            : "bg-primary";
          return (
            <li className="relative -ms-1.5 flex list-none items-start gap-4" key={i}>
              <span className={`size-3 shrink-0 rounded-full ${dot}`} aria-hidden="true"></span>

              <div className="-mt-2">
                {String(e.when ?? "").trim() ? (
                  <time className="text-xs/none font-medium text-muted-foreground">{String(e.when)}</time>
                ) : null}
                {String(e.title ?? "").trim() ? (
                  <h3 className="m-0 text-lg font-bold text-foreground">{String(e.title)}</h3>
                ) : null}
                {String(e.text ?? "").trim() ? (
                  <p className="mx-0 mb-0 mt-0.5 text-sm text-muted-foreground">{String(e.text)}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const timeline = defineBlock(
  {
    id: "ha-timeline",
    label: "Timeline",
    category: "content",
    description: "A vertical line of dated events, each with a title and a few words.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  Timeline,
  () => ({
    events: [
      { when: "March 2025", title: "Studio opens", text: "The first twelve members move in and hang the opening show." },
      { when: "June 2025", title: "First auction", text: "Forty works go to a live room and an online bidding window." },
      { when: "October 2025", title: "Touring show", text: "A selection travels to three partner venues." },
    ],
    highlightFirst: false,
  })
);
