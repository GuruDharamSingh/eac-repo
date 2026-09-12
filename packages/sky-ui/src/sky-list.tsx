"use client";

import { BODY_BY_KEY, SIGN_BY_KEY, formatPosition, type ChartResult } from "@elkdonis/astro";
import { ELEMENT_TEXT, Glyph } from "./glyph";
import { cn } from "./utils";

/**
 * The planets as a list — where each one is, in degrees and sign.
 *
 * This is the face's content: what a passer-by reads off a tile ("Sun, 19°
 * Virgo"), where the wheel is what they open it for. Same shape as the
 * positions table on Elastrocal's own pages, so the tile and the site agree.
 *
 *   rows  a named row each, for a column or a card
 *   grid  two dense columns, for a wide face with little height
 */
export function SkyList({
  chart,
  className,
  variant = "rows",
}: {
  chart: ChartResult;
  className?: string;
  variant?: "rows" | "grid";
}) {
  return (
    <ul
      className={cn(
        "text-[13px] leading-tight tabular-nums",
        variant === "grid" ? "grid grid-cols-2 gap-x-4 gap-y-1" : "divide-y divide-border/60",
        className,
      )}
    >
      {chart.bodies.map((b) => {
        const sign = SIGN_BY_KEY[b.sign];
        return (
          <li
            key={b.key}
            className={cn("flex items-center gap-1.5", variant === "rows" && "py-1")}
          >
            <Glyph className="w-4 shrink-0 text-center text-base text-primary">
              {BODY_BY_KEY[b.key].glyph}
            </Glyph>
            {variant === "rows" && <span className="truncate">{BODY_BY_KEY[b.key].name}</span>}
            <span className={cn("shrink-0", variant === "rows" && "ml-auto")}>
              {formatPosition(b.longitude, "degree")}
            </span>
            <Glyph className={cn("shrink-0", ELEMENT_TEXT[sign.element], variant === "grid" && "ml-auto")}>
              {sign.glyph}
            </Glyph>
            {b.retrograde && (
              <span className="shrink-0 text-[10px] font-semibold text-destructive" title="Retrograde">
                R
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
