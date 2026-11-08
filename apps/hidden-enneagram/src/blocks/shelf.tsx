import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// Cards from the site (he-shelf, round 3, 2026-11-07): a quiet band of cards
// read live from the site: the services (the offer), or the posts of one
// feed (Ario's writing). Smart block: the resolver fills `items`
// (lib/shelf.ts on the server, /api/blocks/he-shelf in the editor); `items`
// is stripped before a page is saved (resolved-keys.ts). Public, published
// records only.
// ============================================================================

export interface ShelfItem {
  id: string;
  title: string;
  href: string;
  kicker?: string | null;
  blurb?: string | null;
  meta?: string | null;
  image?: string | null;
}

const props = [
  { name: "eyebrow", kind: "string", label: "Eyebrow", default: "", inlineEditable: true },
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  { name: "intro", kind: "text", label: "Line under the heading", default: "" },
  {
    name: "source",
    kind: "select",
    label: "Cards of",
    default: "services",
    options: [
      { value: "services", label: "The services" },
      { value: "feed", label: "A feed's posts" },
    ],
  },
  { name: "feed", kind: "string", label: "Feed", description: "When 'Cards of' is a feed: its address, e.g. writing.", default: "writing" },
  { name: "limit", kind: "number", label: "How many", default: 3, min: 1, max: 12, step: 1 },
  { name: "linkLabel", kind: "string", label: "Link under the cards", description: "Empty = none.", default: "" },
  { name: "linkHref", kind: "url", label: "Link goes to", default: "" },
  { name: "emptyNote", kind: "string", label: "Shown when there is nothing", default: "Nothing here yet." },
] as const;

export type ShelfProps = PropsOf<typeof props> & { items?: ShelfItem[] };

export function HeShelf({ eyebrow, heading, intro, limit = 3, linkLabel, linkHref, emptyNote, items = [] }: ShelfProps) {
  const shown = (Array.isArray(items) ? items : []).slice(0, Math.max(1, Number(limit) || 3));
  const link = typeof linkLabel === "string" && linkLabel.trim() && typeof linkHref === "string" && linkHref.trim();
  return (
    <section className="blk he-shelf">
      <header className="he-band-head">
        {eyebrow ? <p className="he-eyebrow">{eyebrow}</p> : null}
        {heading ? <h2 className="he-band-title">{heading}</h2> : null}
        {intro ? <p className="he-band-intro">{intro}</p> : null}
      </header>
      {shown.length === 0 ? (
        <p className="he-works-empty">{emptyNote}</p>
      ) : (
        <div className="he-cards" data-count={shown.length}>
          {shown.map((it) => (
            <a key={it.id} href={it.href} className="he-card">
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt="" className="he-card-img" loading="lazy" />
              ) : null}
              {it.kicker ? <span className="he-card-kicker">{it.kicker}</span> : null}
              <span className="he-card-title">{it.title}</span>
              {it.blurb ? <span className="he-card-blurb">{it.blurb}</span> : null}
              <span className="he-card-foot">
                <span>{it.meta ?? ""}</span>
                <span className="he-card-go">{it.meta ? "View →" : "Read →"}</span>
              </span>
            </a>
          ))}
        </div>
      )}
      {link ? (
        <p className="he-band-more">
          <a href={linkHref as string}>{linkLabel} →</a>
        </p>
      ) : null}
    </section>
  );
}

export const heShelf = defineBlock(
  {
    id: "he-shelf",
    label: "Cards from the site",
    category: "listings",
    description: "A quiet row of cards read live from the site: the services, or a feed's posts.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Cards", sel: "> .he-shelf" },
      eyebrow: { label: "Eyebrow", sel: "> .he-shelf .he-eyebrow", prop: "eyebrow" },
      heading: { label: "Heading", sel: "> .he-shelf .he-band-title", prop: "heading" },
      cards: { label: "Cards", sel: "> .he-shelf .he-cards" },
      more: { label: "Link under", sel: "> .he-shelf .he-band-more" },
    },
    tokens: [
      { name: "--he-ink", label: "Ink", type: "color" },
      { name: "--he-aurum", label: "Accent", type: "color" },
      { name: "--he-card", label: "Card", type: "color" },
    ],
  },
  HeShelf,
);
