import { NextRequest, NextResponse } from "next/server";
import { setPipelineCardLabel } from "@/lib/pipeline";
import { badRequest, num, withMember } from "@/lib/pipeline-api";

/** Toggles one of the board's labels on a card. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withMember(async () => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    const body = await request.json().catch(() => null);
    const labelId = num(body?.labelId);

    if (cardId === null || labelId === null) return badRequest("cardId and labelId are required");
    if (typeof body?.assigned !== "boolean") return badRequest("assigned must be true or false");

    await setPipelineCardLabel(cardId, labelId, body.assigned);
    return new NextResponse(null, { status: 204 });
  });
}
