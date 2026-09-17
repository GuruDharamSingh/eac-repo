import * as React from "react";
import { Slot, cx } from "../slot";

// ============================================================================
// Button.
//
// The props are deliberately IDENTICAL to the shadcn copy this replaces —
// same `variant` names, same `size` names, same `asChild`, same pass-through
// `className`. That is what makes adopting it a one-line import change per
// file across 120 call sites rather than a rewrite of every screen.
//
// What changed is underneath: the variant no longer expands into forty
// Tailwind utility classes. It is written to `data-variant`, and
// primitives.css styles it from there. The old copies already emitted
// `data-variant` and `data-size` alongside their classes, so the seam was
// already cut — this just removes the classes and keeps the attributes.
// ============================================================================

export type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";

export type ButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Render the child element instead of a <button>, carrying these props.
   * Use it for a link that looks like a button — a <button> inside an <a> is
   * invalid HTML and browsers recover from it inconsistently.
   */
  asChild?: boolean;
}

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const shared = {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    className: cx("eac-button", className),
    ...props,
  };

  if (asChild) return <Slot {...shared} />;

  // A <button> inside a <form> submits by default, which has repeatedly been
  // the cause of an accidental submit when the author wanted a plain click
  // handler. Default to "button" and let a submit button say so explicitly.
  return <button type={type ?? "button"} {...shared} />;
}
