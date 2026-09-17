import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status tones, not raw colours. Every status badge in the app (artwork,
 * lot, order) reduces to one of these four states — reuse the tone instead
 * of picking a new Tailwind palette colour per status, which is how the
 * studio and admin consoles ended up with unrelated ad hoc colours (and no
 * dark-mode variants) while orders/[id] already had it right.
 */
const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        /** Closed out: draft, cancelled, refunded, archived, sold/ended/passed. */
        neutral: "bg-muted text-muted-foreground",
        /** Needs attention or is in progress: awaiting payment, reserved, scheduled. */
        pending: "bg-accent text-accent-foreground",
        /** On track / good news: available, live, paid, shipped, completed. */
        success: "bg-primary text-primary-foreground",
        /** Something went wrong. */
        destructive: "bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}

export { badgeVariants };
