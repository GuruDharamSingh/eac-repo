/**
 * Report a card.
 *
 * Deliberately open to anyone, signed in or not: cards publish instantly, so
 * the only thing standing between a bad card and the gallery is somebody
 * saying so. Requiring an account to report would defeat that.
 *
 * A report does NOT hide anything by itself — that would hand every passer-by
 * a veto. It raises open_report_count, which surfaces the card at the top of
 * /manage/reports for a human to judge.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getClientIp, getGuest, requireWritableGuest } from "@/lib/guest";
import { checkRate, recordRate } from "@/lib/rate-limit";

export const runtime = "nodejs";

const BodySchema = z.object({
  threadId: z.string().min(1).max(21),
  reason: z.enum([
    "not_a_pigeon",
    "duplicate",
    "identifiable_person",
    "wrong_place",
    "offensive",
    "copyright",
    "other",
  ]),
  detail: z.string().trim().max(600).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const viewer = await getViewer().catch(() => null);
    const ip = await getClientIp();
    const existingGuest = viewer ? null : await getGuest();

    const rate = await checkRate("report", {
      guestId: existingGuest?.id,
      userId: viewer?.userId,
      ip,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: rate.reason },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Bad report" }, { status: 400 });
    }
    const { threadId, reason, detail } = parsed.data;

    const exists = await db<{ thread_id: string }[]>`
      SELECT pc.thread_id FROM pigeon_cards pc
      JOIN threads t ON t.id = pc.thread_id
      WHERE pc.thread_id = ${threadId} AND t.org_id = ${siteConfig.orgId}
      LIMIT 1
    `;
    if (exists.length === 0) {
      return NextResponse.json({ error: "No such card" }, { status: 404 });
    }

    let guestId: string | null = existingGuest?.id ?? null;
    if (!viewer && !guestId) {
      const guest = await requireWritableGuest();
      if (guest.ok) guestId = guest.guest.id;
    }

    // One open report per reporter per card. Someone hitting the button five
    // times is not five people worried about the same photo, and letting it
    // count as five would let one person push a card to the top of the queue.
    const duplicate = await db<{ id: string }[]>`
      SELECT id FROM pigeon_reports
      WHERE thread_id = ${threadId} AND status = 'open'
        AND (
          ${guestId ? db`reporter_guest_id = ${guestId}` : db`FALSE`}
          OR ${viewer ? db`reporter_user_id = ${viewer.userId}` : db`FALSE`}
        )
      LIMIT 1
    `;
    if (duplicate.length > 0) {
      return NextResponse.json({ ok: true, alreadyReported: true });
    }

    await db.begin(async (tx) => {
      await tx`
        INSERT INTO pigeon_reports (
          id, thread_id, reason, detail, reporter_guest_id, reporter_user_id, ip_address
        ) VALUES (
          ${nanoid()}, ${threadId}, ${reason}, ${detail || null},
          ${guestId}, ${viewer?.userId ?? null}, ${ip}::inet
        )
      `;
      await tx`
        UPDATE pigeon_cards
        SET open_report_count = open_report_count + 1
        WHERE thread_id = ${threadId}
      `;
    });

    await recordRate("report", { guestId, userId: viewer?.userId, ip });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pigeonshoot] report:", err);
    return NextResponse.json({ error: "Couldn't file that report." }, { status: 500 });
  }
}
