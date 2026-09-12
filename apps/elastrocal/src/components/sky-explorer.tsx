"use client";

import Link from "next/link";
import type { ChartResult } from "@elkdonis/astro";
import { ChartWheel, SkyControls, SkyHeader, useSky } from "@/components/sky";
import { AspectsTable, ChartSummary, HousesTable, PositionsTable } from "@/components/chart/tables";
import { Popout } from "@/components/popout";
import { siteConfig } from "@/config/site";

/**
 * The home page.
 *
 * Desktop is two columns. The left is given over to the wheel at the largest
 * size the screen will hold: the drawing is sized off the viewport's *height*
 * so the top of the outer circle sits just under the date and the bottom just
 * above the controls — a chart is square, so height is what limits it, and
 * anything wider would only be cropped. Under it, the time controls with
 * Houses and Aspects beside them as pop-outs rather than two more tables
 * pushing the page down. The right column reads the same chart as text.
 *
 * Phones keep the single column: the compact wheel edge-to-edge, controls
 * under it, everything else stacked. Both wheels are rendered and swapped by
 * breakpoint, so the right one is there on first paint.
 *
 * The parts come from @elkdonis/sky-ui, the same ones the hub tile and the
 * popup use; only this arrangement is the page's own.
 */
export function SkyExplorer({
  initialIso,
  initialChart,
  initialIsNow,
  locationName,
}: {
  initialIso: string;
  initialChart: ChartResult;
  initialIsNow: boolean;
  locationName: string;
}) {
  const sky = useSky(initialIso, initialChart, initialIsNow);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
      {/* The chart */}
      <div className="space-y-3">
        <SkyHeader sky={sky} className="lg:justify-start" />

        {sky.chart.warnings.length > 0 && (
          <div className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm">
            {sky.chart.warnings.join(" ")}
          </div>
        )}

        {/* Phones: compact, to the screen's edges. */}
        <div className="-mx-5 flex justify-center sm:hidden">
          <ChartWheel chart={sky.chart} variant="compact" className="max-w-[100vw]" />
        </div>
        {/* Everything else: the tallest square that fits between the date
            line and the controls, so the wheel takes the whole screen and
            nothing below it falls off the bottom. 15rem is what sits above
            and below it — nav, page padding, the date line, the control row —
            measured in the browser rather than guessed. */}
        <div
          className="mx-auto hidden w-full sm:block lg:mx-0"
          style={{ maxWidth: "min(100%, calc(100vh - 15rem))" }}
        >
          <ChartWheel chart={sky.chart} />
        </div>

        <div className="flex flex-wrap items-start justify-center gap-2 lg:justify-start">
          <SkyControls sky={sky} />
          <div className="flex gap-2 pt-0.5">
            <Popout label="Houses">
              <HousesTable chart={sky.chart} bare />
            </Popout>
            <Popout label="Aspects" count={sky.chart.aspects.length}>
              <AspectsTable chart={sky.chart} bare />
            </Popout>
          </div>
        </div>
      </div>

      {/* The chart as text, and what this is */}
      <div className="space-y-5 lg:sticky lg:top-20">
        <ChartSummary chart={sky.chart} />
        <PositionsTable chart={sky.chart} />

        <section className="rounded-xl border border-border bg-card p-5 text-sm leading-relaxed shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">
            Welcome to {siteConfig.orgName}
          </h2>
          <p className="mt-3 text-muted-foreground">
            The wheel is the sky as it is now, cast for {locationName}. Move it with the controls, or play
            through the hours and watch the Moon travel.
          </p>
          <p className="mt-3 text-muted-foreground">
            Positions come from the Swiss Ephemeris, in the tropical zodiac.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/calculate" className="text-primary underline underline-offset-4">
              Calculate a birth chart
            </Link>
            <Link href="/charts" className="text-primary underline underline-offset-4">
              Your charts
            </Link>
            <Link href="/services" className="text-primary underline underline-offset-4">
              Readings
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
