"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { editItem } from "@elkdonis/blocks/edit-item";
import { hex, lookup, pieceHref, tint, type Piece } from "./artwork-data";
import { PieceCard } from "./piece-card";
import { lookOf } from "./looks";
import { pourSwatch } from "./swatch";
import { PiecePopup } from "./piece-popup";
import type { ArtworkGridProps } from "./artwork-grid";

// ============================================================================
// The grid and its popup.
//
// Cards are real links to /pieces/<slug> (piece-card.tsx). With `cardClick:
// "popup"` (not the default since 2026-11-07) a plain left click
// is intercepted here, by delegation on the list, and opens the popup — a
// self-contained native <dialog> rather than the network's SurfaceProvider,
// because the block has to draw inside Puck's iframe as well as on the page,
// and a provider in the root layout would not reach the canvas. It still
// behaves like a surface: it morphs in from the clicked card, Escape and a
// click outside close it, `?piece=<id>` deep-links to it, and "Open full
// page" leads to the piece's own page.
// ============================================================================

const ASPECTS: Record<string, string> = { "1:1": "1 / 1", "4:5": "4 / 5", "3:4": "3 / 4", "2:3": "2 / 3" };
const PIECE_PARAM = "piece";

interface Entry {
  piece: Piece;
  caption: string | null;
  /** Its row in `chosen`, when hand-picked — so the editor opens that row. */
  row?: number;
}

export function ArtworkGrid({
  heading,
  look,
  intro = "",
  source = "store",
  chosen,
  limit = 24,
  cardClick = "page",
  minColumn = 260,
  gap = 28,
  aspect = "4:5",
  topShape = "rounded",
  radius = 10,
  imageFit = "cover",
  captionPosition = "below",
  showPrice = true,
  showMedium = true,
  showDimensions = false,
  showStatus = true,
  priceFormat = "plain",
  hover = "lift",
  cardBg,
  cardInk,
  accent,
  titleSize = 18,
  metaSize = 13,
  popupWidth = "standard",
  popupBackdrop,
  popupBackdropOpacity = 70,
  popupImageSide = "left",
  popupRadius = 16,
  buyLabel = "Also listed on Collect Art",
  addToCartLabel = "Add to cart",
  emptyText = "New pieces are coming out of the kiln. Check back soon.",
  pieces = [],
  bound,
  hrefBase = "/pieces",
}: ArtworkGridProps) {
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] =
      source === "chosen"
        ? (chosen ?? []).flatMap((row, index) => {
            const piece = lookup(bound, row.artwork);
            if (!piece) return [];
            const caption = typeof row.caption === "string" ? row.caption.trim() : "";
            return [{ piece, caption: caption || null, row: index }];
          })
        : pieces.map((piece) => ({ piece, caption: null }));
    return list.filter((e) => e.piece.image).slice(0, Math.max(0, limit));
  }, [source, chosen, bound, pieces, limit]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.piece.id, e.piece])), [entries]);

  // ── the popup ─────────────────────────────────────────────────────────────
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<Piece | null>(null);
  const [origin, setOrigin] = useState("50% 50%");

  const openPiece = useCallback((piece: Piece, from?: HTMLElement | null) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (from) {
      // Grow out of the card that was clicked, in the canvas's own window.
      const win = from.ownerDocument.defaultView ?? window;
      const r = from.getBoundingClientRect();
      setOrigin(`${(((r.left + r.width / 2) / win.innerWidth) * 100).toFixed(1)}% ${(((r.top + r.height / 2) / win.innerHeight) * 100).toFixed(1)}%`);
    }
    setOpen(piece);
    if (!dialog.open) dialog.showModal();
    const win = dialog.ownerDocument.defaultView;
    if (win) {
      const url = new URL(win.location.href);
      url.searchParams.set(PIECE_PARAM, piece.id);
      // The Studio canvas is an about:srcdoc frame, where a URL change throws.
      try {
        win.history.replaceState(win.history.state, "", url);
      } catch {
        /* no deep link in the canvas */
      }
    }
  }, []);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  }, []);

  // The dialog's own close (Escape, our button, a click outside) ends here.
  const onClosed = useCallback(() => {
    setOpen(null);
    const win = dialogRef.current?.ownerDocument.defaultView;
    if (win) {
      const url = new URL(win.location.href);
      if (url.searchParams.has(PIECE_PARAM)) {
        url.searchParams.delete(PIECE_PARAM);
        try {
          win.history.replaceState(win.history.state, "", url);
        } catch {
          /* about:srcdoc (the Studio canvas) */
        }
      }
    }
  }, []);

  // Deep link: /?piece=<id> opens that piece once the grid has it.
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current) return;
    const win = dialogRef.current?.ownerDocument.defaultView;
    if (!win) return;
    const id = new URL(win.location.href).searchParams.get(PIECE_PARAM);
    const hit = id ? byId.get(id) : undefined;
    if (!hit) return;
    linked.current = true;
    openPiece(hit);
  }, [byId, openPiece]);

  // `cardClick: "page"` (the default): the card is a plain link to the
  // piece's page. "popup": a plain left click opens the popup; anything else
  // (middle click, modifier keys, no JS) still follows the link. A shared
  // `?piece=<id>` link opens the popup either way.
  const onListClick = (e: MouseEvent<HTMLUListElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (pourSwatch(e.target)) return;
    if (cardClick !== "popup") return;
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-piece]");
    if (!a || !e.currentTarget.contains(a)) return;
    const piece = byId.get(a.dataset.piece ?? "");
    if (!piece) return;
    e.preventDefault();
    openPiece(piece, a);
  };

  const onDialogClick = (e: MouseEvent<HTMLDialogElement>) => {
    // The dialog fills the viewport and IS the backdrop: a click on it, and
    // not on the panel inside, closes.
    if (e.target === e.currentTarget) close();
  };

  // ── the look, from the fields ─────────────────────────────────────────────
  const vars: Record<string, string> = {
    "--ktp-col": `${minColumn}px`,
    "--ktp-gap": `${gap}px`,
    "--ktp-radius": `${radius}px`,
    "--ktp-title-size": `${titleSize}px`,
    "--ktp-meta-size": `${metaSize}px`,
    "--ktp-pop-radius": `${popupRadius}px`,
    "--ktp-pop-backdrop": tint(popupBackdrop, popupBackdropOpacity) ?? `color-mix(in srgb, var(--blk-fg) ${Math.round(popupBackdropOpacity)}%, transparent)`,
    "--ktp-origin": origin,
  };
  if (aspect !== "auto") vars["--ktp-aspect"] = ASPECTS[aspect] ?? "4 / 5";
  const bg = hex(cardBg);
  if (bg) vars["--ktp-card-bg"] = bg;
  const ink = hex(cardInk);
  if (ink) vars["--ktp-card-ink"] = ink;
  const a = hex(accent);
  if (a) {
    vars["--blk-accent"] = a;
    vars["--blk-accent-ink"] = `color-mix(in srgb, ${a} 60%, black)`;
  }

  // A "More pieces" grid with no neighbours (a store of one) draws nothing.
  if (source === "more" && entries.length === 0) return null;
  const title = typeof heading === "string" ? heading.trim() : "";
  const sampled = entries.length > 0 && entries.every((e) => e.piece.id.startsWith("sample-"));
  const cardOpts = { showPrice, showMedium, showDimensions, showStatus, priceFormat, minColumn, hrefBase };

  return (
    <section
      className="blk ktp-works"
      data-shape={topShape}
      data-fit={imageFit}
      data-caption={captionPosition}
      data-hover={hover}
      data-aspect={aspect}
      data-pop-width={popupWidth}
      data-pop-side={popupImageSide}
      style={vars as CSSProperties}
    >
      {title || intro ? (
        <header className="ktp-works-head">
          {title ? <h2 className="ktp-works-title">{title}</h2> : null}
          {intro ? <p className="ktp-works-intro">{intro}</p> : null}
        </header>
      ) : null}
      {sampled && hrefBase === "/pieces" ? (
        <p className="ktp-works-note">Sample pieces — the real ones appear once the store has listings.</p>
      ) : null}

      {entries.length === 0 ? (
        <p className="ktp-works-empty">{source === "chosen" ? "No pieces chosen yet." : emptyText}</p>
      ) : (
        <ul className="ktp-grid" onClick={onListClick}>
          {entries.map(({ piece, caption, row }, i) => (
            <PieceCard
              key={`${piece.id}-${i}`}
              piece={piece}
              caption={caption}
              // Lazy for every card: an eager <img> with a srcset makes React
              // 19 hoist a <link preload> whose chosen candidate can differ
              // from the browser's, and Chrome warns about each unused one.
              opts={cardOpts}
              look={lookOf(look)}
              {...(row === undefined ? {} : editItem("chosen", row))}
            />
          ))}
        </ul>
      )}

      <dialog ref={dialogRef} className="ktp-dialog" data-look={lookOf(look) ?? undefined} onClose={onClosed} onClick={onDialogClick} aria-label={open?.title ?? "Piece"}>
        {open ? (
          <PiecePopup piece={open} onClose={close} buyLabel={buyLabel} addToCartLabel={addToCartLabel} priceFormat={priceFormat} pageHref={pieceHref(open, hrefBase)} />
        ) : null}
      </dialog>
    </section>
  );
}
