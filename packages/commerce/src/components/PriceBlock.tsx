import * as React from "react";
import { formatMoney, nextMinimumBid } from "../money";
import type { Artwork, ArtworkVariant, AuctionLot } from "../types";
import { cn } from "./cn";

export interface PriceBlockProps {
  artwork?: Pick<Artwork, "kind" | "status">;
  variant?: Pick<ArtworkVariant, "priceMinor" | "currency" | "label" | "editionNumber" | "editionTotal">;
  lot?: Pick<
    AuctionLot,
    "currentBidMinor" | "startingBidMinor" | "bidIncrementMinor" | "buyNowMinor" | "currency" | "bidCount" | "status"
  > | null;
  /** Visual size variant */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Renders a price block — adapts to fixed-price vs auction.
 * Auction layout: current/starting bid + bid count + optional Buy Now.
 * Fixed: price + edition info if applicable.
 *
 * Stateless / pure — safe to use in server components.
 */
export function PriceBlock({ artwork, variant, lot, size = "md", className }: PriceBlockProps) {
  const sizes = {
    sm: { label: "text-[11px]", value: "text-base", sub: "text-xs" },
    md: { label: "text-xs", value: "text-2xl", sub: "text-sm" },
    lg: { label: "text-sm", value: "text-4xl", sub: "text-base" },
  }[size];

  if (lot && lot.status !== "ended") {
    const display = lot.currentBidMinor ?? lot.startingBidMinor;
    const labelText = lot.currentBidMinor != null ? "Current bid" : "Starting bid";
    const nextMin = nextMinimumBid({
      startingBidMinor: lot.startingBidMinor,
      currentBidMinor: lot.currentBidMinor,
      bidIncrementMinor: lot.bidIncrementMinor,
    });
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <span className={cn("uppercase tracking-wider text-muted-foreground", sizes.label)}>{labelText}</span>
        <span className={cn("font-serif font-medium tabular-nums", sizes.value)}>
          {formatMoney(display, lot.currency)}
        </span>
        <span className={cn("text-muted-foreground", sizes.sub)}>
          {lot.bidCount} {lot.bidCount === 1 ? "bid" : "bids"}
          {" · "}
          next bid {formatMoney(nextMin, lot.currency)}
          {lot.buyNowMinor ? `  ·  Buy now ${formatMoney(lot.buyNowMinor, lot.currency)}` : ""}
        </span>
      </div>
    );
  }

  if (variant) {
    const editionLine =
      variant.editionNumber && variant.editionTotal
        ? `Edition ${variant.editionNumber} of ${variant.editionTotal}`
        : variant.label || null;
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {artwork?.status === "sold" ? (
          <span className={cn("uppercase tracking-wider text-muted-foreground", sizes.label)}>Sold</span>
        ) : (
          <span className={cn("uppercase tracking-wider text-muted-foreground", sizes.label)}>Price</span>
        )}
        <span className={cn("font-serif font-medium tabular-nums", sizes.value)}>
          {formatMoney(variant.priceMinor, variant.currency)}
        </span>
        {editionLine && <span className={cn("text-muted-foreground", sizes.sub)}>{editionLine}</span>}
      </div>
    );
  }

  return (
    <span className={cn("text-muted-foreground italic", sizes.sub, className)}>
      Price on request
    </span>
  );
}
