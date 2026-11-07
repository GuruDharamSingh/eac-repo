"use client";

import { useCallback, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { pieceHref, type Piece } from "./artwork-data";
import { PiecePopup } from "./piece-popup";
import { pourSwatch } from "./swatch";

/**
 * The popup for a LONE card (ktp-piece), as a small client island around the
 * server-rendered card: the block itself stays a server component (so it gets
 * Puck's `isEditing` and can be placed anywhere), and only this wrapper ships
 * script. It intercepts a plain left click on its own `a[data-piece]` and opens
 * the same <dialog> and PiecePopup the grid uses. In the editor (`editing`) it
 * intercepts nothing, so a click selects the block instead.
 */
export function PopupHost({
  piece,
  editing,
  cardOpens = true,
  hrefBase = "/pieces",
  buyLabel = "Also listed on Collect Art",
  addToCartLabel = "Add to cart",
  priceFormat = "plain",
  look = null,
  children,
}: {
  piece: Piece;
  editing: boolean;
  /** Whether a click on the CARD opens the popup (else it follows the link to the piece's page). A "View: open the popup" button always does. */
  cardOpens?: boolean;
  hrefBase?: string;
  buyLabel?: string;
  addToCartLabel?: string;
  priceFormat?: string;
  /** The card's own look, so the popup wears it too (else it follows the row / site). */
  look?: string | null;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");

  const onClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (editing || e.defaultPrevented) return;
      if (pourSwatch(e.target)) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-piece]");
      if (!a || !e.currentTarget.contains(a)) return;
      if (!cardOpens && a.classList.contains("ktp-card-link")) return;
      e.preventDefault();
      const win = a.ownerDocument.defaultView ?? window;
      const r = a.getBoundingClientRect();
      setOrigin(`${(((r.left + r.width / 2) / win.innerWidth) * 100).toFixed(1)}% ${(((r.top + r.height / 2) / win.innerHeight) * 100).toFixed(1)}%`);
      setOpen(true);
      dialogRef.current?.showModal();
    },
    [editing, cardOpens]
  );
  const close = () => dialogRef.current?.close();

  return (
    <div className="ktp-popup-host" onClick={onClick}>
      {children}
      <dialog
        ref={dialogRef}
        className="ktp-dialog"
        data-look={look || undefined}
        style={{ "--ktp-origin": origin, "--ktp-pop-backdrop": "color-mix(in srgb, var(--blk-fg) 70%, transparent)", "--ktp-pop-radius": "16px" } as CSSProperties}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        aria-label={piece.title}
      >
        {open ? (
          <PiecePopup piece={piece} onClose={close} buyLabel={buyLabel} addToCartLabel={addToCartLabel} priceFormat={priceFormat} pageHref={pieceHref(piece, hrefBase)} />
        ) : null}
      </dialog>
    </div>
  );
}
