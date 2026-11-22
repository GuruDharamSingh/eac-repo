import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { canModerateForum, deleteForumReply } from "@/lib/forum";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canModerateForum(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const removed = await deleteForumReply(id);
    if (removed === 0) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    console.error("[forum reply DELETE]", err);
    return NextResponse.json({ error: "Failed to delete reply" }, { status: 500 });
  }
}
