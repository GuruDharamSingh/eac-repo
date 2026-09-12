"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * The package's own button. Deliberately not shadcn's: this is imported by
 * more than one app, and each has its own components/ui. The classes are
 * Tailwind over the shared shadcn TOKENS (--primary, --border…), which both
 * host apps define.
 */
export const SkyButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "outline" | "solid" | "soft" }
>(function SkyButton({ className, variant = "outline", ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:text-sm",
        variant === "outline" && "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        variant === "solid" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "soft" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        className,
      )}
      {...props}
    />
  );
});
