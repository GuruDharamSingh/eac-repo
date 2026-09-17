import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// Questions and answers.
//
// Structure taken from HyperUI's FAQ section (MIT), which gets the important
// thing right: it is a list of <details>/<summary>, not a pile of divs with
// click handlers. That choice is worth more than the styling it came wrapped
// in — the browser gives us open/close, keyboard operation, focus handling,
// find-in-page that opens the matching answer, and correct announcement to a
// screen reader, for no JavaScript at all. This block is therefore NOT
// interactive: it renders on the server and ships nothing to the visitor.
//
// What did NOT come across is the Tailwind. HyperUI's markup carries utility
// classes, and a utility class in a shared package renders as nothing in an
// app that does not compile Tailwind over this package's source — which is
// three of the sites here, including the one this was built for. The classes
// are the disposable part; the element structure is the part with the thinking
// in it. See the `styling` field on every block in this library.
// ============================================================================

const props = [
  {
    name: "items",
    kind: "rows",
    label: "Question",
    addLabel: "Add a question",
    summary: ["question"],
    fields: [
      { name: "question", kind: "string", label: "Question", default: "" },
      {
        name: "answer",
        kind: "text",
        label: "Answer",
        description: "Leave a blank line between paragraphs.",
        default: "",
      },
    ],
  },
  {
    name: "look",
    kind: "select",
    label: "Look",
    default: "divided",
    options: [
      { value: "divided", label: "Divided — a line between each" },
      { value: "boxed", label: "Boxed — each in its own frame" },
      { value: "plain", label: "Plain — no lines" },
    ],
  },
  {
    name: "openFirst",
    kind: "boolean",
    label: "Open the first one",
    description: "So the page does not look like a list of closed doors.",
    default: true,
  },
] as const;

export type FaqProps = PropsOf<typeof props>;

export function Faq({ items, look = "divided", openFirst = true }: FaqProps) {
  const questions = (items ?? []).filter((row) => String(row.question ?? "").trim());
  if (questions.length === 0) return null;

  return (
    <div className="blk blk-faq" data-look={look}>
      {questions.map((row, i) => (
        <details className="blk-faq-item" key={i} open={openFirst && i === 0}>
          <summary className="blk-faq-q">
            <span className="blk-faq-q-text">{String(row.question)}</span>
            {/* Inline, not an icon font or a library: one <svg> costs nothing
                and cannot fail to load. aria-hidden because the open state is
                already announced by <details> itself. */}
            <svg className="blk-faq-mark" viewBox="0 0 20 20" aria-hidden focusable="false">
              <path
                d="M5 7.5 10 12.5 15 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </summary>
          <div className="blk-faq-a">
            {String(row.answer ?? "")
              .split(/\r?\n\s*\r?\n/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((paragraph, j) => (
                <p key={j}>{paragraph}</p>
              ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export const faq = defineBlock(
  {
    id: "faq",
    label: "Questions & answers",
    category: "content",
    description: "A list of questions that open and close. No JavaScript.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  Faq,
  () => ({
    items: [
      {
        question: "Do you take commissions?",
        answer: "Yes. Write with the size, the setting and roughly when you need it, and I will say whether it is something I can do.",
      },
      {
        question: "How long does a painting take?",
        answer: "Between two months and a year, depending on scale.\n\nI work in thin glazes and each one has to dry.",
      },
      { question: "Do you ship?", answer: "Anywhere, crated, at cost." },
    ],
    look: "divided" as const,
    openFirst: true,
  })
);
