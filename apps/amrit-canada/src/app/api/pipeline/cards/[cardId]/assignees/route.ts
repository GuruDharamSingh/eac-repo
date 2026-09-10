import { NextRequest, NextResponse } from "next/server";
import { setPipelineCardAssignee } from "@/lib/pipeline";
import { badRequest, num, withMember } from "@/lib/pipeline-api";

/**
 * Assign or unassign a card. The uid must already be a participant on the
 * board — Deck stores assignments as Nextcloud principals and rejects anyone
 * else, so members who haven't connected a Nextcloud account can't be
 * assigned. The service layer enforces that; this only shapes the request.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withMember(async () => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    const body = await request.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId : "";

    if (cardId === null || !userId) return badRequest("cardId and userId are required");
    if (typeof body?.assigned !== "boolean") return badRequest("assigned must be true or false");

    await setPipelineCardAssignee(cardId, userId, body.assigned);
    return new NextResponse(null, { status: 204 });
  });
}
