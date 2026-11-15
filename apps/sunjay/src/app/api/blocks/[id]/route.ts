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
    which: url.searchParams.get("which") ?? undefined,
    person: url.searchParams.get("person") ?? undefined,
    membersOnly: url.searchParams.get("membersOnly") === "0" ? false : undefined,
  }, atRecord(url.searchParams));
  return NextResponse.json(data);
}

/**
 * The record a template is being edited with (2026-11-14, config.client.ts `atRecord`): handed to the loaders as the
 * page context the published routes pass (`threadId`, `piece`, `service`), so the editor draws that record's page.
 * Shapes only here; each loader applies its own visibility (data-event.ts: a draft only for its editors;
 * data-writing.ts: only pieces shown on this site; data-service.ts: only this site's services).
 */
const REF = /^[A-Za-z0-9_-]{1,120}$/;
function atRecord(q: URLSearchParams): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};
  const thread = q.get("atThread"), piece = q.get("atPiece"), service = q.get("atService");
  if (thread && REF.test(thread)) ctx.threadId = thread;
  if (piece && REF.test(piece)) ctx.piece = piece;
  if (service && REF.test(service)) ctx.service = service;
  return ctx;
}
