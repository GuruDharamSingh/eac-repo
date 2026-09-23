import { NextResponse } from "next/server";
import { loadNestedGalleries } from "@/lib/artworks";

/**
 * The galleries an Image set's pictures open (and those open, down to
 * NEST_DEPTH), for the editor's canvas. Ungated like the other block
 * endpoints: it returns only what the published page shows anyone.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").slice(0, 50);
  return NextResponse.json({ nested: await loadNestedGalleries(ids) });
}
