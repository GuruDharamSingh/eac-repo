import { db } from "@elkdonis/db";
import {
  clearMeetingLight,
  isOccurrenceHost,
  resolveMeetingLight,
  setMeetingLight,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * Is it happening — the host's word.
 *
 * Owners and guides may always set it. So may the "eligible host group" for
 * the SPECIFIC occurrence being answered about: whoever the rota currently
 * has down as host or co-host that week (self-assigned counts) — checked
 * against `meeting_hosts`, never trusted from the request. That is the
 * person actually running it, and they are the ones who know whether it is
 * on, so being made an org editor first should not be the price of saying so.
 *
 * `clear` (back to whatever the numbers mean) stays organiser-only: it wipes
 * every occurrence's stored word, not just the one the eligible host is
 * responsible for.
 *
 * Stored on `threads.metadata`, not a column, while the design settles — see
 * setMeetingLight. A host's word names the occurrence it is about, so it
 * expires by itself instead of leaving a gathering permanently cancelled.
 */
export const dynamic = "force-dynamic";

const STATES = ["green", "yellow", "red"] as const;

export async function POST(request: Request) {
  const viewer = await getApiMember();
  if (!viewer) return Response.json({ error: "Members only" }, { status: 403 });

  let payload: {
    threadId?: string;
    state?: string;
    note?: string | null;
    occurrence?: string | null;
    clear?: boolean;
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const threadId = (payload.threadId ?? "").trim();
  if (!threadId) return Response.json({ error: "Bad request" }, { status: 400 });

  const [thread] = await db<Array<{ id: string }>>`
    SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
  `;
  if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

  if (payload.clear) {
    if (!viewer.canEdit) return Response.json({ error: "Only an owner or guide can clear this" }, { status: 403 });
    await clearMeetingLight(threadId);
    return Response.json({ ok: true, light: await resolveMeetingLight(threadId) });
  }

  const state = STATES.find((s) => s === payload.state);
  if (!state) {
    return Response.json({ error: "Green, yellow or red" }, { status: 400 });
  }

  const occurrence = payload.occurrence ? new Date(payload.occurrence) : null;
  if (occurrence && Number.isNaN(occurrence.getTime())) {
    return Response.json({ error: "Bad occurrence" }, { status: 400 });
  }

  if (!viewer.canEdit) {
    const eligible = occurrence && (await isOccurrenceHost(threadId, occurrence, viewer.userId));
    if (!eligible) {
      return Response.json(
        { error: "Only this week's host, or an owner or guide, can set this" },
        { status: 403 }
      );
    }
  }

  const light = await setMeetingLight(threadId, {
    state,
    note: payload.note ?? null,
    occurrence,
    setBy: viewer.userId,
  });

  return Response.json({ ok: true, light });
}
