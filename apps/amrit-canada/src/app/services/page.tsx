import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getServiceThreads, getSiteSections } from "@/lib/data";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const [services, sections] = await Promise.all([
    getServiceThreads(30),
    getSiteSections(),
  ]);

  const copy = sections.services;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-center font-serif text-3xl">
        {copy?.title ?? "Services"}
      </h1>
      {copy?.subtitle && (
        <p className="mt-2 text-center text-lg italic text-[#d16b47]">
          {copy.subtitle}
        </p>
      )}
      <hr className="saffron-divider mx-auto max-w-xs" />

      {services.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">
          No services listed yet. Check back soon.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <Link
              key={svc.id}
              href={`/services/${svc.slug}`}
              className="card-natural group flex flex-col p-6"
            >
              {svc.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={svc.coverImageUrl}
                  alt=""
                  className="mb-4 h-40 w-full rounded-lg object-cover"
                  loading="lazy"
                />
              )}
              <h2 className="font-serif text-xl font-semibold">{svc.title}</h2>
              {svc.excerpt && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {svc.excerpt}
                </p>
              )}
              {svc.location && (
                <p className="mt-2 text-xs text-muted-foreground">{svc.location}</p>
              )}
              {svc.authorName && (
                <p className="mt-auto pt-4 text-xs text-muted-foreground">
                  with {svc.authorName}
                </p>
              )}
              <span className="mt-2 text-sm font-medium text-[#d16b47] underline-offset-4 group-hover:underline">
                Learn more <ArrowRight className="inline size-3.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
