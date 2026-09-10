import { db } from "@elkdonis/db";
import {
  checkRsvpEligibility,
  countConfirmedRsvps,
  setRsvpStatus,
  deleteRsvp,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * A member's RSVP, on `thread_rsvps`.
 *
 * Distinct from /api/rsvp, which writes `guest_submissions` keyed by email
 * with no user_id, no eligibility check and no capacity check. That route is
 * for the public site, where the person RSVPing has no account. It cannot
 * answer "am I coming?" for a signed-in member, which is what this is for.
 *
 * Eligibility comes from the shared, kind-agnostic `checkRsvpEligibility` —
 * `thread_rsvps` has no `kind` column and `is_rsvp_enabled` / `attendee_limit`
 * / `rsvp_deadline` are generic thread columns, so nothing here branches on
 * whether the thread is a meeting, an event or a workshop.
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

  // The thread must be IFAC's. Without this a member could RSVP to any thread
  // in the network by id, since thread_rsvps itself is org-agnostic.
  const [thread] = await db<Array<{ id: string }>>`
    SELECT id FROM threads
    WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
  `;
  if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

  if (status === "yes") {
    const eligibility = await checkRsvpEligibility(threadId);
    // `=== false` rather than `!ok`: the repo compiles with strict:false, so
    // TypeScript will not narrow a discriminated union on truthiness.
    if (eligibility.ok === false) {
      return Response.json(
        { error: eligibility.error ?? "RSVPs are not open" },
        { status: 409 }
      );
    }
    await setRsvpStatus(threadId, viewer.userId, "yes");
  } else {
    // "Can't make it" removes the row rather than storing 'no'. A declined
    // RSVP and never having answered are the same state to everything that
    // reads this, and keeping the row makes capacity counting subtler than it
    // needs to be.
    await deleteRsvp(threadId, viewer.userId);
  }

  return Response.json({
    ok: true,
    status,
    confirmed: await countConfirmedRsvps(threadId),
  });
}
