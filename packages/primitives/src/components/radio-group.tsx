import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cx } from "../slot";

// Radio groups are the clearest case for keeping Radix. A group has ONE tab
// stop and arrow keys move between options (roving tabindex) — hand-rolling
// that is where home-made radio groups usually break for keyboard users.

export type RadioGroupProps = React.ComponentProps<typeof RadioGroupPrimitive.Root>;

export function RadioGroup({ className, ...props }: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cx("eac-radio-group", className)}
      {...props}
    />
  );
}

export type RadioGroupItemProps = React.ComponentProps<typeof RadioGroupPrimitive.Item>;

export function RadioGroupItem({ className, ...props }: RadioGroupItemProps) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cx("eac-radio", className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" />
    </RadioGroupPrimitive.Item>
  );
}
