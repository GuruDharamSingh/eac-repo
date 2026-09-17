import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A pulled quote.
//
// <blockquote> with a <cite> inside a <figcaption>, which is the shape that
// actually associates an attribution with what was said. A quote followed by a
// loose line of italics looks the same and means nothing.
// ============================================================================

const props = [
  { name: "text", kind: "text", label: "Quote", required: true },
  { name: "attribution", kind: "string", label: "Who said it", inlineEditable: true },
  { name: "source", kind: "string", label: "Where it is from" },
  {
    name: "tone",
    kind: "select",
    label: "Treatment",
    default: "rule",
    options: [
      { value: "rule", label: "Accent rule beside it" },
      { value: "large", label: "Large, centred" },
      { value: "panel", label: "On a tinted panel" },
    ],
  },
] as const;

export type QuoteProps = PropsOf<typeof props>;

export function Quote({ text, attribution, source, tone = "rule" }: QuoteProps) {
  if (!text?.trim()) return null;

  return (
    <figure className="blk blk-quote" data-tone={tone}>
      <blockquote className="blk-quote-text">{text}</blockquote>
      {(attribution || source) && (
        <figcaption className="blk-quote-by">
          {attribution}
          {attribution && source ? ", " : null}
          {source && <cite className="blk-quote-source">{source}</cite>}
        </figcaption>
      )}
    </figure>
  );
}

export const quote = defineBlock(
  {
    id: "quote",
    label: "Quote",
    category: "content",
    description: "A pulled quote with an optional attribution.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  Quote,
  () => ({
    text: "Crown yourself in the early hours of the morning.",
    attribution: "Yogi Bhajan",
    source: "",
    tone: "rule" as const,
  })
);
