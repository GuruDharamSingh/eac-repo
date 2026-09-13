"use client";

import { useMemo } from "react";
import { renderWheelSvg, type WheelOptions } from "@elkdonis/astro/wheel";
import type { ChartResult } from "@elkdonis/astro";
import { cn } from "./utils";

/**
 * The chart wheel: our own renderer (@elkdonis/astro), drawn as inline SVG.
 * Type is set in the page's fonts, so a wheel is ~30 KB and cheap enough to
 * redraw every second while the sky page plays. The printable sheet with the
 * same drawing, type as outlines, comes from @elkdonis/astro/svg.
 *
 * "compact" is the same chart drawn tighter and bolder, for cards.
 *
 * Pass `transits` and it becomes a BI-WHEEL: `chart` stays the inner wheel and
 * keeps the houses, the second chart's planets ring it, and the lines across
 * the middle are the transit-to-natal contacts. See @elkdonis/astro/transits.
 */
export function ChartWheel({
  chart,
  transits,
  orient,
  variant = "full",
  showMinorAspects = false,
  className,
}: {
  chart: ChartResult;
  transits?: ChartResult;
  /** "aries" pins the zodiac so the signs hold still while the date moves. */
  orient?: WheelOptions["orient"];
  variant?: WheelOptions["variant"];
  showMinorAspects?: boolean;
  className?: string;
}) {
  const svg = useMemo(
    () =>
      renderWheelSvg(chart, {
        variant,
        transits,
        orient,
        minorAspects: showMinorAspects,
        rootAttrs: 'role="img" aria-label="Chart wheel"',
        // The full wheel sits on its white card; the compact one on the page.
        background: variant === "full" ? "#ffffff" : "#f9f6ef",
      }),
    [chart, transits, orient, variant, showMinorAspects],
  );
  return (
    <div
      className={cn(
        "wheel mx-auto aspect-square w-full",
        variant === "full" && "rounded-2xl border border-border bg-paper p-2 shadow-sm",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
