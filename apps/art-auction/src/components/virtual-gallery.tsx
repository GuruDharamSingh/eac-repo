"use client";

import * as React from "react";
import Link from "next/link";
import {
  GalleryExperience,
  type GalleryPiece,
  type ParlourAssets,
} from "@elkdonis/three/gallery";
import { HallwayExperience, autoHang, type HallwayPiece } from "@elkdonis/three/hallway";
import { ART_FRAME_STYLES } from "@/lib/frame-styles";
import { venueFor } from "@/lib/venues";
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

/**
 * Furniture for the "see it in a room" parlour, served from this app's public
 * folder. Sofa, armchair and vase are CC0 models from Poly Haven; the coffee
 * table is the collective's own. See public/room/CREDITS.txt.
 */
const PARLOUR_ASSETS: ParlourAssets = {
  sofaUrl: "/room/sofa_01.glb",
  armchairUrl: "/room/armchair_01.glb",
  coffeeTableUrl: "/room/coffee_table.obj",
  vaseUrl: "/room/antique_ceramic_vase_01.glb",
};

function galleryImage(url: string): string {
  return url.includes("?") ? `${url}&w=1024` : `${url}?w=1024`;
}

/**
 * The spaces the gallery can be seen in. The hall and pavilion hang every
 * piece and stand sculpture on plinths; the loft and the morning room are the
 * installation spaces, hung automatically here with the wall work only.
 */
const SPACES = [
  { id: "hall", name: "The hall", kind: "gallery" },
  { id: "pavilion", name: "The pavilion", kind: "gallery" },
  { id: "loft", name: "The loft", kind: "venue" },
  { id: "morning-room", name: "The morning room", kind: "venue" },
] as const;
type SpaceId = (typeof SPACES)[number]["id"];

export function VirtualGallery({
  artworks,
  initialPieceId = null,
}: {
  artworks: Artwork[];
  /** Open walked up to this piece. */
  initialPieceId?: string | null;
}) {
  const [spaceId, setSpaceId] = React.useState<SpaceId>("hall");
  const space = SPACES.find((s) => s.id === spaceId)!;
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

  const venue = React.useMemo(() => (space.kind === "venue" ? venueFor(space.id) : null), [space]);
  const wallPieces = React.useMemo<HallwayPiece[]>(
    () =>
      pieces
        .filter((p) => p.display !== "plinth")
        .map((p) => ({
          id: p.id,
          title: p.title,
          imageUrl: p.imageUrl,
          artistName: p.artistName,
          heightCm: p.heightCm,
          widthCm: p.widthCm,
        })),
    [pieces]
  );
  // The piece asked for goes first, so a full room never leaves it out.
  const hung = React.useMemo(() => {
    if (!venue) return [];
    const first = wallPieces.filter((p) => p.id === initialPieceId);
    const rest = wallPieces.filter((p) => p.id !== initialPieceId);
    return autoHang(venue, [...first, ...rest]);
  }, [venue, wallPieces, initialPieceId]);

  return (
    <div>
      <div
        role="group"
        aria-label="Space"
        className="flex flex-wrap gap-1 border-b border-border bg-background/80 p-2"
      >
        {SPACES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === spaceId}
            onClick={() => setSpaceId(s.id)}
            className={`h-8 rounded-full px-3 text-sm font-medium ${
              s.id === spaceId ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.name}
          </button>
        ))}
        {venue && (
          <span className="ml-auto self-center px-2 text-xs text-muted-foreground">
            {hung.length} of {wallPieces.length} works hung
          </span>
        )}
      </div>
      {venue ? (
        <HallwayExperience
          key={venue.id}
          venue={venue}
          pieces={wallPieces}
          placements={hung}
          frames={ART_FRAME_STYLES}
          initialView="wall"
          focusPieceId={initialPieceId}
          height="min(78vh, 760px)"
          renderDetail={(piece) => {
            const artwork = byId.get(piece.id);
            return artwork ? <GalleryDetail artwork={artwork} /> : null;
          }}
          fallback={<GalleryFallback />}
        />
      ) : (
        <GalleryExperience
          key={space.id}
          pieces={pieces}
          design={space.id as "hall" | "pavilion"}
          height="min(78vh, 760px)"
          parlour={PARLOUR_ASSETS}
          renderDetail={renderDetail}
          initialPieceId={initialPieceId}
          fallback={<GalleryFallback />}
        />
      )}
    </div>
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
