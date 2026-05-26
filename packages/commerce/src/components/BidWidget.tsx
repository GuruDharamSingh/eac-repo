"use client";

import * as React from "react";
import type { AuctionLot, Bid } from "../types";
import { formatMoney, minorToMajor, majorToMinor, nextMinimumBid } from "../money";
import { CountdownTimer } from "./CountdownTimer";
import { cn } from "./cn";

export interface BidWidgetProps {
  lot: AuctionLot;
  /** Recent bids, newest first */
  recentBids?: Bid[];
  /** Whether the viewer is signed in (controls "sign in to bid" CTA) */
  isAuthenticated: boolean;
  signInHref?: string;
  /** Server action / API call: place a bid. Throws on rejection. */
  onPlaceBid: (input: {
    lotId: string;
    amountMinor: number;
    maxAmountMinor?: number | null;
  }) => Promise<{
    ok: boolean;
    lot?: Pick<AuctionLot, "currentBidMinor" | "bidCount" | "endAt">;
    reason?: string;
  }>;
  className?: string;
}

/**
 * The interactive auction bid widget.
 *
 * Embeddable in any context where a user might bid:
 *   - apps/art-auction /lots/[id] page
 *   - workshop pages where a piece is up for auction
 *   - artist subdomain showcasing their auctions
 *
 * Reads-only: countdown + current bid + bid history.
 * Interactive: bid input (with proxy max), buy-now button.
 *
 * Auth gate: if !isAuthenticated, shows "Sign in to bid" CTA. Bidding REQUIRES
 * sign-in (per session decision: guest can buy-now, must register to bid).
 */
export function BidWidget({
  lot,
  recentBids = [],
  isAuthenticated,
  signInHref = "/login",
  onPlaceBid,
  className,
}: BidWidgetProps) {
  const [optimistic, setOptimistic] = React.useState<{
    currentBidMinor: number;
    bidCount: number;
    endAt: string;
  }>({
    currentBidMinor: lot.currentBidMinor ?? 0,
    bidCount: lot.bidCount,
    endAt: lot.endAt,
  });

  const minNext = nextMinimumBid({
    startingBidMinor: lot.startingBidMinor,
    currentBidMinor: optimistic.currentBidMinor || lot.currentBidMinor,
    bidIncrementMinor: lot.bidIncrementMinor,
  });

  const [amountInput, setAmountInput] = React.useState<string>(
    minorToMajor(minNext, lot.currency).toFixed(2)
  );
  const [maxInput, setMaxInput] = React.useState<string>("");
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const lotEnded =
    lot.status === "ended" ||
    lot.status === "sold" ||
    lot.status === "passed" ||
    lot.status === "cancelled" ||
    new Date(optimistic.endAt).getTime() <= Date.now();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    const amountMinor = majorToMinor(parseFloat(amountInput || "0"), lot.currency);
    const maxAmountMinor = maxInput ? majorToMinor(parseFloat(maxInput), lot.currency) : null;

    if (amountMinor < minNext) {
      setErr(`Bid must be at least ${formatMoney(minNext, lot.currency)}.`);
      return;
    }
    if (maxAmountMinor != null && maxAmountMinor < amountMinor) {
      setErr("Max proxy bid must be at least your current bid.");
      return;
    }

    setPending(true);
    try {
      const r = await onPlaceBid({ lotId: lot.id, amountMinor, maxAmountMinor });
      if (r.ok) {
        setOptimistic((prev) => ({
          currentBidMinor: r.lot?.currentBidMinor ?? amountMinor,
          bidCount: r.lot?.bidCount ?? prev.bidCount + 1,
          endAt: r.lot?.endAt ?? prev.endAt,
        }));
        setOk("Bid placed.");
        setAmountInput(minorToMajor(amountMinor + lot.bidIncrementMinor, lot.currency).toFixed(2));
      } else {
        setErr(r.reason ?? "Bid could not be placed.");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Bid failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5", className)}>
      {/* Status + countdown */}
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Time left</span>
          <CountdownTimer endAt={optimistic.endAt} size="lg" />
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {optimistic.currentBidMinor > 0 ? "Current bid" : "Starting bid"}
          </span>
          <span className="font-serif text-3xl font-medium tabular-nums">
            {formatMoney(optimistic.currentBidMinor || lot.startingBidMinor, lot.currency)}
          </span>
          <span className="text-xs text-muted-foreground">
            {optimistic.bidCount} {optimistic.bidCount === 1 ? "bid" : "bids"}
            {lot.reserveMinor != null && optimistic.currentBidMinor < lot.reserveMinor && " · reserve not met"}
          </span>
        </div>
      </div>

      {/* Bid form / sign-in gate / ended state */}
      {lotEnded ? (
        <div className="rounded-md bg-[hsl(var(--muted))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
          This auction has ended.
        </div>
      ) : !isAuthenticated ? (
        <a
          href={signInHref}
          className="inline-flex h-12 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-6 text-base font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
        >
          Sign in to bid
        </a>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your bid (min {formatMoney(minNext, lot.currency)})
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={minorToMajor(minNext, lot.currency)}
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="h-11 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Max proxy bid (optional)
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              placeholder="System will auto-bid up to this"
              className="h-11 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-6 text-base font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
          >
            {pending ? "Placing…" : "Place bid"}
          </button>
          {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
          {ok && <p className="text-sm text-[hsl(var(--primary))]">{ok}</p>}
        </form>
      )}

      {/* Recent bids */}
      {recentBids.length > 0 && (
        <div className="border-t border-[hsl(var(--border))] pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent bids
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {recentBids.slice(0, 8).map((b) => (
              <li key={b.id} className="flex items-baseline justify-between gap-3 tabular-nums">
                <span className="text-foreground/80">
                  {anonymizeName(b.bidderName ?? "Bidder")}
                </span>
                <span className="font-medium">{formatMoney(b.amountMinor, lot.currency)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(b.placedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function anonymizeName(name: string): string {
  // Show first name + initial of last name, e.g. "Jane S."
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${(parts[parts.length - 1]?.[0] ?? "").toUpperCase()}.`;
}
