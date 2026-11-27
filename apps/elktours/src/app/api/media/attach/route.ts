import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { attachPick } from "@/lib/media-picker";

/**
 * POST /api/media/attach { source, path, url?, tour?, destination } (2026-11-26).
 *
 * A pick from the picker: linked where it is when it already belongs to the destination, otherwise copied into the
 * destination's folder (pictures without metadata; never replacing a file). Answers { url, key, copied, copiedFrom,
 * sha256 }. Owners and guides only. docs/open/ELKTOURS_MEDIA_STRUCTURE_2026-11-26.md §3.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const r = await attachPick(await getViewer(), {
    source: String(body.source ?? ""),
    path: String(body.path ?? ""),
    url: typeof body.url === "string" ? body.url : null,
    tourId: typeof body.tour === "string" ? body.tour : null,
    destination: body.destination as never,
  });
  if (r.ok === false) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.value);
}
