import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ count: 0 });
    }

    const result = await db`
      SELECT COUNT(*)::int as count
      FROM notifications
      WHERE user_id = ${session.user.id}
        AND read_at IS NULL
    `;

    return NextResponse.json({ count: result[0]?.count || 0 });
  } catch (error) {
    console.error("Error fetching unread notification count:", error);
    return NextResponse.json({ count: 0 });
  }
}
