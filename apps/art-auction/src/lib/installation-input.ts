import type { InstallationPiece } from "./installations";
// The banner-free entry: the client one marks every export as a client reference.
import { isFrameRatio, normalizeLamp } from "@elkdonis/three/hallway/model";

// What an installation editor sends, bounded before it is stored. Shared by
// the studio's actions and the landing loft's (`/admin/loft`).

/** A number within [lo, hi], or the fallback when it is not a number. */
function bound(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

export function cleanPieces(pieces: unknown): InstallationPiece[] {
  if (!Array.isArray(pieces)) return [];
  return (pieces as InstallationPiece[])
    .filter((p) => p && typeof p.artworkId === "string" && typeof p.wallId === "string")
    .slice(0, 400)
    .map((p) => ({
      artworkId: p.artworkId,
      wallId: p.wallId.slice(0, 16),
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      frameId: p.frameId ? String(p.frameId).slice(0, 40) : null,
      scale: bound(p.scale, 0.25, 4, 1),
      ratio: isFrameRatio(p.ratio) ? p.ratio : "auto",
      crop: {
        x: bound(p.crop?.x, 0, 100, 50),
        y: bound(p.crop?.y, 0, 100, 50),
        zoom: bound(p.crop?.zoom, 1, 3, 1),
      },
      lamp: normalizeLamp(p.lamp),
      sequence: Math.max(1, Math.round(Number(p.sequence) || 1)),
    }));
}
