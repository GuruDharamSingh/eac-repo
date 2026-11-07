// ============================================================================
// A piece as the blocks see it, and the small helpers they share.
//
// Client-safe: no database here. Rows are read in lib/artworks.ts (server) or
// fetched from /api/blocks/artworks (the editor's canvas), and handed to a
// block by its resolver — never typed by an author, never stored in a page.
// The page stores at most an artwork's ID (`binds: "artwork"`), so a retitled
// or sold piece is right everywhere without anyone editing a page.
// ============================================================================

export type PieceStatus = "available" | "reserved" | "sold" | "portfolio";

export interface PieceImage {
  url: string;
  alt: string;
}

export interface Piece {
  id: string;
  /** The marketplace slug; the site's own page is /pieces/<slug> (id also answers). */
  slug: string;
  title: string;
  year: number | null;
  medium: string | null;
  /** "12 × 9 × 9 cm" — height × width × depth, whichever are set. */
  dimensions: string | null;
  kind: "original" | "limited_edition" | "open_edition";
  /** "Edition of 20", "3 / 20" — from the first variant. */
  edition: string | null;
  /** Minor units. 0 or null = "price on request" (the marketplace's own rule). */
  priceMinor: number | null;
  currency: string;
  status: PieceStatus;
  /** The primary picture, else the first. */
  image: string | null;
  /** Every picture, primary first. */
  images: PieceImage[];
  /** Sanitised HTML (sanitizePageText) or null. Safe to set as innerHTML. */
  descriptionHtml: string | null;
  /** The piece's marketplace page. Null for a portfolio piece — it has none. */
  href: string | null;
}

/** Resolved bindings, by artwork id. Supplied by the resolver, never typed. */
export type Bound = Record<string, Piece>;

/** The declaration every bindable block uses for its artwork field. */
export const artworkProp = (label = "Piece") =>
  ({
    name: "artwork",
    kind: "string",
    binds: "artwork",
    label,
    description: "Choose one of the pieces in Katie's store.",
    default: "",
  }) as const;

export function lookup(bound: unknown, id: unknown): Piece | null {
  if (typeof id !== "string" || !id || !bound || typeof bound !== "object") return null;
  return (bound as Bound)[id] ?? null;
}

export function isForSale(p: Piece | null): boolean {
  return !!p && (p.status === "available" || p.status === "reserved");
}

export type PriceFormat = "plain" | "from" | "hide-on-request";

/** "$240", "From $240", "Sold", "Price on request" or "" (hidden). A select prop arrives as a plain string. */
export function priceOf(p: Piece, formatValue: string = "plain"): string {
  const format: PriceFormat = formatValue === "from" || formatValue === "hide-on-request" ? formatValue : "plain";
  if (p.status === "sold") return "Sold";
  if (p.status === "portfolio") return "";
  if (!p.priceMinor) return format === "hide-on-request" ? "" : "Price on request";
  let money: string;
  try {
    money = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: p.currency || "CAD",
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: p.priceMinor % 100 === 0 ? 0 : 2,
    }).format(p.priceMinor / 100);
  } catch {
    money = `${(p.priceMinor / 100).toFixed(2)} ${p.currency}`;
  }
  return format === "from" ? `From ${money}` : money;
}

export function statusLabel(p: Piece): string {
  switch (p.status) {
    case "available":
      return "Available";
    case "reserved":
      return "Reserved";
    case "sold":
      return "Sold";
    default:
      return "Not for sale";
  }
}

export function kindLabel(p: Piece): string {
  if (p.kind === "limited_edition") return "Limited edition";
  if (p.kind === "open_edition") return "Open edition";
  return "One of a kind";
}

/** A hex colour an author typed, or undefined — a typed value can be anything. */
export function hex(value: unknown): string | undefined {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim())
    ? value.trim()
    : undefined;
}

/** `#rrggbb` + opacity 0–100 → `rgb(r g b / a)`; other inputs → undefined. */
export function tint(value: unknown, opacityPct: number): string | undefined {
  const h = hex(value);
  if (!h) return undefined;
  const raw = h.slice(1);
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.slice(0, 6);
  const n = parseInt(full, 16);
  const a = Math.min(Math.max(opacityPct, 0), 100) / 100;
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`;
}

/**
 * Representative pieces for the editor's canvas when the store is empty or
 * not yet opened. Pictures are the app's own /public files, never the
 * network's media. Never stored in a page (see the puck-blocks rules).
 */
export function samplePieces(): Piece[] {
  const img = (...n: number[]): PieceImage[] => n.map((i) => ({ url: `/samples/piece-${i}.svg`, alt: "" }));
  const base = { currency: "CAD", href: "#" } as const;
  const rows: Array<Omit<Piece, "currency" | "href" | "image">> = [
    { id: "sample-1", slug: "tenmoku-tea-bowl", title: "Tenmoku tea bowl", year: 2026, medium: "Stoneware, tenmoku glaze", dimensions: "8 × 12 × 12 cm", kind: "original", edition: null, priceMinor: 9500, status: "available", images: img(1, 4, 5), descriptionHtml: "<p>Thrown on the wheel and fired to cone 10 in reduction. The glaze breaks to rust at the rim where it runs thin, and pools to a deep oil-spot black in the well.</p><p>Holds about 250 ml. Food safe; hand wash.</p>" },
    { id: "sample-2", slug: "celadon-vase", title: "Celadon vase", year: 2025, medium: "Porcelain, celadon glaze", dimensions: "24 × 11 × 11 cm", kind: "original", edition: null, priceMinor: 28000, status: "available", images: img(2, 6), descriptionHtml: "<p>A tall bottle form with a crackled celadon, thrown in two parts and joined at the shoulder.</p>" },
    { id: "sample-3", slug: "shino-jar-with-lid", title: "Shino jar with lid", year: 2025, medium: "Stoneware, shino glaze", dimensions: "16 × 14 × 14 cm", kind: "original", edition: null, priceMinor: 0, status: "available", images: img(3), descriptionHtml: "<p>Carbon-trapped shino over an iron slip. The lid seats on an inner gallery.</p>" },
    { id: "sample-4", slug: "pair-of-cups", title: "Pair of cups", year: 2026, medium: "Stoneware, ash glaze", dimensions: "9 × 8 × 8 cm", kind: "open_edition", edition: null, priceMinor: 6000, status: "available", images: img(4, 1), descriptionHtml: "<p>Sold as a pair. Wood-ash glaze from the studio's own stove.</p>" },
    { id: "sample-5", slug: "wide-serving-bowl", title: "Wide serving bowl", year: 2024, medium: "Stoneware, iron slip", dimensions: "9 × 30 × 30 cm", kind: "original", edition: null, priceMinor: 18000, status: "sold", images: img(5), descriptionHtml: "<p>A low, wide bowl for the middle of the table.</p>" },
    { id: "sample-6", slug: "bud-vase-black", title: "Bud vase, black", year: 2026, medium: "Stoneware, black glaze", dimensions: "14 × 7 × 7 cm", kind: "limited_edition", edition: "3 / 12", priceMinor: 7500, status: "reserved", images: img(6, 2), descriptionHtml: "<p>One of a small run of twelve, each numbered on the foot.</p>" },
  ];
  return rows.map((r) => ({ ...r, ...base, image: r.images[0]!.url }));
}

/** The site's own page for a piece (sample pieces live under /preview). */
export function pieceHref(p: Piece, base = "/pieces"): string {
  return `${base}/${encodeURIComponent(p.slug || p.id)}`;
}
