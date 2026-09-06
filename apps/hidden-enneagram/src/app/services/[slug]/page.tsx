import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceOffering } from "@elkdonis/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

const BOOKING_LABEL: Record<string, string> = {
  one_on_one: "One-on-one",
  group: "Group",
  async: "Self-paced",
};

const FORMAT_LABEL: Record<string, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
};

const CTA_LABEL: Record<string, string> = {
  waitlist: "Join the waitlist",
  full: "Sold out",
  closed: "Booking closed",
};

function priceLabel(price: number | null, currency: string, slidingMin: number | null) {
  if (price == null) return null;
  const fmt = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(n);
  return slidingMin != null ? `${fmt(slidingMin)}–${fmt(price)}, sliding scale` : fmt(price);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) return {};
  return {
    title: service.title,
    description: service.descriptionShort ?? undefined,
    openGraph: service.coverImageUrl ? { images: [service.coverImageUrl] } : undefined,
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) notFound();

  const price = priceLabel(service.price, service.currency, service.priceSlidingMin);
  const bannerUrl = service.bannerImageUrl ?? service.coverImageUrl;
  const isOpen = service.registrationStatus === "open";

  return (
    <article>
      <Link
        href="/services"
        className="text-xs uppercase tracking-[0.2em] text-muted-foreground no-underline hover:text-foreground"
      >
        ← Services
      </Link>

      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerUrl}
          alt=""
          className="mt-6 aspect-[21/9] w-full rounded-xl object-cover"
        />
      )}

      <div className="mt-8 flex items-center gap-2">
        {service.bookingType && (
          <Badge variant="outline" className="border-primary/40 text-primary">
            {BOOKING_LABEL[service.bookingType] ?? service.bookingType}
          </Badge>
        )}
        {service.format && <Badge variant="secondary">{FORMAT_LABEL[service.format]}</Badge>}
      </div>

      <h1 className="mt-3 font-serif text-4xl font-medium leading-[1.1]">{service.title}</h1>
      {service.subtitle && <p className="mt-2 text-lg text-muted-foreground">{service.subtitle}</p>}

      <dl className="mt-8 grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-4">
        {service.recurrenceLabel && (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Schedule
            </dt>
            <dd className="mt-1 text-sm">{service.recurrenceLabel}</dd>
          </div>
        )}
        {service.sessionCount && (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Sessions
            </dt>
            <dd className="mt-1 text-sm">
              {service.sessionCount}
              {service.sessionDurationHrs ? ` × ${service.sessionDurationHrs}h` : ""}
            </dd>
          </div>
        )}
        {service.location && (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Location
            </dt>
            <dd className="mt-1 text-sm">{service.location}</dd>
          </div>
        )}
        {price && (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Price
            </dt>
            <dd className="mt-1 text-sm font-medium">{price}</dd>
          </div>
        )}
      </dl>

      {service.body && (
        <div className="prose-services mt-10 whitespace-pre-wrap text-[17px] leading-relaxed">
          {service.body}
        </div>
      )}

      {service.slidingScaleNote && (
        <p className="mt-6 text-sm text-muted-foreground">{service.slidingScaleNote}</p>
      )}

      <div className="mt-10">
        {isOpen ? (
          <Button asChild size="lg">
            <Link href={`/services/${service.slug}/book`}>Book now</Link>
          </Button>
        ) : (
          <Button size="lg" disabled>
            {CTA_LABEL[service.registrationStatus]}
          </Button>
        )}
      </div>
    </article>
  );
}
