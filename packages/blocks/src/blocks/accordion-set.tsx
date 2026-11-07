import { defineBlock, type PropsOf } from "../registry";
import { Region } from "../slot";

// ============================================================================
// Sections that open (2026-11-07): up to six headed sections that open and
// close, each holding blocks, not only text (the FAQ block holds text).
//
// <details>/<summary>, as the FAQ block: the browser gives open and close,
// keyboard use, find-in-page that opens the match and the right announcement,
// for no script. "One open at a time" is the `name` attribute on <details>
// (an exclusive group; a browser without it lets several open, which loses
// nothing). While the page is being edited every section is open, so each one
// can take a dropped block; the published page starts as the author chose.
//
// Six fixed slots, as Tabs has five, because a Puck list row cannot hold a slot.
// ============================================================================

const SECTION_COUNT = 6;

const props = [
  { name: "title1", kind: "string", label: "Section 1 heading", default: "First section" },
  { name: "section1", kind: "slot", label: "Section 1" },
  { name: "title2", kind: "string", label: "Section 2 heading", default: "Second section" },
  { name: "section2", kind: "slot", label: "Section 2" },
  { name: "title3", kind: "string", label: "Section 3 heading", description: "Leave empty for no third section.", default: "" },
  { name: "section3", kind: "slot", label: "Section 3" },
  { name: "title4", kind: "string", label: "Section 4 heading", default: "" },
  { name: "section4", kind: "slot", label: "Section 4" },
  { name: "title5", kind: "string", label: "Section 5 heading", default: "" },
  { name: "section5", kind: "slot", label: "Section 5" },
  { name: "title6", kind: "string", label: "Section 6 heading", default: "" },
  { name: "section6", kind: "slot", label: "Section 6" },
  {
    name: "look",
    kind: "select",
    label: "Look",
    default: "divided",
    options: [
      { value: "divided", label: "Divided, a line between each" },
      { value: "boxed", label: "Boxed, each in its own frame" },
      { value: "plain", label: "Plain, no lines" },
    ],
  },
  { name: "openFirst", kind: "boolean", label: "Open the first one", default: true },
  { name: "oneAtATime", kind: "boolean", label: "One open at a time", description: "Opening a section closes the one that was open.", default: false },
] as const;

export type AccordionSetProps = PropsOf<typeof props> & { id?: string; puck?: { isEditing?: boolean; boxEditing?: boolean } };

const safeId = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(v) ? v : "sections");

export function AccordionSet(p: AccordionSetProps) {
  const editing = Boolean(p.puck?.isEditing || p.puck?.boxEditing);
  const group = p.oneAtATime && !editing ? `blk-acc-${safeId(p.id)}` : undefined;
  const sections = Array.from({ length: SECTION_COUNT }, (_, i) => {
    const n = i + 1;
    const title = String((p as Record<string, unknown>)[`title${n}`] ?? "").trim();
    return { n, title, body: (p as Record<string, unknown>)[`section${n}`] as AccordionSetProps["section1"] };
  }).filter((s) => s.title);
  if (sections.length === 0) return null;
  const openFirst = p.openFirst ?? true;
  return (
    <div className="blk blk-acc" data-look={p.look ?? "divided"}>
      {sections.map((s, i) => (
        <details key={s.n} className="blk-acc-item" name={group} open={editing || (openFirst && i === 0)}>
          <summary className="blk-acc-head">
            <span className="blk-acc-title">{s.title}</span>
            <svg className="blk-acc-mark" viewBox="0 0 20 20" aria-hidden focusable="false">
              <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <Region of={s.body} className="blk-acc-body" />
        </details>
      ))}
    </div>
  );
}

export const accordionSet = defineBlock(
  {
    id: "accordion-set",
    category: "layout",
    label: "Sections that open",
    description: "Up to six headed sections that open and close, each holding blocks. No script. Name a section to add it.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Sections", sel: "> .blk-acc" },
      item: { label: "Section", sel: "> .blk-acc > .blk-acc-item", repeat: true },
      head: { label: "Section heading", sel: "> .blk-acc > .blk-acc-item > .blk-acc-head", repeat: true },
    },
  },
  AccordionSet,
  () => ({
    title1: "First section", title2: "Second section", title3: "", title4: "", title5: "", title6: "",
    look: "divided" as const, openFirst: true, oneAtATime: false,
  }),
);
