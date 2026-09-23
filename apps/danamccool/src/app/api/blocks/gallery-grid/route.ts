import { NextResponse } from "next/server";
import { loadGalleryGrid, loadNestedGalleries } from "@/lib/artworks";

/**
 * A gallery's tiles for the Gallery grid block in the editor's canvas —
 * the visitor's view (hidden pieces left out). Ungated for the same reason
 * as the other block endpoints: it returns only what the page shows anyone.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const grid = await loadGalleryGrid({
    galleryId: url.searchParams.get("gallery") ?? undefined,
    pagePath: url.searchParams.get("page") ?? undefined,
  });
  const nested = await loadNestedGalleries(grid.items.map((i) => i.opens));
  return NextResponse.json({ grid: { ...grid, nested } });
}
