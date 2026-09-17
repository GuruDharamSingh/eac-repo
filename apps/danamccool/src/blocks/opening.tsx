import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// An opening — Preline UI's centred hero (MIT + Preline Fair Use).
//
// Preline's current markup is TOKEN-DRIVEN rather than palette-driven:
// `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`,
// `border-border`. That is what makes it worth taking. Those class names
// resolve to Tailwind theme variables, so defining the variables from her
// palette (see the @theme block in globals.css) themes the whole block without
// touching a single class — which is the same move daisyUI makes, and the same
// move this repo's own --eac-block-* tokens make.
//
// No Preline JavaScript. Their interactive components (dropdowns, tabs,
// carousels) need their plugin; a hero is markup, and a block that pulls a
// third-party runtime onto a public page is a block this site does not want.
//
// ATTRIBUTION IS A LICENCE CONDITION HERE, not a courtesy. Preline is dual
// licensed — MIT plus a "Fair Use" rider that permits use in a page builder
// only with proper attribution naming Preline UI and linking the repository.
// That credit is on /credits, linked from every page's footer. If this block
// is ever removed, check whether anything else here still needs that page.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  { name: "lede", kind: "text", label: "Underneath", default: "", inlineEditable: true },
  { name: "primaryLabel", kind: "string", label: "First button", default: "" },
  { name: "primaryHref", kind: "url", label: "First button goes to", default: "" },
  { name: "secondaryLabel", kind: "string", label: "Second button", default: "" },
  { name: "secondaryHref", kind: "url", label: "Second button goes to", default: "" },
  {
    name: "size",
    kind: "select",
    label: "Height",
    default: "regular",
    options: [
      { value: "tight", label: "Tight" },
      { value: "regular", label: "Regular" },
      { value: "tall", label: "Tall" },
    ],
  },
] as const;

export type OpeningProps = PropsOf<typeof props>;

const PAD = {
  tight: "py-12",
  regular: "py-24",
  tall: "py-32 sm:py-40",
} as const;

export function Opening({
  heading,
  lede,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  size = "regular",
}: OpeningProps) {
  if (!heading && !lede) return null;
  const pad = PAD[size as keyof typeof PAD] ?? PAD.regular;

  return (
    <div className="relative bg-background">
      <div className={`mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 ${pad}`}>
        <div className="space-y-8 text-center">
          {heading ? (
            <h1 className="text-4xl font-semibold text-foreground sm:text-5xl lg:text-6xl">
              {heading}
            </h1>
          ) : null}
          {lede ? <p className="text-lg text-muted-foreground">{lede}</p> : null}

          {primaryLabel || secondaryLabel ? (
            <div className="flex flex-wrap justify-center gap-3">
              {primaryLabel && primaryHref ? (
                <a
                  className="inline-flex items-center gap-2 bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                  href={primaryHref}
                >
                  {primaryLabel}
                </a>
              ) : null}
              {secondaryLabel && secondaryHref ? (
                <a
                  className="inline-flex items-center gap-2 border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
                  href={secondaryHref}
                >
                  {secondaryLabel}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const opening = defineBlock(
  {
    id: "opening",
    label: "Opening",
    category: "headers",
    description: "A centred opening for a page — heading, a line underneath, and up to two buttons.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  Opening,
  () => ({
    heading: "Dana McCool",
    lede: "Paintings, collage and resin sculpture, built in thin glazes over an underdrawing that never quite disappears.",
    primaryLabel: "See the work",
    primaryHref: "/gallery",
    secondaryLabel: "Commission a piece",
    secondaryHref: "/contact",
    size: "regular" as const,
  })
);
