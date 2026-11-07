import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { artworkProp, samplePieces, type Bound, type Piece } from "./artwork-data";
import { ArtworkGrid } from "./artwork-grid.client";
import { lookProp } from "./looks";
import "./artwork-grid.css";

// ============================================================================
// Artwork grid — Katie's pieces as cards; a click goes to the piece's page
// (`cardClick: "page"`, the default since 2026-11-07) or opens a popup.
//
// Data-driven: the resolver (lib/puck/config.*.ts) reads her store and hands
// the block `pieces` (the store, in the chosen order) and `bound` (the
// records behind hand-picked rows). Neither is a declared prop, so neither
// can be typed or stored. Sale state — price, sold, reserved — always comes
// from the record; a page cannot make an unlisted piece look buyable.
//
// Every visual choice is a field: column width, gap, card shape, caption
// placement, what the caption shows, the hover, the colours, the type sizes,
// and the popup's own width, backdrop, picture side and corners. Spacing and
// borders of the block as a whole are the generic Style layer's (blkStyle).
//
// The component is a client component (artwork-grid.client.tsx) because the
// popup is a native <dialog> opened from the card — `interactive: true`.
// ============================================================================

// Generic on the name so PropsOf keeps the literal key (a plain `string`
// name turns the whole props type into a string index signature).
const colour = <N extends string>(name: N, label: string, description: string) =>
  ({ name, kind: "string", format: "color", label, description, default: "" }) as const;

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "Pieces" },
  { name: "intro", kind: "text", label: "Intro", description: "A line under the heading. Optional.", default: "" },
  {
    name: "source",
    kind: "select",
    label: "Which pieces",
    default: "store",
    options: [
      { value: "store", label: "Everything in the store" },
      { value: "chosen", label: "Hand-picked (below)" },
      { value: "more", label: "More pieces (on a piece's own page)" },
    ],
  },
  {
    name: "chosen",
    kind: "rows",
    label: "Piece",
    addLabel: "Add a piece",
    description: "Used when “Which pieces” is hand-picked.",
    summary: ["caption", "artwork"],
    fields: [
      artworkProp("Piece"),
      { name: "caption", kind: "string", label: "Caption for this page", description: "Empty = the piece's own title.", default: "" },
    ],
  },
  {
    name: "sort",
    kind: "select",
    label: "Order",
    default: "newest",
    options: [
      { value: "newest", label: "Newest first" },
      { value: "oldest", label: "Oldest first" },
      { value: "price_asc", label: "Price, low to high" },
      { value: "price_desc", label: "Price, high to low" },
    ],
  },
  { name: "limit", kind: "number", label: "At most", default: 24, min: 1, max: 100, step: 1 },
  {
    name: "cardClick",
    kind: "select",
    label: "Clicking a card",
    description: "Its page has Buy now and Add to cart. The popup shows pictures, details and Add to cart in place.",
    default: "page",
    options: [
      { value: "page", label: "Goes to the piece's page" },
      { value: "popup", label: "Opens the popup" },
    ],
  },
  { name: "minColumn", kind: "number", label: "Card width (least)", description: "Cards grow to fill the row.", default: 260, min: 140, max: 480, step: 10, unit: "px" },
  { name: "gap", kind: "number", label: "Gap between cards", default: 28, min: 0, max: 64, step: 2, unit: "px" },
  {
    name: "aspect",
    kind: "select",
    label: "Picture proportion",
    default: "4:5",
    options: [
      { value: "1:1", label: "Square" },
      { value: "4:5", label: "Portrait 4:5" },
      { value: "3:4", label: "Portrait 3:4" },
      { value: "2:3", label: "Tall 2:3" },
      { value: "auto", label: "Each picture's own" },
    ],
  },
  {
    name: "topShape",
    kind: "select",
    label: "Card top",
    default: "rounded",
    options: [
      { value: "square", label: "Square corners" },
      { value: "rounded", label: "Rounded corners" },
      { value: "arch", label: "Arch (rounded top)" },
    ],
  },
  { name: "radius", kind: "number", label: "Corner radius", default: 10, min: 0, max: 40, step: 1, unit: "px" },
  {
    name: "imageFit",
    kind: "select",
    label: "Picture fit",
    default: "cover",
    options: [
      { value: "cover", label: "Fill the frame (crop)" },
      { value: "contain", label: "Whole picture (letterbox)" },
    ],
  },
  {
    name: "captionPosition",
    kind: "select",
    label: "Caption",
    default: "below",
    options: [
      { value: "below", label: "Under the picture" },
      { value: "overlay", label: "Over the picture, on hover" },
    ],
  },
  { name: "showPrice", kind: "boolean", label: "Show the price", default: true },
  { name: "showMedium", kind: "boolean", label: "Show the medium", default: true },
  { name: "showDimensions", kind: "boolean", label: "Show the size", default: false },
  { name: "showStatus", kind: "boolean", label: "Sold / reserved badges", default: true },
  {
    name: "priceFormat",
    kind: "select",
    label: "Price shown as",
    default: "plain",
    options: [
      { value: "plain", label: "$240" },
      { value: "from", label: "From $240" },
      { value: "hide-on-request", label: "$240, hidden when on request" },
    ],
  },
  {
    name: "hover",
    kind: "select",
    label: "On hover",
    default: "lift",
    options: [
      { value: "none", label: "Nothing" },
      { value: "lift", label: "Lift with a shadow" },
      { value: "glow", label: "Warm glow and gloss" },
    ],
  },
  colour("cardBg", "Card ground", "Empty = the page's soft tint."),
  colour("cardInk", "Card text", "Empty = the site's ink."),
  colour("accent", "Accent", "Price, badges and the popup's button. Empty = the site's accent."),
  { name: "titleSize", kind: "number", label: "Title size", default: 18, min: 13, max: 32, step: 1, unit: "px" },
  { name: "metaSize", kind: "number", label: "Details size", default: 13, min: 11, max: 20, step: 1, unit: "px" },
  {
    name: "popupWidth",
    kind: "select",
    label: "Popup width",
    default: "standard",
    options: [
      { value: "narrow", label: "Narrow" },
      { value: "standard", label: "Standard" },
      { value: "wide", label: "Wide" },
    ],
  },
  colour("popupBackdrop", "Popup backdrop", "The tint behind the popup. Empty = the site's ink."),
  { name: "popupBackdropOpacity", kind: "number", label: "Backdrop strength", default: 70, min: 20, max: 95, step: 5, unit: "%" },
  {
    name: "popupImageSide",
    kind: "select",
    label: "Popup picture",
    default: "left",
    options: [
      { value: "left", label: "Left of the words" },
      { value: "right", label: "Right of the words" },
    ],
  },
  { name: "popupRadius", kind: "number", label: "Popup corner radius", default: 16, min: 0, max: 32, step: 1, unit: "px" },
  { name: "addToCartLabel", kind: "string", label: "Add-to-cart button", description: "The main button in the popup and on each piece's page.", default: "Add to cart" },
  { name: "buyLabel", kind: "string", label: "Collect Art link", description: "A quiet link under the button: the piece is also listed on the marketplace.", default: "Also listed on Collect Art" },
  lookProp("Every card in the grid (and its popup) wears it. Empty = the site's."),
  { name: "emptyText", kind: "string", label: "When there is nothing to show", default: "New pieces are coming out of the kiln. Check back soon." },
] as const;

export type ArtworkGridProps = PropsOf<typeof props> & {
  pieces?: Piece[];
  bound?: Bound;
  /** Where a card links (`/pieces`, or `/preview/pieces` on the preview). Resolver-supplied. */
  hrefBase?: string;
};

export const artworkGrid = defineBlock(
  {
    id: "ktp-artwork-grid",
    label: "Artwork grid",
    category: "listings",
    description: "Katie's pieces as cards. A click goes to the piece's page (Buy now, Add to cart), or opens a popup if you choose.",
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
    interactive: true,
    props,
    tokens: [
      { name: "--ktp-card-bg", label: "Card ground", type: "color" },
      { name: "--ktp-card-ink", label: "Card ink", type: "color" },
      { name: "--ktp-accent", label: "Accent (price, button)", type: "color" },
    ],
    parts: {
      root: { label: "Grid", sel: "> .ktp-works" },
      heading: { label: "Heading", sel: ".ktp-works-title", prop: "heading", draws: { props: { heading: "Pieces" } } },
      cards: { label: "Cards", sel: ".ktp-card", repeat: true },
      captions: { label: "Captions", sel: ".ktp-card-cap", repeat: true },
      // The same card parts as ktp-piece (one markup: piece-card.tsx), so a
      // look learned on one reads the same on the other.
      pic: { label: "Picture frames", sel: ".ktp-card-pic", repeat: true },
      photo: { label: "Pictures", sel: ".ktp-card-img", repeat: true },
      badge: { label: "Badges", sel: ".ktp-card-badge", repeat: true },
      name: { label: "Titles", sel: ".ktp-card-title", repeat: true },
      meta: { label: "Details", sel: ".ktp-card-meta", repeat: true, prop: "showMedium" },
      price: { label: "Prices", sel: ".ktp-card-price", repeat: true, prop: "priceFormat" },
    },
  },
  ArtworkGrid,
  () => ({
    heading: "Pieces",
    intro: "",
    source: "store" as const,
    chosen: [],
    sort: "newest" as const,
    limit: 24,
    cardClick: "page" as const,
    minColumn: 260,
    gap: 28,
    aspect: "4:5" as const,
    topShape: "rounded" as const,
    radius: 10,
    imageFit: "cover" as const,
    captionPosition: "below" as const,
    showPrice: true,
    showMedium: true,
    showDimensions: false,
    showStatus: true,
    priceFormat: "plain" as const,
    hover: "lift" as const,
    cardBg: "",
    cardInk: "",
    accent: "",
    titleSize: 18,
    metaSize: 13,
    popupWidth: "standard" as const,
    popupBackdrop: "",
    popupBackdropOpacity: 70,
    popupImageSide: "left" as const,
    popupRadius: 16,
    buyLabel: "Also listed on Collect Art",
    addToCartLabel: "Add to cart",
    emptyText: "New pieces are coming out of the kiln. Check back soon.",
    look: "" as const,
    pieces: samplePieces(),
  })
);
