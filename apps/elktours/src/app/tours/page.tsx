import type { Metadata } from "next";
import { mappedTours } from "@/lib/cover";
import Link from "next/link";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { TourCard } from "@/components/tours/tour-card";
import { Split } from "@/components/mobile/split";
import { listTours, nextDepartures } from "@/lib/tours";
import { getViewer } from "@/lib/auth";
import { loadMobileDoc } from "@/lib/puck/mobile";
import { mobileServerConfig } from "@/lib/puck/config.mobile.server";
import { mobileRows } from "@/lib/puck/mobile-data";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Tours",
  description: `Guided walks and experiences in ${siteConfig.city}.`,
};

export const dynamic = "force-dynamic";

export default async function ToursPage() {
  const tours = await listTours();
  const [next, mapped] = await Promise.all([nextDepartures(tours.map((t) => t.id)), mappedTours(tours.map((t) => t.id))]);

  // Phone tree (G2): the m-tours document, drawn with the tours fetched above (not read a second time).
  const mobileTours = mobileRows(tours, next, mapped);
  const [{ data }, viewer] = await Promise.all([loadMobileDoc("m-tours"), getViewer().catch(() => null)]);
  const metadata = { orgId: siteConfig.orgId, slug: "m-tours", mobileTours };
  const filled = await resolveAllData(data, mobileServerConfig, metadata);

  const mobile = (
    <>
      <Render config={mobileServerConfig} data={filled as Data} metadata={metadata} />
      {viewer?.canEdit && (
        <p style={{ padding: "20px 20px 0" }}>
          <Link href="/studio/m-tours" className="underline underline-offset-4" style={{ fontSize: 13 }}>
            Edit phone layout
          </Link>
        </p>
      )}
    </>
  );

  const desktop = (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{siteConfig.city}</p>
        <h1 className="mt-2 font-serif text-4xl">Tours and experiences</h1>
        <p className="mt-3 text-muted-foreground">
          Small groups, on foot, led by people who live here. Pick a date, say how many you are, and pay by card.
        </p>
      </header>

      {tours.length === 0 ? (
        <p className="mt-10 border border-dashed border-border p-10 text-center text-muted-foreground">
          No tours are scheduled at the moment. Check back soon.
        </p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((t) => (
            <TourCard key={t.id} tour={t} next={next.get(t.id)} />
          ))}
        </div>
      )}
    </div>
  );

  return <Split mobile={mobile} desktop={desktop} />;
}
