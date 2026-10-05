import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getIdentity } from "@/lib/auth";
import { claimGuestCharts, getChart } from "@/lib/charts";
import { buildExplorerModel } from "@/lib/chart-explorer";
import { ChartExplorer } from "@/components/chart/explorer";

interface Props {
  params: Promise<{ id: string }>;
  /** ?view=favourites opens the Favourites tab. */
  searchParams: Promise<{ view?: string }>;
}

export const metadata: Metadata = { title: "Explore chart" };

/**
 * The chart explorer: the wheel as something to point at. Hover (or focus)
 * a planet, an aspect line, a sign, a house or a detected pattern and it
 * lights up with what it is connected to; the side panel lists its explicit
 * factor keys, the rulebook facts, and — for studio reviewers — what the
 * books in the corpus say about each key.
 *
 * Same keeper scoping as the chart page: the id alone never reads a row.
 */
export default async function ExploreChartPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { view } = await searchParams;
  const { viewer, guestId, keeper } = await getIdentity();
  if (viewer && guestId) await claimGuestCharts(guestId, viewer.userId);
  const saved = keeper ? await getChart(id, keeper) : null;
  if (!saved) notFound();

  const model = buildExplorerModel(saved.chart);
  // References are open to anyone who can view the chart (excerpts, no votes); the studio
  // owner also gets whole passages, votes and Favourites (lib/explore-access.ts).
  const canSeeReferences = true;
  const isOwner = viewer?.role === "owner";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/charts/${saved.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {saved.name}
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-gold">Explorer</span>
      </div>
      <h1 className="mt-3 text-2xl">{saved.name}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Point at anything on the wheel. Click to pin it; Esc to let go. Tab moves through planets, aspects and patterns.
      </p>
      <ChartExplorer
        chartId={saved.id}
        chart={saved.chart}
        model={model}
        canSeeReferences={canSeeReferences}
        isOwner={isOwner}
        initialView={view === "favourites" ? "favourites" : "chart"}
      />
    </div>
  );
}
