import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingByToken, type BuyerServiceBooking } from "@elkdonis/commerce/server";
import { BookingScheduler } from "@elkdonis/checkout/components";
import { SiteShell } from "@/components/site-shell";
import { confirmAsBuyer, proposeAsBuyer } from "./actions";
import "@elkdonis/checkout/booking.css";

/**
 * /bookings/<token> — a buyer's booking, from the link in their emails. No
 * account needed: the token is the key, so the page is kept out of search and
 * shows only what the buyer already knows. Migration 174.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

const STATUS: Record<BuyerServiceBooking["status"], string> = {
  awaiting_payment: "Not paid yet",
  awaiting_seller: "Waiting for them to confirm a time",
  awaiting_buyer: "They suggested times — choose one",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export default async function BuyerBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const seller = b.sellerName ?? "your host";

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Your booking</p>
          <h1 className="mt-2 font-serif text-3xl">{b.serviceTitle}</h1>
          <p className="mt-2 text-sm">
            With {seller}
            {b.orderNumber ? ` · order ${b.orderNumber}` : ""}
          </p>
          <p className="mt-1 text-sm font-semibold">{STATUS[b.status]}</p>
        </header>
        <div className="rounded-xl border border-border bg-card p-5">
          <BookingScheduler
            role="buyer"
            booking={{
              status: b.status,
              proposedBy: b.proposedBy,
              proposedTimes: b.proposedTimes,
              scheduledAt: b.scheduledAt,
              lastMessage: b.lastMessage,
              lastMessageBy: b.lastMessageBy,
              buyerTimeZone: b.buyerTimeZone,
              durationMinutes: b.durationMinutes,
            }}
            otherName={seller}
            confirm={confirmAsBuyer.bind(null, token)}
            propose={proposeAsBuyer.bind(null, token)}
            calendarHref={b.status === "confirmed" ? `/bookings/${token}/calendar.ics` : null}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Keep this link to yourself: anyone who has it can change this booking&rsquo;s time.
        </p>
      </div>
    </SiteShell>
  );
}
