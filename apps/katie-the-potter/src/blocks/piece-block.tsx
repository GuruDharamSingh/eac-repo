import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { describeLayout, editingOf, effectiveLayout, layoutProp, RecordEmpty, RecordFrame, type PuckEditing, type ResolvedPlacement } from "@elkdonis/blocks/record";
import { AddToCart } from "@/components/add-to-cart";
import { BuyActions } from "@/components/buy-actions";
import { artworkProp, pieceHref, type Piece } from "./artwork-data";
import { PieceCard } from "./piece-card";
import { PopupHost } from "./popup-host.client";
import { ThumbStrip } from "./thumb-strip.client";
import { lookOf, lookProp } from "./looks";
import "./piece-block.css";

// ============================================================================
// ktp-piece: ONE piece, placed anywhere, that adapts to where it is and to
// whether it is being edited. A SERVER component (not `interactive`), so it
// receives Puck's `puck.isEditing`; the only script it ships is the PopupHost
// island around the card (and the thumbnail strip on a feature card).
//
// Data: `artwork` binds a record (only its id is stored). Typed `title`,
// `kicker`, `caption` and `image` win over the record (manual first); the sale
// state, price and buy button ALWAYS come from the record. With no artwork:
// in the editor a "Choose a piece" placeholder; on a published page nothing;
// on the piece-detail template, the route's own piece.
//
// Adaptation:
//   PROXIMITY  layout "auto" takes the layout its placement suggests
//              (resolver -> `placement`, from page-builder's metadata.placement;
//              rules in piece-layout.ts): in a hero's slot -> feature, in a
//              column -> compact, in a row/grid or top level -> card.
//   WIDTH      container queries on the frame (piece-block.css) refine it:
//              a card in a narrow box draws compact, a wide one draws as a row.
//   EDITING    placeholder for an empty binding, a small caption saying why
//              "auto" chose what it chose, and no popup (a click selects).
// The layout prop, the rules, the frame and the editor marks are the shared
// record kit (@elkdonis/blocks/record; docs/reference/record-blocks.md).
// ============================================================================

const props = [
  artworkProp("Piece"),
  layoutProp("Auto follows where the piece sits and how wide it is."),
  lookProp("Ember, Glaze Lab or Profile for this piece. Empty = its row's look, then the site's."),
  { name: "title", kind: "string", label: "Title (override)", description: "Empty = the piece's own title.", default: "" },
  { name: "kicker", kind: "string", label: "Kicker", description: "A small line above the title, e.g. 'New from the kiln'.", default: "" },
  { name: "caption", kind: "text", label: "Caption", description: "A line or two under the details. Optional.", default: "" },
  { name: "image", kind: "image", label: "Picture (override)", description: "Empty = the piece's cover picture." },
  { name: "cardClick", kind: "select", label: "Clicking the card", description: "A piece's own page has Buy now. On that page its own piece opens the popup (bigger pictures).", default: "page", options: [
    { value: "page", label: "Goes to its page" },
    { value: "popup", label: "Opens the popup" },
  ] },
  { name: "ctaMode", kind: "select", label: "Button", default: "open-page", options: [
    { value: "buy-now", label: "Buy now + Add to cart (a piece's page)" },
    { value: "add-to-cart", label: "Add to cart (or enquire / sold note)" },
    { value: "open-popup", label: "View: open the popup" },
    { value: "open-page", label: "View: go to its page" },
    { value: "none", label: "No button" },
  ] },
  { name: "ctaLabel", kind: "string", label: "Button words", description: "Empty = 'View' / 'Add to cart' / with Buy now, 'Add to cart · continue shopping'.", default: "" },
  { name: "buyNowLabel", kind: "string", label: "Buy now words", description: "With Buy now. Empty = 'Buy now'.", default: "" },
  { name: "buyNowNote", kind: "text", label: "Line under Buy now", description: "With Buy now. Empty = the standard line about card, Google Pay, Apple Pay and shipping.", default: "" },
  { name: "pictures", kind: "select", label: "Pictures", description: "On a feature card, show the other pictures as thumbnails.", default: "one", options: [
    { value: "one", label: "The cover" },
    { value: "all", label: "Cover + thumbnails" },
  ] },
  { name: "showPrice", kind: "boolean", label: "Show the price", default: true },
  { name: "showMedium", kind: "boolean", label: "Show the medium", default: true },
  { name: "showDimensions", kind: "boolean", label: "Show the size", default: false },
  { name: "showStatus", kind: "boolean", label: "Sold / reserved badge", default: true },
  { name: "priceFormat", kind: "select", label: "Price shown as", default: "plain", options: [
    { value: "plain", label: "$240" },
    { value: "from", label: "From $240" },
    { value: "hide-on-request", label: "$240, hidden when on request" },
  ] },
] as const;

export type PieceBlockProps = PropsOf<typeof props> & {
  /** Resolver: the record (bound, or the route's piece on the detail template, or a labelled sample in the editor). */
  item?: Piece | null;
  /** Resolver: what "auto" chose and why. */
  placement?: ResolvedPlacement | null;
  /** Resolver: the item is a sample (editor only). */
  sampled?: boolean;
  /** Resolver: the block shows the ROUTE's piece (unbound, on a piece's page). */
  ownPiece?: boolean;
  /** Resolver: card payments are on (Buy now is offered). */
  cardOn?: boolean;
  hrefBase?: string;
  /** Puck: `isEditing` on its canvas; `boxEditing` in the "Edit look" popup (published shape, its own React root). */
  puck?: PuckEditing;
};

export function PieceBlock(p: PieceBlockProps) {
  // `editing`: Puck's canvas (the "why" line). `drawn`: any editing surface,
  // the popup included: the card is drawn, nothing in it acts, and an empty
  // binding shows the placeholder instead of nothing.
  const { editing, drawn } = editingOf(p.puck);
  const piece = p.item ?? null;
  const layout = effectiveLayout(p.layout, p.placement);

  if (!piece) {
    if (!drawn) return null;
    return (
      <RecordFrame name="ktp-piece" layout={layout} placement={p.placement} empty>
        <RecordEmpty
          className="ktp-piece-empty"
          title="Choose a piece"
          body="Pick one in the panel on the right (Piece). Until then this draws nothing on the published page."
        />
      </RecordFrame>
    );
  }

  const hrefBase = p.hrefBase ?? "/pieces";
  const label = typeof p.ctaLabel === "string" && p.ctaLabel.trim() ? p.ctaLabel.trim() : null;
  // A block stored before ctaMode existed meant "add-to-cart"; new blocks default to "View".
  const mode = p.ctaMode ?? "add-to-cart";
  const preview = Boolean(p.sampled) || hrefBase !== "/pieces";
  // Clicking the card goes to the piece's page unless the author chose the
  // popup (blocks stored before cardClick existed get the page too: the
  // owner's call, 2026-11-07). The route's own piece never links to itself:
  // it opens the popup, which shows the pictures larger.
  const cardOpensPopup = p.cardClick === "popup" || Boolean(p.ownPiece);
  const buyNowNote = typeof p.buyNowNote === "string" && p.buyNowNote.trim() ? p.buyNowNote.trim() : null;
  const cta =
    mode === "none" ? null : mode === "buy-now" ? (
      <BuyActions
        piece={piece}
        buyLabel={typeof p.buyNowLabel === "string" ? p.buyNowLabel : null}
        addLabel={label}
        note={buyNowNote}
        preview={preview}
        inert={drawn}
        cardOn={p.cardOn !== false}
      />
    ) : mode === "add-to-cart" ? (
      <AddToCart piece={piece} label={label ?? "Add to cart"} preview={preview} inert={drawn} />
    ) : (
      <a className="ktp-buy ktp-buy--ghost" href={pieceHref(piece, hrefBase)} {...(mode === "open-popup" ? { "data-piece": piece.id } : {})}>
        {label ?? "View"}
      </a>
    );

  const card = (
    <PieceCard
      as="div"
      piece={piece}
      overrides={{ title: p.title as string, kicker: p.kicker as string, caption: p.caption as string, image: p.image as string }}
      opts={{
        showPrice: p.showPrice,
        showMedium: p.showMedium,
        showDimensions: p.showDimensions,
        showStatus: p.showStatus,
        priceFormat: p.priceFormat,
        hrefBase,
        minColumn: layout === "feature" ? 900 : layout === "compact" ? 200 : 360,
        eager: layout === "feature",
      }}
      cta={cta}
      look={lookOf(p.look)}
    />
  );

  return (
    <RecordFrame
      name="ktp-piece"
      layout={layout}
      choice={p.layout}
      placement={p.placement}
      why={editing ? `${p.sampled ? "Sample piece · " : ""}${describeLayout(p.layout, layout, p.placement)}` : null}
    >
      <PopupHost
        piece={piece}
        editing={drawn}
        cardOpens={cardOpensPopup}
        look={lookOf(p.look)}
        hrefBase={hrefBase}
        priceFormat={p.priceFormat}
        addToCartLabel={mode === "buy-now" ? "Add to cart" : (label ?? "Add to cart")}
      >
        {card}
      </PopupHost>
      {layout === "feature" && p.pictures === "all" && piece.images.length > 1 ? <ThumbStrip images={piece.images} title={piece.title} /> : null}
    </RecordFrame>
  );
}

export const pieceBlock = defineBlock(
  {
    id: "ktp-piece",
    label: "Piece",
    category: "listings",
    description: "One piece as a smart card: it lays itself out by where it sits (a hero's slot, a row, a column) and how wide it is.",
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
    props,
    parts: {
      root: { label: "Piece", sel: "> .ktp-piece" },
      frame: { label: "Frame", sel: ".ktp-piece-frame" },
      card: { label: "Card", sel: ".ktp-card" },
      pic: { label: "Picture frame", sel: ".ktp-card-pic" },
      photo: { label: "Picture", sel: ".ktp-card-img", prop: "image" },
      badge: { label: "Badge", sel: ".ktp-card-badge" },
      words: { label: "Words", sel: ".ktp-card-cap" },
      eyebrow: { label: "Kicker", sel: ".ktp-card-kicker", prop: "kicker", draws: { props: { kicker: "New" } } },
      name: { label: "Title", sel: ".ktp-card-title", prop: "title" },
      meta: { label: "Details", sel: ".ktp-card-meta", prop: "showMedium" },
      note: { label: "Caption", sel: ".ktp-card-note", prop: "caption", draws: { props: { caption: "A line" } } },
      price: { label: "Price", sel: ".ktp-card-price", prop: "priceFormat" },
      cta: { label: "Button", sel: ".ktp-card-cta .ktp-buy:not(.ktp-buy--now)", prop: "ctaLabel" },
      buynow: { label: "Buy now", sel: ".ktp-card-cta .ktp-buy--now", prop: "buyNowLabel" },
      buynote: { label: "Line under Buy now", sel: ".ktp-card-cta .ktp-buy-now-note", prop: "buyNowNote" },
    },
    tokens: [
      { name: "--ktp-card-bg", label: "Card ground", type: "color" },
      { name: "--ktp-card-ink", label: "Card ink", type: "color" },
      { name: "--ktp-accent", label: "Accent (price, button)", type: "color" },
      { name: "--ktp-radius", label: "Card corners", type: "length" },
    ],
  },
  PieceBlock,
  () => ({
    artwork: "",
    layout: "auto" as const,
    look: "" as const,
    title: "",
    kicker: "",
    caption: "",
    image: "",
    cardClick: "page" as const,
    ctaMode: "open-page" as const,
    ctaLabel: "",
    buyNowLabel: "",
    buyNowNote: "",
    pictures: "one" as const,
    showPrice: true,
    showMedium: true,
    showDimensions: false,
    showStatus: true,
    priceFormat: "plain" as const,
  })
);
