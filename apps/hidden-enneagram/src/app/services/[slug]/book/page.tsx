import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceOffering } from "@elkdonis/services";
import { BOOKING_UNAVAILABLE, bookingAvailability } from "@elkdonis/checkout/booking";
import { ServiceBookingForm } from "@elkdonis/checkout/components";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { createBookingAction } from "./actions";
import "@elkdonis/checkout/booking.css";

export const metadata: Metadata = { title: "Book" };

/** Book and pay by card: the shared form from @elkdonis/checkout (2026-09-27). */
export default async function BookServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [service, viewer] = await Promise.all([
    getServiceOffering(siteConfig.orgId, slug),
    getViewer(),
  ]);
  if (!service || service.registrationStatus !== "open" || !service.price) notFound();

  const availability = await bookingAvailability(service.authorId);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Book</p>
      <h1 className="mt-2 font-serif text-3xl font-medium">{service.title}</h1>
      <p className="mt-2 text-muted-foreground">{service.descriptionShort}</p>

      {query.payment === "cancelled" && (
        <p role="status" className="mt-4 text-sm">
          Payment was cancelled; nothing was charged.
        </p>
      )}

      <div className="mt-8 max-w-md rounded-xl border border-border bg-card p-6">
        <ServiceBookingForm
          action={createBookingAction.bind(null, service.slug)}
          listPrice={service.price}
          slidingFloor={service.priceSlidingMin}
          slidingNote={service.slidingScaleNote}
          currency={service.currency}
          defaultEmail={viewer?.email ?? null}
          notesLabel="Anything to share before we meet? (optional)"
          unavailable={availability.ok === false ? BOOKING_UNAVAILABLE[availability.reason] : null}
          schedule={(service.bookingType ?? "one_on_one") === "one_on_one"}
        />
      </div>
    </div>
  );
}
