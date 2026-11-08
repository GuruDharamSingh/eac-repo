import { defineBlock, RichText, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// Passage (he-passage): a section of Ario's writing in the house type: a mono
// eyebrow, a Marcellus heading, Spectral paragraphs (formatted text, with an
// optional drop capital), and an optional list of chapter links beside or
// under it (the old site's "Introduction / Centers / Triads ..." buttons).
// ============================================================================

const props = [
  { name: "eyebrow", kind: "string", label: "Eyebrow", default: "", inlineEditable: true },
  { name: "heading", kind: "string", label: "Heading", default: "What is the Enneagram?", inlineEditable: true },
  { name: "body", kind: "richtext", label: "Text", default: "<p>Write here.</p>" },
  { name: "dropCap", kind: "boolean", label: "Drop capital on the first paragraph", default: false },
  {
    name: "links",
    kind: "rows",
    label: "Chapter links",
    addLabel: "Add a link",
    summary: ["label"],
    fields: [
      { name: "label", kind: "string", label: "Label", default: "" },
      { name: "note", kind: "string", label: "Line under it", default: "" },
      { name: "href", kind: "url", label: "Goes to", default: "" },
    ],
    default: [],
  },
  {
    name: "linksAt",
    kind: "select",
    label: "Links sit",
    default: "aside",
    options: [
      { value: "aside", label: "Beside the text (under it on a phone)" },
      { value: "below", label: "Under the text" },
    ],
  },
  {
    name: "width",
    kind: "select",
    label: "Width",
    default: "reading",
    options: [
      { value: "reading", label: "Reading measure" },
      { value: "wide", label: "Wide" },
    ],
  },
] as const;

type Props = PropsOf<typeof props>;

export function HePassage({ eyebrow, heading, body, dropCap = false, links = [], linksAt = "aside", width = "reading" }: Props) {
  const rows = (Array.isArray(links) ? links : []).filter((l) => typeof l.label === "string" && l.label.trim() && typeof l.href === "string" && l.href.trim());
  return (
    <section className="blk he-passage" data-links={rows.length ? linksAt : "none"} data-width={width} data-drop={dropCap ? "yes" : undefined}>
      <div className="he-passage-grid">
        <div className="he-passage-main">
          {eyebrow ? <p className="he-eyebrow">{eyebrow}</p> : null}
          {heading ? <h2 className="he-passage-title">{heading}</h2> : null}
          <RichText className="he-passage-body" body={body} />
        </div>
        {rows.length ? (
          <nav className="he-passage-links" aria-label={typeof heading === "string" && heading ? `${heading}: chapters` : "Chapters"}>
            {rows.map((l, i) => (
              <a key={`${l.href}-${i}`} href={String(l.href)}>
                <span className="he-passage-link">{String(l.label)}</span>
                {l.note ? <span className="he-passage-note">{String(l.note)}</span> : null}
              </a>
            ))}
          </nav>
        ) : null}
      </div>
    </section>
  );
}

export const hePassage = defineBlock(
  {
    id: "he-passage",
    label: "Passage",
    category: "content",
    description: "A section of writing in the house type, with optional chapter links beside it.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Passage", sel: "> .he-passage" },
      eyebrow: { label: "Eyebrow", sel: "> .he-passage .he-eyebrow", prop: "eyebrow" },
      heading: { label: "Heading", sel: "> .he-passage .he-passage-title", prop: "heading" },
      body: { label: "Text", sel: "> .he-passage .he-passage-body", prop: "body" },
      links: { label: "Chapter links", sel: "> .he-passage .he-passage-links" },
    },
    tokens: [
      { name: "--he-ink", label: "Heading ink", type: "color" },
      { name: "--he-ink-dim", label: "Text ink", type: "color" },
      { name: "--he-aurum", label: "Gold (eyebrow, links)", type: "color" },
    ],
  },
  HePassage,
);
