import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";
import { buildEtransferInstructions } from "@elkdonis/commerce/etransfer";
import { nanoid } from "nanoid";

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
    }>>`
      SELECT
        t.id,
        t.title,
        t.scheduled_at,
        COALESCE(wp.price_member, t.price)::TEXT AS price,
        COALESCE(t.currency, 'CAD') AS currency
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

    const priceMajor = Number(workshop.price ?? 0);
    const isFree = !Number.isFinite(priceMajor) || priceMajor <= 0;
    const currency = (workshop.currency ?? "CAD").toUpperCase();

    if (isFree) {
      // Free RSVP path — idempotent via PRIMARY KEY (thread_id, user_id).
      await db`
        INSERT INTO thread_rsvps (thread_id, user_id, status, registered_at, updated_at)
        VALUES (${workshopId}, ${userId}, 'yes', NOW(), NOW())
        ON CONFLICT (thread_id, user_id) DO UPDATE
          SET status = 'yes', updated_at = NOW()
      `;
      return NextResponse.json({
        kind: "free",
        joined: true,
        workshop: { id: workshop.id, title: workshop.title },
      });
    }

    // Paid path — create a join request and return eTransfer instructions.
    const requestId = nanoid();
    const reference = `WS-${nanoid(8).toUpperCase()}`;
    const amountMinor = Math.round(priceMajor * 100);
    const dueAt = new Date(Date.now() + PAYMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    await db`
      INSERT INTO workshop_join_requests (
        id, workshop_id, user_id, contact_name, contact_email, notes,
        amount_minor, currency, payment_reference, status, due_at, created_at
      ) VALUES (
        ${requestId}, ${workshopId}, ${userId},
        ${contactName || null}, ${contactEmail}, ${notes || null},
        ${amountMinor}, ${currency}, ${reference},
        'pending', ${dueAt}, NOW()
      )
    `;

    // Hold a "maybe" RSVP so admins can see pending payments alongside confirmed ones.
    await db`
      INSERT INTO thread_rsvps (thread_id, user_id, status, registered_at, updated_at)
      VALUES (${workshopId}, ${userId}, 'maybe', NOW(), NOW())
      ON CONFLICT (thread_id, user_id) DO NOTHING
    `;

    const instructions = buildEtransferInstructions({
      orderNumber: reference,
      totalMinor: amountMinor,
      currency: currency as "CAD" | "USD",
      artistName: PAYOUT_NAME,
      payoutEmail: PAYOUT_EMAIL,
      paymentDueAt: dueAt.toISOString(),
    });

    return NextResponse.json({
      kind: "paid",
      workshop: { id: workshop.id, title: workshop.title },
      payment: {
        kind: "etransfer_instructions",
        payoutEmail: PAYOUT_EMAIL,
        reference,
        bodyText: instructions.buyerInstructions,
        dueAt: dueAt.toISOString(),
      },
      amountMinor,
      currency,
    });
  } catch (err) {
    console.error("[workshop join POST]", err);
    return NextResponse.json({ error: "Failed to join workshop" }, { status: 500 });
  }
}
