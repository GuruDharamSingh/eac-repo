import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { sized, srcSet } from "./media";
import { pieceHref, priceOf, statusLabel, type Piece } from "./artwork-data";
import "./looks.css";

// ============================================================================
// One piece as a card: the ONE markup every surface uses, so a look set on a
// part in one place (morph parts: pic, image, badge, caption, title, meta,
// price, cta) reads the same everywhere:
//
//   ktp-artwork-grid   <PieceCard as="li">        a click opens the popup
//   ktp-piece          <PieceCard as="div" cta>   a smart, placed card
//   "More pieces"      <PieceCard as="li">        on the detail template
//
// Presentational and server-safe: no handlers. A click on `a[data-piece]` is
// intercepted by whichever client island owns the popup (the grid, or a
// ktp-piece's PopupHost), so a middle-click, a new tab or no JS still reach
// /pieces/<slug>. Free of grid assumptions: its size comes from its container.
// ============================================================================

export interface PieceCardOptions {
  showPrice?: boolean;
  showMedium?: boolean;
  showDimensions?: boolean;
  showStatus?: boolean;
  priceFormat?: string;
  /** `sizes` hint: the width the card is likely drawn at. */
  minColumn?: number;
  /** Where the card's link goes (`/pieces` or `/preview/pieces`). */
  hrefBase?: string;
  /** Load the picture at once rather than lazily. */
  eager?: boolean;
}

/** Typed values that win over the record (manual first). Sale state and price never do. */
export interface PieceCardOverrides {
  title?: string | null;
  kicker?: string | null;
  caption?: string | null;
  image?: string | null;
}

const typed = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function PieceCard({
  piece,
  caption,
  overrides,
  opts = {},
  cta,
  look,
  as = "li",
  ...rest
}: {
  piece: Piece;
  /** Hand-picked rows' caption (the grid's "Caption for this page"). */
  caption?: string | null;
  overrides?: PieceCardOverrides;
  opts?: PieceCardOptions;
  /** A call to action under the card (outside the link: a button cannot sit inside an <a>). */
  cta?: ReactNode;
  as?: "li" | "div";
  /** The card's own look (looks.ts); null/"" = as around it (its row, then the site). */
  look?: string | null;
} & Omit<ComponentProps<"li">, "children">) {
  const {
    showPrice = true,
    showMedium = true,
    showDimensions = false,
    showStatus = true,
    priceFormat = "plain",
    minColumn = 260,
    hrefBase = "/pieces",
    eager = false,
  } = opts;
  const price = showPrice ? priceOf(piece, priceFormat) : "";
  const meta = [showMedium ? piece.medium : null, showDimensions ? piece.dimensions : null].filter(Boolean).join(" · ");
  const badge = showStatus && (piece.status === "sold" || piece.status === "reserved") ? statusLabel(piece) : null;
  const title = typed(overrides?.title) ?? typed(caption) ?? piece.title;
  const kicker = typed(overrides?.kicker);
  const note = typed(overrides?.caption);
  const image = typed(overrides?.image) ?? piece.image;
  const Root = as;
  // For the looks (looks.css): the picture as a CSS image (Profile draws it as a
  // line section) and the record's own dimensions (never invented).
  const picSrc = image ? `url("${sized(image, 512).replace(/["\\\n]/g, "")}")` : undefined;
  // Glaze Lab: the piece's OWN pictures as swatches. Only with more than one;
  // hidden by CSS unless the card wears that look.
  const swatches = piece.images.length > 1 ? piece.images.slice(0, 6) : [];

  return (
    <Root {...(rest as object)} className={`ktp-card${rest.className ? ` ${rest.className}` : ""}`} data-status={piece.status} data-look={look || undefined}>
      <a
        className="ktp-card-link"
        href={pieceHref(piece, hrefBase)}
        data-piece={piece.id}
        aria-label={`${title}${price ? `, ${price}` : ""}${badge ? `, ${badge.toLowerCase()}` : ""}`}
      >
        <span className="ktp-card-pic" style={picSrc ? ({ "--ktp-pic-src": picSrc } as CSSProperties) : undefined}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="ktp-card-img"
              src={sized(image, 512)}
              srcSet={srcSet(image)}
              sizes={`(max-width: 720px) 50vw, ${minColumn}px`}
              alt={piece.images[0]?.alt || ""}
              loading={eager ? "eager" : "lazy"}
            />
          ) : null}
          <span className="ktp-card-plinth" aria-hidden="true" data-dims={piece.dimensions || undefined} />
          {badge ? <span className="ktp-card-badge">{badge}</span> : null}
        </span>
        <span className="ktp-card-cap">
          {kicker ? <span className="ktp-card-kicker">{kicker}</span> : null}
          <span className="ktp-card-title">{title}</span>
          {meta ? <span className="ktp-card-meta">{meta}</span> : null}
          {note ? <span className="ktp-card-note">{note}</span> : null}
          {price ? <span className="ktp-card-price">{price}</span> : null}
        </span>
      </a>
      {swatches.length ? (
        <div className="ktp-card-swatches" role="group" aria-label={`Glazes of ${title}`}>
          {swatches.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              className="ktp-card-swatch"
              data-swatch={img.url}
              data-alt={img.alt || ""}
              aria-pressed={i === 0}
              aria-label={img.alt ? `Show ${img.alt}` : `Show picture ${i + 1} of ${swatches.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sized(img.url, 128)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      {cta ? <div className="ktp-card-cta">{cta}</div> : null}
    </Root>
  );
}
