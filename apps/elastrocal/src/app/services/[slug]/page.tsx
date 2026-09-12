import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceOffering } from "@elkdonis/services";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { BOOKING_LABEL, FORMAT_LABEL, priceLabel, STATUS_LABEL } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) return {};
  return { title: service.title, description: service.descriptionShort ?? undefined };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) notFound();

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

      {service.body && <div className="mt-10 whitespace-pre-wrap text-[17px] leading-relaxed">{service.body}</div>}
      {service.slidingScaleNote && <p className="mt-6 text-sm text-muted-foreground">{service.slidingScaleNote}</p>}

      <p className="mt-10 rounded-xl border border-border bg-muted/50 px-5 py-4 text-sm text-muted-foreground">
        Booking through this page is on its way. Until then, get in touch with the guide through their{" "}
        <Link href="/people" className="text-primary underline underline-offset-4">
          profile
        </Link>
        .
      </p>
    </article>
  );
}
