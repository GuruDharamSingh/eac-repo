import * as React from "react";
import type { Artwork } from "../types";
import { AuctionStatusBadge } from "./AuctionStatusBadge";
import { PriceBlock } from "./PriceBlock";
import { cn } from "./cn";

export interface ArtworkCardProps {
  artwork: Artwork;
  /** Build the href for the artwork detail page. Default: `/artworks/${slug}` */
  hrefBuilder?: (a: Artwork) => string;
  /** Build the href for the artist link. Default: `/artists/${artistSlug}` */
  artistHrefBuilder?: (a: Artwork) => string | null;
  /** Show the auction status badge in the corner if a lot is attached */
  showAuctionBadge?: boolean;
  /** Renderer for the image. Default: native <img> with lazy loading.
   *  Pass a custom one (e.g. next/image) to optimize. */
  renderImage?: (props: { src: string; alt: string; className: string }) => React.ReactNode;
  className?: string;
}

/**
 * Single artwork card. Designed to be embedded in any grid:
 *   - in apps/art-auction storefront
 *   - in an individual artist's org subdomain
 *   - in a workshop GrapesJS template (server-rendered)
 *
 * Accepts a hrefBuilder so consuming apps control routing.
 * No assumed app context, no global state.
 */
export function ArtworkCard({
  artwork,
  hrefBuilder,
  artistHrefBuilder,
  showAuctionBadge = true,
  renderImage,
  className,
}: ArtworkCardProps) {
  const href = hrefBuilder
    ? hrefBuilder(artwork)
    : artwork.lot
    ? `/lots/${artwork.lot.id}`
    : `/artworks/${artwork.id}`;
  const artistHref = artistHrefBuilder
    ? artistHrefBuilder(artwork)
    : artwork.artistSlug
    ? `/artists/${artwork.artistSlug}`
    : artwork.artistUserId
    ? `/artists/${artwork.artistUserId}`
    : null;

  const imgSrc = artwork.primaryImageUrl || PLACEHOLDER_DATA_URI;
  const imgAlt = artwork.primaryImageAlt || artwork.title;

  const image = renderImage ? (
    renderImage({ src: imgSrc, alt: imgAlt, className: "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" })
  ) : (
    <img
      src={imgSrc}
      alt={imgAlt}
      loading="lazy"
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
    />
  );

  return (
    <article className={cn("group flex flex-col gap-3", className)}>
      <a href={href} className="relative block aspect-[4/5] overflow-hidden rounded-md bg-muted">
        {image}
        {showAuctionBadge && artwork.lot && (
          <AuctionStatusBadge lot={artwork.lot} className="absolute left-3 top-3" />
        )}
        {artwork.status === "sold" && !artwork.lot && (
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-foreground/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-background">
            Sold
          </span>
        )}
      </a>

      <div className="flex flex-col gap-1">
        <a href={href} className="font-serif text-base leading-tight underline-offset-4 hover:underline">
          {artwork.title}
        </a>
        {artwork.artistName && (
          <span className="text-sm text-muted-foreground">
            {artistHref ? (
              <a href={artistHref} className="underline-offset-4 hover:underline">
                {artwork.artistName}
              </a>
            ) : (
              artwork.artistName
            )}
            {artwork.yearCreated ? <span className="opacity-60"> · {artwork.yearCreated}</span> : null}
          </span>
        )}
        {artwork.medium && (
          <span className="text-xs text-muted-foreground/80">
            {artwork.medium}
            {artwork.heightCm && artwork.widthCm
              ? ` · ${artwork.heightCm} × ${artwork.widthCm} cm`
              : ""}
          </span>
        )}
        <PriceBlock
          artwork={artwork}
          variant={artwork.variants?.[0]}
          lot={artwork.lot ?? null}
          size="sm"
          className="mt-1"
        />
      </div>
    </article>
  );
}

const PLACEHOLDER_DATA_URI =
  "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%204%205%22%3E%3Crect%20width%3D%224%22%20height%3D%225%22%20fill%3D%22%23eae3d8%22%2F%3E%3C%2Fsvg%3E";
