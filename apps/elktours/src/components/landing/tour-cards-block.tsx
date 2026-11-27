import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { TourCard } from "@/components/tours/tour-card";
import type { Tour } from "@/lib/tours";

// ============================================================================
// tour-cards (2026-11-21): the desktop landing's tour list, which was the live part `tour-cards` (a grid of TourCard
// drawn by app/page.tsx), as a block. With the defaults it draws what the part drew: the site's tours with a coming
// date, pinned first, up to six, in a grid of one, two and three columns. The tours come from the resolver
// (lib/puck/mobile-pick.ts tourCardsFor, registered in config.server / config.client) as `cards`; only the settings are
// stored. The saved landing's part node is turned into this block at read time (lib/puck/landing-hero.ts).
//
// Where the "only tours with coming dates" rule lives: listTours() in lib/tours.ts (the EXISTS on tour departures).
// The setting "All published tours" asks it for `undated: true`, which drops that one condition and keeps
// status = published and visibility = PUBLIC, so a draft can never reach a visitor.
// ============================================================================

const props = [
  {
    name: "which",
    kind: "select",
    label: "Which tours",
    default: "dated",
    options: [
      { value: "dated", label: "Only tours with coming dates" },
      { value: "all", label: "All published tours" },
      { value: "chosen", label: "Tours I choose" },
    ],
  },
  {
    name: "picks",
    kind: "rows",
    label: "Tours I choose",
    addLabel: "Add a tour",
    description: "Used when 'Which tours' is 'Tours I choose'. Shown in this order.",
    fields: [{ name: "tour", kind: "string", label: "Tour", binds: "tour", default: "" }],
  },
  { name: "count", kind: "number", label: "How many", default: 6, min: 1, max: 24, step: 1 },
  {
    name: "order",
    kind: "select",
    label: "Order",
    default: "site",
    options: [
      { value: "site", label: "As the site lists them (pinned first, newest)" },
      { value: "soonest", label: "Soonest date first" },
      { value: "title", label: "By title" },
    ],
  },
  { name: "emptyText", kind: "string", label: "Words when there are no tours", default: "No tours are scheduled at the moment.", inlineEditable: false },
] as const;

export type TourCardsProps = PropsOf<typeof props> & { cards?: { tour: Tour; next: unknown }[] | null };

export function TourCardsBlock({ cards, emptyText }: TourCardsProps) {
  const list = Array.isArray(cards) ? cards : [];
  return (
    <div>
      {list.length === 0 ? (
        <p className="mt-6 text-muted-foreground">{typeof emptyText === "string" ? emptyText : "No tours are scheduled at the moment."}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <TourCard key={c.tour.id} tour={c.tour} next={(c.next ?? null) as never} />
          ))}
        </div>
      )}
    </div>
  );
}

export const tourCards = defineBlock(
  {
    id: "tour-cards",
    category: "content",
    label: "Tour cards",
    description: "The tours as picture cards: which tours (with coming dates, all published, or chosen), how many, in what order.",
    memberSafe: true,
    dataDriven: true,
    styling: "tokens",
    props,
    // What a page may restyle, once per name: a look set on "Card title" applies to every card's title (2026-11-23). Data only; the markup is the card's own.
    parts: {
      card: { label: "Card", sel: ".tour-card", repeat: true },
      kicker: { label: "Card kicker", sel: ".tour-card-kicker", repeat: true },
      title: { label: "Card title", sel: ".tour-card-title", repeat: true },
      excerpt: { label: "Card summary", sel: ".tour-card-excerpt", repeat: true },
      price: { label: "Card price", sel: ".tour-card-price", repeat: true },
      next: { label: "Card next date", sel: ".tour-card-next", repeat: true },
    },
    reads: [
      { from: "site", what: "org" },
      { from: "record", via: "picks", kinds: ["tour"] },
    ],
  },
  TourCardsBlock,
  () => ({ which: "dated", count: 6, order: "site", emptyText: "No tours are scheduled at the moment.", cards: [] })
);
