import { NextRequest, NextResponse } from "next/server";
import { listPipelineActivity } from "@/lib/pipeline";
import { badRequest, num, withMember } from "@/lib/pipeline-api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withMember(async () => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    if (cardId === null) return badRequest("cardId is required");
    return NextResponse.json(await listPipelineActivity(cardId));
  });
}
