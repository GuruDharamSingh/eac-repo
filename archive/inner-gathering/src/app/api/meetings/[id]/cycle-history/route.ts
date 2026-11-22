import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";

const ORG_ID = "inner_group";

// GET — confirm/cancel events for the last 14 days, grouped per day so the
// detail page can render a "cycle history" table (who confirmed/cancelled, when).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [meeting] = await db`
      SELECT id FROM threads
      WHERE id = ${id} AND org_id = ${ORG_ID} AND kind IN ('meeting', 'workshop')
      LIMIT 1
    `;
    if (!meeting) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const events = await db`
      SELECT e.id, e.action, e.created_at, e.user_id,
             COALESCE(u.display_name, u.email) AS user_name
      FROM thread_cycle_events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.thread_id = ${id}
        AND e.created_at > NOW() - INTERVAL '14 days'
      ORDER BY e.created_at DESC
    `;

    return NextResponse.json({
      events: events.map((e: any) => ({
        id: e.id,
        action: e.action,
        userId: e.user_id,
        userName: e.user_name || "Someone",
        createdAt: e.created_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching cycle history:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
