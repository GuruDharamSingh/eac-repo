import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { loadGalleryGridData, loadNestedGalleries } from "@elkdonis/blocks/server";
import { opensIdsOfGrid } from "@/lib/store-panel/opens";

/**
 * The store panel editor's resolver for gallery-grid — see gallery/route.ts.
 * Never editable here (Puck's own drag would fight the grid's), and nested
 * galleries are resolved one level deep so a piece with "other shots" shows
 * them the same way it will once published.
 */
export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const gallery = searchParams.get("gallery") || undefined;
  const grid = await loadGalleryGridData(userId, { gallery, editable: false });
  const nested = await loadNestedGalleries(userId, opensIdsOfGrid(grid.items));

  return NextResponse.json({
    galleryId: grid.galleryId,
    title: grid.title,
    items: grid.items,
    nested,
  });
}
