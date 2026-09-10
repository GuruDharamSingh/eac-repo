import { NextRequest, NextResponse } from "next/server";
import { addPipelineComment, listPipelineComments } from "@/lib/pipeline";
import { badRequest, num, withMember } from "@/lib/pipeline-api";
import { getProfile } from "@elkdonis/services";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withMember(async () => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    if (cardId === null) return badRequest("cardId is required");
    return NextResponse.json(await listPipelineComments(cardId));
  });
}

/**
 * The author name is taken from the viewer's own profile, never from the
 * request body — the comment is posted to Nextcloud under the service
 * account, so this name is the only record of who actually wrote it and a
 * client must not be able to choose it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withMember(async (viewer) => {
    const { cardId: rawCardId } = await params;
    const cardId = num(rawCardId);
    const body = await request.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (cardId === null) return badRequest("cardId is required");
    if (!message) return badRequest("A comment needs a message");

    const profile = await getProfile(viewer.userId);
    const authorName = profile?.displayName?.trim() || viewer.email;
    const comment = await addPipelineComment(cardId, authorName, message);
    return NextResponse.json(comment, { status: 201 });
  });
}
