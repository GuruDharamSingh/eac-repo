import { NextRequest, NextResponse } from "next/server";
import { deletePipelineComment } from "@/lib/pipeline";
import { badRequest, num, withEditor } from "@/lib/pipeline-api";

/**
 * Editor-only: every comment belongs to the service account in Nextcloud, so
 * there is no per-author ownership to check against. Deletion is therefore a
 * moderation action rather than "delete my own comment".
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string; commentId: string }> }
) {
  return withEditor(async () => {
    const { cardId: rawCardId, commentId: rawCommentId } = await params;
    const cardId = num(rawCardId);
    const commentId = num(rawCommentId);
    if (cardId === null || commentId === null) return badRequest("cardId and commentId required");

    await deletePipelineComment(cardId, commentId);
    return new NextResponse(null, { status: 204 });
  });
}
