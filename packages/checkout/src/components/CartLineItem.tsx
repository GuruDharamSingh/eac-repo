"use client";

import * as React from "react";
import type { CartLine } from "@elkdonis/commerce/types";
import { formatMoney } from "@elkdonis/commerce/money";
import { cn } from "./cn";

export interface CartLineItemProps {
  line: CartLine;
  onRemove?: (lineId: string) => void | Promise<void>;
  /** Precomputed href to the artwork detail page (must be a string — this is a client component). */
  artworkHref?: string;
  className?: string;
}

export function CartLineItem({ line, onRemove, artworkHref, className }: CartLineItemProps) {
  const [pending, setPending] = React.useState(false);
  const subtotal = line.unitPriceMinor * line.quantity;
  const href = artworkHref ?? (line.artwork ? `/artworks/${line.artwork.id}` : "#");

  const remove = async () => {
    if (!onRemove) return;
    setPending(true);
    try {
      await onRemove(line.id);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("flex items-start gap-4 py-4", className)}>
      <a href={href} className="block aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-md bg-[hsl(var(--muted))] sm:w-24">
        {line.artwork?.primaryImageUrl ? (
          <img
            src={line.artwork.primaryImageUrl}
            alt={line.artwork.primaryImageAlt ?? line.artwork.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </a>
      <div className="min-w-0 flex-1">
        <a href={href} className="block truncate font-serif text-base underline-offset-4 hover:underline">
          {line.artwork?.title ?? "Artwork"}
        </a>
        {line.artwork?.artistName && (
          <p className="mt-0.5 truncate text-sm text-[hsl(var(--muted-foreground))]">
            {line.artwork.artistName}
          </p>
        )}
        {line.notes && (
          <p className="mt-1 text-xs italic text-[hsl(var(--muted-foreground))]">{line.notes}</p>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="mt-2 text-xs text-[hsl(var(--muted-foreground))] underline-offset-4 hover:text-[hsl(var(--foreground))] hover:underline disabled:opacity-50"
          >
            {pending ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5 tabular-nums">
        <span className="font-medium">{formatMoney(subtotal, line.currency)}</span>
        {line.quantity > 1 && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {line.quantity} × {formatMoney(line.unitPriceMinor, line.currency)}
          </span>
        )}
      </div>
    </div>
  );
}
