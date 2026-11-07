"use client";

import { useState } from "react";
import { sized, srcSet } from "./media";
import { AddToCart } from "@/components/add-to-cart";
import { isForSale, kindLabel, priceOf, statusLabel, type Piece } from "./artwork-data";

// ============================================================================
// The popup's content, and the picture gallery it shares with the detail
// page. Client: the gallery switches pictures.
// ============================================================================

/** The facts under a piece's title: year, medium, size, kind/edition, status. */
export function pieceFacts(piece: Piece): Array<[string, string]> {
  const facts: Array<[string, string]> = [];
  if (piece.year) facts.push(["Year", String(piece.year)]);
  if (piece.medium) facts.push(["Medium", piece.medium]);
  if (piece.dimensions) facts.push(["Size", piece.dimensions]);
  facts.push(["Kind", piece.edition ? `${kindLabel(piece)}, ${piece.edition}` : kindLabel(piece)]);
  facts.push(["Status", statusLabel(piece)]);
  return facts;
}

export function PieceFacts({ piece }: { piece: Piece }) {
  return (
    <dl className="ktp-facts">
      {pieceFacts(piece).map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The main picture with a thumbnail strip when there is more than one. */
export function PieceGallery({ piece, large = false }: { piece: Piece; large?: boolean }) {
  const [shown, setShown] = useState(0);
  const images = piece.images.length ? piece.images : piece.image ? [{ url: piece.image, alt: "" }] : [];
  const current = images[Math.min(shown, images.length - 1)] ?? null;
  return (
    <div className="ktp-gallery" data-large={large ? "true" : undefined}>
      <div className="ktp-gallery-stage">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.url}
            className="ktp-gallery-img"
            src={sized(current.url, 1024)}
            srcSet={srcSet(current.url)}
            sizes={large ? "(max-width: 760px) 100vw, 60vw" : "(max-width: 760px) 100vw, 560px"}
            alt={current.alt || piece.title}
          />
        ) : null}
        <span className="ktp-gallery-plinth" aria-hidden="true" />
      </div>
      {images.length > 1 ? (
        <ul className="ktp-gallery-thumbs" aria-label="More pictures">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`}>
              <button type="button" className="ktp-gallery-thumb" aria-pressed={i === shown} onClick={() => setShown(i)} aria-label={`Picture ${i + 1} of ${images.length}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sized(img.url, 256)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The quiet secondary link to the piece's marketplace page. Buying happens
 * on THIS site (AddToCart); this only says the piece is also listed there.
 * Nothing for a portfolio piece, and nothing when the main control already
 * IS the marketplace link (price on request).
 */
export function MarketLink({ piece, label, className = "ktp-market-link" }: { piece: Piece; label: string; className?: string }) {
  if (!piece.href || piece.status === "portfolio" || !piece.priceMinor) return null;
  return (
    <a className={className} href={piece.href} target="_blank" rel="noopener noreferrer">
      {isForSale(piece) ? label : "View on Collect Art"}
      <span className="ktp-sr"> (opens in a new tab)</span>
    </a>
  );
}

export function PiecePopup({
  piece,
  onClose,
  buyLabel,
  addToCartLabel,
  priceFormat,
  pageHref,
}: {
  piece: Piece;
  onClose: () => void;
  buyLabel: string;
  addToCartLabel: string;
  priceFormat?: string;
  pageHref: string;
}) {
  const price = priceOf(piece, priceFormat === "hide-on-request" ? "plain" : priceFormat);
  return (
    <article className="ktp-pop" data-status={piece.status}>
      <button type="button" className="ktp-pop-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="ktp-pop-media">
        <PieceGallery piece={piece} />
      </div>
      <div className="ktp-pop-body">
        <h3 className="ktp-pop-title">{piece.title}</h3>
        {price ? <p className="ktp-pop-price">{price}</p> : null}
        <PieceFacts piece={piece} />
        {piece.descriptionHtml ? (
          // Sanitised in lib/artworks.ts (sanitizePageText) before it reaches
          // the browser — resolver data, never an author-typed prop.
          <div className="ktp-desc" dangerouslySetInnerHTML={{ __html: piece.descriptionHtml }} />
        ) : null}
        <div className="ktp-pop-actions">
          <AddToCart piece={piece} label={addToCartLabel} preview={pageHref.startsWith("/preview")} />
          <p className="ktp-pop-links">
            <a className="ktp-pop-page" href={pageHref}>
              Open full page
            </a>
            <MarketLink piece={piece} label={buyLabel} />
          </p>
        </div>
      </div>
    </article>
  );
}
