"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A hub tile: real information on its face, the full feature in a modal.
 *
 * That split is the load-time budget. Every tile is server-rendered with the
 * few fields it draws — the next meeting's date, four filenames, three idea
 * titles — so the hub arrives informative on first paint. Nothing fetches on
 * mount. The modal is where the rest lives, and its content fetches when it
 * opens, so eight features cost one page's worth of queries instead of eight.
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
  preview,
  onOpen,
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
  /**
   * Drawn on the tile face, under the blurb. Server-rendered content, so it
   * costs nothing on the client and is visible before any JS runs.
   */
  preview?: ReactNode;
  /** Called the first time the modal opens — where a panel loads its data. */
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    // Fire once: a panel that refetched on every open would undo the point of
    // deferring the fetch in the first place.
    if (open && !opened.current) {
      opened.current = true;
      onOpen?.();
    }
  }, [open, onOpen]);

  const body = (
    <>
      <span className="hub-card-glyph" aria-hidden>
        {glyph}
      </span>
      <span className="hub-card-title">{title}</span>
      <span className="hub-card-blurb">{blurb}</span>
      {preview && <span className="hub-card-preview">{preview}</span>}
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
