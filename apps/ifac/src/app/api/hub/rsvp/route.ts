import { countConfirmedRsvps, joinThreadRsvp, leaveThreadRsvp } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * A member's RSVP, on `thread_rsvps`.
 *
 * Every IFAC RSVP is signed in (developer decision, 2026-10-10): the guest
 * route `/api/rsvp` and its form were removed. Series weeks use
 * `/api/series/rsvp`; this route serves hub threads.
 *
 * The rules (org scope, deadline, capacity under lock, waitlist, the price
 * refusal) are the one RSVP logic in @elkdonis/services (rsvp-handler.ts).
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  let payload: { threadId?: string; status?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const threadId = (payload.threadId ?? "").trim();
  const status = payload.status;
  if (!threadId || (status !== "yes" && status !== "no")) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  if (status === "yes") {
    const joined = await joinThreadRsvp(threadId, viewer.userId, { orgId: siteConfig.orgId });
    if (joined.kind === "not_found") return Response.json({ error: "Not found" }, { status: 404 });
    if (joined.kind === "refused") return Response.json({ error: joined.error }, { status: joined.httpStatus });
    if (joined.kind === "needs_checkout") return Response.json({ error: "This one is paid." }, { status: 402 });
    return Response.json({
      ok: true,
      status: joined.status,
      ...(joined.kind === "waitlisted" ? { waitlisted: true } : {}),
      confirmed: joined.count,
    });
  }

  // "Can't make it" removes the row rather than storing 'no': a declined RSVP
  // and never having answered are the same state to everything that reads this.
  const left = await leaveThreadRsvp(threadId, viewer.userId, { orgId: siteConfig.orgId });
  if (left.kind === "not_found") return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true, status, confirmed: await countConfirmedRsvps(threadId) });
}
