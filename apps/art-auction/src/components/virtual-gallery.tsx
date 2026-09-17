"use client";

import * as React from "react";
import Link from "next/link";
import { GalleryExperience, type GalleryPiece } from "@elkdonis/three/gallery";
import { PriceBlock, BuyNowButton } from "@elkdonis/commerce/components";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Artwork } from "@elkdonis/commerce/types";
import { Button } from "@/components/ui/button";
import { addArtworkToCart } from "@/app/actions";

/**
 * Mediums whose work stands in a case rather than hanging. The gallery package
 * takes `display` as data precisely so this vocabulary — which belongs to the
 * marketplace, not to a renderer — lives here.
 */
const STANDING_MEDIUMS = [
  "jewellery",
  "jewelry",
  "sculpture",
  "ceramic",
  "pottery",
  "glass",
  "textile",
  "object",
];

function displayFor(artwork: Artwork): GalleryPiece["display"] {
  const medium = artwork.medium?.toLowerCase() ?? "";
  return STANDING_MEDIUMS.some((m) => medium.includes(m)) ? "plinth" : "wall";
}

/**
 * Wall pieces are seen at roughly a metre across; asking for a master several
 * thousand pixels wide would cost the visitor the whole file for no visible
 * gain. 1024 is the largest variant the media route mints.
 */
/**
 * Centimetres are what we store, but an artist describes a canvas as "four by
 * eight feet" and a buyer picturing it on their own wall thinks the same way.
 * Shown together rather than either alone.
 */
function formatDimensions(cms: number[]): string {
  const cm = cms.map((v) => Math.round(v * 10) / 10).join(" × ");
  const imperial = cms
    .map((v) => {
      const inches = v / 2.54;
      const feet = Math.floor(inches / 12);
      const rest = Math.round(inches - feet * 12);
      if (feet === 0) return `${Math.round(inches)}\u2033`;
      return rest === 0 ? `${feet}\u2032` : `${feet}\u2032${rest}\u2033`;
    })
    .join(" × ");
  return `${cm} cm · ${imperial}`;
}

function galleryImage(url: string): string {
  return url.includes("?") ? `${url}&w=1024` : `${url}?w=1024`;
}

export function VirtualGallery({ artworks }: { artworks: Artwork[] }) {
  const byId = React.useMemo(
    () => new Map(artworks.map((a) => [a.id, a])),
    [artworks]
  );

  const pieces = React.useMemo<GalleryPiece[]>(
    () =>
      artworks
        .filter((a) => a.primaryImageUrl)
        .map((a) => ({
          id: a.id,
          title: a.title,
          imageUrl: galleryImage(a.primaryImageUrl!),
          alt: a.primaryImageAlt ?? a.title,
          artistName: a.artistName ?? null,
          display: displayFor(a),
          heightCm: a.heightCm ?? null,
          widthCm: a.widthCm ?? null,
        })),
    [artworks]
  );

  const renderDetail = React.useCallback(
    (piece: GalleryPiece) => {
      const artwork = byId.get(piece.id);
      if (!artwork) return null;
      return <GalleryDetail artwork={artwork} />;
    },
    [byId]
  );

  return (
    <GalleryExperience
      pieces={pieces}
      height="min(78vh, 760px)"
      allowRoomChange
      renderDetail={renderDetail}
      fallback={<GalleryFallback />}
    />
  );
}

/**
 * The purchase panel. Everything here is the storefront's own components
 * against the storefront's own server action, so the room sells a piece by
 * exactly the path the detail page does — there is no second checkout to keep
 * in step.
 */
function GalleryDetail({ artwork }: { artwork: Artwork }) {
  const variant = artwork.variants?.[0];
  const lot = artwork.lot;
  const atAuction = Boolean(
    lot && (lot.status === "live" || lot.status === "scheduled")
  );
  const priceOnRequest = !variant || variant.priceMinor <= 0;

  const dims = [artwork.heightCm, artwork.widthCm, artwork.depthCm].filter(
    (d): d is number => d != null
  );

  return (
    <div className="flex flex-col gap-5 text-foreground">
      {artwork.primaryImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${artwork.primaryImageUrl}${artwork.primaryImageUrl.includes("?") ? "&" : "?"}w=512`}
          alt={artwork.primaryImageAlt ?? artwork.title}
          className="w-full rounded-md bg-muted object-contain"
        />
      )}

      <div>
        <h2 className="font-serif text-2xl leading-tight tracking-tight">
          {artwork.title}
        </h2>
        {artwork.artistName && (
          <p className="mt-1 text-sm text-muted-foreground">
            {artwork.artistName}
            {artwork.yearCreated ? ` · ${artwork.yearCreated}` : ""}
          </p>
        )}
        {(artwork.medium || dims.length >= 2) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {artwork.medium}
            {artwork.medium && dims.length >= 2 ? " · " : ""}
            {dims.length >= 2 ? formatDimensions(dims) : ""}
          </p>
        )}
      </div>

      <PriceBlock artwork={artwork} variant={variant} lot={lot} size="md" />

      {variant && artwork.status === "available" && !atAuction && !priceOnRequest ? (
        <BuyNowButton
          artwork={artwork}
          variant={variant}
          onAdd={addArtworkToCart.bind(null, null)}
          size="md"
        />
      ) : lot && atAuction ? (
        <Button asChild>
          <Link href={`/lots/${lot.id}`}>
            View auction &amp; bid
            {lot.buyNowMinor
              ? ` · buy now ${formatMoney(lot.buyNowMinor, lot.currency)}`
              : ""}
          </Link>
        </Button>
      ) : priceOnRequest && artwork.status === "available" ? (
        <p className="rounded-md bg-accent/30 p-3 text-sm text-muted-foreground">
          Price on request — open the full listing to message the artist.
        </p>
      ) : (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {artwork.status === "sold"
            ? "This piece has sold."
            : artwork.status === "reserved"
            ? "This piece is reserved pending payment."
            : "Not currently available."}
        </p>
      )}

      <Link
        href={`/artworks/${artwork.id}`}
        className="text-sm underline underline-offset-4 hover:no-underline"
      >
        Full details, more images, and provenance →
      </Link>
    </div>
  );
}

/** What a visitor gets without WebGL, or when they have asked for less motion. */
function GalleryFallback() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted p-8 text-center">
      <p className="font-serif text-xl">The gallery needs 3D graphics</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Your browser has WebGL turned off, or you have asked for reduced motion.
        Every piece in the room is on the artworks page as well.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Browse the artworks</Link>
      </Button>
    </div>
  );
}
