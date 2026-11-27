import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { listSource } from "@/lib/media-picker";

/**
 * GET /api/media/sources/<tour|place|places|org|mine|stops>?path=&q=&tour=&place= (2026-11-26).
 *
 * One folder of a picker source, in the listing shape @elkdonis/content MediaLibrary reads. Owners and guides only;
 * the root of each source is decided in lib/media-picker.ts from the session and the deployment's org. Opening the
 * `tour` source makes the tour's folder when it has none (Tours/<slug>/, Private/ inside); nothing else is written.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const u = new URL(req.url);
  const r = await listSource(await getViewer(), key, {
    path: u.searchParams.get("path"),
    q: u.searchParams.get("q"),
    tourId: u.searchParams.get("tour"),
    placeId: u.searchParams.get("place"),
  });
  if (r.ok === false) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.value, { headers: { "Cache-Control": "private, no-store" } });
}
