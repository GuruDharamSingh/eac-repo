import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";

// GET — recent notifications for the current user (newest first), with the
// actor's display name and the related thread's title/kind resolved for display.
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ notifications: [] });
    }

    const rows = await db`
      SELECT
        n.id, n.kind, n.thread_id, n.actor_id, n.data, n.read_at, n.created_at,
        a.display_name AS actor_name,
        t.title AS thread_title, t.kind AS thread_kind
      FROM notifications n
      LEFT JOIN users a ON a.id = n.actor_id
      LEFT JOIN threads t ON t.id = n.thread_id
      WHERE n.user_id = ${session.user.id}
      ORDER BY n.created_at DESC
      LIMIT 30
    `;

    const notifications = rows.map((n: any) => ({
      id: n.id,
      kind: n.kind,
      threadId: n.thread_id || null,
      threadTitle: n.thread_title || n.data?.title || null,
      threadKind: n.thread_kind || null,
      actorName: n.actor_name || null,
      data: n.data || {},
      readAt: n.read_at,
      createdAt: n.created_at,
    }));

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ notifications: [] });
  }
}
