import { NextRequest, NextResponse } from "next/server";
import { readPipelineAttachment, removePipelineAttachment } from "@/lib/pipeline";
import { badRequest, num, withEditor, withMember } from "@/lib/pipeline-api";

/**
 * Streams the attachment back through this app. Members have no Nextcloud
 * credentials of their own, so a direct Deck URL would 401 for them — the
 * service account fetches the bytes and this route is the membership gate.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string; attachmentId: string }> }
) {
  return withMember(async () => {
    const { cardId: rawCardId, attachmentId: rawAttachmentId } = await params;
    const cardId = num(rawCardId);
    const attachmentId = num(rawAttachmentId);
    if (cardId === null || attachmentId === null) {
      return badRequest("cardId and attachmentId are required");
    }

    const { data, contentType } = await readPipelineAttachment(cardId, attachmentId);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        // Attachment, not inline: the bytes came from an upload and are
        // served from this app's own origin.
        "Content-Disposition": "attachment",
        "Cache-Control": "private, no-store",
      },
    });
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string; attachmentId: string }> }
) {
  return withEditor(async () => {
    const { cardId: rawCardId, attachmentId: rawAttachmentId } = await params;
    const cardId = num(rawCardId);
    const attachmentId = num(rawAttachmentId);
    if (cardId === null || attachmentId === null) {
      return badRequest("cardId and attachmentId are required");
    }

    await removePipelineAttachment(cardId, attachmentId);
    return new NextResponse(null, { status: 204 });
  });
}
