import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HOUSE_SYSTEMS, formatLatitude, formatLongitude } from "@elkdonis/astro";
import { calculateSkyAt } from "@elkdonis/astro/server";
import { getIdentity } from "@/lib/auth";
import { claimGuestCharts, getChart, listCharts } from "@/lib/charts";
import { ChartActions } from "@/components/chart-actions";
import { OverlayPanel } from "@/components/chart/overlay-panel";
import { ReadingPanel } from "@/components/chart/reading";

interface Props {
  params: Promise<{ id: string }>;
  /** ?compare=<id> lays another of the keeper's charts over this one. */
  searchParams: Promise<{ compare?: string }>;
}

export const metadata: Metadata = { title: "Chart" };

export default async function ChartPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { compare: compareId } = await searchParams;
  const { viewer, guestId, keeper } = await getIdentity();
  if (viewer && guestId) await claimGuestCharts(guestId, viewer.userId);
  const saved = keeper ? await getChart(id, keeper) : null;
  if (!saved) notFound();

  const { birth, chart } = saved;
  // The transit ring's first moment, so the page arrives complete. Planet
  // longitudes don't depend on where the viewer is, and the bi-wheel keeps the
  // NATAL houses, so the default location is immaterial here.
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  const transit = calculateSkyAt(now);

  // The compare menu, and the compared chart itself. Both reads go through
  // the same keeper scoping as the chart being viewed — a chart id on its own
  // must never be enough to read a row.
  const saved_others = await listCharts(keeper!);
  const others = saved_others.filter((c) => c.id !== id).map((c) => ({ id: c.id, name: c.name }));
  const other = compareId && compareId !== id ? await getChart(compareId, keeper!) : null;
  const compare = other ? { id: other.id, name: other.name, chart: other.chart } : null;
  const houseSystem = HOUSE_SYSTEMS.find((h) => h.code === birth.houseSystem)?.name ?? birth.houseSystem;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/charts" className="text-sm text-muted-foreground hover:text-foreground">
        ← Your charts
      </Link>
      <div className="mt-4 mb-2">
        <ChartActions id={saved.id} name={saved.name} isFavorite={saved.isFavorite} />
      </div>
      <p className="mb-8 text-sm text-muted-foreground tabular-nums">
        {birth.date} at {birth.timeKnown ? birth.time : "an unknown time (cast for noon)"} ({birth.timezone}) · {birth.locationName ?? "Coordinates only"} ·{" "}
        {formatLatitude(birth.latitude)} {formatLongitude(birth.longitude)} · {houseSystem} houses
      </p>
      <OverlayPanel
        natal={chart}
        natalName={saved.name}
        initialIso={now.toISOString()}
        initialTransit={transit}
        others={others}
        compare={compare}
      />
      <ReadingPanel chart={chart} name={saved.name} className="mt-6" />
    </div>
  );
}
