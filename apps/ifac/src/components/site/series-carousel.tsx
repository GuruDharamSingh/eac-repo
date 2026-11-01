"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The series cards on /series (2026-10-18; developer: mockup B's cards, as
 * a carousel once there are more than fit). Two cards share the row on wide
 * screens, one on phones; past that the row scrolls sideways (swipe, the
 * arrow buttons, or the keyboard), snapping card by card. With one or two
 * series nothing moves and no arrows show.
 */
export function SeriesCarousel({ children, count }: { children: ReactNode; count: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  function step(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const width = card ? card.getBoundingClientRect().width + 24 : el.clientWidth;
    el.scrollBy({ left: dir * width, behavior: "smooth" });
  }

  const scrolls = !(edges.start && edges.end);
  return (
    <div className={`isx-carousel${count === 1 ? " is-single" : ""}`}>
      <div ref={track} className="isx-carousel__track" role="list" aria-label="Series">
        {children}
      </div>
      {scrolls && (
        <div className="isx-carousel__nav">
          <button type="button" className="ifs-btn ifs-btn--small" aria-label="Previous series" disabled={edges.start} onClick={() => step(-1)}>
            ‹
          </button>
          <button type="button" className="ifs-btn ifs-btn--small" aria-label="Next series" disabled={edges.end} onClick={() => step(1)}>
            ›
          </button>
        </div>
      )}
    </div>
  );
}
