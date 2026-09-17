import * as React from "react";
import { Slot, cx } from "../slot";

// Badge. Same variant vocabulary as Button so the two are learned once.
// A badge is usually a <span> and purely a label; `asChild` covers the case
// where it is genuinely a link.

export type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";

export interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant;
  asChild?: boolean;
}

export function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: BadgeProps) {
  const shared = {
    "data-slot": "badge",
    "data-variant": variant,
    className: cx("eac-badge", className),
    ...props,
  };

  return asChild ? <Slot {...shared} /> : <span {...shared} />;
}
