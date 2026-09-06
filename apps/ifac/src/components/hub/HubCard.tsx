"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A square hub tile that opens a modal for its feature.
 *
 * Uses the native <dialog> element rather than a library: IFAC has no UI
 * dependencies at all (no Tailwind, no Mantine, no Radix), and <dialog>
 * already gives a backdrop, Escape-to-close, focus trapping and correct
 * accessibility semantics. Adding a modal library for this would be the first
 * runtime dependency this app has ever needed.
 */
export function HubCard({
  title,
  blurb,
  glyph,
  accent = "ink",
  href,
  wide = false,
  children,
}: {
  title: string;
  blurb: string;
  /** Short mark drawn in the tile corner — a letter or symbol, not an icon set. */
  glyph: string;
  accent?: "ink" | "oxide" | "moss" | "blue" | "gold" | "charcoal";
  /** When set the tile navigates instead of opening a modal. */
  href?: string;
  wide?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const body = (
    <>
      <span className="hub-card-glyph" aria-hidden>
        {glyph}
      </span>
      <span className="hub-card-title">{title}</span>
      <span className="hub-card-blurb">{blurb}</span>
    </>
  );

  const className = `hub-card hub-card--${accent}${wide ? " hub-card--wide" : ""}`;

  if (href) {
    return (
      <a className={className} href={href}>
        {body}
        <span className="hub-card-cue" aria-hidden>
          &rarr;
        </span>
      </a>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {body}
        <span className="hub-card-cue" aria-hidden>
          +
        </span>
      </button>

      <dialog
        ref={ref}
        className="hub-dialog"
        onClose={() => setOpen(false)}
        // Clicking the backdrop (the dialog element itself, outside the panel)
        // closes it; clicks inside the panel stop at the panel.
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
      >
        <div className="hub-dialog-panel">
          <header className="hub-dialog-head">
            <h2>{title}</h2>
            <button
              type="button"
              className="hub-dialog-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              &times;
            </button>
          </header>
          <div className="hub-dialog-body">{children}</div>
        </div>
      </dialog>
    </>
  );
}
