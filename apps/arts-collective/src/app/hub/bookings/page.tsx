import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";
import { listSellerBookings, type ServiceBooking } from "@elkdonis/commerce/server";
import { BookingScheduler } from "@elkdonis/checkout/components";
import { cancelBooking, confirmBookingTime, proposeBookingTimes } from "./actions";
import "@elkdonis/checkout/booking.css";

/**
 * /hub/bookings — the times people have asked for, for every service this
 * person sells on any site in the network (ArtDirect, hidden-enneagram,
 * elastrocal …). One place rather than one per site: a seller's bookings are
 * theirs, not an org's. Emails link here. Migration 174;
 * packages/commerce/src/server/service-bookings.ts.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Your bookings", robots: { index: false } };

const STATUS: Record<ServiceBooking["status"], string> = {
  awaiting_payment: "Not paid yet",
  awaiting_seller: "Choose a time",
  awaiting_buyer: "Waiting for them",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export default async function BookingsPage() {
  const user = await requireUser("/login?next=/hub/bookings");
  const bookings = await listSellerBookings(user.id).catch(() => []);
  const now = Date.now();
  const past = (b: ServiceBooking) =>
    b.status === "cancelled" || (b.status === "confirmed" && b.scheduledAt != null && new Date(b.scheduledAt).getTime() < now);
  const current = bookings.filter((b) => !past(b));
  const earlier = bookings.filter(past);

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-3xl space-y-10 px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Hub</p>
          <h1 className="mt-2 font-serif text-3xl">Your bookings</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            When someone books one of your one-to-one services, they suggest times that suit them. Confirm one,
            or suggest others; they are told by email either way.
          </p>
        </header>

        {current.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing waiting. New bookings appear here once they are paid.
          </p>
        ) : (
          <ul className="space-y-6">
            {current.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </ul>
        )}

        {earlier.length > 0 && (
          <details className="border-t border-border pt-6">
            <summary className="cursor-pointer text-sm font-medium">Past and cancelled ({earlier.length})</summary>
            <ul className="mt-6 space-y-6">
              {earlier.map((b) => (
                <BookingCard key={b.id} booking={b} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </SiteShell>
  );
}

function BookingCard({ booking: b }: { booking: ServiceBooking }) {
  const buyer = b.buyerName ?? b.buyerEmail;
  return (
    <li className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl">{b.serviceTitle}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.14em]">{STATUS[b.status]}</span>
      </div>
      <p className="mt-1 text-sm">
        {buyer}
        {" · "}
        <a className="underline underline-offset-2" href={`mailto:${b.buyerEmail}`}>
          {b.buyerEmail}
        </a>
        {b.orderNumber ? ` · order ${b.orderNumber}` : ""}
        {` · their zone ${b.buyerTimeZone}`}
      </p>
      <div className="mt-4">
        <BookingScheduler
          role="seller"
          booking={b}
          otherName={b.buyerName ?? "the buyer"}
          confirm={confirmBookingTime.bind(null, b.id)}
          propose={proposeBookingTimes.bind(null, b.id)}
          cancel={cancelBooking.bind(null, b.id)}
          calendarHref={b.status === "confirmed" ? `/hub/bookings/${b.id}/calendar.ics` : null}
        />
      </div>
    </li>
  );
}
