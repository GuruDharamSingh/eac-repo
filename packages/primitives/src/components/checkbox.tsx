import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { cx } from "../slot";

// The tick is an inline SVG rather than a lucide import, so the package keeps
// a single runtime dependency. Same call the blocks package made for the same
// reason — an icon library is a heavy way to draw one path.

export type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root>;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cx("eac-checkbox", className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator">
        {/* currentColor, so the tick follows --pr-accent-on with the fill. */}
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
