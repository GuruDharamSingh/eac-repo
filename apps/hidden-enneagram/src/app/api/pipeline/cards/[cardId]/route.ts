import { NextRequest, NextResponse } from "next/server";
import { deletePipelineCard, updatePipelineCard } from "@/lib/pipeline";
import { badRequest, num, withEditor, withMember } from "@/lib/pipeline-api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withMember(async () => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    if (cardId === null) return badRequest("cardId is required");

    const body = await request.json().catch(() => null);
    if (!body) return badRequest("A body is required");

    const title = typeof body.title === "string" ? body.title.trim() : undefined;
    if (title !== undefined && !title) return badRequest("A card needs a title");

    const card = await updatePipelineCard(cardId, {
      title,
      description: typeof body.description === "string" ? body.description : undefined,
      // null clears the due date, so undefined (absent) is the only "leave it".
      duedate: body.duedate === null || typeof body.duedate === "string" ? body.duedate : undefined,
      archived: typeof body.archived === "boolean" ? body.archived : undefined,
    });
    return NextResponse.json(card);
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withEditor(async () => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    if (cardId === null) return badRequest("cardId is required");

    await deletePipelineCard(cardId);
    return new NextResponse(null, { status: 204 });
  });
}
