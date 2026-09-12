"use client";

import type { ChartResult } from "@elkdonis/astro";
import { ChartWheel } from "./chart-wheel";
import { cn } from "./utils";
import { SkyList } from "./sky-list";
import { SkyControls, SkyHeader } from "./sky-parts";
import { useSky, type SkyApi } from "./use-sky";

/**
 * The current sky as one component: the moment and place, the wheel, and the
 * controls that move it.
 *
 * Three sizes of the same thing, so a hub tile, a popup and the page never
 * drift apart:
 *   "face"    the moment and the planet LIST — what a tile is read for
 *   "surface" the wheel and the controls — what the tile opens for
 *   "page"    everything, at the page's width, with the full wheel on desktop
 */
export type SkyPanelSize = "face" | "surface" | "page";

export function SkyPanel({
  size = "page",
  sky,
  className,
}: {
  size?: SkyPanelSize;
  sky: SkyApi;
  className?: string;
}) {
  if (size === "face") {
    return (
      <div className={cn("space-y-2", className)}>
        <SkyHeader sky={sky} readOnly className="text-[11px]" />
        <SkyList chart={sky.chart} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <SkyHeader sky={sky} />
      {sky.chart.warnings.length > 0 && (
        <div className="mx-auto max-w-xl rounded-lg border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm">
          {sky.chart.warnings.join(" ")}
        </div>
      )}

      {size === "page" ? (
        <>
          {/* Edge-to-edge and compact on phones; the full wheel from sm up. */}
          <div className="-mx-5 flex justify-center sm:hidden">
            <ChartWheel chart={sky.chart} variant="compact" className="max-w-[100vw]" />
          </div>
          <div className="mx-auto hidden w-full max-w-[560px] sm:block">
            <ChartWheel chart={sky.chart} />
          </div>
        </>
      ) : (
        // The popup opens at its widest, so the wheel takes the room it can
        // and the list sits beside it rather than under a small chart.
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-center md:gap-8">
          {/* Takes the room it can, bounded by the popup's height — the wheel
              is square, so height is what actually limits it. What width is
              left over is split either side rather than piled up beside the
              list, which is why the row centres. */}
          <div className="mx-auto w-full max-w-[460px] md:mx-0 md:max-w-[min(100%,62vh)] md:flex-1">
            <ChartWheel chart={sky.chart} />
          </div>
          <div className="md:w-64 md:shrink-0">
            <SkyList chart={sky.chart} />
          </div>
        </div>
      )}

      <SkyControls sky={sky} />
    </div>
  );
}

/** Convenience for hosts that only have the server's first chart. */
export function useSkyPanel(initialIso: string, initialChart: ChartResult, initialIsNow: boolean) {
  return useSky(initialIso, initialChart, initialIsNow);
}
