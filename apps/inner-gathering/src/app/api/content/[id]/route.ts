import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";

const ORG_ID = "inner_group";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await isAdmin(session.user.id);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [thread] = await db`
      SELECT id, kind
      FROM threads
      WHERE id = ${id}
        AND org_id = ${ORG_ID}
        AND kind IN ('post', 'meeting', 'workshop', 'event')
      LIMIT 1
    `;

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    await db`
      UPDATE threads
      SET status = 'archived', updated_at = NOW()
      WHERE id = ${id}
        AND org_id = ${ORG_ID}
        AND kind IN ('post', 'meeting', 'workshop', 'event')
    `;

    revalidatePath("/feed");
    revalidatePath("/calendar");
    revalidatePath("/live");

    return NextResponse.json({ success: true, kind: thread.kind });
  } catch (error) {
    console.error("Failed to delete thread:", error);
    return NextResponse.json(
      { error: "Failed to delete thread" },
      { status: 500 }
    );
  }
}
