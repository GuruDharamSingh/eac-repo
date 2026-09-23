import { ProductCard, ShopCard } from "@elkdonis/commerce/components";
import { marketplaceLinks } from "@elkdonis/commerce/links";
import type { Artwork, Store } from "@elkdonis/commerce/types";
import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A shelf of pieces for sale, in a chosen card and layout.
//
// The designed sibling of profile-store. Same data — the person's store and
// what it lists, read by the same loader (its resolver IS profile-store's) —
// with the look left to the author: five cards (the marketplace's own label
// and tile, and ShopCard's poster, tag and feature) and three layouts.
//
// `skip` lets two shelves share one store without repeating a piece: a
// Feature shelf showing the first piece, and a strip under it starting at the
// second. The loader is asked for limit + skip and the first `skip` dropped.
//
// Every card links to the piece on the marketplace, where cart and checkout
// live; the host page never carries commerce of its own.
// ============================================================================

const props = [
  {
    name: "artist",
    kind: "string",
    binds: "user",
    label: "Whose store",
    description: "Leave empty on a profile page — it uses whoever the page is about.",
  },
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  { name: "intro", kind: "text", label: "Line under the heading", default: "", inlineEditable: true },
  {
    name: "card",
    kind: "select",
    label: "Card",
    default: "poster",
    options: [
      { value: "poster", label: "Poster — picture fills the card, words over it" },
      { value: "tag", label: "Tag — a pinned print with a price tag" },
      { value: "label", label: "Gallery label — the picture hung, a wall label under it" },
      { value: "feature", label: "Feature — one piece large, with its full label" },
      { value: "tile", label: "Tile — a plain boxed card" },
    ],
  },
  {
    name: "layout",
    kind: "select",
    label: "Layout",
    default: "grid",
    options: [
      { value: "grid", label: "Grid" },
      { value: "featured", label: "Featured — the first piece twice the size (fills evenly with 6 or 9 in 3 columns)" },
      { value: "strip", label: "Strip — one row that scrolls sideways" },
    ],
  },
  {
    name: "columns",
    kind: "select",
    label: "Columns",
    description: "Fewer are used when the section is narrow.",
    default: "3",
    options: [
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
    ],
  },
  { name: "limit", kind: "number", label: "How many pieces", default: 6, min: 1, max: 24 },
  {
    name: "skip",
    kind: "number",
    label: "Start after",
    description: "Skip this many pieces — e.g. under a Feature shelf that already shows the first.",
    default: 0,
    min: 0,
    max: 12,
  },
  { name: "cta", kind: "string", label: "Button words (Feature card)", default: "View the piece" },
  { name: "storeLink", kind: "string", label: "Link to the whole store", description: "Leave empty for no link.", default: "See the whole store" },
] as const;

export type StoreShelfProps = PropsOf<typeof props> & {
  store: Store | null;
  artworks: Artwork[];
  marketplaceUrl: string;
  from?: string | null;
};

export function StoreShelf({
  artist: _artist,
  heading,
  intro,
  card = "poster",
  layout = "grid",
  columns = "3",
  limit = 6,
  skip = 0,
  cta,
  storeLink,
  store,
  artworks,
  marketplaceUrl,
  from,
}: StoreShelfProps) {
  // No store: nothing. Same rule as profile-store — a heading over nothing
  // reads as broken, and a store section showing something else is not one.
  if (!store) return null;

  const links = marketplaceLinks(marketplaceUrl, { from });
  const storeHref = store.slug ? links.store(store.slug) : links.browse;
  const shown = (artworks ?? []).slice(skip, skip + limit);
  const one = card === "feature" || shown.length === 1;

  return (
    <section className="blk blk-shelf eac-commerce" data-card={card} data-layout={one ? "single" : layout} data-cols={columns}>
      {heading || intro || storeLink ? (
        <header className="blk-shelf-head">
          <div>
            {heading ? <h2 className="blk-shelf-heading">{heading}</h2> : null}
            {intro ? <p className="blk-shelf-intro">{intro}</p> : null}
          </div>
          {storeLink ? (
            <a className="blk-shelf-link" href={storeHref}>
              {storeLink} <span aria-hidden="true">→</span>
            </a>
          ) : null}
        </header>
      ) : null}

      {shown.length === 0 ? (
        <p className="blk-shelf-intro">
          Nothing is listed right now. <a href={storeHref}>Visit the store</a>.
        </p>
      ) : (
        <ul className="blk-shelf-items" aria-label={typeof heading === "string" && heading ? heading : "Pieces for sale"}>
          {shown.map((artwork, i) => {
            const href = links.artwork(artwork.id);
            return (
              <li key={artwork.id} className="blk-shelf-item" data-first={i === 0 || undefined}>
                {card === "label" || card === "tile" ? (
                  <ProductCard
                    artwork={artwork}
                    href={href}
                    artistHref={null}
                    variant={card === "label" ? "wall" : "tile"}
                    fit="cover"
                    compact
                  />
                ) : (
                  <ShopCard
                    artwork={artwork}
                    look={card as "poster" | "tag" | "feature"}
                    href={href}
                    cta={cta || undefined}
                    large={layout === "featured" && i === 0 && !one}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const sampleArtworks = [
  { id: "s1", title: "Nightjar", artistName: "Sample Artist", yearCreated: 2024, medium: "Oil on linen", status: "available", variants: [{ priceMinor: 180000, currency: "CAD" }] },
  { id: "s2", title: "Three Vessels", artistName: "Sample Artist", yearCreated: 2023, medium: "Stoneware", status: "reserved", variants: [] },
  { id: "s3", title: "Low Tide", artistName: "Sample Artist", yearCreated: 2025, medium: "Watercolour", status: "available", variants: [{ priceMinor: 42000, currency: "CAD" }] },
] as unknown as Artwork[];

export const storeShelf = defineBlock(
  {
    id: "store-shelf",
    category: "listings",
    label: "Store shelf",
    description:
      "Pieces for sale from this person's store, as posters, pinned tags, gallery labels or one featured piece.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  StoreShelf,
  () => ({
    heading: "For sale",
    card: "poster" as const,
    layout: "grid" as const,
    columns: "3" as const,
    limit: 6,
    skip: 0,
    marketplaceUrl: "",
    store: { id: "sample", slug: "sample-studio", status: "active" } as unknown as Store,
    artworks: sampleArtworks,
  })
);
