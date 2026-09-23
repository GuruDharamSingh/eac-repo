import * as React from "react";
import { formatMoney, nextMinimumBid } from "../money";
import type { Artwork, AuctionLot } from "../types";

/**
 * How a piece is being sold right now, reduced to the one thing a card has to
 * say. Everything else on the card is description; this is the state.
 */
export type ProductState =
  | { kind: "auction"; tone: "live" | "urgent" | "quiet"; label: string; lot: AuctionLot }
  | { kind: "price" }
  | { kind: "ask" }
  | { kind: "sold" }
  | { kind: "reserved" };

export interface ProductCardProps {
  artwork: Artwork;
  /** Detail-page href. Default `/artworks/${id}`. */
  href?: string;
  /** Maker's page href. `null` suppresses the link but keeps the name. */
  artistHref?: string | null;
  /**
   * Prefix for every generated href — how a card embedded on another app in
   * the network points back at the marketplace. Ignored when `href` is given.
   */
  baseUrl?: string;
  /**
   * `wall` hangs the piece in a shared band with a gallery label under it —
   * the marketplace's own surfaces. `tile` boxes it into a fixed rectangle,
   * which is what a narrow embedded column on someone else's site needs.
   */
  variant?: "wall" | "tile";
  /** Crop to fill instead of showing the whole work. `tile` only. */
  fit?: "contain" | "cover";
  /** Aspect of the picture box. Default `4 / 5`. */
  aspect?: string;
  /** Buttons under the price — "Add to cart", "Bid", a favourite toggle. */
  actions?: React.ReactNode;
  /** Swap in `next/image` etc. Default is a lazy native `<img>`. */
  renderImage?: (p: { src: string; alt: string; className: string }) => React.ReactNode;
  /**
   * Build a downscaled URL for a given width, for `srcset`. Defaults to the
   * network's `?w=` media convention; pass `null` to serve masters.
   */
  thumbnailer?: ((url: string, width: number) => string) | null;
  /** `sizes` for the generated srcset. Defaults to the wall grid's geometry. */
  imageSizes?: string;
  /** Hide the medium/dimensions line, for narrow columns. */
  compact?: boolean;
  className?: string;
}

/**
 * The marketplace's product card.
 *
 * Styled by `@elkdonis/commerce/commerce.css` rather than Tailwind utilities,
 * so it renders the same in art-auction, on an IFAC artist page, on an
 * ArtDirect profile and inside a Silex template — none of which share a build
 * config. See the header of that file for the failure this replaces.
 *
 * Pure and server-safe: no state, no app imports. Interactivity arrives
 * through `actions`, which the consuming app wires to its own server actions.
 */
export function ProductCard({
  artwork,
  href,
  artistHref,
  baseUrl = "",
  variant = "wall",
  fit = "contain",
  aspect,
  actions,
  renderImage,
  thumbnailer = mediaThumbnail,
  imageSizes = "(max-width: 40rem) 45vw, (max-width: 80rem) 24vw, 20rem",
  compact = false,
  className,
}: ProductCardProps) {
  const base = baseUrl.replace(/\/$/, "");
  const to = href ?? `${base}/artworks/${artwork.id}`;
  const credit = artwork.artistName;
  const creditHref =
    artistHref === null
      ? null
      : (artistHref ??
        (artwork.artistSlug ? `${base}/artists/${artwork.artistSlug}` : null));

  const state = readState(artwork);
  const meta = [
    artwork.medium,
    dimensionLine(artwork),
    compact ? null : artwork.kind === "limited_edition" ? "Limited edition" : null,
  ].filter(Boolean) as string[];

  const alt = artwork.primaryImageAlt || artwork.title;
  const srcSet = thumbnailer
    ? buildSrcSet(artwork.primaryImageUrl, thumbnailer)
    : undefined;

  const img = artwork.primaryImageUrl ? (
    renderImage ? (
      renderImage({ src: artwork.primaryImageUrl, alt, className: "eac-pc__img" })
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        // The fallback is a downscaled render too, not the master: a client
        // that ignores srcset should not be the one handed four megabytes.
        src={thumbnailer ? thumbnailer(artwork.primaryImageUrl, 512) : artwork.primaryImageUrl}
        srcSet={srcSet}
        sizes={srcSet ? imageSizes : undefined}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="eac-pc__img"
      />
    )
  ) : (
    <span className="eac-pc__empty" aria-hidden="true">
      No image
    </span>
  );

  const shell = [
    "eac-commerce",
    "eac-pc",
    variant === "wall" ? "eac-pc--wall" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const style = aspect ? ({ "--pc-aspect": aspect } as React.CSSProperties) : undefined;

  if (variant === "wall") {
    return (
      <article className={shell} data-status={artwork.status} style={style}>
        <div className="eac-pc__hang">{img}</div>

        {/* A gallery label: who made it, what it is called, what it is made
            of, how big, what it costs. Ordered the way a collector's eye
            already runs down a wall card. */}
        <div className="eac-pc__label">
          {credit && (
            <span className="eac-pc__maker">
              {creditHref ? <a href={creditHref}>{credit}</a> : credit}
            </span>
          )}

          <h3 className="eac-pc__work">
            <a className="eac-pc__hit" href={to}>
              {artwork.title}
            </a>
            {artwork.yearCreated ? (
              <span className="eac-pc__year">, {artwork.yearCreated}</span>
            ) : null}
          </h3>

          {/* Always rendered — see `.eac-pc__spec` for why the empty slot is
              deliberate. Hidden from assistive tech when there is nothing in
              it, so a screen reader is not read a blank line per card. */}
          <p className="eac-pc__spec" aria-hidden={meta.length === 0 || undefined}>
            {meta.join(", ")}
          </p>

          <WallAmount artwork={artwork} state={state} />

          {state.kind === "auction" && (
            <span className="eac-pc__mark" data-tone={state.tone}>
              <span className="eac-pc__dot" aria-hidden="true" />
              {state.label}
            </span>
          )}
          {state.kind === "reserved" && (
            <span className="eac-pc__mark" data-tone="quiet">
              Reserved
            </span>
          )}
        </div>

        {actions && <div className="eac-pc__actions">{actions}</div>}
      </article>
    );
  }

  return (
    <article className={shell} data-status={artwork.status} data-fit={fit} style={style}>
      <div className="eac-pc__frame">
        {img}
        {state.kind === "auction" && (
          <span className="eac-pc__badge" data-tone={state.tone}>
            <span className="eac-pc__dot" aria-hidden="true" />
            {state.label}
          </span>
        )}
        {state.kind === "sold" && (
          <span className="eac-pc__badge" data-tone="quiet">
            Sold
          </span>
        )}
        {state.kind === "reserved" && (
          <span className="eac-pc__badge" data-tone="quiet">
            Reserved
          </span>
        )}
      </div>

      <div className="eac-pc__body">
        {/* The title carries the card's single stretched link, so the whole
            card is clickable while assistive tech hears one link named after
            the piece — not the two identical links this used to have. */}
        <h3 className="eac-pc__title">
          <a className="eac-pc__hit" href={to}>
            {artwork.title}
          </a>
        </h3>

        {credit && (
          <p className="eac-pc__by">
            {creditHref ? <a href={creditHref}>{credit}</a> : credit}
            {artwork.yearCreated ? (
              <>
                <span className="eac-pc__sep"> · </span>
                {artwork.yearCreated}
              </>
            ) : null}
          </p>
        )}

        {meta.length > 0 && <p className="eac-pc__meta">{meta.join(" · ")}</p>}

        <ProductPrice artwork={artwork} state={state} />
      </div>

      {actions && <div className="eac-pc__actions">{actions}</div>}
    </article>
  );
}

/**
 * The money line on a wall label — one line, the way a gallery prints it.
 *
 * An open lot shows the standing bid and how many there are, because on an
 * auction those two numbers together are the price. Everything else is a
 * single figure, and a piece without one says so in italics rather than
 * leaving a gap that reads as a bug.
 */
export function WallAmount({ artwork, state }: { artwork: Artwork; state: ProductState }) {
  if (state.kind === "auction") {
    const lot = state.lot;
    const shown = lot.currentBidMinor ?? lot.startingBidMinor;
    return (
      <p className="eac-pc__amount">
        {lot.currentBidMinor != null ? "Current bid " : "From "}
        {formatMoney(shown, lot.currency)}
        <span className="eac-pc__sep"> · </span>
        {lot.bidCount} {lot.bidCount === 1 ? "bid" : "bids"}
      </p>
    );
  }

  const variant = artwork.variants?.[0];
  if (!variant || variant.priceMinor <= 0) {
    return (
      <p className="eac-pc__amount" data-ask="true">
        Price on request
      </p>
    );
  }

  const edition =
    variant.editionNumber && variant.editionTotal
      ? ` · Edition ${variant.editionNumber}/${variant.editionTotal}`
      : "";

  return (
    <p className="eac-pc__amount">
      {state.kind === "sold" ? "Sold — " : ""}
      {formatMoney(variant.priceMinor, variant.currency)}
      {edition}
    </p>
  );
}

/** The price line, in the shape the current state calls for. */
function ProductPrice({ artwork, state }: { artwork: Artwork; state: ProductState }) {
  if (state.kind === "auction") {
    const lot = state.lot;
    const shown = lot.currentBidMinor ?? lot.startingBidMinor;
    const next = nextMinimumBid({
      startingBidMinor: lot.startingBidMinor,
      currentBidMinor: lot.currentBidMinor,
      bidIncrementMinor: lot.bidIncrementMinor,
    });
    return (
      <div className="eac-pc__price">
        <span className="eac-pc__price-label">
          {lot.currentBidMinor != null ? "Current bid" : "Starting bid"}
        </span>
        <span className="eac-pc__price-value">{formatMoney(shown, lot.currency)}</span>
        <span className="eac-pc__price-sub">
          {lot.bidCount} {lot.bidCount === 1 ? "bid" : "bids"}
          <span className="eac-pc__sep"> · </span>
          next {formatMoney(next, lot.currency)}
        </span>
      </div>
    );
  }

  const variant = artwork.variants?.[0];
  if (!variant || variant.priceMinor <= 0) {
    return <p className="eac-pc__price eac-pc__price-ask">Price on request</p>;
  }

  const edition =
    variant.editionNumber && variant.editionTotal
      ? `Edition ${variant.editionNumber} of ${variant.editionTotal}`
      : variant.label || null;

  return (
    <div className="eac-pc__price">
      <span className="eac-pc__price-label">
        {state.kind === "sold" ? "Sold" : state.kind === "reserved" ? "Reserved" : "Price"}
      </span>
      <span className="eac-pc__price-value">
        {formatMoney(variant.priceMinor, variant.currency)}
      </span>
      {edition && <span className="eac-pc__price-sub">{edition}</span>}
    </div>
  );
}

/**
 * One place that decides what a piece's state is, so a card, a grid and a
 * showcase can never disagree about whether something is at auction.
 *
 * An open lot outranks everything: while one is running the lot is the only
 * way to own the piece, so showing a price beside it would offer a purchase
 * that `addToCart` refuses.
 */
export function readState(artwork: Artwork): ProductState {
  const lot = artwork.lot;
  if (lot && (lot.status === "live" || lot.status === "scheduled")) {
    if (lot.status === "scheduled") {
      return { kind: "auction", tone: "quiet", label: "Auction soon", lot };
    }
    const minutesLeft = (new Date(lot.endAt).getTime() - Date.now()) / 60000;
    return minutesLeft > 0 && minutesLeft <= 60
      ? { kind: "auction", tone: "urgent", label: "Ending soon", lot }
      : { kind: "auction", tone: "live", label: "Bidding open", lot };
  }
  if (artwork.status === "sold") return { kind: "sold" };
  if (artwork.status === "reserved") return { kind: "reserved" };
  const variant = artwork.variants?.[0];
  return !variant || variant.priceMinor <= 0 ? { kind: "ask" } : { kind: "price" };
}

/**
 * The widths the network's media route actually renders. Asking for anything
 * else just rounds up to one of these, so a `srcset` built from other numbers
 * would advertise variants that do not exist and hand the browser the next
 * size up under a wrong label.
 */
const THUMB_WIDTHS = [256, 512, 1024] as const;

/**
 * The `?w=` convention shared by every app's `/api/media` route.
 *
 * Applied only to that route: an artwork image can be an absolute URL on
 * someone else's host, and bolting a query string onto it would at best be
 * ignored and at worst break a signed link.
 */
export function mediaThumbnail(url: string, width: number): string {
  if (!url.includes("/api/media/") || url.includes("?")) return url;
  return `${url}?w=${width}`;
}

/**
 * Why this exists: the marketplace was serving master files to its grid —
 * fourteen cards at one to four megabytes each, some forty megabytes of
 * pictures for one screen. On anything short of a desk connection the page
 * rendered as a row of empty shadows for several seconds, which is exactly
 * what a broken site looks like. The same image at `?w=256` is under 60KB.
 */
export function buildSrcSet(
  url: string | null | undefined,
  thumb: (url: string, width: number) => string
): string | undefined {
  if (!url) return undefined;
  const entries = THUMB_WIDTHS.map((w) => [thumb(url, w), w] as const).filter(
    ([built]) => built !== url
  );
  if (entries.length === 0) return undefined;
  return entries.map(([built, w]) => `${built} ${w}w`).join(", ");
}

/**
 * Dimensions the way a label prints them.
 *
 * These are often inches converted to centimetres, which arrives as
 * "243.84 × 121.92" — true, and unreadable. A gallery rounds: whole numbers
 * above 10cm, one decimal below, where a millimetre on a pendant matters.
 */
export function dimensionLine(a: Artwork): string | null {
  const dims = [a.heightCm, a.widthCm, a.depthCm].filter((d): d is number => d != null);
  if (dims.length < 2) return null;
  const round = (d: number) =>
    d >= 10 ? String(Math.round(d)) : String(Math.round(d * 10) / 10);
  return `${dims.map(round).join(" × ")} cm`;
}
