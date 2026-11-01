"use client";

import * as React from "react";
import Link from "next/link";
import { HallwayExperience, type HallwayPiece, type Placement, type SceneLighting } from "@elkdonis/three/hallway";
import { ART_FRAME_STYLES } from "@/lib/frame-styles";
import type { InstallationArtwork, InstallationPiece } from "@/lib/installations";
import { venueFor } from "@/lib/venues";

function sized(url: string, w: number): string {
  return url.includes("?") ? `${url}&w=${w}` : `${url}?w=${w}`;
}

export function InstallationWalk({
  artworks,
  pieces,
  venueId,
  lighting,
}: {
  artworks: InstallationArtwork[];
  pieces: InstallationPiece[];
  /** `art_installation.hallway`: which space the hang is in. */
  venueId: string;
  /** `art_installation.scene.lighting`. */
  lighting: SceneLighting;
}) {
  const venue = React.useMemo(() => venueFor(venueId), [venueId]);
  const byId = React.useMemo(() => new Map(artworks.map((a) => [a.id, a])), [artworks]);
  const hallPieces = React.useMemo<HallwayPiece[]>(
    () =>
      artworks
        .filter((a) => a.imageUrl)
        .map((a) => ({
          id: a.id,
          title: a.title,
          imageUrl: sized(a.imageUrl!, 1024),
          artistName: a.artistName,
          heightCm: a.heightCm,
          widthCm: a.widthCm,
        })),
    [artworks]
  );
  const placements = React.useMemo<Placement[]>(
    () =>
      pieces.map((p) => ({
        pieceId: p.artworkId,
        wallId: p.wallId,
        x: p.x,
        y: p.y,
        frameId: p.frameId,
        scale: p.scale,
        ratio: p.ratio,
        crop: p.crop,
        lamp: p.lamp,
      })),
    [pieces]
  );

  const renderDetail = React.useCallback(
    (piece: HallwayPiece) => {
      const a = byId.get(piece.id);
      if (!a) return null;
      return (
        <div className="flex flex-col gap-4">
          {a.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sized(a.imageUrl, 512)} alt={a.title} className="w-full rounded-md bg-muted object-contain" />
          )}
          <div>
            <h2 className="font-serif text-2xl leading-tight tracking-tight">{a.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {a.artistName}
              {a.yearCreated ? ` · ${a.yearCreated}` : ""}
            </p>
            {a.medium && <p className="mt-1 text-xs text-muted-foreground">{a.medium}</p>}
          </div>
          <Link href={`/artworks/${a.id}`} className="text-sm underline underline-offset-4 hover:no-underline">
            See this piece, its price and provenance →
          </Link>
        </div>
      );
    },
    [byId]
  );

  return (
    <HallwayExperience
      key={venue.id}
      venue={venue}
      pieces={hallPieces}
      placements={placements}
      frames={ART_FRAME_STYLES}
      lighting={lighting}
      height="min(78vh, 760px)"
      renderDetail={renderDetail}
      fallback={
        <div className="flex h-full items-center justify-center p-8 text-center text-sm">
          The hallway needs 3D graphics, which your browser has turned off.
        </div>
      }
    />
  );
}
