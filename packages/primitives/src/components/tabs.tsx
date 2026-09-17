import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cx } from "../slot";

// Two looks, matching the copies this replaces: `default` is a segmented
// control on a rail, `line` is an underline. The variant is written to
// data-variant on the LIST, and primitives.css reaches the triggers from
// there — the copies did the same thing with Tailwind group-data selectors.

export type TabsListVariant = "default" | "line";

export type TabsProps = React.ComponentProps<typeof TabsPrimitive.Root>;

export function Tabs({ className, ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cx("eac-tabs", className)} {...props} />
  );
}

export interface TabsListProps extends React.ComponentProps<typeof TabsPrimitive.List> {
  variant?: TabsListVariant;
}

export function TabsList({ className, variant = "default", ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cx("eac-tabs-list", className)}
      {...props}
    />
  );
}

export type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Trigger>;

export function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cx("eac-tabs-trigger", className)}
      {...props}
    />
  );
}

export type TabsContentProps = React.ComponentProps<typeof TabsPrimitive.Content>;

export function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cx("eac-tabs-content", className)}
      {...props}
    />
  );
}
