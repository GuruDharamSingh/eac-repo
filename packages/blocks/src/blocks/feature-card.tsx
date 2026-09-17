import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// One cell of a grid: a marker, a title, a few words.
//
// Covers both patterns the retiring pages used — Features drew an icon above
// each card, Philosophy drew a big number — because they are the same card
// with a different marker. Rather than take an icon component (which would
// mean an icon library in a package that has none), the marker is a short
// string: a number, a glyph, an emoji. That is enough for both and costs
// nothing.
// ============================================================================

const props = [
  { name: "title", kind: "string", label: "Title", required: true, inlineEditable: true },
  { name: "body", kind: "text", label: "Text", inlineEditable: true },
  {
    name: "marker",
    kind: "string",
    label: "Marker",
    description: "A number or a symbol above the title, e.g. 01 or ✦.",
  },
  {
    name: "href",
    kind: "url",
    label: "Link",
    description: "Makes the whole card a link.",
  },
  {
    name: "tone",
    kind: "select",
    label: "Treatment",
    default: "panel",
    options: [
      { value: "panel", label: "On a panel" },
      { value: "bordered", label: "Outlined" },
      { value: "plain", label: "Plain" },
    ],
  },
] as const;

export type FeatureCardProps = PropsOf<typeof props>;

export function FeatureCard({ title, body, marker, href, tone = "panel" }: FeatureCardProps) {
  const inner = (
    <>
      {/* Decorative: "01" read aloud before every heading is noise, and the
          heading already carries the meaning. */}
      {marker && (
        <span className="blk-card-marker" aria-hidden="true">
          {marker}
        </span>
      )}
      <h3 className="blk-card-title">{title}</h3>
      {body && <p className="blk-card-body">{body}</p>}
    </>
  );

  // A linked card is an <a>; an unlinked one is an <article>. Not a div with a
  // click handler — that is unreachable by keyboard and invisible to a screen
  // reader, and it is the usual way a "clickable card" goes wrong.
  return href ? (
    <a className="blk blk-card" data-tone={tone} href={href}>
      {inner}
    </a>
  ) : (
    <article className="blk blk-card" data-tone={tone}>
      {inner}
    </article>
  );
}

export const featureCard = defineBlock(
  {
    id: "feature-card",
    label: "Card",
    category: "content",
    description: "A marker, a title and a few words. Made to sit in a grid.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  FeatureCard,
  () => ({
    marker: "01",
    title: "Gathering",
    body: "We meet before dawn, and we keep the hours together.",
    href: "",
    tone: "panel" as const,
  })
);
