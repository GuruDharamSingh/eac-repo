import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A heading that introduces a section.
//
// Lifted from the shape repeated in the retiring landing pages, where an
// eyebrow, a heading and a short accent rule were hand-written above every
// section — the same markup in Features.tsx, Philosophy.tsx and four others,
// each with its copy welded in.
//
// Note it renders an <h2> by default rather than an <h1>: a page normally has
// one <h1>, and that one belongs to the hero or the banner at the top. The
// level is a prop so an author can fix the order when it is wrong, because a
// page whose headings jump from h1 to h4 is genuinely harder to navigate with
// a screen reader.
// ============================================================================

const props = [
  { name: "title", kind: "string", label: "Heading", required: true, inlineEditable: true },
  {
    name: "eyebrow",
    kind: "string",
    label: "Small label above",
    description: "A short category line, e.g. What we do.",    inlineEditable: true,

  },
  { name: "subtitle", kind: "string", label: "Line underneath", inlineEditable: true },
  {
    name: "level",
    kind: "select",
    label: "Heading level",
    description: "Keep these in order down the page — do not skip a level.",
    default: "h2",
    options: [
      { value: "h2", label: "Section (h2)" },
      { value: "h3", label: "Sub-section (h3)" },
      { value: "h4", label: "Minor (h4)" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Alignment",
    default: "center",
    options: [
      { value: "center", label: "Centred" },
      { value: "start", label: "Left" },
    ],
  },
  {
    name: "rule",
    kind: "boolean",
    label: "Show the accent rule",
    default: true,
  },
] as const;

export type SectionHeadingProps = PropsOf<typeof props>;

export function SectionHeading({
  title,
  eyebrow,
  subtitle,
  level = "h2",
  align = "center",
  rule = true,
}: SectionHeadingProps) {
  const Tag = (level === "h3" ? "h3" : level === "h4" ? "h4" : "h2") as "h2" | "h3" | "h4";

  return (
    <div className="blk blk-heading" data-align={align}>
      {eyebrow && <p className="blk-heading-eyebrow">{eyebrow}</p>}
      <Tag className="blk-heading-title">{title}</Tag>
      {/* Decorative, so it is hidden from assistive tech rather than announced
          as a thematic break that means nothing. */}
      {rule && <span className="blk-heading-rule" aria-hidden="true" />}
      {subtitle && <p className="blk-heading-sub">{subtitle}</p>}
    </div>
  );
}

export const sectionHeading = defineBlock(
  {
    id: "section-heading",
    label: "Section heading",
    category: "headers",
    description: "A heading for a section, with an optional label above and rule beneath.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  SectionHeading,
  () => ({
    eyebrow: "What we do",
    title: "Pillars of the work",
    subtitle: "Four threads that run through everything we hold.",
    level: "h2" as const,
    align: "center" as const,
    rule: true,
  })
);
