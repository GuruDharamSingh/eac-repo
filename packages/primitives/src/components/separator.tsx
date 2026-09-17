import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";
import { cx } from "../slot";

// Radix is here for one reason: `decorative` decides whether the rule is
// announced as a semantic separator or hidden from assistive tech. A bare
// <div> gets that wrong silently, and it is the sort of detail nobody notices
// until someone navigating by screen reader hits a wall of unlabelled rules.

export type SeparatorProps = React.ComponentProps<typeof SeparatorPrimitive.Root>;

export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cx("eac-separator", className)}
      {...props}
    />
  );
}
