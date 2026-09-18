import { NextRequest, NextResponse } from "next/server";
import {
  getOccurrenceRecord,
  saveOccurrenceRecord,
  suggestAttendanceFromTalk,
  type AttendanceEntry,
} from "@elkdonis/services";
import { getApiMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { db } from "@elkdonis/db";

/**
 * What happened at one occurrence: a note, and who was there.
 *
 * GET also returns what Talk thinks — a SUGGESTION, never the record. The
 * distinction is the whole design: the call log is evidence, the record is a
 * person's account, and a system that silently promotes the first into the
 * second will eventually tell somebody they attended a meeting they did not.
 */
export const dynamic = "force-dynamic";

async function threadInOrg(threadId: string): Promise<boolean> {
  const [row] = await db<Array<{ id: string }>>`
    SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
  `;
  return Boolean(row);
}

export async function GET(request: NextRequest) {
  const viewer = await getApiMember();
  if (!viewer) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const threadId = request.nextUrl.searchParams.get("threadId");
  const occurrence = request.nextUrl.searchParams.get("occurrence");
  if (!threadId || !occurrence)
    return NextResponse.json({ error: "threadId and occurrence required" }, { status: 400 });
  if (!(await threadInOrg(threadId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [record, talk] = await Promise.all([
    getOccurrenceRecord(threadId, occurrence),
    // A failure here costs the suggestion, not the panel: the note is the
    // thing being written, and Talk being unreachable must not block it.
    suggestAttendanceFromTalk(threadId, occurrence).catch(() => null),
  ]);

  return NextResponse.json({
    record,
    talk: talk
      ? { scanned: talk.scanned, roomToken: talk.roomToken, suggested: talk.suggested }
      : null,
  });
}

export async function POST(request: NextRequest) {
  const viewer = await getApiMember();
  if (!viewer) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    threadId?: string;
    occurrenceAt?: string;
    note?: string | null;
    attended?: AttendanceEntry[];
  };
  if (!body.threadId || !body.occurrenceAt)
    return NextResponse.json({ error: "threadId and occurrenceAt required" }, { status: 400 });
  if (!(await threadInOrg(body.threadId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Any member may write the record. Whoever hosted is usually not an
  // organiser — that is the entire point of a rota — so gating this on
  // `canEdit` would mean the one person actually running it cannot say what
  // happened.
  await saveOccurrenceRecord({
    threadId: body.threadId,
    occurrenceAt: body.occurrenceAt,
    note: body.note ?? null,
    attended: Array.isArray(body.attended) ? body.attended : [],
    actorUserId: viewer.userId,
  });

  return NextResponse.json({ ok: true });
}
