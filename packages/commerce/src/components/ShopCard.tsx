import * as React from "react";
import type { Artwork } from "../types";
import {
  WallAmount,
  buildSrcSet,
  dimensionLine,
  mediaThumbnail,
  readState,
  type ProductState,
} from "./ProductCard";

// ============================================================================
// Three more looks for a piece for sale, for designed store sections.
//
// ProductCard is the marketplace's card — `wall` (a gallery label) and `tile`
// (a boxed card for narrow columns) — and it stays the default everywhere.
// These are for a section someone has DESIGNED (a store panel on an artist
// page, a shop section on an org site), where the card is part of the look:
//
//   poster   the picture fills the card; title and price sit over a dark fade
//            at the foot and rise on hover. Reads on any picture, because the
//            words never sit on the picture itself — see the scrim note in
//            commerce.css.
//   tag      a print on a white mat, pinned at a slight tilt, with a price tag
//            hanging off the corner. Straightens when pointed at.
//   feature  one piece, large: the picture beside its full label and a button.
//            For the piece a section is built around.
//
// Same data rules as ProductCard, by construction: the state (auction, sold,
// reserved, price on request) comes from `readState`, the money line from
// `WallAmount`, the picture from the same `?w=` thumbnails. A piece reads the
// same wherever it is met; only the frame around it changes.
//
// Plain CSS (commerce.css, `.eac-sc*`), pure and server-safe. Every animation
// is CSS and stops under `prefers-reduced-motion`.
// ============================================================================

export type ShopCardLook = "poster" | "tag" | "feature";

export interface ShopCardProps {
  artwork: Artwork;
  look: ShopCardLook;
  /** Where the card goes — the piece on the marketplace. */
  href: string;
  /** For `feature`: the button's words. */
  cta?: string;
  /** For `poster`: make this card the big one in a featured layout. */
  large?: boolean;
  className?: string;
}

/** What a card says about the piece's state, if anything. */
function stateLabel(state: ProductState): { text: string; tone: string } | null {
  if (state.kind === "auction") return { text: state.label, tone: state.tone };
  if (state.kind === "sold") return { text: "Sold", tone: "quiet" };
  if (state.kind === "reserved") return { text: "Reserved", tone: "quiet" };
  return null;
}

function Picture({ artwork, sizes }: { artwork: Artwork; sizes: string }) {
  const url = artwork.primaryImageUrl;
  if (!url) {
    return (
      <span className="eac-sc__empty" aria-hidden="true">
        No image
      </span>
    );
  }
  const srcSet = buildSrcSet(url, mediaThumbnail);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaThumbnail(url, 1024)}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={artwork.primaryImageAlt || artwork.title}
      loading="lazy"
      decoding="async"
      className="eac-sc__img"
    />
  );
}

export function ShopCard({ artwork, look, href, cta = "View the piece", large, className }: ShopCardProps) {
  const state = readState(artwork);
  const mark = stateLabel(state);
  const shell = ["eac-commerce", "eac-sc", `eac-sc--${look}`, className].filter(Boolean).join(" ");
  const byline = [artwork.artistName, artwork.yearCreated ? String(artwork.yearCreated) : null]
    .filter(Boolean)
    .join(", ");

  if (look === "poster") {
    return (
      <article className={shell} data-status={artwork.status} data-large={large || undefined}>
        <div className="eac-sc__media">
          <Picture artwork={artwork} sizes={large ? "(max-width: 40rem) 90vw, 40rem" : "(max-width: 40rem) 45vw, 20rem"} />
        </div>
        <div className="eac-sc__over">
          {mark ? (
            <span className="eac-sc__mark" data-tone={mark.tone}>
              {mark.text}
            </span>
          ) : null}
          <h3 className="eac-sc__title">
            {/* The one link, stretched over the whole card. */}
            <a className="eac-sc__hit" href={href}>
              {artwork.title}
            </a>
          </h3>
          {byline ? <p className="eac-sc__by">{byline}</p> : null}
          <WallAmount artwork={artwork} state={state} />
          <span className="eac-sc__cue" aria-hidden="true">
            View →
          </span>
        </div>
      </article>
    );
  }

  if (look === "tag") {
    return (
      <article className={shell} data-status={artwork.status}>
        <div className="eac-sc__mat">
          <div className="eac-sc__media">
            <Picture artwork={artwork} sizes="(max-width: 40rem) 45vw, 16rem" />
          </div>
          <h3 className="eac-sc__title">
            <a className="eac-sc__hit" href={href}>
              {artwork.title}
            </a>
          </h3>
          {byline ? <p className="eac-sc__by">{byline}</p> : null}
        </div>
        {/* The tag: price, or the state when there is no price to give. */}
        <div className="eac-sc__tag">
          {mark && state.kind !== "auction" ? <span>{mark.text}</span> : <WallAmount artwork={artwork} state={state} />}
        </div>
      </article>
    );
  }

  // feature
  const spec = [artwork.medium, dimensionLine(artwork)].filter(Boolean).join(", ");
  return (
    <article className={shell} data-status={artwork.status}>
      <div className="eac-sc__media">
        <Picture artwork={artwork} sizes="(max-width: 40rem) 90vw, 28rem" />
      </div>
      <div className="eac-sc__text">
        {mark ? (
          <span className="eac-sc__mark" data-tone={mark.tone}>
            {mark.text}
          </span>
        ) : null}
        <h3 className="eac-sc__title">{artwork.title}</h3>
        {byline ? <p className="eac-sc__by">{byline}</p> : null}
        {spec ? <p className="eac-sc__spec">{spec}</p> : null}
        <WallAmount artwork={artwork} state={state} />
        <a className="eac-sc__cta" href={href}>
          {cta} <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}
