import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A call to action.
//
// Always an <a>, never a <button>: it navigates. A <button> that navigates
// cannot be opened in a new tab, cannot be copied as a link, and tells a
// screen reader the wrong thing about what is about to happen.
//
// It is styled through the block tokens rather than importing the shared
// Button, so that a page rendered on an app which has not adopted
// @elkdonis/primitives still draws it correctly. That is the same reason every
// block here is plain CSS.
// ============================================================================

const props = [
  { name: "label", kind: "string", label: "Label", required: true, inlineEditable: true },
  { name: "href", kind: "url", label: "Goes to", required: true },
  {
    name: "tone",
    kind: "select",
    label: "Treatment",
    default: "filled",
    options: [
      { value: "filled", label: "Filled" },
      { value: "outline", label: "Outlined" },
      { value: "quiet", label: "Text only" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Alignment",
    default: "start",
    options: [
      { value: "start", label: "Left" },
      { value: "center", label: "Centred" },
    ],
  },
  {
    name: "newTab",
    kind: "boolean",
    label: "Open in a new tab",
    default: false,
  },
] as const;

export type LinkButtonProps = PropsOf<typeof props>;

export function LinkButton({ label, href, tone = "filled", align = "start", newTab = false }: LinkButtonProps) {
  if (!label || !href) return null;

  return (
    <div className="blk blk-cta" data-align={align}>
      <a
        className="blk-cta-link"
        data-tone={tone}
        href={href}
        // noreferrer alongside noopener: without it the new page can read
        // where it came from, and opener access is the actual security issue.
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {label}
        {/* Says out loud what the icon-free visual cue cannot. */}
        {newTab && <span className="blk-sr"> (opens in a new tab)</span>}
      </a>
    </div>
  );
}

export const linkButton = defineBlock(
  {
    id: "link-button",
    label: "Button",
    category: "actions",
    description: "A link styled as a button.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  LinkButton,
  () => ({
    label: "Join us",
    href: "#",
    tone: "filled" as const,
    align: "start" as const,
    newTab: false,
  })
);
