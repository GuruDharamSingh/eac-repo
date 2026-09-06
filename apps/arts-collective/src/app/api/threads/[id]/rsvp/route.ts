import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import {
  checkRsvpEligibility,
  countConfirmedRsvps,
  deleteRsvp,
  isEnrolledInWorkshop,
  setRsvpStatus,
} from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * Member RSVP for a thread shown on an org's network subdomain.
 *
 * Deliberately lean next to amrit-canada's route of the same name: that one
 * layers confirmation emails, recurrence-cycle checks, a min-attendees nudge
 * and a guest path on top. All of that is site-specific. What is shared —
 * eligibility, capacity, the upsert — lives in @elkdonis/services/thread-rsvp
 * and is the whole of what this route calls.
 *
 * Signed-in only. The thread must be published and public, which is the same
 * thing the subdomain page will show anyone: this route can never be used to
 * discover or act on a draft.
 */

async function loadPublicThread(threadId: string) {
  const [row] = await db<Array<{
    id: string;
    title: string;
    org_id: string;
    kind: string;
    author_id: string | null;
    price: string | number | null;
  }>>`
    SELECT
      t.id, t.title, t.org_id, t.kind, t.author_id,
      COALESCE(wp.price_member, t.price) AS price
    FROM threads t
    LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    WHERE t.id = ${threadId}
      AND t.status = 'published'
      AND t.visibility = 'PUBLIC'
    LIMIT 1
  `;
  return row ?? null;
}

/**
 * Joining a workshop should also open its materials folder to you in
 * Nextcloud, and cancelling should close it again.
 *
 * Best-effort and deliberately non-blocking: most participants have no
 * Nextcloud account at all, and they don't need one — the workshop page
 * serves materials through its own gated route using the service account.
 * This share only matters for people who browse Nextcloud directly.
 */
async function syncMaterialsAccess(
  threadId: string,
  orgId: string,
  userId: string,
  grant: boolean
): Promise<void> {
  try {
    const [ncUser] = await db<Array<{ nextcloud_user_id: string | null }>>`
      SELECT nextcloud_user_id FROM users
      WHERE id = ${userId} AND nextcloud_synced = true
      LIMIT 1
    `;
    if (!ncUser?.nextcloud_user_id) return;

    const { getAdminClient, grantMaterialsAccess, revokeMaterialsAccess } = await import(
      "@elkdonis/nextcloud"
    );
    const client = getAdminClient();
    if (grant) {
      await grantMaterialsAccess(client, orgId, threadId, ncUser.nextcloud_user_id, "attendee");
    } else {
      await revokeMaterialsAccess(client, orgId, threadId, ncUser.nextcloud_user_id);
    }
  } catch (err) {
    console.warn(`[arts-collective] materials access sync failed for ${threadId}:`, err);
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to RSVP." }, { status: 401 });

  const thread = await loadPublicThread(id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A PAID workshop must never be joined by RSVP.
  //
  // `upsertWorkshopOffering` sets is_rsvp_enabled = TRUE on every workshop,
  // paid ones included, and `isEnrolledInWorkshop` counts an RSVP of 'yes' as
  // enrolment — so without this check any signed-in person could POST here
  // with a workshop's thread id and be admitted to its gated workspace, its
  // materials download, and a real Nextcloud share, for free, in any org.
  // inner-gathering avoids this by writing a 'maybe' shell for paid joins and
  // only honouring workshop_join_requests.status='paid'; arts-collective has
  // no payment path yet, so the honest answer here is to refuse.
  const price = Number(thread.price ?? 0);
  if (thread.kind === "workshop" && Number.isFinite(price) && price > 0) {
    return NextResponse.json(
      { error: "This workshop is paid — joining it isn't available here yet." },
      { status: 402 }
    );
  }

  const eligibility = await checkRsvpEligibility(id);
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error ?? "Cannot RSVP" }, { status: 409 });
  }

  await setRsvpStatus(id, user.id, "yes");
  if (thread.kind === "workshop") {
    await syncMaterialsAccess(id, thread.org_id, user.id, true);
  }
  return NextResponse.json({ ok: true, count: await countConfirmedRsvps(id) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to RSVP." }, { status: 401 });

  const thread = await loadPublicThread(id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteRsvp(id, user.id);
  if (thread.kind === "workshop") {
    // Don't strip materials access from someone who is still entitled to it by
    // another route — a paid join request, or authoring the workshop. Removing
    // an RSVP is not the same as leaving the workshop.
    const stillEntitled =
      thread.author_id === user.id || (await isEnrolledInWorkshop(id, user.id));
    if (!stillEntitled) {
      await syncMaterialsAccess(id, thread.org_id, user.id, false);
    }
  }
  return NextResponse.json({ ok: true, count: await countConfirmedRsvps(id) });
}
