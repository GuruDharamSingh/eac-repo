import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { sized, srcSet } from "./media";
import {
  artworkProp,
  galleryProp,
  COLLECTIONS,
  isForSale,
  lookup,
  pick,
  priceOf,
  type ArtworkItem,
  type Bound,
} from "./artwork-data";

// ============================================================================
// Her artworks — a wall of them, each with its label.
//
// Three ways to fill it, chosen by the first field:
//
//   A gallery     one of her galleries — managed in the Galleries panel (in
//                 the editor, on /hub and on /gallery), in its order. Empty
//                 means the gallery linked to this page. Plain pictures in
//                 the gallery show as pictures; artworks carry their label.
//   A collection  automatic (the older tag list — galleries replace it).
//                 Every piece carrying that collection, in her order. Add a piece to "figurative" in the marketplace and it
//                 appears here without anybody editing the page.
//   Hand-picked   exactly the pieces chosen, in the order chosen. Each one can
//                 have its own caption for this page, and can be shown as a
//                 PICTURE ONLY — no price, no enquire link — even when it is
//                 for sale, for a page that is about the work rather than the
//                 shop.
//
// A piece that is not for sale at all (a "portfolio" piece — unlisted on the
// marketplace, kept on her site as a picture of her work) always shows as a
// picture only; see lib/artworks.ts. Nothing about sale status is typed into
// the page, so it cannot go stale.
//
// Buying happens on the marketplace, not here: "Enquire / buy" goes to the
// piece's own page there, where the network's one checkout lives.
//
// `items` and `bound` are supplied by the resolver, never by an author —
// which is why neither is a declared prop.
// ============================================================================

export { COLLECTIONS };
export type { ArtworkItem };

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  {
    name: "source",
    kind: "select",
    label: "Which works",
    default: "collection",
    options: [
      { value: "gallery", label: "A gallery (managed in the Galleries panel)" },
      { value: "collection", label: "A collection tag (older)" },
      { value: "chosen", label: "Hand-picked (below)" },
    ],
  },
  galleryProp("Gallery"),
  {
    name: "collection",
    kind: "select",
    label: "Collection",
    description: "Used when “Which works” is a collection.",
    default: "all",
    options: COLLECTIONS.map((c) => ({ value: c.value, label: c.label })),
  },
  {
    name: "includePortfolio",
    kind: "boolean",
    label: "Include pieces that are not for sale",
    description: "Portfolio pieces show as pictures only, without a price.",
    default: true,
  },
  {
    name: "chosen",
    kind: "rows",
    label: "Piece",
    addLabel: "Add a piece",
    description: "Used when “Which works” is hand-picked.",
    summary: ["caption", "artwork"],
    fields: [
      artworkProp("Artwork"),
      {
        name: "caption",
        kind: "string",
        label: "Caption for this page",
        description: "Leave empty to use the artwork's own title and year.",
        default: "",
      },
      {
        name: "display",
        kind: "select",
        label: "Show as",
        default: "listed",
        options: [
          { value: "listed", label: "As listed (price + enquire when for sale)" },
          { value: "picture", label: "Picture only" },
        ],
      },
    ],
  },
  {
    name: "layout",
    kind: "select",
    label: "Hang",
    description: "Wall keeps each picture's own shape; tiles crops them to matching squares.",
    default: "wall",
    options: [
      { value: "wall", label: "Wall (whole pictures)" },
      { value: "tiles", label: "Tiles (squares, two across — like her Collections page)" },
    ],
  },
  { name: "limit", kind: "number", label: "At most", default: 24, min: 1, max: 60, step: 1 },
  { name: "showPrice", kind: "boolean", label: "Show the price", default: true },
  { name: "buyLabel", kind: "string", label: "Button words", default: "Enquire / buy" },
] as const;

export type ArtworkWallProps = PropsOf<typeof props> & { items?: ArtworkItem[]; bound?: Bound };

interface Entry {
  item: ArtworkItem;
  caption: string | null;
  pictureOnly: boolean;
}

export function ArtworkWall({
  heading,
  source = "collection",
  chosen,
  layout = "wall",
  limit = 24,
  showPrice = true,
  buyLabel = "Enquire / buy",
  items = [],
  bound,
}: ArtworkWallProps) {
  const entries: Entry[] =
    source === "chosen"
      ? (chosen ?? []).flatMap((row) => {
          const item = lookup(bound, row.artwork);
          // A row whose artwork is gone (withdrawn, or never chosen) draws
          // nothing rather than an empty frame.
          if (!item) return [];
          return [{ item, caption: pick(row.caption, null) || null, pictureOnly: row.display === "picture" }];
        })
      : source === "gallery"
        ? items.map((item) => ({ item, caption: null, pictureOnly: item.status === "portfolio" && !item.href }))
      : items.map((item) => ({ item, caption: null, pictureOnly: false }));

  const shown = entries.filter((e) => e.item.image).slice(0, Math.max(0, limit));
  const title = typeof heading === "string" ? heading.trim() : heading;

  return (
    <section className="dm-works" data-layout={layout}>
      {title ? <h2 className="dm-works-title">{title as string}</h2> : null}
      {shown.length === 0 ? (
        <p className="dm-works-empty">
          {source === "chosen"
            ? "No pieces chosen yet."
            : source === "gallery"
              ? "This gallery is empty, or no gallery is linked to this page yet."
              : "No works in this collection yet."}
        </p>
      ) : (
        <ul className="dm-works-grid">
          {shown.map(({ item, caption, pictureOnly }, i) => {
            const selling = isForSale(item) && !pictureOnly && !!item.href;
            const meta = [item.medium, item.dimensions].filter(Boolean).join(" · ");
            const picture = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sized(item.image!, 512)}
                srcSet={srcSet(item.image!)}
                sizes="(max-width: 720px) 50vw, 25vw"
                alt={item.title}
                loading="lazy"
              />
            );
            const priceText = pictureOnly ? "" : priceOf(item);
            return (
              <li key={`${item.id}-${i}`} className="dm-work" data-status={pictureOnly ? "picture" : item.status}>
                {selling ? (
                  <a className="dm-work-picture" href={item.href!} target="_blank" rel="noopener noreferrer">
                    {picture}
                    <span className="dm-sr">(opens the marketplace in a new tab)</span>
                  </a>
                ) : (
                  <div className="dm-work-picture">{picture}</div>
                )}
                <div className="dm-work-label">
                  {caption ? (
                    <p className="dm-work-title">{caption}</p>
                  ) : (
                    <p className="dm-work-title">
                      <cite>{item.title}</cite>
                      {item.year ? <span>, {item.year}</span> : null}
                    </p>
                  )}
                  {meta ? <p className="dm-work-meta">{meta}</p> : null}
                  {showPrice && priceText ? <p className="dm-work-price">{priceText}</p> : null}
                  {selling && buyLabel ? (
                    <a className="dm-work-buy" href={item.href!} target="_blank" rel="noopener noreferrer">
                      {buyLabel}
                      <span className="dm-sr"> — {item.title} (opens in a new tab)</span>
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export const artworkWall = defineBlock(
  {
    id: "dm-artwork-wall",
    label: "Artworks",
    category: "listings",
    description:
      "Her artworks with their labels — a whole collection, or hand-picked pieces. For-sale pieces get a price and an enquire / buy link; the rest show as pictures.",
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
    props,
  },
  ArtworkWall,
  () => ({
    heading: "Works",
    source: "gallery" as const,
    gallery: "",
    collection: "all" as const,
    includePortfolio: true,
    chosen: [],
    layout: "wall" as const,
    limit: 24,
    showPrice: true,
    buyLabel: "Enquire / buy",
    items: [],
  })
);
