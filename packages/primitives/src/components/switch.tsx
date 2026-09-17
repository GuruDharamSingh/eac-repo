import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cx } from "../slot";

export type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root>;

export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cx("eac-switch", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" />
    </SwitchPrimitive.Root>
  );
}
