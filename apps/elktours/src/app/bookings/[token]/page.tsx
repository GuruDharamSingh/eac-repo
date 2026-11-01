import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTourBookingByToken } from "@elkdonis/commerce/server";
import { formatDeparture, formatDuration, formatPrice } from "@/lib/tours";

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
  const b = await getTourBookingByToken(token);
  if (!b) notFound();

  const when = formatDeparture(b.startsAt, { withYear: true });
  const people = `${b.partySize} ${b.partySize === 1 ? "person" : "people"}`;

  return (
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
}

function Row({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-base">{value}</dd>
    </div>
  );
}
