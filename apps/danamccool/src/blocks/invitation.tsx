import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// An invitation band — and the first block written for ONE site.
//
// Two things are being proved here at once.
//
// 1. THE PER-SITE CATALOGUE. `createCatalogue([...SHARED_BLOCKS, ...myBlocks])`
//    has been the stated route to bespoke work since the registry was written
//    and nothing had ever taken it. This block lives in the app, not the
//    library, and is passed to `buildEditorConfig({ blocks })`. Nothing in
//    @elkdonis/blocks changed to make room for it.
//
// 2. TAILWIND, HERE, SAFELY. The structure is HyperUI's centred call-to-action
//    (MIT) with its utility classes intact — which is exactly what could NOT
//    be done before this site compiled Tailwind. It lives in the app because a
//    utility-classed block in the SHARED library renders naked in any app that
//    has not pointed Tailwind at the library's source. Site-local means
//    site-scoped risk.
//
// The colours are arbitrary values reading her own custom properties rather
// than HyperUI's `bg-rose-600` and `text-gray-900`. That is the whole bridge
// between the two systems: utilities for layout, her tokens for colour, so the
// band belongs to this site instead of looking like a sample.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  { name: "body", kind: "string", label: "Line underneath", default: "", inlineEditable: true },
  { name: "label", kind: "string", label: "Button", default: "Get in touch" },
  { name: "href", kind: "url", label: "Button goes to", default: "/contact" },
  {
    name: "tone",
    kind: "select",
    label: "Ground",
    default: "panel",
    options: [
      { value: "panel", label: "Deeper violet" },
      { value: "ink", label: "Near-black" },
    ],
  },
] as const;

export type InvitationProps = PropsOf<typeof props>;

export function Invitation({ heading, body, label = "Get in touch", href = "/contact", tone = "panel" }: InvitationProps) {
  if (!heading && !body) return null;

  // Ink on the deeper violet measures 3.96:1 and fails, so the panel tone
  // carries CREAM text, not ink — the same measurement that put paper under
  // the form fields. The near-black ground is 18.7:1 with cream.
  const ground = tone === "ink" ? "bg-[var(--ink)]" : "bg-[var(--violet-panel)]";

  return (
    <section className={`${ground} text-[#fdf5e6]`}>
      <div className="p-8 md:p-12 lg:px-16 lg:py-20">
        <div className="mx-auto max-w-lg text-center">
          {heading ? <h2 className="text-2xl font-semibold md:text-3xl">{heading}</h2> : null}
          {body ? <p className="mt-4 opacity-90">{body}</p> : null}

          {href ? (
            <a
              href={href}
              className="mt-8 inline-flex items-center gap-2 bg-[var(--cyan)] px-6 py-3 text-sm font-semibold text-[var(--ink)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fdf5e6]"
            >
              {label}
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export const invitation = defineBlock(
  {
    id: "invitation",
    label: "Invitation band",
    category: "actions",
    description: "A full-width band with a heading and one button.",
    memberSafe: true,
    // Declared honestly. This block only renders correctly where Tailwind is
    // compiled over this file — which is this site, and nowhere else.
    styling: "tailwind",
    props,
  },
  Invitation,
  () => ({
    heading: "Commission a piece",
    body: "Tell me the size, the setting and roughly when you need it.",
    label: "Get in touch",
    href: "/contact",
    tone: "panel" as const,
  })
);
