import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { sanitizeRichText } from "@elkdonis/utils";
import { createReply, getForumThread, resolveForumAuthorId } from "@/lib/forum";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    // Open to everyone — signed-out visitors reply as a stable anonymous guest.
    const session = await getServerSession();

    const body = await request.json().catch(() => ({}));
    const content = typeof body.content === "string" ? body.content : "";
    const parentReplyId =
      typeof body.parentReplyId === "string" && body.parentReplyId
        ? body.parentReplyId
        : null;

    if (content.trim().length < 1) {
      return NextResponse.json({ error: "Reply content is required." }, { status: 400 });
    }

    const thread = await getForumThread(slug);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }

    const userId = await resolveForumAuthorId(session?.user?.id);
    const reply = await createReply({
      threadId: thread.id,
      parentId: parentReplyId,
      userId,
      content: sanitizeRichText(content),
    });

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[forum thread reply POST]", err);
    return NextResponse.json({ error: "Failed to add reply." }, { status: 500 });
  }
}
