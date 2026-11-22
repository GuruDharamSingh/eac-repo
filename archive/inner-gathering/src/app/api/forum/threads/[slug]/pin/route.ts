import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { canModerateForum, getForumThread, setThreadPinned } from "@/lib/forum";

export async function POST(
  request: NextRequest,
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

    const body = await request.json().catch(() => ({}));
    const pinned = body.pinned === true;

    const thread = await getForumThread(slug);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    await setThreadPinned(thread.id, pinned);
    return NextResponse.json({ ok: true, pinned });
  } catch (err) {
    console.error("[forum pin POST]", err);
    return NextResponse.json({ error: "Failed to update pin" }, { status: 500 });
  }
}
