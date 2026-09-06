import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceOffering } from "@elkdonis/services";
import { ServiceBookingForm } from "@/components/service-booking-form";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Book" };

export default async function BookServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [service, viewer] = await Promise.all([
    getServiceOffering(siteConfig.orgId, slug),
    getViewer(),
  ]);
  if (!service || service.registrationStatus !== "open" || service.price == null) notFound();

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Book</p>
      <h1 className="mt-2 font-serif text-3xl font-medium">{service.title}</h1>
      <p className="mt-2 text-muted-foreground">{service.descriptionShort}</p>

      <div className="mt-8 max-w-md">
        <ServiceBookingForm
          slug={service.slug}
          defaultEmail={viewer?.email}
          listPrice={service.price}
          slidingFloor={service.priceSlidingMin}
          currency={service.currency}
        />
      </div>
    </div>
  );
}
