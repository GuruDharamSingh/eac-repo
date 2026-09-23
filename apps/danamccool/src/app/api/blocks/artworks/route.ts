import { NextResponse } from "next/server";
import { loadArtworks, loadArtworksByIds, loadGalleryWorks } from "@/lib/artworks";

/**
 * Her artworks, for the editor's canvas and its artwork picker.
 *
 *   ?collection=&limit=&portfolio=0   a collection, as the Artworks block shows it
 *   ?ids=a,b,c                        specific pieces, for blocks bound to them
 *   ?picker=1                         everything shown on her site, for choosing
 *   ?gallery=<id> | ?page=<path>      a gallery's contents, in its order
 *
 * Ungated for the thread-feed route's reason: `lib/artworks` only ever returns
 * pieces that are on public sale or that she has marked to show on her site,
 * so this can show nothing a visitor could not already see.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const ids = url.searchParams.get("ids");
  if (ids !== null) {
    return NextResponse.json({ bound: await loadArtworksByIds(ids.split(",").slice(0, 100)) });
  }

  const gallery = url.searchParams.get("gallery");
  const page = url.searchParams.get("page");
  if (gallery || page) {
    const raw = Number(url.searchParams.get("limit"));
    return NextResponse.json({
      items: await loadGalleryWorks({
        galleryId: gallery ?? undefined,
        pagePath: page ?? undefined,
        limit: Number.isFinite(raw) && raw > 0 ? raw : 24,
      }),
    });
  }

  if (url.searchParams.get("picker")) {
    return NextResponse.json({ items: await loadArtworks({ limit: 200 }) });
  }

  const raw = Number(url.searchParams.get("limit"));
  const items = await loadArtworks({
    collection: url.searchParams.get("collection") ?? undefined,
    limit: Number.isFinite(raw) && raw > 0 ? raw : 24,
    includePortfolio: url.searchParams.get("portfolio") !== "0",
  });
  return NextResponse.json({ items });
}
