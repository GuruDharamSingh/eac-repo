import { NextResponse } from "next/server";
import { BLOCK_DATA_IDS, loadBlockData } from "@/lib/puck/block-data";
import { getApiEditor } from "@/lib/auth";

/**
 * Rows for a data block, for the editor's canvas.
 *
 * Editors only: the forum snapshot and the standing meeting are read as the
 * signed-in viewer, and the canvas is the only caller. The member panel is not
 * served here at all — it describes the viewer, and the editor draws the
 * sign-up form in its place.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const { id } = await params;
  if (id === "pt-member" || !(BLOCK_DATA_IDS as readonly string[]).includes(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit"));
  const data = await loadBlockData(id, {
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    source: url.searchParams.get("source") ?? undefined,
    feed: url.searchParams.get("feed") ?? undefined,
    service: url.searchParams.get("service") ?? undefined,
    piece: url.searchParams.get("piece") ?? undefined,
    series: url.searchParams.get("series") ?? undefined,
    membersOnly: url.searchParams.get("membersOnly") === "0" ? false : undefined,
  });
  return NextResponse.json(data);
}
