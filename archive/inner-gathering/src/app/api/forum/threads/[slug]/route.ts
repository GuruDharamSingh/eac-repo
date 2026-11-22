import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { canModerateForum, deleteForumThread, getForumThread } from "@/lib/forum";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canModerateForum(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const thread = await getForumThread(slug);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    await deleteForumThread(thread.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forum thread DELETE]", err);
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
  }
}
