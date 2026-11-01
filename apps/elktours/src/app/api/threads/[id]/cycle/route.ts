import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Confirm or cancel the current occurrence of a recurring gathering.
 *
 * "Is it on this month?" is the question the Amrit Vela audience actually
 * needs answered, and nobody can answer it from the schedule alone — a 4am
 * sadhana depends on whether a guide is opening the door. This writes an
 * append-only row to `thread_cycle_events`; the read side (getCycleStatus)
 * takes the latest event *within the current cycle*, so last month's
 * confirmation never speaks for this month.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const editor = await getApiEditor();
  if (!editor) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  // 'confirmed' / 'cancelled' — the vocabulary the thread_cycle_events CHECK
  // constraint enforces and inner-gathering already uses. Accepts the bare
  // verbs too, since that's the natural thing for a caller to send.
  const raw = await request.json().catch(() => ({}));
  const action =
    raw.action === "confirm" || raw.action === "confirmed"
      ? "confirmed"
      : raw.action === "cancel" || raw.action === "cancelled"
        ? "cancelled"
        : null;

  if (!action) {
    return NextResponse.json(
      { error: "action must be 'confirmed' or 'cancelled'" },
      { status: 400 }
    );
  }

  const [thread] = await db<{ id: string }[]>`
    SELECT id FROM threads
    WHERE id = ${id} AND org_id = ${siteConfig.orgId}
    LIMIT 1
  `;
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db`
    INSERT INTO thread_cycle_events (id, thread_id, user_id, action)
    VALUES (${nanoid()}, ${id}, ${editor.userId}, ${action})
  `;

  return NextResponse.json({ ok: true, action });
}
