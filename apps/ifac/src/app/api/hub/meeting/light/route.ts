import { db } from "@elkdonis/db";
import {
  clearMeetingLight,
  isOccurrenceHost,
  resolveMeetingLight,
  setMeetingLight,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * Is it happening — the host's word.
 *
 * Owners and guides, and whoever the rota has down as host or co-host of THIS
 * occurrence: this is the one control on the card that speaks for the whole
 * group, and a member turning the gathering red would be telling everyone else
 * it was cancelled. The host widening matches innergathering's route
 * (2026-09-23) — the person running the week is the one who knows. Clearing a
 * host's word stays with owners and guides. The gate lives here rather than in
 * the service, which writes what it is told.
 *
 * Stored on `threads.metadata`, not a column, while the design settles — see
 * setMeetingLight. A host's word names the occurrence it is about, so it
 * expires by itself instead of leaving a gathering permanently cancelled.
 */
export const dynamic = "force-dynamic";

const STATES = ["green", "yellow", "red"] as const;

export async function POST(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

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
    if (!viewer.canEdit) return forbidden("Only an owner or guide can clear this");
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
    if (!eligible) return forbidden("Only this week's host, or an owner or guide, can set this");
  }

  const light = await setMeetingLight(threadId, {
    state,
    note: payload.note ?? null,
    occurrence,
    setBy: viewer.userId,
  });

  return Response.json({ ok: true, light });
}
