import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";
import { createThreadOrder } from "@elkdonis/commerce/server";
import { nanoid } from "nanoid";
import {
  RSVP_GUEST_TEMPLATE_KEY,
  getEmailTemplateSettingsForThread,
} from "@/lib/email-template-settings";
import { checkRsvpEligibility } from "@elkdonis/services";

/**
 * Join a workshop.
 *
 * - Free workshop (price null or 0): inserts a `thread_rsvps` row and returns
 *   { kind: "free", joined: true }.
 * - Paid workshop: inserts a `workshop_join_requests` row + RSVP shell, and
 *   returns { kind: "paid", payment: PaymentDisplay } so the modal can show
 *   eTransfer instructions.
 *
 * Auth required for both — we need a user_id to attribute the RSVP.
 */

const PAYOUT_EMAIL = process.env.EAC_PAYOUT_EMAIL ?? "info@elkdonis-arts.org";
const PAYOUT_NAME = process.env.EAC_PAYOUT_NAME ?? "Elkdonis Arts Collective";
const PAYMENT_WINDOW_DAYS = 7;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workshopId } = await params;

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const sessionEmail = session.user.email ?? "";

    const body = await request.json().catch(() => ({}));
    const contactName = typeof body.contactName === "string" ? body.contactName.trim() : "";
    const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() : sessionEmail;
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    // Look up the workshop. We accept thread kind = 'workshop' OR
    // kind = 'meeting' with is_meeting = false (CMS workshops live as
    // either depending on the org). Pull workshop_pages.price_member when
    // available; fall back to threads.price.
    const [workshop] = await db<Array<{
      id: string;
      title: string;
      scheduled_at: Date | null;
      price: string | number | null;
      currency: string | null;
      org_id: string;
      nextcloud_talk_token: string | null;
    }>>`
      SELECT
        t.id,
        t.title,
        t.scheduled_at,
        COALESCE(wp.price_member, t.price)::TEXT AS price,
        COALESCE(t.currency, 'CAD') AS currency,
        t.org_id,
        t.nextcloud_talk_token
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.id = ${workshopId}
        AND t.kind IN ('workshop', 'meeting')
        AND t.status = 'published'
      LIMIT 1
    `;

    if (!workshop) {
      return NextResponse.json({ error: "Workshop not found" }, { status: 404 });
    }

    if (!contactEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Same eligibility check every thread kind uses (deadline + capacity) —
    // paid join requests count toward capacity here too, on top of the plain
    // 'yes' RSVPs the shared check already counts.
    const [{ count: paidCount }] = await db<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM workshop_join_requests
      WHERE workshop_id = ${workshopId} AND status = 'paid'
    `;
    const eligibility = await checkRsvpEligibility(workshopId, paidCount);
    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.error }, { status: 400 });
    }

    const priceMajor = Number(workshop.price ?? 0);
    const isFree = !Number.isFinite(priceMajor) || priceMajor <= 0;
    const currency = (workshop.currency ?? "CAD").toUpperCase();

    if (isFree) {
      // Free RSVP path — idempotent via PRIMARY KEY (thread_id, user_id).
      await db`
        INSERT INTO thread_rsvps (thread_id, user_id, status, updated_at)
        VALUES (${workshopId}, ${userId}, 'yes', NOW())
        ON CONFLICT (thread_id, user_id) DO UPDATE
          SET status = 'yes', updated_at = NOW()
      `;

      // Workshop materials: grant the attendee a read-only share of the
      // materials folder (requires a synced Nextcloud account). Non-blocking,
      // same pattern as the meeting RSVP route.
      void (async () => {
        try {
          const [ncUser] = await db`
            SELECT nextcloud_user_id FROM users
            WHERE id = ${userId} AND nextcloud_synced = true
          `;
          if (!ncUser?.nextcloud_user_id) return;
          const { getAdminClient, grantMaterialsAccess } = await import("@elkdonis/nextcloud");
          await grantMaterialsAccess(
            getAdminClient(),
            workshop.org_id,
            workshopId,
            ncUser.nextcloud_user_id as string,
            "attendee"
          );
        } catch (materialsErr) {
          console.error("[inner-gathering] materials share on workshop join failed:", materialsErr);
        }
      })();

      // Welcome email — reuses the RSVP guest template (author-editable copy
      // + materials link), same as meetings. Non-blocking.
      void (async () => {
        try {
          const template = await getEmailTemplateSettingsForThread(
            workshop.org_id,
            RSVP_GUEST_TEMPLATE_KEY,
            workshopId
          );
          const { sendRsvpConfirmation } = await import("@elkdonis/email");
          await sendRsvpConfirmation(contactEmail, {
            guestName: contactName || session.user.email?.split("@")[0] || "there",
            meetingTitle: workshop.title,
            scheduledAt: workshop.scheduled_at ? String(workshop.scheduled_at) : undefined,
            talkRoomUrl: workshop.nextcloud_talk_token
              ? new URL(`/api/talk/join?token=${workshop.nextcloud_talk_token}`, request.nextUrl.origin).toString()
              : undefined,
            materialsUrl: new URL(`/workshops/${workshopId}`, request.nextUrl.origin).toString(),
            orgName: "Inner Gathering",
            primaryColor: "#022278",
            ...(template?.config ?? {}),
          });
        } catch (emailErr) {
          console.error("[inner-gathering] welcome email on workshop join failed:", emailErr);
        }
      })();

      return NextResponse.json({
        kind: "free",
        joined: true,
        workshop: { id: workshop.id, title: workshop.title },
      });
    }

    // Paid path — a real commerce order, then the enrolment that points at it.
    //
    // This used to write a join request and hand back eTransfer instructions
    // addressed to a global env var, with no order behind it. That meant a paid
    // workshop had no order, no line, no split, and no way to be marked paid —
    // `workshop_join_requests.status` never left 'pending' anywhere in the
    // codebase. Now the guide is the payee, on the same rules as every other
    // sale, and the org takes only what an accepted agreement gives it.
    const requestId = nanoid();
    const amountMinor = Math.round(priceMajor * 100);
    const dueAt = new Date(Date.now() + PAYMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const order = await createThreadOrder({
      orgId: workshop.org_id,
      threadId: workshopId,
      kinds: ["workshop"],
      itemNoun: "place",
      customerEmail: contactEmail,
      customerName: contactName || null,
      customerId: userId,
      notes: notes || null,
      etransferDueHours: PAYMENT_WINDOW_DAYS * 24,
    });
    const reference = order.paymentReference ?? `WS-${nanoid(8).toUpperCase()}`;

    await db`
      INSERT INTO workshop_join_requests (
        id, workshop_id, user_id, contact_name, contact_email, notes,
        amount_minor, currency, payment_reference, status, due_at, created_at,
        order_id
      ) VALUES (
        ${requestId}, ${workshopId}, ${userId},
        ${contactName || null}, ${contactEmail}, ${notes || null},
        ${amountMinor}, ${currency}, ${reference},
        'pending', ${dueAt}, NOW(), ${order.id}
      )
    `;

    // Hold a "maybe" RSVP so admins can see pending payments alongside confirmed ones.
    await db`
      INSERT INTO thread_rsvps (thread_id, user_id, status, updated_at)
      VALUES (${workshopId}, ${userId}, 'maybe', NOW())
      ON CONFLICT (thread_id, user_id) DO NOTHING
    `;

    return NextResponse.json({
      kind: "paid",
      workshop: { id: workshop.id, title: workshop.title },
      payment: {
        kind: "etransfer_instructions",
        // From the order, so the buyer is told to pay whoever the settlement
        // rules actually named — not a constant this route happens to hold.
        payoutEmail:
          (order.paymentMetadata?.payoutEmail as string | undefined) ?? PAYOUT_EMAIL,
        reference,
        bodyText: order.paymentInstructions ?? "",
        dueAt: dueAt.toISOString(),
      },
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
    });
  } catch (err) {
    console.error("[workshop join POST]", err);
    return NextResponse.json({ error: "Failed to join workshop" }, { status: 500 });
  }
}
