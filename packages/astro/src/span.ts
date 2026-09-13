import { assembleChart } from "./assemble";
import type { BodyKey, ChartInput, ChartResult } from "./types";

/**
 * A run of consecutive days, tabulated.
 *
 * Scrubbing a dial through a year is the case a per-date API is worst at: the
 * engine casts a chart in about four milliseconds, but asking for one date at
 * a time means a round trip per day, and the wheel arrives behind the hand.
 * A span is the same information turned inside out — every day in a window,
 * fetched once, in the only numbers a chart cannot be derived from.
 *
 * Everything else (which sign, which house, the aspects, the balance) is
 * arithmetic, and `chartFromSpan` does it in the browser with the same
 * assembler the engine uses, so a scrubbed chart and a cast one agree.
 *
 * Two things are deliberately not carried: ecliptic latitude, which nothing
 * draws, and per-day warnings, which do not vary within a window. Longitudes
 * are rounded to six decimals — two thousandths of an arcsecond, about a
 * millionth of the width of a drawn planet — which takes roughly a third off
 * the payload.
 */

/** Decimal places kept for every angle in a span. */
export const SPAN_PRECISION = 6;
const round = (n: number) => Number(n.toFixed(SPAN_PRECISION));

export interface ChartSpan {
  engineVersion: string;
  ephemeris: "swiss" | "moshier";
  /** The first day, "YYYY-MM-DD". Each row is the next calendar day. */
  from: string;
  /** Held fixed for every day: the time, the place, the house system. */
  input: Omit<Required<ChartInput>, "date">;
  /** Which bodies each row's longitudes belong to. */
  keys: BodyKey[];
  /** Whatever the engine said about the window as a whole. */
  warnings: string[];
  /** Per day. */
  days: Array<{
    /** The chart's instant, ISO — the time zone's rules for that date applied. */
    utc: string;
    jd: number;
    /** Longitudes in `keys` order. */
    lon: number[];
    /** Degrees per day, same order. */
    spd: number[];
    /** Twelve cusps in house order. */
    cusp: number[];
    asc: number;
    mc: number;
    vtx: number;
  }>;
}

/** Trim a span row to the numbers, rounded. Used when building one. */
export function packSpanDay(day: ChartSpan["days"][number]): ChartSpan["days"][number] {
  return {
    utc: day.utc,
    jd: day.jd,
    lon: day.lon.map(round),
    spd: day.spd.map(round),
    cusp: day.cusp.map(round),
    asc: round(day.asc),
    mc: round(day.mc),
    vtx: round(day.vtx),
  };
}

/** How many days into the span a date falls, or -1 when it is outside. */
export function spanIndexOf(span: ChartSpan, isoDate: string): number {
  const from = Date.parse(`${span.from}T00:00:00Z`);
  const at = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(at)) return -1;
  const i = Math.round((at - from) / 86_400_000);
  return i >= 0 && i < span.days.length ? i : -1;
}

/**
 * The chart for one day of a span — assembled in whatever runtime asks,
 * including a browser, with no ephemeris and no network.
 */
export function chartFromSpan(span: ChartSpan, index: number): ChartResult {
  const day = span.days[index];
  const date = new Date(Date.parse(`${span.from}T00:00:00Z`) + index * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return assembleChart(
    {
      longitudes: day.lon,
      speeds: day.spd,
      cusps: day.cusp,
      ascendant: day.asc,
      midheaven: day.mc,
      vertex: day.vtx,
    },
    {
      input: { ...span.input, date },
      engineVersion: span.engineVersion,
      utc: day.utc,
      julianDayUt: day.jd,
      ephemeris: span.ephemeris,
      approximate: span.input.timeKnown === false,
      warnings: span.warnings,
      keys: span.keys,
    },
  );
}

/** The chart for a date, or null when the span does not cover it. */
export function chartForDate(span: ChartSpan, isoDate: string): ChartResult | null {
  const i = spanIndexOf(span, isoDate);
  return i < 0 ? null : chartFromSpan(span, i);
}
