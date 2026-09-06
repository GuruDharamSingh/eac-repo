import Link from "next/link";
import type { Metadata } from "next";
import { listServiceOfferings } from "@elkdonis/services";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Services & Sessions",
  description: "Workshops and one-on-one enneagram work — booked directly.",
};

const BOOKING_LABEL: Record<string, string> = {
  one_on_one: "One-on-one",
  group: "Group",
  async: "Self-paced",
};

const STATUS_LABEL: Record<string, string> = {
  waitlist: "Waitlist",
  full: "Sold out",
  closed: "Closed",
};

function priceLabel(price: number | null, currency: string, slidingMin: number | null) {
  if (price == null) return null;
  const fmt = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(n);
  if (slidingMin != null) return `Sliding scale, from ${fmt(slidingMin)}`;
  return fmt(price);
}

export default async function ServicesPage() {
  const services = await listServiceOfferings(siteConfig.orgId);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
        Services &amp; sessions
      </p>
      <h1 className="mt-3 font-serif text-5xl font-medium leading-[1.05]">
        Work with the enneagram
      </h1>
      <p className="mt-4 max-w-[560px] text-lg text-muted-foreground">
        Typing sessions, consultations and workshops — booked directly, no account needed.
      </p>

      {services.length === 0 ? (
        <p className="mt-16 text-muted-foreground">Nothing scheduled at the moment.</p>
      ) : (
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {services.map((s) => (
            <Link
              key={s.id}
              href={`/services/${s.slug}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-6 no-underline transition-colors hover:border-primary/60"
            >
              {s.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.coverImageUrl}
                  alt=""
                  className="mb-5 aspect-[16/9] w-full rounded-lg object-cover"
                />
              )}
              <div className="flex items-center gap-2">
                {s.bookingType && (
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {BOOKING_LABEL[s.bookingType] ?? s.bookingType}
                  </Badge>
                )}
                {s.registrationStatus !== "open" && (
                  <Badge variant="secondary">{STATUS_LABEL[s.registrationStatus]}</Badge>
                )}
              </div>
              <h2 className="mt-3 font-serif text-2xl font-medium">{s.title}</h2>
              {s.descriptionShort && (
                <p className="mt-2 text-sm text-muted-foreground">{s.descriptionShort}</p>
              )}
              <div className="mt-auto flex items-center justify-between pt-6">
                <span className="text-sm font-medium">
                  {priceLabel(s.price, s.currency, s.priceSlidingMin)}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  View →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
