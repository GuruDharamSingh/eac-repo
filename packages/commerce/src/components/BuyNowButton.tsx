"use client";

import * as React from "react";
import type { Artwork, ArtworkVariant } from "../types";
import { formatMoney } from "../money";
import { cn } from "./cn";

export interface BuyNowButtonProps {
  artwork: Pick<Artwork, "id" | "title" | "status" | "kind">;
  variant: Pick<ArtworkVariant, "id" | "priceMinor" | "currency" | "inventoryQty">;
  /** Server action / fetch handler that adds to cart and returns the new cart token. */
  onAdd: (input: {
    artworkId: string;
    artworkVariantId: string;
  }) => Promise<{ cartToken: string; redirectTo?: string }>;
  /** Default: 'window.location.assign(result.redirectTo ?? "/checkout")' */
  onSuccess?: (result: { cartToken: string; redirectTo?: string }) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}

/**
 * Buy-now button — single-piece purchase flow.
 * Headless: caller wires `onAdd` to whatever server action / API endpoint the
 * consuming app uses. Default redirect goes to /checkout.
 */
export function BuyNowButton({
  artwork,
  variant,
  onAdd,
  onSuccess,
  className,
  size = "lg",
  label,
}: BuyNowButtonProps) {
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const disabled =
    pending ||
    artwork.status === "sold" ||
    artwork.status === "reserved" ||
    artwork.status === "archived" ||
    variant.inventoryQty <= 0;

  const sizeCls = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  }[size];

  const click = async () => {
    setErr(null);
    setPending(true);
    try {
      const result = await onAdd({ artworkId: artwork.id, artworkVariantId: variant.id });
      if (onSuccess) onSuccess(result);
      else if (typeof window !== "undefined") {
        window.location.assign(result.redirectTo ?? "/checkout");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not add to cart.");
      setPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button
        type="button"
        onClick={click}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
          "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
          "hover:bg-[hsl(var(--primary))]/90",
          "disabled:opacity-50 disabled:pointer-events-none",
          sizeCls
        )}
      >
        {pending
          ? "Adding…"
          : artwork.status === "sold"
          ? "Sold"
          : artwork.status === "reserved"
          ? "Reserved"
          : (label ?? `Buy now · ${formatMoney(variant.priceMinor, variant.currency)}`)}
      </button>
      {err && <p className="text-sm text-[hsl(var(--destructive))]">{err}</p>}
    </div>
  );
}
