import { NextRequest, NextResponse } from "next/server";
import { movePipelineCard } from "@/lib/pipeline";
import { badRequest, num, withMember } from "@/lib/pipeline-api";

/**
 * Moves a card to a stack and position. The board is never named by the
 * client — it is resolved from this site's org — and the service layer
 * rejects a card or stack id that isn't on that board.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withMember(async () => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    const body = await request.json().catch(() => null);
    const toStackId = num(body?.toStackId);
    const order = num(body?.order);

    if (cardId === null || toStackId === null || order === null) {
      return badRequest("cardId, toStackId and order are required");
    }

    const stackCards = await movePipelineCard(cardId, toStackId, order);
    return NextResponse.json(stackCards);
  });
}
