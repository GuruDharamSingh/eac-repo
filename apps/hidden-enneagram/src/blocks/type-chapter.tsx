import type { CSSProperties } from "react";
import { defineBlock, RichText, type PropsOf } from "@elkdonis/blocks";
import { TYPE_CHAPTERS } from "@/lib/exposition";

// ============================================================================
// A type's chapter (he-type, round 3, 2026-11-07): one of the nine, in Ario's
// words (the old /type-N Silex pages, folded into /enneagram). In the page it
// is a quiet row, number, name and epithets, that opens in place
// (<details>, no script needed); `#type-N` opens it and scrolls to it, which
// is where /type-N now redirects. With script, a tap opens the same chapter
// as a Surface popup instead (components/exposition/type-links.tsx; connector
// `enneagram-type` in components/hub/HubSurfaces.tsx), whose "In the page"
// comes back here: the popup and the row are twins, drawn from the same DOM.
// ============================================================================

const NUMS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const first = TYPE_CHAPTERS[0];

const props = [
  {
    name: "n",
    kind: "select",
    label: "Type",
    default: "1",
    options: NUMS.map((n) => ({ value: n, label: `Type ${n}` })),
  },
  { name: "name", kind: "string", label: "Name", default: first?.name ?? "", inlineEditable: true },
  { name: "epithets", kind: "string", label: "Epithets (line under the name)", default: first?.epithets ?? "" },
  { name: "lead", kind: "richtext", label: "Opening paragraphs", default: first?.lead ?? "" },
  { name: "body", kind: "richtext", label: "The rest (qualities, notes)", default: first?.body ?? "" },
  { name: "pageLabel", kind: "string", label: "Popup: button back to the page", default: "In the page" },
] as const;

type Props = PropsOf<typeof props>;

export function centerOf(n: number): "gut" | "heart" | "head" {
  return n === 8 || n === 9 || n === 1 ? "gut" : n <= 4 ? "heart" : "head";
}

export function HeType({ n = "1", name, epithets, lead, body, pageLabel }: Props) {
  const num = Math.min(9, Math.max(1, Number(n) || 1));
  return (
    <details
      className="blk he-type"
      id={`type-${num}`}
      data-he-type-chapter={num}
      data-page-label={typeof pageLabel === "string" && pageLabel.trim() ? pageLabel : undefined}
      style={{ "--type-hue": `var(--he-${centerOf(num)})` } as CSSProperties}
    >
      <summary className="he-type-row" data-he-type-open={num}>
        <span className="he-type-num" aria-hidden="true">
          {num}
        </span>
        <span className="he-type-id">
          <span className="he-type-name">{name || `Type ${num}`}</span>
          {epithets ? <span className="he-type-epithets">{epithets}</span> : null}
        </span>
        <span className="he-type-open" aria-hidden="true">
          Read
        </span>
      </summary>
      <div className="he-type-text">
        <RichText className="he-type-lead" body={lead} />
        <RichText className="he-type-body" body={body} />
      </div>
    </details>
  );
}

export const heType = defineBlock(
  {
    id: "he-type",
    label: "A type's chapter",
    category: "content",
    description: "One of the nine types in Ario's words: a row that opens in place, or as a popup with script. Its address is #type-N.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Chapter", sel: "> .he-type" },
      row: { label: "Row", sel: "> .he-type .he-type-row" },
      name: { label: "Name", sel: "> .he-type .he-type-name", prop: "name" },
      epithets: { label: "Epithets", sel: "> .he-type .he-type-epithets", prop: "epithets" },
      text: { label: "Text", sel: "> .he-type .he-type-text" },
    },
    tokens: [
      { name: "--he-ink", label: "Ink", type: "color" },
      { name: "--he-ink-dim", label: "Text ink", type: "color" },
    ],
  },
  HeType,
);
