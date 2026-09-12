import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceOfferingById } from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { ServiceForm } from "@/components/hub/service-form";

export const metadata: Metadata = { title: "Edit service" };
export const dynamic = "force-dynamic";

/** `/hub/services/new` creates; any other id edits that offering. */
export default async function HubServiceEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOrgEditor("/hub/services");
  const { id } = await params;
  const service = id === "new" ? null : await getServiceOfferingById(siteConfig.orgId, id).catch(() => null);
  if (id !== "new" && !service) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/hub/services" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
        ← Services
      </Link>
      <h1 className="mt-4 text-3xl font-semibold md:text-4xl">{service ? service.title : "New service"}</h1>
      {service?.status === "published" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Live at{" "}
          <Link href={`/services/${service.slug}`} className="text-primary underline underline-offset-4">
            /services/{service.slug}
          </Link>
        </p>
      )}
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <ServiceForm
          threadId={service?.id}
          initial={{
            title: service?.title ?? "",
            subtitle: service?.subtitle ?? "",
            descriptionShort: service?.descriptionShort ?? "",
            body: service?.body ?? "",
            bookingType: service?.bookingType ?? "one_on_one",
            format: service?.format ?? undefined,
            price: service?.price ?? 0,
            currency: service?.currency ?? "CAD",
            priceSlidingMin: service?.priceSlidingMin ?? undefined,
            slidingScaleNote: service?.slidingScaleNote ?? "",
            sessionDurationHrs: service?.sessionDurationHrs ?? undefined,
            recurrenceLabel: service?.recurrenceLabel ?? "",
            location: service?.location ?? "",
            registrationStatus: service?.registrationStatus ?? "open",
            status: service?.status === "published" ? "published" : "draft",
          }}
        />
      </div>
    </div>
  );
}
