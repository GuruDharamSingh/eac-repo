"use client";

import * as React from "react";
import { ServiceBookingForm } from "@elkdonis/checkout/components";
import "@elkdonis/checkout/booking.css";
import { InquiryForm } from "@/components/inquiry-form";
import { bookServiceAction } from "@/lib/booking-actions";
import type { WireBooking } from "./service-sample";

/**
 * Book the chosen service by card, or send an enquiry.
 *
 * `unavailable` and `inquiry` come from lib/puck/data-service.ts: a one-to-one
 * service, a service with no price, or a site whose payouts are not set up
 * shows the enquiry form (and the reason) instead of the card form. The card
 * form's action is this site's own (lib/booking-actions.ts) and returns to
 * the page it was used on. The booking form's stylesheet is imported here so
 * it travels with the block into the editor's canvas and the published page.
 */
export function BookingView({
  booking,
  heading = "Book",
  notesLabel = "Anything we should know before you come? (optional)",
}: {
  booking?: WireBooking | null;
  heading?: string;
  notesLabel?: string;
}) {
  const returnPath = React.useRef("/");
  React.useEffect(() => {
    returnPath.current = `${window.location.pathname}${window.location.search}`;
  }, []);

  const s = booking?.service;
  if (!booking || !s) {
    return <p className="card-natural p-6 text-sm text-muted-foreground">Choose a service to book.</p>;
  }

  return (
    <section id="book" className="card-natural p-6">
      {heading ? <h2 className="font-serif text-2xl">{heading}</h2> : null}
      <p className="mt-1 text-sm text-muted-foreground">
        {s.title}
        {s.priceLabel ? ` · ${s.priceLabel}` : ""}
      </p>
      {booking.unavailable ? (
        <p className="mt-4 border-l-[3px] border-l-[hsl(var(--primary))] pl-3 text-sm">{booking.unavailable}</p>
      ) : null}
      <div className="mt-4">
        {booking.inquiry ? (
          <InquiryForm threadId={s.id} serviceTitle={s.title} />
        ) : (
          <ServiceBookingForm
            action={(input) => bookServiceAction(s.slug, returnPath.current, input)}
            listPrice={s.price ?? 0}
            slidingFloor={s.priceSlidingMin}
            slidingNote={s.slidingScaleNote}
            currency={s.currency}
            defaultName={booking.defaultName}
            defaultEmail={booking.defaultEmail}
            notesLabel={notesLabel}
            unavailable={booking.unavailable}
          />
        )}
      </div>
    </section>
  );
}
