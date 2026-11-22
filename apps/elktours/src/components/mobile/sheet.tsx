"use client";

import type { ReactNode } from "react";
import { Dialog } from "radix-ui";
import { cx } from "./cx";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Taller sheet (up to 92% of the screen) for long content. */
  tall?: boolean;
  /** Accessible name. Screens draw their own visible heading inside. */
  title: string;
  children: ReactNode;
}

/** Bottom sheet on the radix Dialog: scrim tap and Esc close, focus is trapped, scroll is locked. */
export function Sheet({ open, onOpenChange, tall, title, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="m-scrim" />
        <Dialog.Content className={cx("m-sheet", tall && "m-sheet-tall")} aria-describedby={undefined}>
          <Dialog.Title className="m-sr">{title}</Dialog.Title>
          <div className="m-grab" aria-hidden="true" />
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
