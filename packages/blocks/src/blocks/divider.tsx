import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A break between things.
//
// Two jobs in one block, chosen by `style`: a visible rule, or plain empty
// space. They are the same block because they answer the same question — "put
// a gap here" — and an author who wants air between two sections should not
// have to know that one of those is an <hr> and the other is a <div>.
//
// The distinction that IS kept is semantic: a rule marks a change of subject
// and is announced as a separator; space is decorative and is hidden. Getting
// that backwards fills a screen reader with meaningless separators.
// ============================================================================

const props = [
  {
    name: "style",
    kind: "select",
    label: "Kind",
    default: "rule",
    options: [
      { value: "rule", label: "A line" },
      { value: "accent", label: "A short accent line" },
      { value: "space", label: "Just space" },
    ],
  },
  {
    name: "size",
    kind: "select",
    label: "Space around it",
    default: "regular",
    options: [
      { value: "tight", label: "Tight" },
      { value: "regular", label: "Regular" },
      { value: "loose", label: "Loose" },
    ],
  },
] as const;

export type DividerProps = PropsOf<typeof props>;

export function Divider({ style = "rule", size = "regular" }: DividerProps) {
  if (style === "space") {
    return <div className="blk blk-divider" data-style="space" data-size={size} aria-hidden="true" />;
  }
  return <hr className="blk blk-divider" data-style={style} data-size={size} />;
}

export const divider = defineBlock(
  {
    id: "divider",
    label: "Divider",
    category: "layout",
    description: "A line or a gap between sections.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  Divider,
  () => ({ style: "rule" as const, size: "regular" as const })
);
