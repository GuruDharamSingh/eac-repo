import * as React from "react";
import type { AuctionLot } from "../types";
import { cn } from "./cn";

export interface AuctionStatusBadgeProps {
  lot: Pick<AuctionLot, "status" | "endAt" | "currentBidMinor" | "reserveMinor"> | null | undefined;
  className?: string;
}

/**
 * Visual badge for an auction lot. Reads status + reserve to show:
 *   LIVE / ENDING SOON / ENDED / RESERVE NOT MET / RESERVE MET
 */
export function AuctionStatusBadge({ lot, className }: AuctionStatusBadgeProps) {
  if (!lot) return null;

  const now = Date.now();
  const endMs = new Date(lot.endAt).getTime();
  const minutesLeft = (endMs - now) / 60000;

  let label = "Live auction";
  let tone = "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]";

  if (lot.status === "ended" || lot.status === "sold" || lot.status === "passed") {
    label = lot.status === "sold" ? "Sold at auction" : "Auction ended";
    tone = "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]";
  } else if (lot.status === "scheduled") {
    label = "Auction soon";
    tone = "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]";
  } else if (minutesLeft <= 60 && minutesLeft > 0) {
    label = "Ending soon";
    tone = "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
        tone,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
