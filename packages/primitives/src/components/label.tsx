import * as React from "react";
import { cx } from "../slot";

// ============================================================================
// Label.
//
// A plain <label>, where the shadcn copy wrapped @radix-ui/react-label. Radix's
// version exists to fix a Safari quirk about clicking a label that contains a
// control; modern Safari handles it, and the dependency was costing every app
// a package for one element. If that quirk resurfaces, the fix belongs here.
//
// `htmlFor` is a normal <label> prop and passes straight through — which is
// the thing that actually matters for accessibility, and which a wrapper can
// only get in the way of.
// ============================================================================

export type LabelProps = React.ComponentProps<"label">;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label data-slot="label" className={cx("eac-label", className)} {...props} />
  );
}
