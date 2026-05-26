import * as React from "react";
import type { Artwork } from "../types";
import { ArtworkCard, type ArtworkCardProps } from "./ArtworkCard";
import { cn } from "./cn";

export interface ArtworkGridProps
  extends Omit<ArtworkCardProps, "artwork"> {
  items: Artwork[];
  columns?: 2 | 3 | 4 | 5;
  gap?: "tight" | "normal" | "loose";
  className?: string;
  emptyState?: React.ReactNode;
}

/**
 * Responsive grid of ArtworkCards.
 *
 * Embeddable anywhere — accepts the same routing props as ArtworkCard so a
 * consuming app can rewrite hrefs (e.g. when embedded on an artist subdomain
 * the cards might link to the central Art-Auction app instead of in-app).
 */
export function ArtworkGrid({
  items,
  columns = 4,
  gap = "normal",
  className,
  emptyState,
  ...cardProps
}: ArtworkGridProps) {
  if (items.length === 0) {
    return <>{emptyState ?? <p className="text-muted-foreground">No artworks to show.</p>}</>;
  }

  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  }[columns];

  const gapCls = { tight: "gap-4", normal: "gap-6 md:gap-8", loose: "gap-8 md:gap-12" }[gap];

  return (
    <div className={cn("grid", gridCols, gapCls, className)}>
      {items.map((a) => (
        <ArtworkCard key={a.id} artwork={a} {...cardProps} />
      ))}
    </div>
  );
}
