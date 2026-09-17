import Link from "next/link";
import type { Artwork } from "@elkdonis/commerce/types";
import { formatMoney } from "@elkdonis/commerce/money";

/**
 * One piece, given the room a gallery would give it.
 *
 * A marketplace with fifteen works cannot open on a dense grid — that reads as
 * a thin shop. A gallery opens on one thing, large, with its label beside it,
 * and this is that. The picture is uncropped and unboxed: it sets its own
 * height up to a ceiling, and the column beside it holds still.
 */
/**
 * The `?w=` convention the media route understands. The master of one of
 * these paintings is three to four megabytes; the 1024px render is under two
 * hundred kilobytes, and this is the image every visit loads first.
 */
function thumb(url: string, width: number): string {
  if (!url.includes("/api/media/") || url.includes("?")) return url;
  return `${url}?w=${width}`;
}

export function FeaturedWork({ artwork }: { artwork: Artwork }) {
  const variant = artwork.variants?.[0];
  const lot = artwork.lot;
  const atAuction = Boolean(lot && (lot.status === "live" || lot.status === "scheduled"));
  const href = `/artworks/${artwork.id}`;

  const dims = [artwork.heightCm, artwork.widthCm].filter((d): d is number => d != null);
  const spec = [
    artwork.medium,
    dims.length === 2 ? `${dims[0]} × ${dims[1]} cm` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    // `max-content` for the picture rather than a fraction: a portrait piece
    // in a 1.55fr column left a third of the band empty beside it, because the
    // column was sized to the grid and the picture to itself. Letting the
    // picture claim exactly its own width puts the label right next to it at
    // any proportion.
    <section
      aria-labelledby="featured-work"
      className="grid items-end justify-center gap-8 md:grid-cols-[max-content_minmax(16rem,24rem)] md:gap-12 lg:gap-16"
    >
      <Link href={href} className="group block justify-self-center md:justify-self-end">
        {artwork.primaryImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb(artwork.primaryImageUrl, 1024)}
            srcSet={`${thumb(artwork.primaryImageUrl, 512)} 512w, ${thumb(artwork.primaryImageUrl, 1024)} 1024w`}
            sizes="(max-width: 48rem) 92vw, 44rem"
            alt={artwork.primaryImageAlt ?? artwork.title}
            // The one image above the fold on every visit, so it is not lazy.
            fetchPriority="high"
            className="max-h-[26rem] w-auto max-w-full lg:max-h-[34rem] shadow-[0_2px_4px_rgba(0,0,0,0.12),0_28px_60px_-18px_rgba(0,0,0,0.42)] transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.012]"
            style={{ transformOrigin: "center bottom" }}
          />
        ) : (
          <div className="flex h-80 w-64 items-center justify-center border border-dashed border-border text-sm text-ink-faint">
            No image
          </div>
        )}
      </Link>

      <div className="pb-2">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {atAuction ? "At auction" : "Currently showing"}
        </p>

        <h2 id="featured-work" className="mt-3 font-serif text-3xl italic leading-tight md:text-4xl">
          <Link href={href} className="underline-offset-[6px] hover:underline">
            {artwork.title}
          </Link>
          {artwork.yearCreated && (
            <span className="not-italic text-ink-faint">, {artwork.yearCreated}</span>
          )}
        </h2>

        {artwork.artistName && (
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {artwork.artistSlug ? (
              <Link href={`/artists/${artwork.artistSlug}`} className="underline-offset-4 hover:underline">
                {artwork.artistName}
              </Link>
            ) : (
              artwork.artistName
            )}
          </p>
        )}

        {spec && <p className="mt-4 text-sm text-ink-faint">{spec}</p>}

        <p className="mt-5 text-lg tabular-nums">
          {atAuction && lot ? (
            <>
              {lot.currentBidMinor != null ? "Current bid " : "From "}
              {formatMoney(lot.currentBidMinor ?? lot.startingBidMinor, lot.currency)}
              <span className="text-ink-faint">
                {" · "}
                {lot.bidCount} {lot.bidCount === 1 ? "bid" : "bids"}
              </span>
            </>
          ) : variant && variant.priceMinor > 0 ? (
            formatMoney(variant.priceMinor, variant.currency)
          ) : (
            <span className="italic text-muted-foreground">Price on request</span>
          )}
        </p>

        <Link
          href={atAuction && lot ? `/lots/${lot.id}` : href}
          className="mt-7 inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {atAuction ? "View the lot" : "See this work"}
        </Link>
      </div>
    </section>
  );
}
