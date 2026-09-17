"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BookPage } from "@/lib/types";

interface BookLeafProps {
  title: string;
  pages: BookPage[];
  /** Page NUMBER (as printed) to open on; falls back to the first page. */
  initialPage?: number | null;
  /** Fired on any interaction, so a carousel can stop auto-advancing. */
  onInteract?: () => void;
}

/**
 * A page of the book, rendered as a sheet of paper you peer at.
 *
 * Two gestures, on two axes, so they cannot be mistaken for each other:
 *   - horizontal: the halves of the sheet turn to the previous / next page
 *   - vertical:   dragging (or scrolling) the sheet reads further down it
 *
 * The scroller is a native scroll container (see site.css), so the drag
 * handler here is only an extra affordance for a mouse — it nudges scrollTop.
 * Touch and wheel already work without it.
 */
export function BookLeaf({ title, pages, initialPage, onInteract }: BookLeafProps) {
  const startIndex = Math.max(
    0,
    initialPage != null ? pages.findIndex((p) => p.number === initialPage) : 0
  );
  const [index, setIndex] = useState(startIndex);
  const [dragging, setDragging] = useState(false);
  const [more, setMore] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);

  const page = pages[index];
  const canPrev = index > 0;
  const canNext = index < pages.length - 1;

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, []);

  // Re-measure when the page changes or the sheet is resized.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = 0;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, measure]);

  const turn = (dir: -1 | 1) => {
    onInteract?.();
    setIndex((i) => Math.min(pages.length - 1, Math.max(0, i + dir)));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Touch gets the native scroller; only mouse/pen need the drag shim.
    if (e.pointerType === "touch" || e.button !== 0) return;
    // Not from the turn buttons. Capturing the pointer here retargets the
    // following click to the SHEET, so the button never receives it — the
    // page simply would not turn, with nothing in the console to say why.
    if ((e.target as Element).closest("button")) return;
    const el = scroller.current;
    if (!el) return;
    drag.current = { y: e.clientY, top: el.scrollTop, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = scroller.current;
    if (!d || !el) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 3) d.moved = true;
    el.scrollTop = d.top - dy;
    measure();
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    if (drag.current.moved) onInteract?.();
    drag.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); turn(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); turn(-1); }
  };

  if (!page) {
    return (
      <div className="leaf">
        <div className="leaf__sheet" data-dragging="false" data-more="false">
          <div className="leaf__scroller">
            <p className="leaf__chapter">{title}</p>
            <p>No pages have been transcribed yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="leaf">
      <div
        className="leaf__sheet"
        data-dragging={dragging}
        data-more={more}
        tabIndex={0}
        role="region"
        aria-label={`${title}, page ${page.number}. Use the arrow keys to turn the page.`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          ref={scroller}
          className="leaf__scroller"
          onScroll={() => { measure(); }}
          onWheel={() => onInteract?.()}
        >
          {page.chapter && <p className="leaf__chapter">{page.chapter}</p>}
          {page.paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        <div className="leaf__fade" aria-hidden />

        <button
          type="button"
          className="leaf__turn leaf__turn--prev"
          onClick={() => turn(-1)}
          disabled={!canPrev}
          aria-label="Previous page"
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
        <button
          type="button"
          className="leaf__turn leaf__turn--next"
          onClick={() => turn(1)}
          disabled={!canNext}
          aria-label="Next page"
        >
          <ChevronRight size={22} aria-hidden />
        </button>

        <span className="leaf__hint" aria-hidden>
          {more ? "drag up for more · " : ""}turn at the edges
        </span>
        <span className="leaf__folio" aria-hidden>
          — {page.number} —
        </span>
      </div>
    </div>
  );
}
