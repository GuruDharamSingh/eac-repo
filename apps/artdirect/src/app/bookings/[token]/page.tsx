import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { bookerLabel, getBookingByToken } from "@elkdonis/booking";
import { BookingCancel, BookingScheduler } from "@elkdonis/checkout/components";
import { bookerCancelAction, bookerConfirmAction, bookerProposeAction } from "@/lib/booking-actions";
import { ACTIVE, STATUS_WORD, money, negotiating, schedulerBooking, whenText } from "@/components/booking/view";
import "@elkdonis/checkout/booking.css";

// ============================================================================
// /bookings/<token>: the booker's private page (booking module, 2026-11-15).
// No account needed: the token in the address is the credential, so the page
// is never indexed and shows nothing the booker did not give or need.
// ============================================================================

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking — ArtDirect", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingPage({ params, searchParams }: Props) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const zone = b.bookerTimeZone ?? b.timeZone;
  const fresh = query.new === "1";
  const at = whenText(b.scheduledAt, zone);
  const upcoming = !b.scheduledAt || new Date(b.scheduledAt).getTime() > Date.now();
  const refund = b.refundStatus === "due" ? money(b.refundDueMinor, b.currency) : null;

  let headline: string;
  switch (b.status) {
    case "confirmed":
      headline = fresh ? "You are booked." : "Your booking is confirmed.";
      break;
    case "awaiting_payment":
      headline = fresh ? "Payment is being confirmed. Refresh this page in a moment." : "This booking is waiting for payment.";
      break;
    case "awaiting_seller":
      headline = `Waiting for ${b.hostName ?? "the host"} to confirm a time.`;
      break;
    case "awaiting_booker":
      headline = `${b.hostName ?? "The host"} suggested other times. Choose one below.`;
      break;
    case "cancelled":
      headline = "This booking is cancelled.";
      break;
    case "expired":
      headline = "This booking lapsed before payment was completed. The time was let go.";
      break;
    default:
      headline = STATUS_WORD[b.status];
  }

  const base = `/bookings/${encodeURIComponent(token)}`;

  return (
    <main className="eac-person-page oad-person oad-booking-page">
      <div className="eac-person-slot">
        <section className="eac-person-section eac-person-panel" aria-labelledby="booking-heading">
          <p className="eac-person-meta">Booking{b.orderNumber ? ` · order ${b.orderNumber}` : ""}</p>
          <h1 id="booking-heading" className="eac-person-name">
            {b.threadTitle}
          </h1>
          <p className="eac-booking-status" role="status">
            {headline}
          </p>

          <dl className="eac-booking-facts">
            {b.hostName ? (
              <>
                <dt>With</dt>
                <dd>{b.hostName}</dd>
              </>
            ) : null}
            {at ? (
              <>
                <dt>When</dt>
                <dd>{at}</dd>
              </>
            ) : null}
            {b.durationMinutes ? (
              <>
                <dt>Length</dt>
                <dd>{b.durationMinutes} minutes</dd>
              </>
            ) : null}
            <dt>Booked by</dt>
            <dd>
              {bookerLabel(b)} ({b.bookerEmail})
            </dd>
            <dt>Status</dt>
            <dd>{b.status === "awaiting_booker" ? "Your turn: choose a time" : b.status === "awaiting_seller" ? `Waiting for ${b.hostName ?? "the host"}` : STATUS_WORD[b.status]}</dd>
            {refund ? (
              <>
                <dt>Refund</dt>
                <dd>{refund} due, issued by {b.hostName ?? "the host"}</dd>
              </>
            ) : b.refundStatus === "due" ? (
              <>
                <dt>Refund</dt>
                <dd>{b.hostName ?? "The host"} decides; reply to the email about it.</dd>
              </>
            ) : null}
          </dl>

          {b.status === "confirmed" ? (
            <p>
              <a href={`${base}/ics`}>Add to your calendar (.ics)</a>
            </p>
          ) : null}

          {negotiating(b) ? (
            <BookingScheduler
              role="buyer"
              booking={schedulerBooking(b)}
              otherName={b.hostName ?? "the host"}
              confirm={bookerConfirmAction.bind(null, token)}
              propose={bookerProposeAction.bind(null, token)}
              calendarHref={null}
            />
          ) : null}

          {ACTIVE.includes(b.status) && upcoming ? (
            <BookingCancel action={bookerCancelAction.bind(null, token)} policy={b.cancelPolicyText} />
          ) : b.cancelPolicyText && b.status === "confirmed" ? (
            <p className="eac-booking-hint">Cancellation: {b.cancelPolicyText}</p>
          ) : null}

          <p className="eac-booking-hint">Keep this link: it is how you see or change this booking. It was also sent to you by email.</p>
        </section>
      </div>
    </main>
  );
}
