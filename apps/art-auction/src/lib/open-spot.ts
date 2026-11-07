import type { HallwayPiece } from "@elkdonis/three/hallway";
import { OPEN_SPOT_ID } from "@elkdonis/three/hallway/model";

// The visitors' free spot in the landing loft: a drawn placeholder hung as a
// piece, so a click on it opens the same panel a hung work opens (the
// picker). Browser only: call from an effect.

/**
 * A dark card with a dashed edge and an invitation, as a PNG data URL: the
 * hall decodes its pictures with `createImageBitmap`, which does not take SVG.
 */
export function drawOpenSpot(): string {
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

/** The placeholder as a hall piece: 80 × 100 cm. */
export function openSpotPiece(imageUrl: string): HallwayPiece {
  return { id: OPEN_SPOT_ID, title: "Visitors' free spot", imageUrl, aspect: 0.8, heightCm: 100, widthCm: 80 };
}
