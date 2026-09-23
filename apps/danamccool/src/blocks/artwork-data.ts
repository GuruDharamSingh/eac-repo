// ============================================================================
// The artwork record as her blocks see it, and the binding rules they share.
//
// Client-safe: no database here. The rows are read in lib/artworks.ts (server)
// or fetched from /api/blocks/artworks (the editor), and handed to a block as
// a readOnly `bound` prop by the resolver — see lib/puck/bindings.ts.
//
// THE RULE for every block that can show an artwork:
//
//   1. It works with nothing bound — every field can be filled by hand.
//   2. Binding an artwork fills the blanks: picture, title, caption, and a
//      price / enquire link when the piece is for sale.
//   3. Anything typed by hand WINS over the bound value, field by field.
//      Bind a piece, retype only its caption for this page, and the picture
//      and title still follow the record.
//
// The page stores only the artwork's ID, never a copy, so retitling or
// selling a piece in the marketplace updates every page that shows it.
// ============================================================================

export interface ArtworkItem {
  id: string;
  title: string;
  year: number | null;
  medium: string | null;
  dimensions: string | null;
  image: string | null;
  /** Minor units. 0 means "price on request", the marketplace's own rule. */
  priceMinor: number | null;
  currency: string;
  /**
   * `portfolio` = shown on her site as a picture of her work, NOT for sale
   * (unlisted on the marketplace). The other three are the marketplace's own.
   */
  status: "available" | "reserved" | "sold" | "portfolio";
  /** The piece's marketplace page. Null for a portfolio piece — it has none. */
  href: string | null;
}

/** Resolved bindings, by artwork id. Supplied by the resolver, never typed. */
export type Bound = Record<string, ArtworkItem>;

/**
 * The collections a piece can belong to. A closed list on purpose: the
 * collection is a select in the editor, and a free-text box would give
 * "figurative", "Figurative" and "figure work" within a week.
 */
export const COLLECTIONS = [
  { value: "all", label: "Everything" },
  { value: "figurative", label: "Figurative" },
  { value: "portraiture", label: "Portraiture" },
  { value: "medicine-buddha", label: "Medicine Buddha" },
  { value: "mixed-media", label: "Mixed media" },
  { value: "universal-pharmacy", label: "Universal Pharmacy" },
  { value: "illustration", label: "Illustration" },
  { value: "collage", label: "Collage" },
  { value: "botanical-resin", label: "Botanical resin sculptures" },
  { value: "art-objects", label: "Art objects" },
] as const;

/** A gallery binding: her galleries (user_galleries), picked from a list. */
export const galleryProp = (label = "Gallery") =>
  ({
    name: "gallery",
    kind: "string",
    binds: "gallery",
    label,
    description: "Leave empty to use the gallery linked to this page.",
    default: "",
  }) as const;

/** The declaration every bindable block uses for its artwork field. */
export const artworkProp = (label = "Artwork") =>
  ({
    name: "artwork",
    kind: "string",
    binds: "artwork",
    label,
    description:
      "Optional. Choose one of her artworks and its picture, title and details fill in — anything you type below still wins.",
    default: "",
  }) as const;

export function lookup(bound: unknown, id: unknown): ArtworkItem | null {
  if (typeof id !== "string" || !id || !bound || typeof bound !== "object") return null;
  return (bound as Bound)[id] ?? null;
}

/** A hand-typed value if there is one, else the bound one. */
export function pick(manual: unknown, fallback: string | null | undefined): string {
  const typed = typeof manual === "string" ? manual.trim() : "";
  return typed || (fallback ?? "");
}

export function isForSale(item: ArtworkItem | null): boolean {
  return !!item && (item.status === "available" || item.status === "reserved");
}

/** "Title, 2021" — the caption a bound picture gets when none is typed. */
export function captionOf(item: ArtworkItem | null): string {
  if (!item) return "";
  return [item.title, item.year].filter(Boolean).join(", ");
}

export function priceOf(item: ArtworkItem): string {
  if (item.status === "sold") return "Sold";
  if (item.status === "portfolio") return "";
  if (!item.priceMinor) return "Price on request";
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: item.currency || "CAD",
      maximumFractionDigits: item.priceMinor % 100 === 0 ? 0 : 2,
    }).format(item.priceMinor / 100);
  } catch {
    return `${(item.priceMinor / 100).toFixed(2)} ${item.currency}`;
  }
}
