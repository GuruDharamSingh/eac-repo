import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingByAnyToken, getPendingBookingByToken, type PendingBookingView } from "@/lib/booking-lookup";
import { syncStripeOrder } from "@elkdonis/checkout/stripe";
import { formatDeparture, formatDuration, formatPrice } from "@/lib/tours";
import { Split } from "@/components/mobile/split";
import { BackButton, FactsGrid, PrimaryButton } from "@/components/mobile";
import "@/blocks/mobile/flow.css";

export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The buyer's page, reached from the Stripe return hop and the confirmation
 * email. The link is the credential: no account is needed, and nothing here
 * identifies anyone but the buyer.
 */
export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let b = await getBookingByAnyToken(token);
  if (!b) {
    // Not paid yet: Stripe can send the buyer back before the payment settles. Reconcile once (elktours has no
    // webhook secret, so a reload of this page is what picks up a late payment), then show "being confirmed".
    const pending = await getPendingBookingByToken(token);
    if (!pending) notFound();
    if (pending.orderId) {
      await syncStripeOrder(pending.orderId).catch((err) => console.error(`[elktours] booking page sync ${pending.orderId}:`, err));
      b = await getBookingByAnyToken(token);
    }
    if (!b) return <PendingBooking token={token} booking={pending} />;
  }

  const when = formatDeparture(b.startsAt, { withYear: true });
  const people = `${b.partySize} ${b.partySize === 1 ? "person" : "people"}`;

  const desktop = (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {b.status === "confirmed" ? "Booking confirmed" : "Booking cancelled"}
      </p>
      <h1 className="mt-2 font-serif text-3xl">{b.tourTitle}</h1>

      <dl className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
        <Row label="When" value={when} />
        <Row label="Length" value={formatDuration(b.durationMinutes) ?? "—"} />
        <Row label="Party" value={people} />
        <Row label="Paid" value={formatPrice(b.totalMinor / 100, b.currency)} />
        {b.meetingPoint && <Row label="Meeting point" value={b.meetingPoint} wide />}
        {b.guideName && <Row label="Your guide" value={b.guideName} />}
        {b.orderNumber && <Row label="Order" value={b.orderNumber} />}
        <Row label="Booked by" value={b.buyerName ?? b.buyerEmail} />
      </dl>

      {b.note && (
        <p className="mt-4 text-sm text-muted-foreground">
          Your note to the guide: “{b.note}”
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {b.status === "confirmed" && (
          <a
            href={`/bookings/${token}/calendar.ics`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Add to calendar
          </a>
        )}
        <Link href={`/tours/${b.tourSlug}`} className="rounded-md border border-border px-4 py-2 text-sm">
          See the tour
        </Link>
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Questions, or need to change the date? Reply to your confirmation email and your guide will answer.
        Keep this link: it is your ticket.
      </p>
    </div>
  );

  // Phone tree (G3b): "You're booked" and the reference; the desktop page above is unchanged.
  const confirmed = b.status === "confirmed";
  const mobile = (
    <div className="elk-m m-flow">
      <div className="m-flow-top">
        <BackButton href={`/tours/${b.tourSlug}`} />
        <div className="m-flow-top-text"><span className="m-kicker">{confirmed ? "Booking confirmed" : "Booking cancelled"}</span><span className="m-flow-top-title">{b.tourTitle}</span></div>
      </div>
      <h1 className="m-done-title">{confirmed ? "You're booked" : "Booking cancelled"}</h1>
      {b.orderNumber && <p className="m-done-ref">Reference {b.orderNumber}</p>}
      <FactsGrid items={[
        { label: "When", value: when },
        { label: "Party", value: people },
        { label: "Paid", value: formatPrice(b.totalMinor / 100, b.currency) },
        { label: "Length", value: formatDuration(b.durationMinutes) ?? "—" },
      ]} />
      {b.meetingPoint && <p className="m-flow-note">Meet at {b.meetingPoint}{b.guideName ? ` · with ${b.guideName}` : ""}</p>}
      {b.note && <p className="m-flow-note">Your note to the guide: “{b.note}”</p>}
      <div className="m-done-actions">
        {confirmed && <PrimaryButton href={`/bookings/${token}/calendar.ics`}>Add to calendar</PrimaryButton>}
        <Link href={`/tours/${b.tourSlug}`} className="m-done-link">See the tour</Link>
      </div>
      <p className="m-flow-note">Questions, or need to change the date? Reply to your confirmation email. Keep this link: it is your ticket.</p>
    </div>
  );

  return <Split mobile={mobile} desktop={desktop} />;
}

/** Paid on Stripe's page but not settled yet (or the return came first): no ticket yet, and no 404. */
function PendingBooking({ token, booking: p }: { token: string; booking: PendingBookingView }) {
  const when = formatDeparture(p.startsAt, { withYear: true });
  const people = `${p.partySize} ${p.partySize === 1 ? "person" : "people"}`;
  const words = "If you completed the payment, it is being confirmed. This page shows your booking once it is; reload it in a minute. The confirmation email follows with this same link.";
  const desktop = (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Payment being confirmed</p>
      <h1 className="mt-2 font-serif text-3xl">{p.tourTitle}</h1>
      <p className="mt-4 text-base">{when} · {people}</p>
      <p className="mt-4 text-sm text-muted-foreground">{words}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={`/bookings/${token}`} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Reload</a>
        <Link href={`/tours/${p.tourSlug}`} className="rounded-md border border-border px-4 py-2 text-sm">See the tour</Link>
      </div>
    </div>
  );
  const mobile = (
    <div className="elk-m m-flow">
      <div className="m-flow-top">
        <BackButton href={`/tours/${p.tourSlug}`} />
        <div className="m-flow-top-text"><span className="m-kicker">Payment being confirmed</span><span className="m-flow-top-title">{p.tourTitle}</span></div>
      </div>
      <h1 className="m-done-title">Almost there</h1>
      <p className="m-flow-note">{when} · {people}</p>
      <p className="m-flow-note">{words}</p>
      <div className="m-done-actions">
        <PrimaryButton href={`/bookings/${token}`}>Reload</PrimaryButton>
        <Link href={`/tours/${p.tourSlug}`} className="m-done-link">See the tour</Link>
      </div>
    </div>
  );
  return <Split mobile={mobile} desktop={desktop} />;
}

function Row({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-base">{value}</dd>
    </div>
  );
}
