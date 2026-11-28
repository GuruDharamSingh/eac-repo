import { Fragment } from "react";
import type { Metadata } from "next";
import { ARTIST_SPACE_ORG_ID, listMyHostBookings } from "@elkdonis/services";
import { bookerLabel, listHostNetworkBookings } from "@elkdonis/booking";
import { BookingCancel, BookingScheduler } from "@elkdonis/checkout/components";
import { requireUser } from "@/lib/session";
import { hostCancelAction, hostConfirmAction, hostProposeAction } from "@/lib/booking-actions";
import { ACTIVE, STATUS_WORD, money, negotiating, schedulerBooking, whenText } from "@/components/booking/view";
import "@elkdonis/checkout/booking.css";

// ============================================================================
// /bookings: the signed-in person's bookings of their own services on
// ArtDirect (booking module, 2026-11-15). The host is the session user; the
// list is scoped to the `oad` org and to offers they host.
// ============================================================================

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your bookings — ArtDirect", robots: { index: false, follow: false } };

export default async function HostBookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/login?redirect=/bookings");
  const query = await searchParams;
  const includePast = query.past === "1";
  const own = await listMyHostBookings(ARTIST_SPACE_ORG_ID, user.id, { includePast });
  // Services of theirs sold through the content library on other sites (booking in the thread's org).
  const network = await listHostNetworkBookings(ARTIST_SPACE_ORG_ID, user.id, { includePast }).catch((): typeof own => []);
  const sortKey = (b: (typeof own)[number]) => b.scheduledAt ?? b.createdAt;
  const bookings = network.length ? [...own, ...network].sort((a, b) => sortKey(a).localeCompare(sortKey(b))) : own;
  const waiting = bookings.filter((b) => b.status === "awaiting_seller");
  const rest = bookings.filter((b) => b.status !== "awaiting_seller");

  const item = (b: (typeof bookings)[number]) => {
    const zone = b.timeZone;
    const at = whenText(b.scheduledAt, zone);
    const refund = b.refundStatus === "due" ? money(b.refundDueMinor, b.currency) ?? "to decide" : null;
    return (
      <li key={b.id} className="eac-booking-item" data-booking-status={b.status}>
        <p className="eac-booking-status">
          <strong>{at ?? "No time yet"}</strong> · {b.threadTitle}
        </p>
        <dl className="eac-booking-facts">
          <dt>Who</dt>
          <dd>
            {bookerLabel(b)} (<a href={`mailto:${b.bookerEmail}`}>{b.bookerEmail}</a>)
          </dd>
          <dt>Status</dt>
          <dd>{STATUS_WORD[b.status]}</dd>
          {b.orderNumber ? (
            <>
              <dt>Order</dt>
              <dd>
                {b.orderNumber}
                {b.orderStatus ? ` (${b.orderStatus.replace(/_/g, " ")})` : ""}
              </dd>
            </>
          ) : null}
          {b.notes ? (
            <>
              <dt>Note</dt>
              <dd>{b.notes}</dd>
            </>
          ) : null}
          {Object.entries(b.answers).map(([k, v]) => (
            <Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
          {refund ? (
            <>
              <dt>Refund due</dt>
              <dd>{refund}: issue it from the order</dd>
            </>
          ) : null}
          {b.cancelReason ? (
            <>
              <dt>Cancel note</dt>
              <dd>{b.cancelReason}</dd>
            </>
          ) : null}
        </dl>
        {negotiating(b) ? (
          <BookingScheduler
            role="seller"
            booking={schedulerBooking(b)}
            otherName={bookerLabel(b)}
            confirm={hostConfirmAction.bind(null, b.id)}
            propose={hostProposeAction.bind(null, b.id)}
            cancel={hostCancelAction.bind(null, b.id)}
          />
        ) : ACTIVE.includes(b.status) ? (
          <BookingCancel action={hostCancelAction.bind(null, b.id)} noteLabel="A note for them (optional)" />
        ) : null}
      </li>
    );
  };

  return (
    <main className="eac-person-page oad-person oad-booking-page">
      <div className="eac-person-slot">
        <section className="eac-person-section eac-person-panel" aria-labelledby="bookings-heading">
          <h1 id="bookings-heading" className="eac-person-name">
            Your bookings
          </h1>
          <p className="eac-booking-hint">
            Bookings of your services on ArtDirect. {includePast ? <a href="/bookings">Hide past</a> : <a href="/bookings?past=1">Show past</a>}
          </p>
          {bookings.length === 0 ? <p>No bookings yet.</p> : null}
          {waiting.length ? (
            <>
              <h2 className="eac-person-heading">Needs an answer</h2>
              <ul className="eac-booking-choices">{waiting.map(item)}</ul>
            </>
          ) : null}
          {rest.length ? (
            <>
              <h2 className="eac-person-heading">{includePast ? "All" : "Coming up"}</h2>
              <ul className="eac-booking-choices">{rest.map(item)}</ul>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
