import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// A page banner — HyperUI's "Center (Dark)" banner (MIT), taken VERBATIM.
//
// The classes are theirs, down to `bg-white`, `text-gray-900`, `text-indigo-600`
// and the whole `dark:` set. Nothing has been swapped for a site token, and
// that is the decision, not an oversight: the kits come in looking like
// themselves, and the site is coloured afterwards from one place.
//
// That works because Tailwind v4 compiles every colour utility to
// `var(--color-…)` — `.bg-white { background-color: var(--color-white) }` —
// so re-defining those variables at :root recolours this section, and every
// other harvested section, without a class being touched. The palette editor
// at /studio/theme is what writes them.
//
// The only changes are the ones a BLOCK requires rather than a page: the
// literal copy becomes props, and the emphasis word is its own field instead
// of a <strong> buried in a sentence.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  {
    name: "emphasis",
    kind: "string",
    label: "Emphasised word",
    description: "Picked out in the accent colour, in the middle of the heading.",
    default: "",
  },
  { name: "headingEnd", kind: "string", label: "…rest of the heading", default: "", inlineEditable: true },
  { name: "body", kind: "text", label: "Underneath", default: "", inlineEditable: true },
  { name: "primaryLabel", kind: "string", label: "First button", default: "" },
  { name: "primaryHref", kind: "url", label: "First button goes to", default: "" },
  { name: "secondaryLabel", kind: "string", label: "Second button", default: "" },
  { name: "secondaryHref", kind: "url", label: "Second button goes to", default: "" },
  {
    name: "fullHeight",
    kind: "boolean",
    label: "Fill the screen",
    description: "HyperUI's own `lg:h-screen`. A whole screen with nothing else on it.",
    default: false,
  },
] as const;

export type BannerProps = PropsOf<typeof props>;

export function Banner({
  heading,
  emphasis,
  headingEnd,
  body,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  fullHeight = false,
}: BannerProps) {
  if (!heading && !body) return null;

  return (
    <section
      className={`bg-white dark:bg-gray-900 ${fullHeight ? "lg:grid lg:h-screen lg:place-content-center" : ""}`}
    >
      <div className="mx-auto w-screen max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-prose text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">
            {heading}
            {emphasis ? <strong className="text-indigo-600"> {emphasis} </strong> : null}
            {headingEnd}
          </h1>

          {body ? (
            <p className="mt-4 text-base text-pretty text-gray-700 sm:text-lg/relaxed dark:text-gray-200">
              {body}
            </p>
          ) : null}

          {primaryLabel || secondaryLabel ? (
            <div className="mt-4 flex justify-center gap-4 sm:mt-6">
              {primaryLabel && primaryHref ? (
                <a
                  className="inline-block rounded border border-indigo-600 bg-indigo-600 px-5 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
                  href={primaryHref}
                >
                  {primaryLabel}
                </a>
              ) : null}
              {secondaryLabel && secondaryHref ? (
                <a
                  className="inline-block rounded border border-gray-200 px-5 py-3 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
                  href={secondaryHref}
                >
                  {secondaryLabel}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export const banner = defineBlock(
  {
    id: "banner",
    label: "Banner",
    category: "headers",
    description: "A full-width opening with a heading, a line underneath and up to two buttons.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  Banner,
  () => ({
    heading: "Paintings that keep",
    emphasis: "changing",
    headingEnd: "places",
    body: "Figure and ornament, built in thin glazes over an underdrawing that never quite disappears.",
    primaryLabel: "See the work",
    primaryHref: "/gallery",
    secondaryLabel: "Commission a piece",
    secondaryHref: "/contact",
    fullHeight: false,
  })
);
