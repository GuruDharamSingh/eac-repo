import { NextRequest, NextResponse } from "next/server";
import { setPipelineCardArchived, setPipelineCardDone } from "@/lib/pipeline";
import { badRequest, num, withMember } from "@/lib/pipeline-api";

/**
 * Deck's "Mark as done" and "Archive card" card-menu actions. Both are
 * reversible and neither loses anything, so they sit with the member-level
 * card work rather than behind the editor gate that guards deletion.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withMember(async () => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    if (cardId === null) return badRequest("cardId is required");

    const body = await request.json().catch(() => null);
    if (typeof body?.done === "boolean") {
      return NextResponse.json(await setPipelineCardDone(cardId, body.done));
    }
    if (typeof body?.archived === "boolean") {
      return NextResponse.json(await setPipelineCardArchived(cardId, body.archived));
    }
    return badRequest("Pass done or archived as a boolean");
  });
}
