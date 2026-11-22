import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { listLibrary } from "@/lib/media-libraries";

/**
 * GET /api/media/libraries/<tours|places|general>?path=&q=&tour= (MEDIA lane, 2026-11-21).
 *
 * The picture picker's tabs. Who may open which library is decided in lib/media-libraries.ts from the session and the
 * deployment's org; the query supplies only a folder name, a search word and (tours) a tour to open. Read only: it
 * lists pictures that are already stored and writes nothing.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const url = new URL(req.url);
  const res = await listLibrary(await getViewer(), key, {
    path: url.searchParams.get("path") ?? "",
    q: url.searchParams.get("q") ?? "",
    tourId: url.searchParams.get("tour") ?? "",
  });
  if ("listing" in res) return NextResponse.json(res.listing, { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ error: res.error }, { status: res.status });
}
