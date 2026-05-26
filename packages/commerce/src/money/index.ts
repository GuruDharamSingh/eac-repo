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
 * Compute the next minimum bid given current bid and increment.
 * If no current bid, returns the lot's starting bid.
 */
export function nextMinimumBid(opts: {
  startingBidMinor: number;
  currentBidMinor?: number | null;
  bidIncrementMinor: number;
}): number {
  if (opts.currentBidMinor == null) return opts.startingBidMinor;
  return opts.currentBidMinor + opts.bidIncrementMinor;
}

/** Pretty short money for badges: "$1.2k" / "$899" */
export function shortMoney(amountMinor: number, currency: Currency = "CAD"): string {
  return formatMoney(amountMinor, currency, { compact: true });
}
