import * as React from "react";
import { cx } from "../slot";

export type InputProps = React.ComponentProps<"input">;

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cx("eac-input", className)}
      {...props}
    />
  );
}

export type TextareaProps = React.ComponentProps<"textarea">;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cx("eac-textarea", className)}
      {...props}
    />
  );
}
