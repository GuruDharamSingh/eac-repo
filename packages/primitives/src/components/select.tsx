import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { cx } from "../slot";

// ============================================================================
// Select.
//
// The heaviest thing Radix earns its place on: a listbox that types ahead,
// keeps focus inside itself, positions against the viewport edge, and returns
// focus to the trigger on close. The 190-line copies in five apps were all
// styling over exactly this behaviour.
//
// Rendered in a portal, which is why primitives.css selects the content by
// data-slot rather than by descent from the trigger — the markup is not
// nested in the DOM even though it is nested in the JSX.
// ============================================================================

const Chevron = ({ up = false }: { up?: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    focusable="false"
    style={up ? { transform: "rotate(180deg)" } : undefined}
  >
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps
  extends React.ComponentProps<typeof SelectPrimitive.Trigger> {
  size?: "default" | "sm";
}

export function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cx("eac-select-trigger", className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <Chevron />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cx("eac-select-content", className)}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton data-slot="select-scroll-up">
          <Chevron up />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport data-slot="select-viewport">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton data-slot="select-scroll-down">
          <Chevron />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cx("eac-select-label", className)}
      {...props}
    />
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cx("eac-select-item", className)}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator data-slot="select-item-indicator">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cx("eac-select-separator", className)}
      {...props}
    />
  );
}
