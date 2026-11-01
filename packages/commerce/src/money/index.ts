/**
 * Money utilities. Stick to integer minor units everywhere; only convert at
 * the display boundary or when accepting user input.
 */

import type { Currency, Money } from "../types";

const CURRENCY_LOCALE: Record<Currency, string> = {
  CAD: "en-CA",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
};

const CURRENCY_FRACTION_DIGITS: Record<Currency, number> = {
  CAD: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
};

export function minorToMajor(amountMinor: number, currency: Currency): number {
  const digits = CURRENCY_FRACTION_DIGITS[currency];
  return amountMinor / Math.pow(10, digits);
}

export function majorToMinor(amountMajor: number, currency: Currency): number {
  const digits = CURRENCY_FRACTION_DIGITS[currency];
  return Math.round(amountMajor * Math.pow(10, digits));
}

export function money(amountMinor: number, currency: Currency = "CAD"): Money {
  return { amountMinor, currency };
}

/**
 * Format money for display. Always pairs amount + currency code.
 *
 * formatMoney(199900, "CAD") -> "CA$1,999.00"
 * formatMoney(199900, "CAD", { compact: true }) -> "CA$2k"
 */
export function formatMoney(
  amountMinor: number | null | undefined,
  currency: Currency = "CAD",
  opts: { compact?: boolean; hideSymbol?: boolean } = {}
): string {
  if (amountMinor == null) return "—";
  const major = minorToMajor(amountMinor, currency);
  if (opts.compact && Math.abs(major) >= 1000) {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(major);
  }
  if (opts.hideSymbol) {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
      minimumFractionDigits: CURRENCY_FRACTION_DIGITS[currency],
      maximumFractionDigits: CURRENCY_FRACTION_DIGITS[currency],
    }).format(major);
  }
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
  }).format(major);
}

/**
 * Split a sale into artist payout and gallery commission.
 * commissionRate is the gallery's percentage (e.g. 30 = gallery keeps 30%).
 */
export function splitCommission(
  amountMinor: number,
  commissionRate: number
): { artistShareMinor: number; galleryShareMinor: number } {
  const galleryShareMinor = Math.round((amountMinor * commissionRate) / 100);
  const artistShareMinor = amountMinor - galleryShareMinor;
  return { artistShareMinor, galleryShareMinor };
}

/**
 * One band of a bid-increment ladder: bids up to `upTo` (minor units, inclusive)
 * step by `step`; the last band has no `upTo`. ORG_STORE_BRIEF R4.
 */
export interface IncrementStep {
  upTo?: number;
  step: number;
}

/** The marketplace default ladder (minor units): <$100 $5 · $100–499 $10 · $500–999 $25 · $1k–4,999 $100 · $5k+ $250. */
export const DEFAULT_INCREMENT_LADDER: IncrementStep[] = [
  { upTo: 9999, step: 500 },
  { upTo: 49999, step: 1000 },
  { upTo: 99999, step: 2500 },
  { upTo: 499999, step: 10000 },
  { step: 25000 },
];

/** The increment that applies at a given current bid. */
export function incrementAt(currentMinor: number, ladder: IncrementStep[] | null | undefined): number {
  const steps = Array.isArray(ladder) && ladder.length > 0 ? ladder : DEFAULT_INCREMENT_LADDER;
  const cur = Number(currentMinor);
  for (const s of steps) {
    if (s.upTo == null || cur <= Number(s.upTo)) return Math.max(1, Number(s.step));
  }
  return Math.max(1, Number(steps[steps.length - 1]!.step));
}

/**
 * Compute the next minimum bid given the current bid and the lot's increment
 * rule: a ladder when the lot carries one, else its flat increment. With no
 * current bid, the starting bid.
 */
export function nextMinimumBid(opts: {
  startingBidMinor: number;
  currentBidMinor?: number | null;
  bidIncrementMinor: number;
  ladder?: IncrementStep[] | null;
}): number {
  // Number(): a bigint column that reaches here as a string would otherwise
  // concatenate ("1500" + 1000 = "15001000").
  if (opts.currentBidMinor == null) return Number(opts.startingBidMinor);
  const cur = Number(opts.currentBidMinor);
  const inc = opts.ladder && opts.ladder.length > 0 ? incrementAt(cur, opts.ladder) : Number(opts.bidIncrementMinor);
  return cur + inc;
}

/** The ladder a lot uses, read from its metadata; null means its flat increment. */
export function lotLadder(metadata: Record<string, unknown> | null | undefined): IncrementStep[] | null {
  const l = metadata?.ladder;
  return Array.isArray(l) && l.length > 0 ? (l as IncrementStep[]) : null;
}

/** Pretty short money for badges: "$1.2k" / "$899" */
export function shortMoney(amountMinor: number, currency: Currency = "CAD"): string {
  return formatMoney(amountMinor, currency, { compact: true });
}
