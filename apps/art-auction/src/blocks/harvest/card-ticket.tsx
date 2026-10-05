import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// A ticket-style card: details above a dashed tear line, price and button in
// the stub below.
//
// Source:  HyperUI "Pricing" 1 — public/examples/marketing/pricing/1.html
//          https://github.com/markmead/hyperui (MIT, Copyright (c) Mark Mead;
//          see ./NOTICE.md)
//
// Changes: the card is HyperUI's `rounded-2xl border p-6 shadow-xs` shell, the
// `text-3xl font-bold` price figure and the `rounded-full` button; the tear
// line and the stub are new. indigo-600 -> primary (border, button, kicker),
// white -> bg-card, gray-900 / gray-700 -> text-card-foreground /
// text-muted-foreground; the stub sits on bg-muted. No notches are cut into
// the edges: they would need a fill matching whatever the page sits on.
// `m-0` on <h3> and <p>.
// ============================================================================

const props = [
  { name: "kicker", kind: "string", label: "Small line above", default: "", inlineEditable: true },
  { name: "title", kind: "string", label: "Title", default: "", inlineEditable: true },
  { name: "meta", kind: "string", label: "Date, place or other detail", default: "", inlineEditable: true },
  { name: "figure", kind: "string", label: "Price or number", default: "" },
  { name: "figureLabel", kind: "string", label: "Under the price", default: "" },
  { name: "href", kind: "url", label: "Button goes to", default: "" },
  { name: "buttonLabel", kind: "string", label: "Button words", default: "" },
] as const;

export type CardTicketProps = PropsOf<typeof props>;

function safeHref(href: string | undefined): string | undefined {
  const h = String(href ?? "").trim();
  return /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(h) ? h : undefined;
}

export function CardTicket({ kicker, title, meta, figure, figureLabel, href, buttonLabel }: CardTicketProps) {
  if (!title && !figure) return null;
  const link = safeHref(href);

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-xs">
        <div className="p-6 sm:px-8">
          {kicker ? (
            <p className="m-0 text-sm font-medium tracking-widest text-primary uppercase">{kicker}</p>
          ) : null}
          {title ? <h3 className="mx-0 mb-0 mt-1 text-xl font-bold text-card-foreground sm:text-2xl">{title}</h3> : null}
          {meta ? <p className="mx-0 mb-0 mt-2 text-sm text-muted-foreground">{meta}</p> : null}
        </div>

        <div className="border-t-2 border-dashed border-border" aria-hidden="true"></div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-b-2xl bg-muted p-6 sm:px-8">
          <div>
            {figure ? (
              <p className="m-0 text-3xl font-bold text-card-foreground sm:text-4xl">{figure}</p>
            ) : null}
            {figureLabel ? (
              <p className="m-0 text-sm font-medium text-muted-foreground">{figureLabel}</p>
            ) : null}
          </div>

          {link && buttonLabel ? (
            <a
              href={link}
              className="block rounded-full border border-primary bg-primary px-8 py-3 text-center text-sm font-medium text-primary-foreground no-underline hover:ring-1 hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {buttonLabel}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const cardTicket = defineBlock(
  {
    id: "ha-card-ticket",
    label: "Ticket card",
    category: "actions",
    description: "An admission-style card: title and detail, a tear line, then a price and a button.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  CardTicket,
  () => ({
    kicker: "Admission",
    title: "Autumn preview evening",
    meta: "Friday 17 October, 7 pm, main hall",
    figure: "$20",
    figureLabel: "per person",
    href: "/",
    buttonLabel: "Reserve a place",
  })
);
