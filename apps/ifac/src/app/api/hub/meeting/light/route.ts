import { db } from "@elkdonis/db";
import {
  clearMeetingLight,
  resolveMeetingLight,
  setMeetingLight,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * Is it happening — the host's word.
 *
 * Owners and guides only: this is the one control on the card that speaks for
 * the whole group, and a member turning the gathering red would be telling
 * everyone else it was cancelled. `getHubViewer` returns `canEdit` for
 * exactly those two roles, and the gate lives here rather than in the service,
 * which writes what it is told.
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
  if (!viewer.canEdit) return forbidden("Only an owner or guide can set this");

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

  const light = await setMeetingLight(threadId, {
    state,
    note: payload.note ?? null,
    occurrence,
    setBy: viewer.userId,
  });

  return Response.json({ ok: true, light });
}
