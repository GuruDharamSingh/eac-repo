import { NextRequest, NextResponse } from "next/server";
import { addPipelineAttachment, listPipelineAttachments } from "@/lib/pipeline";
import { badRequest, num, withMember } from "@/lib/pipeline-api";

/** Matches Nextcloud's own default upload ceiling for a Deck attachment. */
const MAX_BYTES = 100 * 1024 * 1024;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withMember(async () => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    if (cardId === null) return badRequest("cardId is required");
    return NextResponse.json(await listPipelineAttachments(cardId));
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withMember(async () => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    if (cardId === null) return badRequest("cardId is required");

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return badRequest("A file is required");
    if (file.size === 0) return badRequest("That file is empty");
    if (file.size > MAX_BYTES) return badRequest("That file is too large");

    const attachment = await addPipelineAttachment(cardId, {
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || undefined,
    });
    return NextResponse.json(attachment, { status: 201 });
  });
}
