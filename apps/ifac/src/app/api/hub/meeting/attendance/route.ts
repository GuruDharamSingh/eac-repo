import { db } from "@elkdonis/db";
import {
  checkRsvpEligibility,
  clearMeetingAttendance,
  countConfirmedRsvps,
  getMeetingAttendance,
  resolveMeetingLight,
  rsvpFlavour,
  setMeetingAttendance,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * "Will you make it?", answered in words.
 *
 * The sibling of /api/hub/rsvp, and deliberately not a replacement for it:
 * that route is the plain yes/no behind the thread surface's RSVP button and
 * DELETES the row on a no. This one keeps a no, because "we'll make it next
 * time" is the thing a guide asked for and dropping the row drops the
 * sentence. Counting is unaffected — every count in the network reads
 * `status = 'yes'`, and these rows are 'no'.
 *
 * The flavour never widens `thread_rsvps`'s status CHECK. Each answer commits
 * to one of the four statuses it already allows, and the nuance rides in the
 * `flavour` column added by migration 130.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  let payload: { threadId?: string; flavour?: string; promiseNext?: boolean; clear?: boolean };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const threadId = (payload.threadId ?? "").trim();
  if (!threadId) return Response.json({ error: "Bad request" }, { status: 400 });

  // The thread must be IFAC's. Without this a member could answer for any
  // thread in the network by id, since thread_rsvps itself is org-agnostic.
  const [thread] = await db<Array<{ id: string; is_rsvp_enabled: boolean }>>`
    SELECT id, is_rsvp_enabled FROM threads
    WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
  `;
  if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

  if (payload.clear) {
    await clearMeetingAttendance(threadId, viewer.userId);
    return Response.json({
      ok: true,
      status: null,
      flavour: null,
      promiseNext: false,
      confirmed: await countConfirmedRsvps(threadId),
      light: await resolveMeetingLight(threadId),
    });
  }

  const flavour = rsvpFlavour(payload.flavour);
  if (!flavour) {
    return Response.json({ error: "That isn't one of the answers" }, { status: 400 });
  }

  if (!thread.is_rsvp_enabled) {
    return Response.json({ error: "RSVPs are not open for this" }, { status: 409 });
  }

  // Capacity and the deadline only bind a NEW yes. Someone already holding a
  // seat who changes an early yes to a certain one is not taking a second
  // one, and `checkRsvpEligibility` counts them in the total it compares —
  // so running it unconditionally would refuse a full meeting's own attendees
  // the right to sharpen their answer.
  if (flavour.status === "yes") {
    const held = await getMeetingAttendance(threadId, viewer.userId);
    if (held?.status !== "yes") {
      const eligibility = await checkRsvpEligibility(threadId);
      // `=== false` rather than `!ok`: the repo compiles with strict:false, so
      // TypeScript will not narrow a discriminated union on truthiness.
      if (eligibility.ok === false) {
        return Response.json(
          { error: eligibility.error ?? "RSVPs are not open" },
          { status: 409 }
        );
      }
    }
  }

  const saved = await setMeetingAttendance(threadId, viewer.userId, flavour.key, Boolean(payload.promiseNext));
  if (!saved) {
    return Response.json({ error: "That isn't one of the answers" }, { status: 400 });
  }

  return Response.json({
    ok: true,
    status: saved.status,
    flavour: saved.flavour,
    promiseNext: saved.promiseNext,
    confirmed: await countConfirmedRsvps(threadId),
    // An answer can be the one that meets the minimum, so the light comes
    // back with it rather than waiting for the next page load.
    light: await resolveMeetingLight(threadId),
  });
}
