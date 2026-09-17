"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Shows a text field; its value is passed to `onConfirm`. Omit for a plain yes/no confirm. */
  field?: { label: string; placeholder?: string };
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  pending?: boolean;
  onConfirm: (value?: string) => void;
}

/**
 * The one confirm/prompt surface for the app. Replaces `window.confirm` /
 * `window.prompt` — a native popup next to a designed console blocks the
 * whole page and cannot be styled, focus-trapped consistently, or told apart
 * from a browser warning.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  field,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  pending,
  onConfirm,
}: ConfirmDialogProps) {
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    if (open) setValue("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {field && (
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">{field.label}</label>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field.placeholder}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            disabled={pending}
            onClick={() => onConfirm(field ? value : undefined)}
          >
            {pending ? "…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
