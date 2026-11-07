import { NextResponse } from "next/server";
import { loadPieces, loadPiecesByIds } from "@/lib/artworks";

/**
 * Her pieces, for the editor's canvas and its artwork picker.
 *
 *   ?limit=&sort=      the store, as the Artwork grid shows it     → { pieces }
 *   ?ids=a,b,c         specific pieces, for hand-picked rows        → { bound }
 *   ?picker=1          everything shown on the site, for choosing   → { items }
 *
 * Ungated on purpose: lib/artworks only ever returns pieces that are on
 * public sale or marked to show on the site, so this can show nothing a
 * visitor could not already see. The org is this deployment's, never a
 * request parameter.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const ids = url.searchParams.get("ids");
  if (ids !== null) {
    return NextResponse.json({ bound: await loadPiecesByIds(ids.split(",").slice(0, 100)) });
  }

  if (url.searchParams.get("picker")) {
    return NextResponse.json({ items: await loadPieces({ limit: 100 }) });
  }

  const raw = Number(url.searchParams.get("limit"));
  const pieces = await loadPieces({
    limit: Number.isFinite(raw) && raw > 0 ? raw : 24,
    sort: url.searchParams.get("sort") ?? undefined,
  });
  return NextResponse.json({ pieces });
}
