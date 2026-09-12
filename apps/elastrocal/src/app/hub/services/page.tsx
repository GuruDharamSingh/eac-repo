import Link from "next/link";
import type { Metadata } from "next";
import { listAllServiceOfferingsForOrg } from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BOOKING_LABEL, priceLabel } from "@/lib/services";

export const metadata: Metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function HubServicesPage() {
  await requireOrgEditor("/hub/services");
  const services = await listAllServiceOfferingsForOrg(siteConfig.orgId).catch(() => []);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <Link href="/hub" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
        ← Hub
      </Link>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">Services</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Readings and sessions listed on{" "}
            <Link href="/services" className="text-primary underline underline-offset-4">
              /services
            </Link>
            . Drafts are only visible here.
          </p>
        </div>
        <Button asChild>
          <Link href="/hub/services/new">New service</Link>
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-display text-2xl">Nothing listed yet</p>
          <p className="mt-2 text-sm text-muted-foreground">A reading, a consultation, a class — start with a draft.</p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
          {services.map((s) => (
            <li key={s.id}>
              <Link href={`/hub/services/${s.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-accent">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.title}</span>
                    <Badge variant={s.status === "published" ? "default" : "secondary"}>{s.status}</Badge>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {s.bookingType ? BOOKING_LABEL[s.bookingType] : ""}
                    {s.subtitle ? ` · ${s.subtitle}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">{priceLabel(s.price, s.currency, s.priceSlidingMin)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
