import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";

// POST — mark notifications read. Body { ids?: string[] }; omit ids to mark all.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined;

    if (ids && ids.length > 0) {
      await db`
        UPDATE notifications SET read_at = NOW()
        WHERE user_id = ${session.user.id} AND read_at IS NULL AND id = ANY(${ids})
      `;
    } else {
      await db`
        UPDATE notifications SET read_at = NOW()
        WHERE user_id = ${session.user.id} AND read_at IS NULL
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking notifications read:", error);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
