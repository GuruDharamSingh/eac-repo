import Link from "next/link";
import type { Metadata } from "next";
import { listServiceOfferings } from "@elkdonis/services";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { BOOKING_LABEL, priceLabel, STATUS_LABEL } from "@/lib/services";

export const metadata: Metadata = {
  title: "Readings & Sessions",
  description: "Natal chart readings and consultations, booked directly.",
};
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await listServiceOfferings(siteConfig.orgId);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Readings &amp; sessions</p>
      <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Work with a guide</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Chart readings and consultations from the people behind Elastrocal.
      </p>

      {services.length === 0 ? (
        <p className="mt-14 text-muted-foreground">Nothing listed at the moment.</p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {services.map((s) => (
            <Link
              key={s.id}
              href={`/services/${s.slug}`}
              className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/60"
            >
              <div className="flex items-center gap-2">
                {s.bookingType && (
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {BOOKING_LABEL[s.bookingType] ?? s.bookingType}
                  </Badge>
                )}
                {s.registrationStatus !== "open" && <Badge variant="secondary">{STATUS_LABEL[s.registrationStatus]}</Badge>}
              </div>
              <h2 className="mt-3 font-display text-xl group-hover:text-primary">{s.title}</h2>
              {s.descriptionShort && <p className="mt-2 text-sm text-muted-foreground">{s.descriptionShort}</p>}
              <div className="mt-auto flex items-center justify-between pt-6">
                <span className="text-sm font-medium">{priceLabel(s.price, s.currency, s.priceSlidingMin)}</span>
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
