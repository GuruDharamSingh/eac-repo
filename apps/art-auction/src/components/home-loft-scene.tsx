"use client";

import * as React from "react";
import Link from "next/link";
import { HallwayExperience, OPEN_SPOT_ID, type HallwayPiece, type Placement } from "@elkdonis/three/hallway";
import { ART_FRAME_STYLES } from "@/lib/frame-styles";
import { venueFor } from "@/lib/venues";
import { drawOpenSpot, openSpotPiece } from "@/lib/open-spot";
import type { HomeLoft, LoftWork } from "@/lib/landing-loft";

// The loft on the home page: the landing installation as put on the page at
// /admin/loft (works, framing, lighting, opening view) and, when it has one,
// the visitors' free spot. The free spot is itself a "piece" — a drawn
// placeholder — so a click on it opens the same panel a hung work opens, and
// that panel is the picker. Loaded only after the visitor asks for the scene
// (see home-loft.tsx), so the model is not fetched on every visit.

function sized(url: string, w: number): string {
  return url.includes("?") ? `${url}&w=${w}` : `${url}?w=${w}`;
}

function toPiece(w: { id: string; title: string; imageUrl: string | null; artistName: string | null; heightCm: number | null; widthCm: number | null }): HallwayPiece {
  return {
    id: w.id,
    title: w.title,
    imageUrl: sized(w.imageUrl ?? "", 1024),
    artistName: w.artistName,
    heightCm: w.heightCm,
    widthCm: w.widthCm,
  };
}

export interface HomeLoftSceneProps {
  loft: HomeLoft;
  /** The visitor's own pick for the free spot, if they made one. */
  pick: LoftWork | null;
  onPick: (work: LoftWork | null) => void;
}

export function HomeLoftScene({ loft, pick, onPick }: HomeLoftSceneProps) {
  const { works, pieces: hung, scene, pool } = loft;
  const venue = React.useMemo(() => venueFor(loft.hallway), [loft.hallway]);
  const [placeholder, setPlaceholder] = React.useState<string>("");
  React.useEffect(() => {
    if (scene.openSpot) setPlaceholder(drawOpenSpot());
  }, [scene.openSpot]);

  const spot = scene.openSpot;
  const pieces = React.useMemo<HallwayPiece[]>(() => {
    const list = works.map(toPiece);
    if (spot && pick) list.push(toPiece(pick));
    else if (spot && placeholder) list.push(openSpotPiece(placeholder));
    return list;
  }, [works, spot, pick, placeholder]);

  const placements = React.useMemo<Placement[]>(() => {
    const list: Placement[] = hung.map((p) => ({
      pieceId: p.artworkId,
      wallId: p.wallId,
      x: p.x,
      y: p.y,
      frameId: p.frameId,
      scale: p.scale,
      ratio: p.ratio,
      crop: p.crop,
      lamp: p.lamp,
    }));
    if (spot && (pick || placeholder)) {
      list.push({
        pieceId: pick ? pick.id : OPEN_SPOT_ID,
        wallId: spot.wallId,
        x: spot.x,
        y: spot.y,
        scale: spot.scale,
        frameId: pick ? null : "float",
      });
    }
    return list;
  }, [hung, spot, pick, placeholder]);

  const byId = React.useMemo(
    () =>
      new Map<string, LoftWork>([
        ...works.map((w) => [w.id, { ...w, imageUrl: w.imageUrl ?? "" }] as const),
        ...pool.map((w) => [w.id, w] as const),
      ]),
    [works, pool]
  );

  const renderDetail = React.useCallback(
    (piece: HallwayPiece, _sequence: number, close: () => void) => {
      if (piece.id === OPEN_SPOT_ID) {
        return (
          <div className="hl-picker">
            <h2 className="hl-picker-title">Choose a painting to hang here</h2>
            <p className="hl-picker-lede">Any work on the market. Your choice stays on this device.</p>
            <ul className="hl-picker-grid">
              {pool
                .filter((w) => !works.some((h) => h.id === w.id))
                .map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(w);
                        close();
                      }}
                      aria-label={`Hang ${w.title}${w.artistName ? ` by ${w.artistName}` : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sized(w.imageUrl, 320)} alt="" loading="lazy" />
                      <span>{w.title}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        );
      }
      const w = byId.get(piece.id);
      if (!w) return null;
      const chosen = pick?.id === w.id;
      return (
        <div className="hl-detail">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sized(w.imageUrl, 512)} alt={w.title} />
          <h2>{w.title}</h2>
          {w.artistName && <p className="hl-detail-artist">{w.artistName}</p>}
          <Link href={`/artworks/${w.id}`} className="hl-detail-link">
            See this piece, its price and provenance →
          </Link>
          {chosen && (
            <button
              type="button"
              className="hl-btn"
              onClick={() => {
                onPick(null);
                close();
              }}
            >
              Choose another for this spot
            </button>
          )}
        </div>
      );
    },
    [pool, works, byId, pick, onPick]
  );

  // The saved opening view, or the cutaway at the middle work.
  const view = scene.view;
  const focusPieceId = view ? null : (hung[Math.floor((hung.length - 1) / 2)]?.artworkId ?? (spot ? OPEN_SPOT_ID : null));
  const initialWall = React.useMemo(() => (view ? { side: view.side, s: view.s } : null), [view]);

  return (
    <HallwayExperience
      key={venue.id}
      venue={venue}
      pieces={pieces}
      placements={placements}
      frames={ART_FRAME_STYLES}
      lighting={scene.lighting}
      initialView={view?.mode ?? "wall"}
      initialWall={initialWall}
      focusPieceId={focusPieceId}
      height="min(72vh, 680px)"
      renderDetail={renderDetail}
      fallback={<div className="hl-fallback">The loft needs 3D graphics, which your browser has turned off.</div>}
    />
  );
}
