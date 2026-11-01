import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/** The Make tab's save endpoint -- one column, so it doesn't go through the general content-edit action. */

const MIN_MINUTES = 15;
const MAX_MINUTES = 14 * 24 * 60; // 14 days

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const raw = body.minutesBefore;

  const value =
    raw === null || raw === undefined
      ? null
      : Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(Number(raw))));

  if (value !== null && !Number.isFinite(value)) {
    return NextResponse.json({ error: "minutesBefore must be a number or null" }, { status: 400 });
  }

  const [row] = await db<{ reminder_minutes_before: number | null }[]>`
    UPDATE threads
    SET reminder_minutes_before = ${value}
    WHERE id = ${id} AND org_id = ${siteConfig.orgId}
    RETURNING reminder_minutes_before
  `;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ reminderMinutesBefore: row.reminder_minutes_before });
}
