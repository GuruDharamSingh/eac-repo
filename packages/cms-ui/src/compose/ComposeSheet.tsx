"use client";

import * as React from "react";
import type { ComposeOption } from "./catalogue";

// ============================================================================
// The compose popup, shared by every hub.
//
// Two panes: pick what you are making, then make it. The picker is skipped
// when a hub opens the sheet on a specific kind — clicking the "Article" card
// should not then ask you what you want to write.
//
// It is a plain <dialog>-less overlay rather than Radix, because cms-ui is
// consumed by apps that each carry their own component library and this
// package deliberately depends on neither. The behaviour that actually matters
// for a modal is implemented directly: Escape closes, focus moves in on open
// and returns to the trigger on close, the background is inert to scroll, and
// the panel is labelled.
//
// Rendering the FORM is the host app's job — it owns the server action, its
// media picker, and its own inputs. This owns the shell and the catalogue, so
// two hubs presenting the same choice present it the same way.
// ============================================================================

export interface ComposeSheetProps {
  open: boolean;
  onClose: () => void;
  /** Everything this org can make. One entry renders no picker. */
  options: ComposeOption[];
  /** Controlled selection, so a hub can open straight into a kind. */
  selected: ComposeOption | null;
  onSelect: (option: ComposeOption) => void;
  /**
   * Return to the picker. Omit when the hub opened straight into a kind and
   * there is nothing to go back to — the control is then not rendered.
   */
  onBack?: () => void;
  /** The chosen kind's form. Rendered once something is selected. */
  children?: React.ReactNode;
  title?: string;
}

export function ComposeSheet({
  open,
  onClose,
  options,
  selected,
  onSelect,
  onBack,
  children,
  title = "Compose",
}: ComposeSheetProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const returnFocusTo = React.useRef<Element | null>(null);

  React.useEffect(() => {
    if (!open) return;

    returnFocusTo.current = document.activeElement;
    // Focus the panel itself rather than the first control: the first thing
    // here is a choice, and jumping into a text input would skip it.
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      // Returning focus is what makes this usable from a keyboard: without it
      // the next Tab starts from the top of the document.
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onMouseDown={(e) => {
        // Only a click that both starts and ends on the backdrop closes —
        // otherwise a text selection that drags out of the panel dismisses
        // the form and loses the draft.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={selected ? `${title}: ${selected.title}` : title}
        tabIndex={-1}
        className="my-auto w-full max-w-2xl rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-lg outline-none"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[hsl(var(--border))] px-5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              {selected ? selected.title : title}
            </p>
            {selected && (
              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                {selected.blurb}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md px-2 py-1 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-4">
          {selected ? (
            <>
              {onBack && options.length > 1 && (
                <button
                  type="button"
                  onClick={onBack}
                  className="mb-3 text-xs text-[hsl(var(--muted-foreground))] underline-offset-2 hover:underline"
                >
                  ← Something else
                </button>
              )}
              {children}
            </>
          ) : (
            <ComposePicker options={options} onSelect={onSelect} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The catalogue, on its own.
 *
 * Exported because a hub may want the CMS as a page rather than a popup — the
 * same grid, rendered inline, with no modal around it.
 */
export function ComposePicker({
  options,
  onSelect,
}: {
  options: ComposeOption[];
  onSelect: (option: ComposeOption) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        There is nothing to compose here yet.
      </p>
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const inner = (
          <>
            <span aria-hidden className="text-lg text-[hsl(var(--muted-foreground))]">
              {option.icon}
            </span>
            <span className="space-y-0.5">
              <span className="block text-sm font-medium text-[hsl(var(--foreground))]">
                {option.title}
              </span>
              <span className="block text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                {option.blurb}
              </span>
            </span>
          </>
        );

        const cls =
          "flex w-full items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-left transition-colors hover:border-[hsl(var(--foreground))]/30 hover:bg-[hsl(var(--muted))]/40";

        return (
          <li key={option.id}>
            {option.mode === "route" && option.href ? (
              // A kind whose authoring is too large for a popup navigates
              // instead — the workshop wizard is ten manifest-derived steps.
              <a href={option.href} className={cls}>
                {inner}
              </a>
            ) : (
              <button type="button" onClick={() => onSelect(option)} className={cls}>
                {inner}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
