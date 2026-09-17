import * as React from "react";
import type { Artwork } from "../types";
import { ProductCard, type ProductCardProps } from "./ProductCard";

export interface ProductGridProps
  extends Omit<ProductCardProps, "artwork" | "href" | "artistHref" | "actions"> {
  items: Artwork[];
  /** Per-card overrides the grid cannot know: hrefs, buttons. */
  hrefBuilder?: (a: Artwork) => string;
  artistHrefBuilder?: (a: Artwork) => string | null;
  renderActions?: (a: Artwork) => React.ReactNode;
  /** Card width band. `tight` ≈ 11rem, `normal` ≈ 15rem, `loose` ≈ 19rem. */
  density?: "tight" | "normal" | "loose";
  /** Passed to every card, and to the grid so it can set the hang height. */
  variant?: "wall" | "tile";
  /** Narrowest a card may get before a column is dropped, e.g. "17rem". */
  minCardWidth?: string;
  emptyState?: React.ReactNode;
  /** Accessible name for the list, e.g. "Live auctions". */
  label?: string;
  className?: string;
}

/**
 * A grid of {@link ProductCard}s.
 *
 * Columns come from the available width, not from viewport breakpoints: these
 * cards are dropped into containers whose width the grid cannot predict — a
 * profile page's half-width section, an org site's sidebar — where a
 * `xl:grid-cols-4` describes the window rather than the box it is actually in.
 *
 * A `<ul>` rather than bare `<div>`s, so the count is announced once instead
 * of every card being an unrelated island.
 */
export function ProductGrid({
  items,
  hrefBuilder,
  artistHrefBuilder,
  renderActions,
  density = "normal",
  variant = "wall",
  minCardWidth,
  emptyState,
  label,
  className,
  ...cardProps
}: ProductGridProps) {
  if (items.length === 0) {
    return <>{emptyState ?? <p className="eac-commerce">Nothing listed yet.</p>}</>;
  }

  return (
    <ul
      className={["eac-commerce", "eac-pc-grid", className].filter(Boolean).join(" ")}
      data-density={density}
      data-variant={variant}
      aria-label={label}
      style={minCardWidth ? ({ "--pc-min": minCardWidth } as React.CSSProperties) : undefined}
    >
      {items.map((a) => (
        <li key={a.id}>
          <ProductCard
            artwork={a}
            href={hrefBuilder?.(a)}
            artistHref={artistHrefBuilder?.(a)}
            actions={renderActions?.(a)}
            variant={variant}
            {...cardProps}
          />
        </li>
      ))}
    </ul>
  );
}
