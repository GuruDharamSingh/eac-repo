import { calculateSkyAt } from "@elkdonis/astro/server";
import { siteConfig } from "@/config/site";
import { SkyExplorer } from "@/components/sky-explorer";

interface Props {
  /** ?t=<ISO instant> — the moment to chart. Absent or unparseable means now. */
  searchParams: Promise<{ t?: string }>;
}

/** Whole seconds: the chart is recomputed per request, so a stable string matters more than ms. */
function truncate(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 1000) * 1000);
}

/**
 * The home page is the sky and nothing else.
 *
 * It carried a strip of collective cards — people, readings, the other sites
 * — for a while, but four of the six had nothing behind them yet, and a row
 * of "not open yet" tiles under a chart is worse than no row at all. The
 * people and the readings have their own pages in the nav; this page is for
 * looking at the sky.
 */
export default async function HomePage({ searchParams }: Props) {
  const { t } = await searchParams;
  const requested = t ? new Date(t) : null;
  const valid = requested && !Number.isNaN(requested.getTime()) ? truncate(requested) : null;
  const at = valid ?? truncate(new Date());

  const { name, latitude, longitude } = siteConfig.skyLocation;
  const sky = calculateSkyAt(at, latitude, longitude);

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:py-8">
      <SkyExplorer initialIso={at.toISOString()} initialChart={sky} initialIsNow={valid === null} locationName={name} />
    </div>
  );
}
