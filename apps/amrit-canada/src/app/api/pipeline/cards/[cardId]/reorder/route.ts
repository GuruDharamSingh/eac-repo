import { NextRequest, NextResponse } from "next/server";
import { getApiMember } from "@/lib/auth";
import { movePipelineCard, pipelineWritesEnabled } from "@/lib/pipeline";

/**
 * Moves a card between stacks/positions on the Pipeline board. boardId is
 * never read from the request — always the server-side PIPELINE_BOARD_ID —
 * so a client can't redirect a write at an arbitrary board the shared
 * Nextcloud admin account can see.
 *
 * Gated on both membership AND canEdit (owner/guide, not just any member):
 * this board is real, currently-used data belonging to someone else, so
 * write access starts narrower than read access. Also gated on
 * pipelineWritesEnabled() — checked here, not just hidden in the UI.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const viewer = await getApiMember();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.canEdit) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!pipelineWritesEnabled()) {
    return NextResponse.json({ error: "Pipeline moves are disabled" }, { status: 403 });
  }

  const { cardId } = await params;
  const body = await request.json().catch(() => null);
  const fromStackId = Number(body?.fromStackId);
  const toStackId = Number(body?.toStackId);
  const order = Number(body?.order);

  if (!Number.isFinite(fromStackId) || !Number.isFinite(toStackId) || !Number.isFinite(order)) {
    return NextResponse.json({ error: "fromStackId, toStackId and order are required" }, { status: 400 });
  }

  try {
    const card = await movePipelineCard(fromStackId, Number(cardId), toStackId, order);
    return NextResponse.json(card);
  } catch (error) {
    console.error("[amrit-canada] pipeline reorder error:", error);
    return NextResponse.json({ error: "Could not move the card" }, { status: 502 });
  }
}
