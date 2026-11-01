"use client";

import * as React from "react";
import Link from "next/link";
import { HallwayExperience, type HallwayPiece, type Placement } from "@elkdonis/three/hallway";
import { ART_FRAME_STYLES } from "@/lib/frame-styles";
import { venueFor } from "@/lib/venues";
import type { LoftHung, LoftWork } from "@/lib/home-sections";
import { cropToDataUrl, isUncropped, ratioNumber } from "@/lib/loft-crop";

// The loft on the home page: two works already on the long wall and a free
// spot beside them. The free spot is itself a "piece" — a drawn placeholder —
// so that a click on it opens the same panel a hung work opens, and that panel
// is the picker. Loaded only after the visitor asks for the scene (see
// home-loft.tsx), so the model is not fetched on every visit.

export const EMPTY_ID = "home-loft-empty-spot";

/** Where the three spots are on the loft's long wall (`S1`), metres from its centre. */
const SPOTS: Array<{ x: number; y: number }> = [
  { x: -2.6, y: 1.55 },
  { x: 0.2, y: 1.55 },
  { x: 3.0, y: 1.55 },
];

function sized(url: string, w: number): string {
  return url.includes("?") ? `${url}&w=${w}` : `${url}?w=${w}`;
}

function toPiece(w: LoftWork): HallwayPiece {
  return {
    id: w.id,
    title: w.title,
    imageUrl: sized(w.imageUrl, 1024),
    artistName: w.artistName,
    heightCm: w.heightCm,
    widthCm: w.widthCm,
  };
}

/**
 * The placeholder, drawn once in the browser: a dark card with a dashed edge
 * and an invitation. A PNG data URL, because the hall decodes its pictures
 * with `createImageBitmap`, which does not take SVG.
 */
function drawPlaceholder(): string {
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = 1000;
  const g = c.getContext("2d");
  if (!g) return "";
  g.fillStyle = "#23262e";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(196, 202, 214, 0.8)";
  g.lineWidth = 6;
  g.setLineDash([28, 18]);
  g.strokeRect(40, 40, c.width - 80, c.height - 80);
  g.setLineDash([]);
  g.fillStyle = "#eef2f9";
  g.textAlign = "center";
  g.font = "500 54px Georgia, serif";
  g.fillText("Hang a painting here", c.width / 2, c.height / 2 - 20);
  g.fillStyle = "#aab3c7";
  g.font = "400 32px system-ui, sans-serif";
  g.fillText("Click to choose one from the market", c.width / 2, c.height / 2 + 44);
  return c.toDataURL("image/png");
}

/**
 * A hung work as a piece, framed as the owners set it: a fixed proportion or a
 * zoom means the picture is cropped on a canvas first (`cropped`), and the
 * recorded height is kept with the width following the frame, so the piece
 * keeps its real scale on the wall.
 */
function toFramedPiece(w: LoftHung, cropped: string | undefined): HallwayPiece {
  if (isUncropped(w.ratio, w.crop) || !cropped) return toPiece(w);
  const r = ratioNumber(w.ratio);
  const heightCm = w.heightCm ?? null;
  return {
    id: w.id,
    title: w.title,
    imageUrl: cropped,
    artistName: w.artistName,
    heightCm,
    widthCm: r && heightCm ? Math.round(heightCm * r) : r ? null : w.widthCm,
    aspect: r,
  };
}

export interface HomeLoftSceneProps {
  hung: LoftHung[];
  pool: LoftWork[];
  /** The visitor's own pick for the free spot, if they made one. */
  pick: LoftWork | null;
  onPick: (work: LoftWork | null) => void;
}

export function HomeLoftScene({ hung, pool, pick, onPick }: HomeLoftSceneProps) {
  const venue = React.useMemo(() => venueFor("loft"), []);
  const [placeholder, setPlaceholder] = React.useState<string>("");
  React.useEffect(() => setPlaceholder(drawPlaceholder()), []);

  // The owners' crops, drawn in the browser once the scene opens.
  const [cropped, setCropped] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    let live = true;
    for (const w of hung.slice(0, 2)) {
      if (isUncropped(w.ratio, w.crop)) continue;
      cropToDataUrl(sized(w.imageUrl, 1024), w.ratio, w.crop)
        .then((url) => live && setCropped((c) => ({ ...c, [w.id]: url })))
        .catch(() => {
          /* the piece hangs as shot */
        });
    }
    return () => {
      live = false;
    };
  }, [hung]);

  const spotWork = pick;
  const pieces = React.useMemo<HallwayPiece[]>(() => {
    const list = hung.slice(0, 2).map((w) => toFramedPiece(w, cropped[w.id]));
    if (spotWork) list.push(toPiece(spotWork));
    else if (placeholder) list.push({ id: EMPTY_ID, title: "A free spot", imageUrl: placeholder, aspect: 0.8, heightCm: 100, widthCm: 80 });
    return list;
  }, [hung, spotWork, placeholder, cropped]);

  const placements = React.useMemo<Placement[]>(
    () => pieces.map((p, i) => ({ pieceId: p.id, wallId: "S1", frameId: p.id === EMPTY_ID ? "float" : null, ...SPOTS[Math.min(i, 2)]! })),
    [pieces]
  );

  const byId = React.useMemo(() => new Map([...hung, ...pool].map((w) => [w.id, w] as const)), [hung, pool]);

  const renderDetail = React.useCallback(
    (piece: HallwayPiece, _sequence: number, close: () => void) => {
      if (piece.id === EMPTY_ID) {
        return (
          <div className="hl-picker">
            <h2 className="hl-picker-title">Choose a painting to hang here</h2>
            <p className="hl-picker-lede">Any work on the market. Your choice stays on this device.</p>
            <ul className="hl-picker-grid">
              {pool
                .filter((w) => !hung.some((h) => h.id === w.id))
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
      const chosen = spotWork?.id === w.id;
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
    [pool, hung, byId, spotWork, onPick]
  );

  return (
    <HallwayExperience
      key={venue.id}
      venue={venue}
      pieces={pieces}
      placements={placements}
      frames={ART_FRAME_STYLES}
      initialView="wall"
      focusPieceId={hung[1]?.id ?? hung[0]?.id ?? EMPTY_ID}
      height="min(72vh, 680px)"
      renderDetail={renderDetail}
      fallback={
        <div className="hl-fallback">The loft needs 3D graphics, which your browser has turned off.</div>
      }
    />
  );
}
