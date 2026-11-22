import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { createForumThread, resolveForumAuthorId } from "@/lib/forum";

export async function POST(request: NextRequest) {
  try {
    // Open to everyone — signed-out visitors post as a stable anonymous guest.
    const session = await getServerSession();

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title : "";
    const content = typeof body.body === "string" ? body.body : "";

    if (title.trim().length < 3) {
      return NextResponse.json(
        { error: "Title must be at least 3 characters." },
        { status: 400 }
      );
    }
    if (content.trim().length < 1) {
      return NextResponse.json({ error: "Body is required." }, { status: 400 });
    }

    const authorId = await resolveForumAuthorId(session?.user?.id);
    const thread = await createForumThread({
      authorId,
      title,
      body: content,
    });

    return NextResponse.json({ thread });
  } catch (err) {
    console.error("[forum threads POST]", err);
    return NextResponse.json({ error: "Failed to create thread." }, { status: 500 });
  }
}
