import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { createForumThread } from "@/lib/forum";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const thread = await createForumThread({
      authorId: session.user.id,
      title,
      body: content,
    });

    return NextResponse.json({ thread });
  } catch (err) {
    console.error("[forum threads POST]", err);
    return NextResponse.json({ error: "Failed to create thread." }, { status: 500 });
  }
}
