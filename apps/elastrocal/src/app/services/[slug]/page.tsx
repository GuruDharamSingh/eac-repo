import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceOffering } from "@elkdonis/services";
import { sanitizeRichText } from "@elkdonis/utils";
import { BOOKING_UNAVAILABLE, bookingAvailability } from "@elkdonis/checkout/booking";
import { ServiceBookingForm } from "@elkdonis/checkout/components";
import { Badge } from "@/components/ui/badge";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { BOOKING_LABEL, FORMAT_LABEL, priceLabel, STATUS_LABEL } from "@/lib/services";
import { bookServiceAction } from "./actions";
import "@elkdonis/checkout/booking.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) return {};
  return { title: service.title, description: service.descriptionShort ?? undefined };
}

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ booked?: string; payment?: string }>;
}) {
  const [{ slug }, query, viewer] = await Promise.all([params, searchParams, getViewer()]);
  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) notFound();

  const open = service.registrationStatus === "open" && (service.price ?? 0) > 0;
  const availability = open ? await bookingAvailability(service.authorId) : null;

  const price = priceLabel(service.price, service.currency, service.priceSlidingMin);

  return (
    <article className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/services" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
        ← Readings &amp; sessions
      </Link>

      <div className="mt-6 flex items-center gap-2">
        {service.bookingType && (
          <Badge variant="outline" className="border-primary/40 text-primary">
            {BOOKING_LABEL[service.bookingType] ?? service.bookingType}
          </Badge>
        )}
        {service.format && <Badge variant="secondary">{FORMAT_LABEL[service.format]}</Badge>}
        {service.registrationStatus !== "open" && <Badge variant="secondary">{STATUS_LABEL[service.registrationStatus]}</Badge>}
      </div>

      <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{service.title}</h1>
      {service.subtitle && <p className="mt-2 text-lg text-muted-foreground">{service.subtitle}</p>}

      <dl className="mt-8 grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-4">
        {service.recurrenceLabel && (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Schedule</dt>
            <dd className="mt-1 text-sm">{service.recurrenceLabel}</dd>
          </div>
        )}
        {service.sessionDurationHrs && (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Length</dt>
            <dd className="mt-1 text-sm">{service.sessionDurationHrs} h</dd>
          </div>
        )}
        {service.location && (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Location</dt>
            <dd className="mt-1 text-sm">{service.location}</dd>
          </div>
        )}
        {price && (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Price</dt>
            <dd className="mt-1 text-sm font-medium">{price}</dd>
          </div>
        )}
      </dl>

      {/* Rich-text HTML from the composer; sanitised here as well as on
          write, because rows written by the old textarea form predate it. */}
      {service.body && (
        <div
          className="mt-10 text-[17px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(service.body) }}
        />
      )}
      {service.slidingScaleNote && <p className="mt-6 text-sm text-muted-foreground">{service.slidingScaleNote}</p>}

      <section className="mt-10 rounded-xl border border-border bg-card p-6 shadow-sm" aria-labelledby="book-heading">
        <h2 id="book-heading" className="text-xl font-semibold">
          Book
        </h2>
        <div className="mt-4">
          {query.booked === "1" ? (
            <p role="status">
              Thank you — your booking is paid.{" "}
              {(service.bookingType ?? "one_on_one") === "one_on_one"
                ? "The guide will confirm one of your times, or suggest others; the email we sent you has a link to follow it."
                : "The guide will be in touch by email."}
            </p>
          ) : open ? (
            <>
              {query.payment === "cancelled" && <p className="mb-4 text-sm">Payment was cancelled; nothing was charged.</p>}
              <ServiceBookingForm
                action={bookServiceAction.bind(null, service.slug)}
                listPrice={service.price!}
                slidingFloor={service.priceSlidingMin}
                slidingNote={service.slidingScaleNote}
                currency={service.currency}
                defaultEmail={viewer?.email ?? null}
                notesLabel="Birth details or anything to share before the reading (optional)"
                unavailable={availability && availability.ok === false ? BOOKING_UNAVAILABLE[availability.reason] : null}
                schedule={(service.bookingType ?? "one_on_one") === "one_on_one"}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {service.registrationStatus === "open"
                ? "This is arranged directly. Get in touch with the guide through their "
                : `${STATUS_LABEL[service.registrationStatus]}. Get in touch with the guide through their `}
              <Link href="/people" className="text-primary underline underline-offset-4">
                profile
              </Link>
              .
            </p>
          )}
        </div>
      </section>
    </article>
  );
}
